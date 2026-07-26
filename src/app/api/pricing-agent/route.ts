import { NextRequest, NextResponse } from 'next/server'
import { runPricingAgent } from '@/lib/pricing-agent'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    const result = await runPricingAgent({
      category:       body.category       || 'Plomberie',
      description:    body.description    || '',
      items_needed:   body.items_needed   || [],
      hours_estimate: body.hours_estimate || 2,
      quartier:       body.quartier       || 'Cocody',
      urgency:        body.urgency        || 'medium',
      artisan_id:     body.artisan_id,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[pricing-agent]', err?.message)
    return NextResponse.json({ total: 0, fourchette: { min: 0, max: 0 }, artisan_percoit: 0, breakdown: {} }, { status: 500 })
  }
}
