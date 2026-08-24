/**
 * POST /api/payment
 * Remplace l'appel RPC credit_escrow — plus robuste : upsert du wallet artisan
 * si inexistant, puis enregistrement transaction + update mission.
 *
 * Body : { mission_id, amount }
 * Auth : Bearer token Supabase (session.access_token du client)
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'


// ⚠️ Taux en dur, l'un des quatre du projet — voir docs/COMMISSIONS.md.
// `service_fees` prévoit 10 % de commission + 2 % d'assurance SAV, soit 88 %
// à l'artisan. Ici il en reçoit 90 % : l'assurance n'est jamais prélevée, et
// `transactions` n'a pas de colonne pour l'accueillir. Écart constaté et
// assumé au 2026-08-22 ; ne pas changer ce taux sans lire les trois autres.
const PLATFORM_FEE_PCT = 0.10  // 10% commission AfriOne

export async function POST(req: NextRequest) {
  const { mission_id, amount } = await req.json()

  if (!mission_id || !amount || amount <= 0) {
    return NextResponse.json({ error: 'mission_id et amount requis' }, { status: 400 })
  }

  // Vérifier l'identité du client via son token
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await userClient.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })

  // Charger la mission — vérifier que c'est bien le client qui paie
  const { data: mission, error: mErr } = await supabaseAdmin
    .from('missions')
    .select('id, client_id, artisan_id, status')
    .eq('id', mission_id)
    .single()

  if (mErr || !mission) {
    return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  }
  if (mission.client_id !== user.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  if (mission.status === 'payment' || mission.status === 'en_route' || mission.status === 'en_cours' || mission.status === 'completed') {
    return NextResponse.json({ error: 'Paiement déjà effectué' }, { status: 409 })
  }
  if (!mission.artisan_id) {
    return NextResponse.json({ error: 'Aucun artisan assigné à cette mission' }, { status: 400 })
  }

  // ── Upsert wallet artisan ──────────────────────────────────────────────────
  // wallets.artisan_id → artisan_pros.id (= mission.artisan_id)
  const { data: existingWallet } = await supabaseAdmin
    .from('wallets')
    .select('id, balance_escrow')
    .eq('artisan_id', mission.artisan_id)
    .maybeSingle()

  if (existingWallet) {
    // Écriture non vérifiée jusqu'ici : un échec ici créditait l'escrow nulle
    // part, alors que la suite annonçait le paiement au client. Supabase ne
    // lève pas d'exception — l'erreur est dans l'objet retour.
    const { error: eMaj } = await supabaseAdmin
      .from('wallets')
      .update({
        balance_escrow: (existingWallet.balance_escrow || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('artisan_id', mission.artisan_id)
    if (eMaj) {
      console.error('[payment] crédit escrow échoué:', eMaj.message)
      return NextResponse.json({ error: 'Erreur lors du dépôt en escrow' }, { status: 500 })
    }
  } else {
    // Wallet manquant → le créer automatiquement
    const { error: wErr } = await supabaseAdmin
      .from('wallets')
      .insert({
        artisan_id:        mission.artisan_id,
        balance_available: 0,
        balance_escrow:    amount,
        total_earned:      0,
        total_withdrawn:   0,
      })
    if (wErr) {
      console.error('[payment] wallet insert error:', wErr)
      return NextResponse.json({ error: 'Erreur création wallet artisan' }, { status: 500 })
    }
  }

  // ── Enregistrer la transaction ─────────────────────────────────────────────
  const platformFee  = Math.round(amount * PLATFORM_FEE_PCT)
  const artisanAmount = amount - platformFee

  // Le wallet retient déjà les fonds à ce stade. Sans transaction pour en
  // garder trace, l'escrow devient invisible : ni remboursement ni libération
  // ne le retrouveraient, tous deux cherchant une transaction en 'escrow'.
  const { error: eTx } = await supabaseAdmin.from('transactions').insert({
    mission_id,
    amount,
    platform_fee:   platformFee,
    artisan_amount: artisanAmount,
    status:         'escrow',
    payment_method: 'wave',
  })
  if (eTx) {
    console.error('[payment] transaction non enregistrée:', eTx.message)
    return NextResponse.json({ error: "Le paiement n'a pas pu être enregistré" }, { status: 500 })
  }

  // ── Mettre à jour la mission ───────────────────────────────────────────────
  // En échec, le client a payé mais la mission reste en négociation : il
  // reverrait le bouton « payer » sur une mission déjà réglée.
  const { error: eMission } = await supabaseAdmin
    .from('missions')
    .update({ status: 'payment', updated_at: new Date().toISOString() })
    .eq('id', mission_id)
  if (eMission) {
    console.error('[payment] statut mission non mis à jour:', eMission.message)
    return NextResponse.json({ error: 'Paiement enregistré mais mission non mise à jour' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, artisan_amount: artisanAmount })
}
