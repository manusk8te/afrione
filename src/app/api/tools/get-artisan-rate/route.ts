import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SMIG_X2_HORAIRE } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const FALLBACK_RATES: Record<string, number> = {
  'Plombier': 3200, 'Électricien': 3500, 'Peintre': 2500,
  'Maçon': 2800, 'Menuisier': 3000, 'Climaticien': 4500,
  'Serrurier': 3000, 'Carreleur': 2800,
}

export async function POST(req: NextRequest) {
  const { metier, artisan_id } = await req.json()

  if (artisan_id) {
    const { data } = await supabaseAdmin
      .from('artisan_pros')
      .select('tarif_min, years_experience')
      .eq('id', artisan_id)
      .maybeSingle()

    if (data?.tarif_min && data.tarif_min >= SMIG_X2_HORAIRE) {
      return NextResponse.json({
        rate: data.tarif_min,
        years_exp: data.years_experience ?? 3,
        source: 'Déclaré par l\'artisan',
        smig_floor: SMIG_X2_HORAIRE,
      })
    }
  }

  const { data: labor } = await supabaseAdmin
    .from('labor_rates')
    .select('tarif_horaire')
    .eq('metier', metier)
    .maybeSingle()

  const rate = Math.max(labor?.tarif_horaire || FALLBACK_RATES[metier] || 3000, SMIG_X2_HORAIRE)

  return NextResponse.json({
    rate,
    source: labor ? 'Référence AfriOne' : 'Référence marché',
    smig_floor: SMIG_X2_HORAIRE,
  })
}
