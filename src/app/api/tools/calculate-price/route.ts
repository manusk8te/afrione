import { NextRequest, NextResponse } from 'next/server'
import { getTransport } from '@/lib/transport'
import { computeLabor } from '@/lib/pricing'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  const { hours, hourly_rate, materials_total, urgency = 'medium', quartier = 'Cocody' } = await req.json()

  // Plus de plafond à 30 000 : voir computeLabor (src/lib/pricing.ts).
  const { labor: labor_base, degressif } = computeLabor(hourly_rate, hours)
  const urgency_pct = urgency === 'emergency' ? 0.40 : urgency === 'high' ? 0.25 : 0
  const labor_final = Math.round(labor_base * (1 + urgency_pct))
  const transport   = getTransport(quartier)
  const subtotal    = labor_final + (materials_total || 0) + transport
  const commission  = Math.round(subtotal * 0.10)
  const assurance   = Math.round(subtotal * 0.02)
  const total       = subtotal + commission + assurance

  return NextResponse.json({
    breakdown: {
      main_oeuvre:       labor_final,
      degressivite:      degressif < 1 ? `−${Math.round((1 - degressif) * 100)}% longue tâche` : null,
      urgence:           urgency_pct > 0 ? `+${urgency_pct * 100}%` : null,
      materiaux:         materials_total || 0,
      transport,
      commission_afrione: commission,
      assurance_sav:     assurance,
    },
    total,
    fourchette:      { min: Math.round(total * 0.92), max: Math.round(total * 1.08) },
    artisan_percoit: Math.round(total * 0.88),
  })
}
