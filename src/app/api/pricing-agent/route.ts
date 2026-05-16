import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CATEGORY_TO_METIER } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const AGENT_ID = process.env.OPENAI_AGENT_ID!

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!process.env.OPENAI_API_KEY || !AGENT_ID) {
    return NextResponse.json({ error: 'OPENAI_API_KEY ou OPENAI_AGENT_ID manquant' }, { status: 500 })
  }

  const category      = body.category       || 'Plomberie'
  const metier        = CATEGORY_TO_METIER[category] || category
  const items         = (body.items_needed || []).join(', ') || 'aucun'
  const hours         = body.hours_estimate || 2
  const quartier      = body.quartier       || 'Cocody'
  const urgency       = body.urgency        || 'medium'
  const artisan_id    = body.artisan_id     || ''
  const description   = body.description   || ''

  // Appel à l'agent OpenAI (Responses API)
  const response = await (openai as any).responses.create({
    agent: AGENT_ID,
    input: `Calcule le prix pour cette prestation :
- Métier : ${metier}
- Description : ${description}
- Matériaux : ${items}
- Durée : ${hours}h
- Quartier : ${quartier}
- Urgence : ${urgency}
${artisan_id ? `- Artisan ID : ${artisan_id}` : ''}

Réponds en JSON avec : total, fourchette (min/max), artisan_percoit, breakdown, explanation.`,
  })

  const text = response.output_text || response.output?.[0]?.content?.[0]?.text || ''

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed  = JSON.parse(cleaned)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ explanation: text, total: 0, fourchette: { min: 0, max: 0 }, artisan_percoit: 0, breakdown: {} })
  }
}
