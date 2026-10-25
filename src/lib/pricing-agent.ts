import { Agent, AgentInputItem, Runner, tool, withTrace, getGlobalTraceProvider } from "@openai/agents";
import { z } from "zod";
import { supabaseAdmin } from "./supabase";
import { lookupItemOnJumia } from "./jumia-lookup";
import { SMIG_X2_HORAIRE, CATEGORY_TO_METIER, computeLabor } from "./pricing";
import { FILTRE_CATALOGUE_VALIDE } from "./catalogue";
import { getTransport } from "./transport";
import { getStudyEstimate, findPublishedPriceReferences, getPriceContext, type StudyEvaluation, type PriceContext } from './pricing-studies';
import { lockPricingInputs } from './pricing-studies/engine.mjs';

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

function createCalculateFinalPrice(context?: PricingContext) {
  return tool({
  name: "calculate_final_price",
  description: "Calcule le prix final AfriOne avec dégressivité longues tâches + commission. Appeler après avoir tous les prix. Utilise le taux horaire et l'urgence donnés dans le contexte, ne les recalcule jamais.",
  parameters: z.object({
    hours:           z.number().describe("Durée en heures"),
    hourly_rate:     z.number().describe("Taux horaire FCFA déjà résolu, donné dans le contexte"),
    materials_total: z.number().describe("Total matériaux FCFA"),
    urgency:         z.enum(['low', 'medium', 'high', 'emergency']).optional().describe("Urgence déjà résolue, donnée dans le contexte"),
    quartier:        z.string().optional().describe("Quartier client Abidjan"),
  }),
  execute: async (args) => {
    const { hours, hourly_rate, materials_total, urgency = 'medium', quartier = 'Cocody' } = lockPricingInputs(context, args);
    // Plancher SMIG appliqué en code par défense en profondeur (déjà garanti en amont par resolveHourlyRate)
    const flooredRate = Math.max(hourly_rate, SMIG_X2_HORAIRE);

    // Plus de plafond à 30 000 : voir computeLabor (src/lib/pricing.ts). La
    // formule était recopiée ici et dans /api/tools/calculate-price — deux
    // copies d'un même calcul de rémunération, à corriger deux fois.
    const { labor: labor_base, degressif } = computeLabor(flooredRate, hours);
    const urgency_pct = urgency === 'emergency' ? 0.40 : urgency === 'high' ? 0.25 : 0;
    const labor_final = Math.round(labor_base * (1 + urgency_pct));
    const transport   = getTransport(quartier);
    const subtotal    = labor_final + (materials_total || 0) + transport;
    // ⚠️ Seul endroit qui décompose commission ET assurance, conformément à
    // `service_fees` — mais avec les taux recopiés en dur, et les routes de
    // paiement n'appliquent pas la même chose. Voir docs/COMMISSIONS.md.
    const commission  = Math.round(subtotal * 0.10);
    const assurance   = Math.round(subtotal * 0.02);
    const total       = subtotal + commission + assurance;

    return {
      breakdown: {
        main_oeuvre: labor_final,
        degressivite: degressif < 1 ? `-${Math.round((1 - degressif) * 100)}% longue tâche` : null,
        urgence: urgency_pct > 0 ? `+${urgency_pct * 100}%` : null,
        materiaux: materials_total || 0,
        transport,
        commission_afrione: commission,
        assurance_sav: assurance,
      },
      total,
      fourchette:      { min: Math.round(total * 0.92), max: Math.round(total * 1.08) },
      artisan_percoit: Math.round(total * 0.88),
    };
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
  artisan_percoit: z.number(),
  breakdown: z.object({
    main_oeuvre:        z.number(),
    degressivite:       z.string().nullable(),
    urgence:             z.string().nullable(),
    materiaux:           z.number(),
    transport:           z.number(),
    commission_afrione:  z.number(),
    assurance_sav:       z.number(),
  }),
  // Injecté/écrasé côté TypeScript après le run — voir runPricingAgent.
  // Conservé dans le schéma pour que le modèle le reporte de façon cohérente.
  source_tarif:      z.enum(['artisan_declare', 'donnees_zone', 'moyenne_nationale', 'fallback_marche']),
  version_reference: z.string(),
  data_note:         z.string().min(1).describe(
    "Toujours renseigné. Explique la source du taux horaire donné. Signale explicitement tout matériau au prix marqué is_fallback:true (jamais présenté comme un prix trouvé)."
  ),
});

export type PricingAgentOutput = z.infer<typeof pricingOutputSchema> & {
  study: StudyEvaluation | null;
  price_context: PriceContext | null;
  applied_estimator: 'legacy_hourly';
};

// ── Agent ────────────────────────────────────────────────────────────────────
// Prompt réduit (C4) : la résolution du taux horaire et de l'urgence se fait
// en amont, en TypeScript. L'agent ne fait plus que chercher les matériaux,
// calculer le prix final, et rédiger data_note.

function createAfrioneAgent(onStudy: (value: StudyEvaluation) => void, hours?: number, context?: PricingContext, onPriceContext?: (value: PriceContext) => void) {
  const searchPriceReference = tool({
    name: 'search_price_reference',
    description: 'Retrouve des prix publiés en France et au Sénégal, avec unité, périmètre, URL et identifiant. Compare les caractéristiques au besoin client avant de choisir une référence. La recherche ne décide pas du diagnostic.',
    parameters: z.object({ query: z.string().min(1) }),
    execute: async ({ query }) => findPublishedPriceReferences(query),
  });
  const contextualizeReferencePrice = tool({
    name: 'contextualize_reference_price',
    description: 'Applique la fonction statistique de contexte France/Sénégal vers Côte d’Ivoire à une référence publiée. La mission est comprise par l’agent ; le moteur ne contient aucun coefficient par nom de tâche. D est appris sur les erreurs hors apprentissage. Expérimental : ne pas transformer le résultat en tarif de main-d’œuvre seule.',
    parameters: z.object({
      reference_id: z.string().describe('Identifiant obtenu dans search_price_reference, jamais un prix inventé'),
      hours: z.number().positive(),
    }),
    execute: async ({ reference_id, hours: requestedHours }) => {
      const value = getPriceContext(reference_id, hours ?? requestedHours);
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
  return new Agent({
  name: "afrione",
  instructions: `Tu es l'agent de tarification AfriOne pour le marché informel d'Abidjan, Côte d'Ivoire.

Le taux horaire et l'urgence sont déjà résolus et te sont donnés dans le message. Ne les recalcule jamais, ne les déduis pas d'autre chose que ce qui t'est donné.

Processus :
0. Comprends la prestation et ses caractéristiques. Appelle search_price_reference, vérifie le périmètre, puis contextualize_reference_price pour obtenir le contexte économique ivoirien. Tu comprends et choisis la référence ; la fonction statistique contextualise son prix. Si aucune référence n'est comparable, ne force pas le rapprochement et consulte estimate_service_price pour documenter l'absence de couverture. Ce dernier outil conserve les études antérieures. Ne rapproche pas un mitigeur de cuisine d'une référence de lavabo sans signaler cette différence.
1. Pour chaque matériau nécessaire, appelle search_material_price.
2. Appelle calculate_final_price avec le taux horaire donné, hours, materials_total, l'urgence donnée telle quelle, et le quartier.
3. Rédige data_note : mentionne toujours la source du taux horaire donnée dans le message (et si un plancher a été appliqué), et signale explicitement tout matériau dont le résultat a is_fallback:true — ce n'est pas un prix trouvé, ne le présente jamais comme tel.
4. Signale que le devis courant reste fondé sur le moteur horaire existant. Les résultats statistiques sont une comparaison expérimentale, pas une main-d’œuvre à additionner aux fournitures. Ne remplace jamais hourly_rate par un montant retourné par estimate_service_price. Ne fabrique pas d'intervalle de confiance à partir d'une MAE.

Règle absolue : les prix viennent toujours des outils, jamais inventés.`,
  model: "gpt-4o-mini",
  tools: [searchPriceReference, contextualizeReferencePrice, estimateServicePrice, searchMaterialPrice, createCalculateFinalPrice(context)],
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
  const afrione = createAfrioneAgent(value => { study = value; }, hours, context, value => { priceContext = value; });
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

      return {
        output: result.finalOutput,
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
    output:      result ? { ...result.output, study: result.study, price_context: result.price_context, applied_estimator: 'legacy_hourly' } : null,
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
    source_tarif: rate.source_tarif,
    version_reference: 'hourly-fallback-v1', // pas de catalogue de tâches tant que C2 n'est pas fait
    data_note: result.output.data_note + ' Les études sont consultées en comparaison expérimentale ; leurs montants ne sont pas appliqués comme main-d’œuvre seule.',
    study: result.study,
    price_context: result.price_context,
    applied_estimator: 'legacy_hourly',
  };
}
