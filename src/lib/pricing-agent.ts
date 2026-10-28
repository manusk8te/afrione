import { Agent, AgentInputItem, Runner, tool, withTrace, getGlobalTraceProvider } from "@openai/agents";
import { z } from "zod";
import { supabaseAdmin } from "./supabase";
import { lookupItemOnJumia } from "./jumia-lookup";
import { SMIG_X2_HORAIRE, CATEGORY_TO_METIER } from "./pricing";
import { FILTRE_CATALOGUE_VALIDE } from "./catalogue";
import { getStudyEstimate, findPublishedPriceReferences, getPriceContext, getIndicativePriceContext, getPublishedReferenceCatalogue, type StudyEvaluation, type PriceContext } from './pricing-studies';

// ── Fallbacks ────────────────────────────────────────────────────────────────

const FALLBACK_RATES: Record<string, number> = {
  'Plombier': 3200, 'Électricien': 3500, 'Peintre': 2500,
  'Maçon': 2800, 'Menuisier': 3000, 'Climaticien': 4500,
  'Serrurier': 3000, 'Carreleur': 2800,
};

const FALLBACK_MAT: Record<string, number> = {
  'Plomberie': 1500, 'Électricité': 1200, 'Peinture': 2000,
  'Maçonnerie': 2500, 'Menuiserie': 1800, 'Climatisation': 3500,
  'Serrurerie': 1500, 'Carrelage': 2800,
};

// ── Résolution urgence (C4) ─────────────────────────────────────────────────
// Mapping texte libre → enum fait en TypeScript, jamais délégué au modèle.
// Par défaut medium si aucun mot-clé ne matche — jamais low par défaut.

type Urgency = 'low' | 'medium' | 'high' | 'emergency';

const URGENCY_KEYWORDS: Record<'emergency' | 'high' | 'low', string[]> = {
  emergency: ['urgence', 'urgent', 'immédiat', 'immediat', 'critique', 'emergency', 'panne'],
  high:      ['rapide', 'prioritaire', "aujourd'hui", 'vite', 'high'],
  low:       ['flexible', 'pas pressé', 'pas presse', 'quand possible', 'sans urgence', 'low'],
};

function resolveUrgency(raw: string | undefined): Urgency {
  const text = (raw || '').toLowerCase();
  if (URGENCY_KEYWORDS.emergency.some(k => text.includes(k))) return 'emergency';
  if (URGENCY_KEYWORDS.high.some(k => text.includes(k))) return 'high';
  if (URGENCY_KEYWORDS.low.some(k => text.includes(k))) return 'low';
  return 'medium';
}

// ── Résolution taux horaire (C4) ────────────────────────────────────────────
// Résolution déterministe de la source de prix EN AMONT de l'appel agent.
// Priorité : artisan déclaré (résout C-08) > données de zone > moyenne
// nationale > repli marché statique. Plancher SMIG appliqué ici, en code,
// jamais délégué au prompt.

type PriceSource = 'artisan_declare' | 'donnees_zone' | 'moyenne_nationale' | 'fallback_marche';

interface ResolvedRate {
  hourly_rate: number;
  source_tarif: PriceSource;
  rate_floored: boolean;
  nb_observations?: number;
}

function applyFloor(rate: number, source: PriceSource, nb_observations?: number): ResolvedRate {
  return {
    hourly_rate: Math.max(rate, SMIG_X2_HORAIRE),
    source_tarif: source,
    rate_floored: rate < SMIG_X2_HORAIRE,
    nb_observations,
  };
}

async function resolveHourlyRate(metier: string, zone: string, artisan_id?: string): Promise<ResolvedRate> {
  // 1. Tarif déclaré par l'artisan lui-même — priorité absolue (C-08)
  if (artisan_id) {
    const { data } = await supabaseAdmin
      .from('artisan_pros')
      .select('tarif_min')
      .eq('id', artisan_id)
      .maybeSingle();

    if (data?.tarif_min && data.tarif_min > 0) {
      return applyFloor(data.tarif_min, 'artisan_declare');
    }
  }

  // 2. Données terrain réelles pour la zone
  const { data: zoneData } = await supabaseAdmin
    .from('pricing_reference')
    .select('taux_horaire, nb_observations')
    .eq('metier', metier)
    .eq('zone', zone);

  if (zoneData?.length) {
    const total = zoneData.reduce((s, r) => s + r.nb_observations, 0);
    const rate = Math.round(zoneData.reduce((s, r) => s + r.taux_horaire * r.nb_observations, 0) / total);
    return applyFloor(rate, 'donnees_zone', total);
  }

  // 3. Moyenne nationale
  const { data: national } = await supabaseAdmin
    .from('pricing_reference')
    .select('taux_horaire, nb_observations')
    .eq('metier', metier);

  if (national?.length) {
    const total = national.reduce((s, r) => s + r.nb_observations, 0);
    const rate = Math.round(national.reduce((s, r) => s + r.taux_horaire * r.nb_observations, 0) / total);
    return applyFloor(rate, 'moyenne_nationale', total);
  }

  // 4. Repli marché statique
  const { data: labor } = await supabaseAdmin
    .from('labor_rates')
    .select('tarif_horaire')
    .eq('metier', metier)
    .maybeSingle();

  return applyFloor(labor?.tarif_horaire || FALLBACK_RATES[metier] || 3000, 'fallback_marche');
}

// ── Tools ────────────────────────────────────────────────────────────────────

const searchMaterialPrice = tool({
  name: "search_material_price",
  description: "Cherche le prix réel d'un matériau sur Jumia CI et dans la base AfriOne. Appeler pour chaque matériau mentionné.",
  parameters: z.object({
    item:     z.string().describe("Nom du matériau (ex: joint plomberie, câble 2.5mm)"),
    category: z.string().describe("Catégorie métier (ex: Plomberie, Électricité, Peinture)"),
    qty:      z.number().optional().describe("Quantité nécessaire (défaut: 1)"),
  }),
  execute: async ({ item, category, qty = 1 }) => {
    // 1. Base AfriOne — ORDER BY déterministe : sans lui, deux appels
    // identiques peuvent renvoyer des lignes différentes en Postgres.
    // Articles admis seulement : un prix déclaré par un artisan et non encore
    // validé par un admin ne doit pas entrer dans un devis. Voir
    // src/lib/catalogue.ts.
    const { data: cached } = await supabaseAdmin
      .from('price_materials')
      .select('id, price_market, source, name')
      .ilike('name', `%${item}%`)
      .or(FILTRE_CATALOGUE_VALIDE)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return { item, qty, price_unit: cached.price_market, total: cached.price_market * qty, source: cached.source || 'Base AfriOne', product_name: cached.name, is_fallback: false };
    }

    // 2. Jumia CI live
    const jumia = await lookupItemOnJumia(item, category);
    if (jumia.found && jumia.price) {
      return { item, qty, price_unit: jumia.price, total: jumia.price * qty, source: 'Jumia CI', product_name: jumia.name, is_fallback: false };
    }

    // 3. Fallback catégorie — marqué explicitement comme tel, jamais présenté comme un prix trouvé
    const fallback = FALLBACK_MAT[category] || 1500;
    return { item, qty, price_unit: fallback, total: fallback * qty, source: 'Estimation marché Abidjan', is_fallback: true };
  },
});

interface PricingContext {
  hours: number;
  hourly_rate: number;
  urgency: Urgency;
  quartier: string;
}

type CalculatedQuote = Pick<z.infer<typeof pricingOutputSchema>, 'total' | 'fourchette' | 'artisan_percoit' | 'breakdown'>;

function createCalculateFinalPrice(context?: PricingContext, onCalculated?: (value: CalculatedQuote) => void, getContext?: () => PriceContext | null) {
  return tool({
  name: "calculate_final_price",
  description: "Applique au prix proposé le résultat V4 de la référence comparable sélectionnée. Aucun frais ni fourniture ajouté automatiquement ; ventilation inconnue.",
  parameters: z.object({
    hours:           z.number().positive().finite().describe("Durée en heures"),
    hourly_rate:     z.number().nonnegative().finite().describe("Taux horaire FCFA déjà résolu, donné dans le contexte"),
    materials_total: z.number().nonnegative().finite().describe("Total matériaux FCFA"),
    urgency:         z.enum(['low', 'medium', 'high', 'emergency']).optional().describe("Urgence déjà résolue, donnée dans le contexte"),
    quartier:        z.string().optional().describe("Quartier client Abidjan"),
  }),
  execute: async (args) => {
    const priceContext = getContext?.();
    const candidate = priceContext && 'candidate_price_fcfa' in priceContext ? priceContext.candidate_price_fcfa : null;
    if (priceContext?.status !== 'contextualisation_experimentale' || typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate <= 0) {
      throw new Error('Référence comparable, durée et quantité nécessaires avant de proposer un prix');
    }
    // La V4 porte sur la prestation : ne pas fabriquer une ventilation, ni doubler les fournitures/frais.
    const total = Math.max(1, Math.round(candidate));
    const calculated: CalculatedQuote = {
      total, fourchette: { min: total, max: total }, artisan_percoit: null,
      breakdown: { main_oeuvre: null, materiaux: null, transport: null,
        commission_afrione: null, assurance_sav: null, degressivite: null, urgence: null },
    };
    onCalculated?.(calculated);
    return calculated;
  },
});
}

// ── Sortie structurée (C3) ──────────────────────────────────────────────────
// Remplace le JSON.parse manuel sur output_text par un schéma zod appliqué
// nativement par le SDK. Plus de fallback silencieux à total:0 : un échec
// de run ou de validation lève désormais une erreur.

const pricingOutputSchema = z.object({
  total:           z.number(),
  fourchette:      z.object({ min: z.number(), max: z.number() }),
  artisan_percoit: z.number().nullable(),
  breakdown: z.object({
    main_oeuvre:        z.number().nullable(),
    degressivite:       z.string().nullable(),
    urgence:             z.string().nullable(),
    materiaux:           z.number().nullable(),
    transport:           z.number().nullable(),
    commission_afrione:  z.number().nullable(),
    assurance_sav:       z.number().nullable(),
  }),
  // Injecté/écrasé côté TypeScript après le run — voir runPricingAgent.
  // Conservé dans le schéma pour que le modèle le reporte de façon cohérente.
  source_tarif:      z.enum(['artisan_declare', 'donnees_zone', 'moyenne_nationale', 'fallback_marche', 'reference_transferee']),
  version_reference: z.string(),
  data_note:         z.string().min(1).describe(
    "Toujours renseigné. Explique la référence transférée, la comparaison et les limites. Tout matériau is_fallback:true est une estimation, jamais un prix trouvé."
  ),
});

export type PricingAgentOutput = z.infer<typeof pricingOutputSchema> & {
  study: StudyEvaluation | null;
  price_context: PriceContext | null;
  applied_estimator: 'context_v4';
  calculation_source: 'calculate_final_price';
};

// ── Agent ────────────────────────────────────────────────────────────────────
// Prompt réduit (C4) : la résolution du taux horaire et de l'urgence se fait
// en amont, en TypeScript. L'agent ne fait plus que chercher les matériaux,
// calculer le prix final, et rédiger data_note.

function createAfrioneAgent(onStudy: (value: StudyEvaluation) => void, hours?: number, context?: PricingContext, onPriceContext?: (value: PriceContext) => void, onCalculated?: (value: CalculatedQuote) => void) {
  let selectedContext: PriceContext | null = null;
  const searchPriceReference = tool({
    name: 'search_price_reference',
    description: 'Retrouve des prix publiés en France et au Sénégal, avec unité, périmètre, URL et identifiant. Compare les caractéristiques au besoin client avant de choisir une référence. La recherche ne décide pas du diagnostic.',
    parameters: z.object({ query: z.string().min(1) }),
    execute: async ({ query }) => ({
      matches: findPublishedPriceReferences(query),
      catalogue: getPublishedReferenceCatalogue(),
      instruction: 'Choisir une référence réellement comparable dans le catalogue, y compris par synonymes. Ne jamais inventer un identifiant.',
    }),
  });
  const contextualizeReferencePrice = tool({
    name: 'contextualize_reference_price',
    description: 'Applique la fonction statistique de contexte France/Sénégal vers Côte d’Ivoire à une référence publiée. La mission est comprise par l’agent ; le moteur ne contient aucun coefficient par nom de tâche. D est appris sur les erreurs hors apprentissage. Expérimental : ne pas transformer le résultat en tarif de main-d’œuvre seule.',
    parameters: z.object({
      reference_id: z.string().describe('Identifiant obtenu dans search_price_reference, jamais un prix inventé'),
      hours: z.number().positive(),
      quantity: z.number().positive().describe('Quantité explicitement fournie pour l’unité publiée : surface en m², convives, unités ; durée pour heure. Ne pas inventer une surface.'),
      match_reason: z.string().min(15).describe('Comparaison technique, différences, périmètre et provenance de la quantité dans la demande'),
    }),
    execute: async ({ reference_id, hours: requestedHours, quantity, match_reason }) => {
      const value = getIndicativePriceContext(reference_id, hours ?? requestedHours, quantity, match_reason);
      selectedContext = value;
      onPriceContext?.(value);
      return value;
    },
  });
  const estimateServicePrice = tool({
    name: 'estimate_service_price',
    description: 'Exécute les estimateurs déjà calculés dans les études AfriOne (médiane, OLS, transfert quantile). Retourne leurs versions, sources, limites et scores. Comparaison seulement : les montants ne sont pas des tarifs de main-d’œuvre seule et ne remplacent pas le taux horaire.',
    parameters: z.object({
      mission: z.string().describe('Intitulé exact de la mission. Si inconnue, ne pas forcer un rapprochement.'),
      hours: z.number().positive().describe('Durée estimée en heures'),
    }),
    execute: async ({ mission, hours: requestedHours }) => {
      const evaluation = getStudyEstimate(mission, hours ?? requestedHours);
      onStudy(evaluation);
      return evaluation;
    },
  });
  const requestPricingDetails = tool({
    name: 'request_pricing_details',
    description: 'Demande une précision indispensable pour chiffrer : quantité, dimension ou caractéristique manquante, ou absence de référence comparable. Aucun prix inventé.',
    parameters: z.object({ question: z.string().min(10).max(500) }),
    execute: async ({ question }) => {
      const value = { ...getPriceContext('', hours ?? 1), status: 'devis_requis', reason: question };
      selectedContext = value;
      onPriceContext?.(value);
      return value;
    },
  });
  return new Agent({
  name: "afrione",
  instructions: `Tu es l'agent de tarification AfriOne pour le marché informel d'Abidjan, Côte d'Ivoire.

Processus :
1. Comprends la mission, ses dimensions et ses fournitures. Cherche les références avec search_price_reference : le catalogue complet est disponible, pas seulement les cinq tâches de l’enquête. Choisis une référence techniquement comparable, même si les mots diffèrent, et explique précisément les différences. Une différence de métier seule n’est pas une analogie valable.
2. Appelle contextualize_reference_price avec l’identifiant publié, la durée fournie, la quantité correspondant à l’unité source et une justification technique. Pour une seule intervention/unité demandée, quantity=1 ; pour heure, quantity=durée ; pour m², mètres linéaires, convives, plusieurs unités, il faut une quantité explicite dans la demande. Sans quantité, référence comparable ou résultat exploitable, appelle request_pricing_details pour poser la question précise, puis retourne sans calculate_final_price. Les contrats annuels nécessitent un devis.
3. Le résultat V4 est la proposition indicative réellement affichée. Appelle calculate_final_price après une contextualisation réussie. Cet outil applique la V4 en code ; ses anciens paramètres horaires ne modifient plus le montant. Recopie exactement ses montants et ses valeurs nulles.
4. Les fournitures peuvent être recherchées avec search_material_price à titre informatif, mais ne sont pas additionnées au prix V4 : les données sources ont des périmètres variables. La ventilation main-d’œuvre, transport, fournitures, commissions et rémunération est inconnue, donc nulle. Ne fabrique ni frais ni intervalle de confiance.
5. Explique dans data_note la référence, la quantité, la comparaison, la nature indicative et la nécessité d’un devis. Sur une tâche sans calibration locale, dis clairement « estimation par analogie, non validée localement ». La réduction V4 ne garantit pas d’être sous le marché ivoirien ni la viabilité économique. Ne prétends pas que le modèle apprend automatiquement : une nouvelle version doit être réentraînée et vérifiée sur les retours réels.

Règle absolue : les prix viennent toujours des outils, jamais inventés.`,
  model: "gpt-4o-mini",
  tools: [requestPricingDetails, searchPriceReference, contextualizeReferencePrice, estimateServicePrice, searchMaterialPrice, createCalculateFinalPrice(context, onCalculated, () => selectedContext)],
  outputType: pricingOutputSchema,
  modelSettings: { store: true },
});
}

// ── Runner ───────────────────────────────────────────────────────────────────

type WorkflowInput = { input_as_text: string };

// Étapes du run (appels d'outils + résultats) extraites pour le journal local
export type AgentStep = { type: string; name?: string; arguments?: any; output?: any };

function extractSteps(newItems: any[]): AgentStep[] {
  return newItems.map((item: any) => {
    const raw = item.rawItem ?? {};
    if (raw.type === 'function_call') {
      let args: any = raw.arguments;
      try { args = JSON.parse(raw.arguments) } catch {}
      return { type: 'tool_call', name: raw.name, arguments: args };
    }
    if (raw.type === 'function_call_result' || raw.type === 'function_call_output') {
      let out: any = raw.output?.text ?? raw.output;
      try { if (typeof out === 'string') out = JSON.parse(out) } catch {}
      return { type: 'tool_result', name: raw.name, output: out };
    }
    return { type: raw.type || item.type || 'item' };
  });
}

export const runWorkflow = async (workflow: WorkflowInput, hours?: number, context?: PricingContext) => {
  let study: StudyEvaluation | null = null;
  let priceContext: PriceContext | null = null;
  let calculatedPrice: CalculatedQuote | null = null;
  const afrione = createAfrioneAgent(value => { study = value; }, hours, context, value => { priceContext = value; calculatedPrice = null; }, value => { calculatedPrice = value; });
  try {
    return await withTrace("AfriOne Pricing Agent", async () => {
      const conversationHistory: AgentInputItem[] = [
        { role: "user", content: [{ type: "input_text", text: workflow.input_as_text }] },
      ];

      const runner = new Runner();

      const result = await runner.run(afrione, [...conversationHistory]);

      if (!result.finalOutput) {
        throw new Error("Agent result is undefined");
      }
      if (!study && !priceContext) throw new Error('Études non consultées : contextualisation ou estimate_service_price requis');
      if (!calculatedPrice) {
        if (priceContext && 'reason' in priceContext && priceContext.reason) throw new Error(`informations_requises: ${priceContext.reason}`);
        throw new Error('Calcul final non exécuté : calculate_final_price requis');
      }

      return {
        // L’IA rédige et choisit les outils ; les montants restent ceux du calcul exécuté.
        output: { ...result.finalOutput, ...(calculatedPrice as CalculatedQuote) },
        steps: extractSteps(result.newItems ?? []),
        study,
        price_context: priceContext,
      };
    });
  } finally {
    // Vercel gèle la function dès que la réponse part — le BatchTraceProcessor
    // n'a jamais le temps d'exporter. Flush obligatoire AVANT de répondre,
    // sinon aucune trace n'apparaît sur platform.openai.com/traces.
    await getGlobalTraceProvider().forceFlush().catch(() => {});
  }
};

// ── Interface publique ───────────────────────────────────────────────────────

export interface AgentPricingInput {
  category:       string;
  description:    string;
  items_needed:   string[];
  hours_estimate: number;
  quartier:       string;
  urgency:        string;
  artisan_id?:    string;
}

export async function runPricingAgent(input: AgentPricingInput): Promise<PricingAgentOutput> {
  const metier  = CATEGORY_TO_METIER[input.category] || input.category;
  const urgency = resolveUrgency(input.urgency);
  const rate    = await resolveHourlyRate(metier, input.quartier, input.artisan_id);

  const { data: examples } = await supabaseAdmin
    .from('accepted_prices')
    .select('quartier, urgency, hours, materials_count, description_short, final_price')
    .eq('category', input.category)
    .order('created_at', { ascending: false })
    .limit(5);

  const examplesBlock = examples?.length
    ? `\nMissions ${input.category} récemment acceptées (calibre ton prix) :\n` +
      examples.map(e =>
        `- ${e.quartier} · ${e.urgency} · ${e.hours}h · ${e.materials_count} mat.${e.description_short ? ` · "${e.description_short}"` : ''} → ${e.final_price.toLocaleString('fr')} FCFA ✓`
      ).join('\n')
    : '';

  const text = `Calcule le prix AfriOne pour :
- Métier : ${metier}
- Description : ${input.description}
- Matériaux : ${input.items_needed.join(', ') || 'aucun'}
- Durée estimée : ${input.hours_estimate}h
- Quartier client : ${input.quartier}
- Taux horaire résolu : ${rate.hourly_rate} FCFA/h (source : ${rate.source_tarif}${rate.rate_floored ? ', plancher SMIG appliqué' : ''}${rate.nb_observations ? `, ${rate.nb_observations} observations` : ''})
- Urgence résolue : ${urgency}${input.artisan_id ? `\n- Artisan ID : ${input.artisan_id}` : ''}${examplesBlock}`;

  const startedAt = Date.now();
  let result: Awaited<ReturnType<typeof runWorkflow>> | null = null;
  let runError: string | null = null;

  try {
    result = await runWorkflow({ input_as_text: text }, input.hours_estimate, {
      hours: input.hours_estimate, hourly_rate: rate.hourly_rate, urgency, quartier: input.quartier,
    });
  } catch (err: any) {
    runError = err?.message || 'run_failed';
  }

  // Journal local du run — observabilité indépendante d'OpenAI (table agent_runs).
  // Awaité : en serverless, un insert fire-and-forget serait perdu au gel de la function.
  await supabaseAdmin.from('agent_runs').insert({
    agent_name:  'pricing',
    model:       'gpt-4o-mini',
    input:       { category: input.category, metier, quartier: input.quartier, urgency, hours: input.hours_estimate, items: input.items_needed, artisan_id: input.artisan_id ?? null, source_tarif: rate.source_tarif, hourly_rate: rate.hourly_rate, prompt: text },
    steps:       result?.steps ?? [],
    output:      result ? { ...result.output, study: result.study, price_context: result.price_context, applied_estimator: 'context_v4', calculation_source: 'calculate_final_price' } : null,
    total_price: result?.output?.total ?? null,
    parse_ok:    result != null,
    error:       runError,
    duration_ms: Date.now() - startedAt,
  }).then(({ error }) => {
    if (error) console.warn('[agent_runs] insert failed:', error.message);
  });

  // Plus de fallback silencieux à total:0 — un échec de run lève une erreur.
  if (runError || !result) {
    throw new Error(runError || 'pricing_agent_failed');
  }

  // source_tarif et version_reference sont des faits résolus en TypeScript,
  // jamais laissés au jugement du modèle : on les écrase après coup pour
  // garantir la cohérence même si le modèle a mal recopié le contexte.
  return {
    ...result.output,
    source_tarif: 'reference_transferee',
    version_reference: result.price_context?.version ?? 'context-v4',
    data_note: result.output.data_note + ' Prix V4 indicatif appliqué à la prestation ; fournitures et frais non ventilés, à confirmer par devis.',
    study: result.study,
    price_context: result.price_context,
    applied_estimator: 'context_v4',
    calculation_source: 'calculate_final_price',
  };
}
