import { Agent, AgentInputItem, Runner, tool, withTrace } from "@openai/agents";
import { z } from "zod";
import { supabaseAdmin } from "./supabase";
import { lookupItemOnJumia } from "./jumia-lookup";
import { SMIG_X2_HORAIRE, CATEGORY_TO_METIER } from "./pricing";
import { getTransport } from "./transport";

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

const TRANSPORT: Record<string, number> = {
  'Cocody': 1000, 'Plateau': 800, 'Adjamé': 900, 'Yopougon': 1500,
  'Abobo': 1800, 'Marcory': 1000, 'Treichville': 800, 'Koumassi': 1200,
  'Port-Bouët': 1400, 'Bingerville': 2000, 'Riviera': 1200,
  'Zone 4': 900, 'Deux-Plateaux': 1100, 'Angré': 1300,
};

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
    // 1. Base AfriOne
    const { data: cached } = await supabaseAdmin
      .from('price_materials')
      .select('price_market, source, name')
      .ilike('name', `%${item}%`)
      .limit(1)
      .maybeSingle();

    if (cached) {
      return { item, qty, price_unit: cached.price_market, total: cached.price_market * qty, source: cached.source || 'Base AfriOne', product_name: cached.name };
    }

    // 2. Jumia CI live
    const jumia = await lookupItemOnJumia(item, category);
    if (jumia.found && jumia.price) {
      return { item, qty, price_unit: jumia.price, total: jumia.price * qty, source: 'Jumia CI', product_name: jumia.name };
    }

    // 3. Fallback catégorie
    const fallback = FALLBACK_MAT[category] || 1500;
    return { item, qty, price_unit: fallback, total: fallback * qty, source: 'Estimation marché Abidjan' };
  },
});

const getArtisanRate = tool({
  name: "get_artisan_rate",
  description: "Récupère le taux horaire réel de l'artisan depuis AfriOne. Appeler en premier avant tout calcul.",
  parameters: z.object({
    metier:     z.string().describe("Métier (ex: Plombier, Électricien, Maçon)"),
    artisan_id: z.string().optional().describe("ID artisan si disponible"),
  }),
  execute: async ({ metier, artisan_id }) => {
    if (artisan_id) {
      const { data } = await supabaseAdmin
        .from('artisan_pros')
        .select('tarif_min, years_experience')
        .eq('id', artisan_id)
        .maybeSingle();

      if (data?.tarif_min && data.tarif_min >= SMIG_X2_HORAIRE) {
        return { rate: data.tarif_min, years_exp: data.years_experience ?? 3, source: "Déclaré par l'artisan", smig_floor: SMIG_X2_HORAIRE };
      }
    }

    const { data: labor } = await supabaseAdmin
      .from('labor_rates')
      .select('tarif_horaire')
      .eq('metier', metier)
      .maybeSingle();

    const rate = Math.max(labor?.tarif_horaire || FALLBACK_RATES[metier] || 3000, SMIG_X2_HORAIRE);
    return { rate, source: labor ? 'Référence AfriOne' : 'Référence marché', smig_floor: SMIG_X2_HORAIRE };
  },
});

const calculateFinalPrice = tool({
  name: "calculate_final_price",
  description: "Calcule le prix final AfriOne avec dégressivité longues tâches + commission. Appeler après avoir tous les prix.",
  parameters: z.object({
    hours:           z.number().describe("Durée en heures"),
    hourly_rate:     z.number().describe("Taux horaire FCFA"),
    materials_total: z.number().describe("Total matériaux FCFA"),
    urgency:         z.enum(['low', 'medium', 'high', 'emergency']).optional(),
    quartier:        z.string().optional().describe("Quartier client Abidjan"),
  }),
  execute: async ({ hours, hourly_rate, materials_total, urgency = 'medium', quartier = 'Cocody' }) => {
    const LABOR_CAP   = 30_000;
    const degressif   = hours <= 2 ? 1.0 : hours <= 4 ? 0.85 : hours <= 8 ? 0.70 : 0.60;
    const labor_base  = Math.min(Math.round(hourly_rate * hours * degressif), LABOR_CAP);
    const urgency_pct = urgency === 'emergency' ? 0.40 : urgency === 'high' ? 0.25 : 0;
    const labor_final = Math.round(labor_base * (1 + urgency_pct));
    const transport   = getTransport(quartier);
    const subtotal    = labor_final + (materials_total || 0) + transport;
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

// ── Agent ────────────────────────────────────────────────────────────────────

const afrione = new Agent({
  name: "afrione",
  instructions: `Tu es l'agent de pricing d'AfriOne, plateforme d'artisans à Abidjan, Côte d'Ivoire.

Quand on te demande de calculer le prix d'une prestation :
1. Appelle get_artisan_rate pour obtenir le vrai taux horaire
2. Pour chaque matériau mentionné, appelle search_material_price
3. Additionne tous les matériaux
4. Appelle calculate_final_price avec les chiffres réels
5. Réponds avec le détail du prix en français clair

Règles absolues :
- Taux horaire minimum = 866 FCFA/h (SMIG × 2 Côte d'Ivoire)
- Les prix viennent toujours des outils, jamais inventés
- Toujours montrer le détail : main d'œuvre + matériaux + transport + commission AfriOne (10%) + assurance (2%)
- L'artisan perçoit 88% du total
- Répondre en JSON : { total, fourchette: {min, max}, artisan_percoit, breakdown, explanation }`,
  model: "gpt-4o-mini",
  tools: [searchMaterialPrice, getArtisanRate, calculateFinalPrice],
  modelSettings: {
    store: true,
  },
});

// ── Runner ───────────────────────────────────────────────────────────────────

type WorkflowInput = { input_as_text: string };

export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace("AfriOne Pricing Agent", async () => {
    const conversationHistory: AgentInputItem[] = [
      { role: "user", content: [{ type: "input_text", text: workflow.input_as_text }] },
    ];

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_6a084fa83e648190a097efab184635fb012d5e5358b9e872",
      },
    });

    const result = await runner.run(afrione, [...conversationHistory]);
    conversationHistory.push(...result.newItems.map((item) => item.rawItem as AgentInputItem));

    if (!result.finalOutput) {
      throw new Error("Agent result is undefined");
    }

    return { output_text: result.finalOutput ?? "" };
  });
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

export async function runPricingAgent(input: AgentPricingInput) {
  const metier = CATEGORY_TO_METIER[input.category] || input.category;

  const text = `Calcule le prix pour cette prestation :
- Métier : ${metier}
- Description : ${input.description}
- Matériaux : ${input.items_needed.join(', ') || 'aucun'}
- Durée : ${input.hours_estimate}h
- Quartier : ${input.quartier}
- Urgence : ${input.urgency}
${input.artisan_id ? `- Artisan ID : ${input.artisan_id}` : ''}`;

  const result = await runWorkflow({ input_as_text: text });

  try {
    const cleaned = result?.output_text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '';
    return JSON.parse(cleaned);
  } catch {
    return { explanation: result?.output_text || '', total: 0, fourchette: { min: 0, max: 0 }, artisan_percoit: 0, breakdown: {} };
  }
}
