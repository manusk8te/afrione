/**
 * AfriOne Pricing Agent — OpenAI function calling
 * L'agent cherche les vrais prix (Jumia CI + Supabase) et calcule avec la formule AfriOne.
 */

import OpenAI from 'openai'
import { supabaseAdmin } from './supabase'
import { lookupItemOnJumia } from './jumia-lookup'
import { CATEGORY_TO_METIER, SMIG_X2_HORAIRE } from './pricing'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Taux horaire de référence par métier (fallback si artisan pas encore en base)
const FALLBACK_RATES: Record<string, number> = {
  'Plombier':    3200,
  'Électricien': 3500,
  'Peintre':     2500,
  'Maçon':       2800,
  'Menuisier':   3000,
  'Climaticien': 4500,
  'Serrurier':   3000,
  'Carreleur':   2800,
}

const TRANSPORT_QUARTIER: Record<string, number> = {
  'Cocody': 1000, 'Plateau': 800, 'Adjamé': 900, 'Yopougon': 1500,
  'Abobo': 1800, 'Marcory': 1000, 'Treichville': 800, 'Koumassi': 1200,
  'Port-Bouët': 1400, 'Bingerville': 2000, 'Riviera': 1200, 'Zone 4': 900,
  'Deux-Plateaux': 1100, 'Angré': 1300,
}

// ── Outils de l'agent ───────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_material_price',
      description: 'Cherche le prix réel d\'un matériau sur Jumia CI et dans la base AfriOne. À appeler pour chaque matériau.',
      parameters: {
        type: 'object',
        properties: {
          item:     { type: 'string',  description: 'Nom du matériau en français (ex: joint plomberie, siphon, câble 2.5mm)' },
          category: { type: 'string',  description: 'Catégorie métier (ex: Plomberie, Électricité, Peinture)' },
          qty:      { type: 'number',  description: 'Quantité nécessaire (défaut: 1)' },
        },
        required: ['item', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_artisan_rate',
      description: 'Récupère le taux horaire réel de l\'artisan depuis AfriOne. Toujours appeler en premier.',
      parameters: {
        type: 'object',
        properties: {
          metier:     { type: 'string', description: 'Métier (ex: Plombier, Électricien, Maçon)' },
          artisan_id: { type: 'string', description: 'ID de l\'artisan si disponible' },
        },
        required: ['metier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_final_price',
      description: 'Calcule le prix final AfriOne. Appeler une fois qu\'on a le taux horaire et le total matériaux.',
      parameters: {
        type: 'object',
        properties: {
          hours:           { type: 'number', description: 'Durée en heures' },
          hourly_rate:     { type: 'number', description: 'Taux horaire en FCFA' },
          materials_total: { type: 'number', description: 'Total matériaux en FCFA' },
          urgency:         { type: 'string', enum: ['low', 'medium', 'high', 'emergency'] },
          quartier:        { type: 'string', description: 'Quartier du client à Abidjan' },
        },
        required: ['hours', 'hourly_rate', 'materials_total'],
      },
    },
  },
]

// ── Exécution des outils ────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  if (name === 'search_material_price') {
    const { item, category, qty = 1 } = args

    // 1. Chercher dans price_materials (déjà scrapé)
    const { data: cached } = await supabaseAdmin
      .from('price_materials')
      .select('price_market, price_min, price_max, source')
      .ilike('name', `%${item}%`)
      .limit(1)
      .maybeSingle()

    if (cached) {
      return JSON.stringify({
        item, qty,
        price_unit: cached.price_market,
        total: cached.price_market * qty,
        source: cached.source || 'Base AfriOne',
      })
    }

    // 2. Scraper Jumia en live
    const jumia = await lookupItemOnJumia(item, category)
    if (jumia.found && jumia.price) {
      return JSON.stringify({
        item, qty,
        price_unit: jumia.price,
        total: jumia.price * qty,
        source: 'Jumia CI',
        product_name: jumia.name,
      })
    }

    // 3. Fallback par catégorie
    const FALLBACK_MAT: Record<string, number> = {
      'Plomberie': 1500, 'Électricité': 1200, 'Peinture': 2000,
      'Maçonnerie': 2500, 'Menuiserie': 1800, 'Climatisation': 3500,
      'Serrurerie': 1500, 'Carrelage': 2800,
    }
    const fallback = FALLBACK_MAT[category] || 1500
    return JSON.stringify({
      item, qty,
      price_unit: fallback,
      total: fallback * qty,
      source: 'Estimation marché Abidjan',
    })
  }

  if (name === 'get_artisan_rate') {
    const { metier, artisan_id } = args

    // Chercher le tarif déclaré par l'artisan
    if (artisan_id) {
      const { data } = await supabaseAdmin
        .from('artisan_pros')
        .select('tarif_min, years_experience')
        .eq('id', artisan_id)
        .maybeSingle()

      if (data?.tarif_min && data.tarif_min >= SMIG_X2_HORAIRE) {
        return JSON.stringify({
          rate: data.tarif_min,
          years_exp: data.years_experience ?? 3,
          source: 'Déclaré par l\'artisan',
          smig_floor: SMIG_X2_HORAIRE,
        })
      }
    }

    // Chercher dans labor_rates
    const { data: labor } = await supabaseAdmin
      .from('labor_rates')
      .select('tarif_horaire, majoration_urgence')
      .eq('metier', metier)
      .maybeSingle()

    const rate = Math.max(labor?.tarif_horaire || FALLBACK_RATES[metier] || 3000, SMIG_X2_HORAIRE)
    return JSON.stringify({
      rate,
      source: labor ? 'Référence AfriOne' : 'Référence marché',
      smig_floor: SMIG_X2_HORAIRE,
    })
  }

  if (name === 'calculate_final_price') {
    const { hours, hourly_rate, materials_total, urgency = 'medium', quartier = 'Cocody' } = args

    // Dégressivité pour les longues tâches
    const degressif = hours <= 2 ? 1.0 : hours <= 4 ? 0.85 : hours <= 8 ? 0.70 : 0.60
    const labor_base = Math.round(hourly_rate * hours * degressif)

    // Majoration urgence
    const urgency_pct = urgency === 'emergency' ? 0.40 : urgency === 'high' ? 0.25 : 0
    const labor_final = Math.round(labor_base * (1 + urgency_pct))

    const transport    = TRANSPORT_QUARTIER[quartier] || 1000
    const subtotal     = labor_final + (materials_total || 0) + transport
    const commission   = Math.round(subtotal * 0.10)
    const assurance    = Math.round(subtotal * 0.02)
    const total        = subtotal + commission + assurance

    return JSON.stringify({
      breakdown: {
        main_oeuvre:      labor_final,
        degressivite:     degressif < 1 ? `${Math.round((1 - degressif) * 100)}% de réduction durée` : null,
        urgence:          urgency_pct > 0 ? `+${urgency_pct * 100}%` : null,
        materiaux:        materials_total || 0,
        transport,
        commission_afrione: commission,
        assurance_sav:    assurance,
      },
      total,
      fourchette:      { min: Math.round(total * 0.92), max: Math.round(total * 1.08) },
      artisan_percoit: Math.round(total * 0.88),
    })
  }

  return JSON.stringify({ error: 'Outil non reconnu' })
}

// ── Interface publique ──────────────────────────────────────────────────────

export interface AgentPricingInput {
  category:       string
  description:    string
  items_needed:   string[]
  hours_estimate: number
  quartier:       string
  urgency:        string
  artisan_id?:    string
}

export interface AgentPricingOutput {
  total:           number
  fourchette:      { min: number; max: number }
  artisan_percoit: number
  breakdown:       Record<string, any>
  explanation:     string
  sources:         string[]
}

export async function runPricingAgent(input: AgentPricingInput): Promise<AgentPricingOutput> {
  const metier = CATEGORY_TO_METIER[input.category] || input.category

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `Tu es l'agent de pricing d'AfriOne, plateforme d'artisans à Abidjan, Côte d'Ivoire.
Ton rôle : calculer le prix juste d'une prestation en utilisant tes outils pour trouver les vrais prix du marché.

PROCESSUS OBLIGATOIRE :
1. Appelle get_artisan_rate en premier
2. Pour chaque matériau dans la liste → appelle search_material_price
3. Additionne tous les totaux matériaux
4. Appelle calculate_final_price avec les vrais chiffres
5. Réponds UNIQUEMENT avec un JSON structuré (pas de texte libre)

FORMAT DE RÉPONSE JSON :
{
  "total": <nombre>,
  "fourchette": { "min": <nombre>, "max": <nombre> },
  "artisan_percoit": <nombre>,
  "breakdown": { ... },
  "explanation": "<explication courte en français pour le client>",
  "sources": ["Jumia CI", "Base AfriOne", ...]
}`,
    },
    {
      role: 'user',
      content: `Calcule le prix pour cette prestation :
- Métier : ${metier}
- Description : ${input.description}
- Matériaux nécessaires : ${input.items_needed.length ? input.items_needed.join(', ') : 'aucun identifié'}
- Durée estimée : ${input.hours_estimate}h
- Quartier : ${input.quartier}
- Urgence : ${input.urgency}
${input.artisan_id ? `- Artisan ID : ${input.artisan_id}` : ''}`,
    },
  ]

  // Boucle agent — max 12 itérations
  for (let i = 0; i < 12; i++) {
    const response = await openai.chat.completions.create({
      model:        'gpt-4o-mini',
      messages,
      tools:        TOOLS,
      tool_choice:  'auto',
      temperature:  0.1,
    })

    const msg    = response.choices[0].message
    const reason = response.choices[0].finish_reason
    messages.push(msg)

    if (reason === 'stop' && msg.content) {
      try {
        const cleaned = msg.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed  = JSON.parse(cleaned)
        return parsed as AgentPricingOutput
      } catch {
        return {
          total:           0,
          fourchette:      { min: 0, max: 0 },
          artisan_percoit: 0,
          breakdown:       {},
          explanation:     msg.content,
          sources:         [],
        }
      }
    }

    if (reason === 'tool_calls' && msg.tool_calls) {
      const results = await Promise.all(
        msg.tool_calls.map(async tc => ({
          role:        'tool' as const,
          tool_call_id: tc.id,
          content:     await executeTool(tc.function.name, JSON.parse(tc.function.arguments)),
        }))
      )
      messages.push(...results)
    }
  }

  return {
    total: 0, fourchette: { min: 0, max: 0 }, artisan_percoit: 0,
    breakdown: {}, explanation: 'Calcul non abouti', sources: [],
  }
}
