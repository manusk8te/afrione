import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TRANSPORT: Record<string, number> = {
  'Cocody': 1000, 'Plateau': 800, 'Adjamé': 900, 'Yopougon': 1500,
  'Abobo': 1800, 'Marcory': 1000, 'Treichville': 800, 'Koumassi': 1200,
  'Port-Bouët': 1400, 'Bingerville': 2000, 'Riviera': 1200,
  'Zone 4': 900, 'Deux-Plateaux': 1100, 'Angré': 1300,
}

export async function POST(req: NextRequest) {
  const { hours, hourly_rate, materials_total, urgency = 'medium', quartier = 'Cocody' } = await req.json()

  const degressif = hours <= 2 ? 1.0 : hours <= 4 ? 0.85 : hours <= 8 ? 0.70 : 0.60
  const labor_base  = Math.round(hourly_rate * hours * degressif)
  const urgency_pct = urgency === 'emergency' ? 0.40 : urgency === 'high' ? 0.25 : 0
  const labor_final = Math.round(labor_base * (1 + urgency_pct))
  const transport   = TRANSPORT[quartier] || 1000
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
