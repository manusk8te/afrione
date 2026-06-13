import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { CATEGORY_TO_METIER } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    mission_id, category, quartier, urgency, hours,
    materials_count, description_short, final_price, artisan_percoit,
    // Optionnel : breakdown du pricing agent pour enrichir pricing_reference
    breakdown,
  } = body

  if (!category || !final_price || final_price <= 0) {
    return NextResponse.json({ ok: false })
  }

  const zone = quartier || 'Cocody'

  // 1. Sauvegarder dans accepted_prices (historique missions)
  await supabaseAdmin.from('accepted_prices').insert({
    mission_id,
    category,
    quartier:          zone,
    urgency:           urgency           || 'medium',
    hours:             hours             || 2,
    materials_count:   materials_count   ?? 0,
    description_short: description_short || null,
    final_price,
    artisan_percoit:   artisan_percoit   || null,
  })

  // 2. Enrichir pricing_reference si on a le taux horaire réel
  const metier  = CATEGORY_TO_METIER[category] || category
  const h       = Number(hours) || 2
  const mainOeuvre = breakdown?.main_oeuvre ?? null

  if (metier && zone && mainOeuvre && mainOeuvre > 0 && h > 0) {
    // Taux horaire implicite à partir de la main d'œuvre acceptée
    // Note : main_oeuvre est déjà après dégressivité + urgence → taux de marché réel
    const tauxHoraire = Math.round(mainOeuvre / h)
    const tauxJournee = Math.round(tauxHoraire * 8)

    // On ne logue que si le taux est réaliste (entre SMIG×2 et 15 000 FCFA/h)
    if (tauxHoraire >= 800 && tauxHoraire <= 15_000) {
      await supabaseAdmin.from('pricing_reference').insert({
        metier,
        zone,
        taux_horaire:      tauxHoraire,
        taux_journee:      tauxJournee,
        niveau_experience: 'confirme',
        source:            'plateforme',
        date_collecte:     new Date().toISOString().split('T')[0],
        nb_observations:   1,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
