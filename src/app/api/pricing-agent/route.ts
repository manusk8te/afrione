import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CATEGORY_TO_METIER, SMIG_X2_HORAIRE } from '@/lib/pricing'
import { supabaseAdmin } from '@/lib/supabase'
import { lookupItemOnJumia } from '@/lib/jumia-lookup'
import { getTransport } from '@/lib/transport'

export const dynamic = 'force-dynamic'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const FALLBACK_RATES: Record<string, number> = {
  'Plombier': 3200, 'Électricien': 3500, 'Peintre': 2500,
  'Maçon': 2800, 'Menuisier': 3000, 'Climaticien': 4500,
  'Serrurier': 3000, 'Carreleur': 2800,
}
const FALLBACK_MAT: Record<string, number> = {
  'Plomberie': 1500, 'Électricité': 1200, 'Peinture': 2000,
  'Maçonnerie': 2500, 'Menuiserie': 1800, 'Climatisation': 3500,
  'Serrurerie': 1500, 'Carrelage': 2800,
}

async function runTool(name: string, args: Record<string, any>): Promise<string> {
  if (name === 'get_pricing_data') {
    const { metier, zone } = args

    // 1. Cherche les données terrain pour ce métier + zone
    const { data: zoneData } = await supabaseAdmin
      .from('pricing_reference')
      .select('taux_horaire, taux_journee, niveau_experience, nb_observations, source')
      .eq('metier', metier)
      .eq('zone', zone)
      .order('nb_observations', { ascending: false })

    if (zoneData && zoneData.length > 0) {
      const totalObs = zoneData.reduce((s, r) => s + r.nb_observations, 0)
      const avgHoraire = Math.round(
        zoneData.reduce((s, r) => s + r.taux_horaire * r.nb_observations, 0) / totalObs
      )
      const avgJournee = Math.round(
        zoneData.reduce((s, r) => s + r.taux_journee * r.nb_observations, 0) / totalObs
      )
      return JSON.stringify({
        metier, zone,
        taux_horaire: avgHoraire,
        taux_journee: avgJournee,
        nb_observations: totalObs,
        source: 'Données terrain AfriOne',
        has_data: true,
      })
    }

    // 2. Pas de données pour cette zone — fallback national
    const { data: nationalData } = await supabaseAdmin
      .from('pricing_reference')
      .select('taux_horaire, taux_journee, nb_observations')
      .eq('metier', metier)
      .order('nb_observations', { ascending: false })

    if (nationalData && nationalData.length > 0) {
      const totalObs = nationalData.reduce((s, r) => s + r.nb_observations, 0)
      const avgHoraire = Math.round(
        nationalData.reduce((s, r) => s + r.taux_horaire * r.nb_observations, 0) / totalObs
      )
      const avgJournee = Math.round(
        nationalData.reduce((s, r) => s + r.taux_journee * r.nb_observations, 0) / totalObs
      )
      return JSON.stringify({
        metier, zone,
        taux_horaire: avgHoraire,
        taux_journee: avgJournee,
        nb_observations: totalObs,
        source: 'Moyenne nationale AfriOne (pas de données pour cette zone)',
        has_data: true,
        fallback: true,
      })
    }

    // 3. Aucune donnée — l'agent devra utiliser get_artisan_rate
    return JSON.stringify({
      metier, zone,
      has_data: false,
      message: `Pas de données terrain pour ${metier} à ${zone}. Utilise get_artisan_rate comme fallback.`,
    })
  }

  if (name === 'search_material_price') {
    const { item, category, qty = 1 } = args
    const { data } = await supabaseAdmin.from('price_materials')
      .select('price_market, source, name').ilike('name', `%${item}%`).limit(1).maybeSingle()
    if (data) return JSON.stringify({ item, qty, price_unit: data.price_market, total: data.price_market * qty, source: data.source || 'Base AfriOne' })
    const jumia = await lookupItemOnJumia(item, category)
    if (jumia.found && jumia.price) return JSON.stringify({ item, qty, price_unit: jumia.price, total: jumia.price * qty, source: 'Jumia CI' })
    const fallback = FALLBACK_MAT[category] || 1500
    return JSON.stringify({ item, qty, price_unit: fallback, total: fallback * qty, source: 'Estimation marché Abidjan' })
  }

  if (name === 'get_artisan_rate') {
    const { metier, artisan_id } = args
    if (artisan_id) {
      const { data } = await supabaseAdmin.from('artisan_pros')
        .select('tarif_min, years_experience').eq('id', artisan_id).maybeSingle()
      if (data?.tarif_min && data.tarif_min >= SMIG_X2_HORAIRE)
        return JSON.stringify({ rate: data.tarif_min, source: "Déclaré par l'artisan", smig_floor: SMIG_X2_HORAIRE })
    }
    const { data: labor } = await supabaseAdmin.from('labor_rates')
      .select('tarif_horaire').eq('metier', metier).maybeSingle()
    const rate = Math.max(labor?.tarif_horaire || FALLBACK_RATES[metier] || 3000, SMIG_X2_HORAIRE)
    return JSON.stringify({ rate, source: labor ? 'Référence AfriOne' : 'Référence marché', smig_floor: SMIG_X2_HORAIRE })
  }

  if (name === 'calculate_final_price') {
    const { hours, hourly_rate, materials_total, urgency = 'medium', quartier = 'Cocody' } = args
    const LABOR_CAP   = 30_000
    const degressif   = hours <= 2 ? 1.0 : hours <= 4 ? 0.85 : hours <= 8 ? 0.70 : 0.60
    const urgency_pct = urgency === 'emergency' ? 0.40 : urgency === 'high' ? 0.25 : 0
    const labor       = Math.min(Math.round(hourly_rate * hours * degressif * (1 + urgency_pct)), LABOR_CAP)
    const transport   = getTransport(quartier)
    const subtotal    = labor + (materials_total || 0) + transport
    const commission  = Math.round(subtotal * 0.10)
    const assurance   = Math.round(subtotal * 0.02)
    const total       = subtotal + commission + assurance
    return JSON.stringify({
      breakdown: { main_oeuvre: labor, materiaux: materials_total || 0, transport, commission_afrione: commission, assurance_sav: assurance },
      total, fourchette: { min: Math.round(total * 0.92), max: Math.round(total * 1.08) },
      artisan_percoit: Math.round(total * 0.88),
    })
  }
  return JSON.stringify({ error: 'Outil inconnu' })
}

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_pricing_data',
      description: 'Récupère les vrais tarifs terrain Abidjan par métier et zone depuis la base AfriOne. TOUJOURS appeler en premier avant tout calcul.',
      parameters: {
        type: 'object',
        properties: {
          metier: { type: 'string', description: 'Ex: Plombier, Électricien, Maçon, Peintre' },
          zone:   { type: 'string', description: 'Quartier Abidjan : Plateau, Cocody, Yopougon, Abobo, Adjamé, Treichville, Marcory' },
        },
        required: ['metier', 'zone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_artisan_rate',
      description: 'Retourne le tarif horaire FCFA/h pour un métier. Appeler en premier.',
      parameters: {
        type: 'object',
        properties: {
          metier:     { type: 'string', description: 'Ex: Plombier, Électricien, Maçon' },
          artisan_id: { type: 'string', description: 'ID artisan optionnel pour taux personnalisé' },
        },
        required: ['metier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_material_price',
      description: 'Cherche le prix unitaire FCFA d\'un matériau (base AfriOne → Jumia CI → marché Abidjan). Appeler pour chaque article.',
      parameters: {
        type: 'object',
        properties: {
          item:     { type: 'string', description: 'Nom exact du matériau' },
          category: { type: 'string', description: 'Catégorie de la mission' },
          qty:      { type: 'number', description: 'Quantité nécessaire (défaut 1)' },
        },
        required: ['item', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_final_price',
      description: 'Calcule le prix final AfriOne avec dégressif heures, urgence, commission 10% et assurance SAV 2%. Appeler en dernier.',
      parameters: {
        type: 'object',
        properties: {
          hours:           { type: 'number', description: 'Durée en heures' },
          hourly_rate:     { type: 'number', description: 'Taux horaire obtenu via get_artisan_rate' },
          materials_total: { type: 'number', description: 'Somme totale des matériaux (0 si aucun)' },
          urgency:         { type: 'string', enum: ['low', 'medium', 'high', 'emergency'] },
          quartier:        { type: 'string', description: 'Quartier client pour le transport' },
        },
        required: ['hours', 'hourly_rate', 'materials_total'],
      },
    },
  },
]

const BASE_SYSTEM_PROMPT = `Tu es l'agent de tarification AfriOne pour le marché informel d'Abidjan, Côte d'Ivoire.

Processus OBLIGATOIRE en 4 étapes (ne jamais sauter) :

1. Appelle get_pricing_data(metier, zone) → tarifs terrain réels Abidjan
   - Si has_data=true : utilise taux_horaire comme hourly_rate de référence principale
   - Si has_data=false : appelle get_artisan_rate(metier, artisan_id?) comme fallback

2. Pour chaque matériau listé, appelle search_material_price (parallélisable)

3. Appelle calculate_final_price avec :
   - hours = durée estimée
   - hourly_rate = taux_horaire obtenu à l'étape 1
   - materials_total = somme des totaux matériaux
   - urgency et quartier

4. Réponds UNIQUEMENT avec le JSON brut de calculate_final_price. Aucun texte, aucun markdown.

Note : si get_pricing_data retourne fallback=true, mentionne-le dans un champ "data_note" ajouté au JSON final.`

async function buildSystemPrompt(category: string, quartier: string): Promise<string> {
  // Charger les 5 missions les plus récentes acceptées dans la même catégorie
  const { data: examples } = await supabaseAdmin
    .from('accepted_prices')
    .select('quartier, urgency, hours, materials_count, description_short, final_price')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!examples?.length) return BASE_SYSTEM_PROMPT

  const lines = examples.map(e =>
    `- ${e.quartier} · ${e.urgency} · ${e.hours}h · ${e.materials_count} matériau(x)${e.description_short ? ` · "${e.description_short}"` : ''} → ${e.final_price.toLocaleString('fr')} FCFA ✓ accepté`
  ).join('\n')

  return `${BASE_SYSTEM_PROMPT}

Missions ${category} récemment acceptées sur AfriOne (utilise-les pour calibrer ton prix) :
${lines}`
}

export async function POST(req: NextRequest) {
  const body     = await req.json()
  const category = body.category || 'Plomberie'
  const metier   = CATEGORY_TO_METIER[category] || category
  const quartier = body.quartier || 'Cocody'

  const [systemPrompt] = await Promise.all([
    buildSystemPrompt(category, quartier),
  ])

  const userMessage = `Calcule le prix AfriOne pour :
- Métier : ${metier}
- Description : ${body.description || ''}
- Matériaux nécessaires : ${(body.items_needed || []).join(', ') || 'aucun'}
- Durée estimée : ${body.hours_estimate || 2}h
- Quartier client : ${quartier}
- Urgence : ${body.urgency || 'medium'}${body.artisan_id ? `\n- Artisan ID : ${body.artisan_id}` : ''}`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userMessage },
  ]

  for (let turn = 0; turn < 6; turn++) {
    const response = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      temperature: 0,
      tools:       TOOLS,
      tool_choice: 'auto',
      messages,
    })

    const msg    = response.choices[0].message
    const reason = response.choices[0].finish_reason
    messages.push(msg)

    if (reason === 'stop') {
      const text = msg.content || ''
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        return NextResponse.json(JSON.parse(cleaned))
      } catch {
        return NextResponse.json({ explanation: text, total: 0, fourchette: { min: 0, max: 0 }, artisan_percoit: 0, breakdown: {} })
      }
    }

    if (reason === 'tool_calls' && msg.tool_calls?.length) {
      // Exécuter tous les tool calls en parallèle (search_material_price notamment)
      const results = await Promise.all(
        msg.tool_calls.map(async tc => ({
          role:         'tool' as const,
          tool_call_id: tc.id,
          content:      await runTool(tc.function.name, JSON.parse(tc.function.arguments)),
        }))
      )
      messages.push(...results)
    }
  }

  return NextResponse.json({ total: 0, fourchette: { min: 0, max: 0 }, artisan_percoit: 0, breakdown: {} })
}
