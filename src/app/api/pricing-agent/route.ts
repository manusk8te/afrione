import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CATEGORY_TO_METIER } from '@/lib/pricing'
import { supabaseAdmin } from '@/lib/supabase'
import { lookupItemOnJumia } from '@/lib/jumia-lookup'
import { SMIG_X2_HORAIRE } from '@/lib/pricing'
import { getTransport } from '@/lib/transport'

export const dynamic = 'force-dynamic'

const openai       = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID!

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
    const degressif   = hours <= 2 ? 1.0 : hours <= 4 ? 0.85 : hours <= 8 ? 0.70 : 0.60
    const urgency_pct = urgency === 'emergency' ? 0.40 : urgency === 'high' ? 0.25 : 0
    const labor       = Math.round(hourly_rate * hours * degressif * (1 + urgency_pct))
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

export async function POST(req: NextRequest) {
  const body = await req.json()
  const category = body.category || 'Plomberie'
  const metier   = CATEGORY_TO_METIER[category] || category

  const prompt = `Calcule le prix pour :
- Métier : ${metier}
- Description : ${body.description || ''}
- Matériaux : ${(body.items_needed || []).join(', ') || 'aucun'}
- Durée : ${body.hours_estimate || 2}h
- Quartier : ${body.quartier || 'Cocody'}
- Urgence : ${body.urgency || 'medium'}
${body.artisan_id ? `- Artisan ID : ${body.artisan_id}` : ''}`

  // Créer un thread et lancer l'assistant
  const thread = await openai.beta.threads.create()
  await openai.beta.threads.messages.create(thread.id, { role: 'user', content: prompt })

  let run = await openai.beta.threads.runs.create(thread.id, { assistant_id: ASSISTANT_ID })

  // Boucle jusqu'à completion
  while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
    await new Promise(r => setTimeout(r, 800))
    run = await openai.beta.threads.runs.retrieve(thread.id, run.id)

    if (run.status === 'requires_action') {
      const calls = run.required_action!.submit_tool_outputs.tool_calls
      const outputs = await Promise.all(calls.map(async tc => ({
        tool_call_id: tc.id,
        output: await runTool(tc.function.name, JSON.parse(tc.function.arguments)),
      })))
      run = await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, { tool_outputs: outputs })
    }
  }

  const messages = await openai.beta.threads.messages.list(thread.id)
  const last     = messages.data[0]?.content[0]
  const text     = last?.type === 'text' ? last.text.value : ''

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ explanation: text, total: 0, fourchette: { min: 0, max: 0 }, artisan_percoit: 0, breakdown: {} })
  }
}
