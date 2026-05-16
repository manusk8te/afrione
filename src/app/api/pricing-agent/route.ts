import { NextRequest, NextResponse } from 'next/server'
import { runPricingAgent, type AgentPricingInput } from '@/lib/pricing-agent'
import { CATEGORY_TO_METIER } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const input: AgentPricingInput = {
    category:       body.category       || 'Plomberie',
    description:    body.description    || '',
    items_needed:   body.items_needed   || [],
    hours_estimate: body.hours_estimate || 2,
    quartier:       body.quartier       || 'Cocody',
    urgency:        body.urgency        || 'medium',
    artisan_id:     body.artisan_id,
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 })
  }

  const result = await runPricingAgent(input)
  return NextResponse.json(result)
}
