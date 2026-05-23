import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mission_id, category, quartier, urgency, hours, materials_count, description_short, final_price, artisan_percoit } = body

  if (!category || !final_price || final_price <= 0) {
    return NextResponse.json({ ok: false })
  }

  await supabaseAdmin.from('accepted_prices').insert({
    mission_id,
    category,
    quartier:          quartier          || 'Cocody',
    urgency:           urgency           || 'medium',
    hours:             hours             || 2,
    materials_count:   materials_count   ?? 0,
    description_short: description_short || null,
    final_price,
    artisan_percoit:   artisan_percoit   || null,
  })

  return NextResponse.json({ ok: true })
}
