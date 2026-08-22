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

  // 1. Sauvegarder dans accepted_prices (historique missions).
  //
  // `final_price` seul ne dit rien : deux chantiers au même total peuvent
  // avoir des mains-d'œuvre du simple au triple. La décomposition est la seule
  // façon de remonter au taux horaire réel — c'est ce que la table attend, et
  // ce que la vue `taux_horaire_observe` exploite.
  const mainOeuvreBrut = breakdown?.main_oeuvre ?? null
  const materiauxBrut  = breakdown?.materiaux   ?? null

  const { error: eInsert } = await supabaseAdmin.from('accepted_prices').insert({
    mission_id,
    category,
    quartier:          zone,
    urgency:           urgency           || 'medium',
    hours:             hours             || 2,
    materials_count:   materials_count   ?? 0,
    description_short: description_short || null,
    prix_main_oeuvre:  mainOeuvreBrut,
    prix_materiaux:    materiauxBrut,
    final_price,
    artisan_percoit:   artisan_percoit   || null,
    source:            'plateforme',
  })

  // La War Room appelle cette route en `.catch(() => {})` : une erreur ici ne
  // remonterait nulle part. On la trace au moins côté serveur — c'est ainsi
  // que tous les prix acceptés ont disparu pendant des mois, la table
  // `accepted_prices` n'existant pas.
  if (eInsert) console.error('[accepted-price] insert échoué :', eInsert.message)

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
      const { error: eRef } = await supabaseAdmin.from('pricing_reference').insert({
        metier,
        zone,
        taux_horaire:      tauxHoraire,
        taux_journee:      tauxJournee,
        niveau_experience: 'confirme',
        // 'plateforme' et non 'terrain' : ce taux est déduit d'une mission
        // dont AfriOne a lui-même suggéré le prix. Le confondre avec un relevé
        // d'artisan interrogé ferait boucler le moteur sur ses propres
        // estimations.
        source:            'plateforme',
        date_collecte:     new Date().toISOString().split('T')[0],
        nb_observations:   1,
      })
      if (eRef) console.error('[accepted-price] pricing_reference échoué :', eRef.message)
    }
  }

  return NextResponse.json({ ok: true })
}
