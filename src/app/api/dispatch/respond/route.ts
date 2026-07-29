import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelAndRefund } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

// Nom + horodatage de l'artisan qui a réellement remporté la mission —
// pour une attribution explicite plutôt qu'un "prise par un autre" générique.
async function getTakenByInfo(missionId: string, artisanId: string) {
  const [{ data: pro }, { data: attempt }] = await Promise.all([
    supabaseAdmin.from('artisan_pros').select('users!artisan_pros_user_id_fkey(name)').eq('id', artisanId).maybeSingle(),
    supabaseAdmin.from('dispatch_attempts').select('responded_at').eq('mission_id', missionId).eq('artisan_id', artisanId).eq('response', 'accepted').maybeSingle(),
  ])
  return {
    name: (pro?.users as any)?.name || 'Un autre artisan',
    at:   attempt?.responded_at || null,
  }
}

export async function POST(req: NextRequest) {
  const { mission_id, artisan_id, response } = await req.json()

  if (!mission_id || !artisan_id || !response) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  if (!['accepted', 'refused'].includes(response)) {
    return NextResponse.json({ error: 'Réponse invalide' }, { status: 400 })
  }

  // Vérifier que la mission est encore en cours de dispatch
  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('status, client_id, category, artisan_id')
    .eq('id', mission_id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })

  // Si déjà assignée à un AUTRE artisan — attribution explicite (qui, quand)
  if (mission.status === 'en_route' && mission.artisan_id && mission.artisan_id !== artisan_id) {
    const taken_by = await getTakenByInfo(mission_id, mission.artisan_id)
    return NextResponse.json({ error: 'Mission déjà assignée', already_taken: true, taken_by }, { status: 409 })
  }

  // Récupérer la tentative de cet artisan
  const { data: attempt } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('id, expires_at, response')
    .eq('mission_id', mission_id)
    .eq('artisan_id', artisan_id)
    .is('response', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!attempt) {
    return NextResponse.json({ error: 'Tentative introuvable ou expirée' }, { status: 404 })
  }

  if (new Date(attempt.expires_at) < new Date()) {
    await supabaseAdmin
      .from('dispatch_attempts')
      .update({ response: 'timeout', responded_at: new Date().toISOString() })
      .eq('id', attempt.id)
    return NextResponse.json({ error: 'Délai expiré' }, { status: 410 })
  }

  if (response === 'refused') {
    await supabaseAdmin
      .from('dispatch_attempts')
      .update({ response: 'refused', responded_at: new Date().toISOString() })
      .eq('id', attempt.id)

    // Vérifier si tous les artisans ont refusé
    const { data: pending } = await supabaseAdmin
      .from('dispatch_attempts')
      .select('id')
      .eq('mission_id', mission_id)
      .is('response', null)

    if (!pending?.length) {
      await cancelAndRefund(mission_id, mission.client_id)
      return NextResponse.json({ refused: true, refunded: true })
    }
    return NextResponse.json({ refused: true })
  }

  // ── Accepté : tenter la prise atomique AVANT de marquer la tentative ──────
  // Ordre important : marquer response='accepted' avant ce claim laissait la
  // tentative figée sur "accepted" même quand le claim échouait (ex: le
  // timeout client — même fenêtre 60s — annule la mission dans l'instant qui
  // sépare les deux requêtes) → incohérence observée en base (dispatch_attempts
  // accepted, mission cancelled, artisan_id null) et message "prise par un
  // autre artisan" alors que personne ne l'a réellement obtenue.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('missions')
    .update({ status: 'en_route', artisan_id: artisan_id })
    .eq('id', mission_id)
    .eq('status', 'dispatching')
    .select('id')
    .maybeSingle()

  if (claimError || !claimed) {
    // Refléter l'échec réel plutôt que de laisser la tentative sur "accepted"
    await supabaseAdmin
      .from('dispatch_attempts')
      .update({ response: 'timeout', responded_at: new Date().toISOString() })
      .eq('id', attempt.id)

    // Distinguer "prise par quelqu'un d'autre" (attribution réelle) de
    // "expirée/annulée entre-temps" (aucun gagnant) — messages différents
    const { data: current } = await supabaseAdmin
      .from('missions').select('status, artisan_id').eq('id', mission_id).maybeSingle()

    if (current?.status === 'en_route' && current.artisan_id) {
      const taken_by = await getTakenByInfo(mission_id, current.artisan_id)
      return NextResponse.json({ error: 'Mission déjà assignée', already_taken: true, taken_by }, { status: 409 })
    }
    return NextResponse.json({ error: 'Mission expirée ou annulée avant confirmation', expired: true }, { status: 410 })
  }

  // Confirmer la tentative seulement maintenant que la prise a réussi
  await supabaseAdmin
    .from('dispatch_attempts')
    .update({ response: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', attempt.id)

  // Cancel all other pending attempts
  await supabaseAdmin
    .from('dispatch_attempts')
    .update({ response: 'cancelled', responded_at: new Date().toISOString() })
    .eq('mission_id', mission_id)
    .is('response', null)
    .neq('artisan_id', artisan_id)

  // Créditer l'escrow du wallet artisan
  const { data: transaction } = await supabaseAdmin
    .from('transactions')
    .select('artisan_amount')
    .eq('mission_id', mission_id)
    .eq('status', 'escrow')
    .maybeSingle()

  if (transaction?.artisan_amount) {
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('artisan_id', artisan_id)
      .maybeSingle()

    if (wallet) {
      await supabaseAdmin
        .from('wallets')
        .update({ balance_escrow: (wallet.balance_escrow || 0) + transaction.artisan_amount })
        .eq('artisan_id', artisan_id)
    } else {
      await supabaseAdmin.from('wallets').insert({
        artisan_id:        artisan_id,
        balance_escrow:    transaction.artisan_amount,
        balance_available: 0,
        total_earned:      0,
      })
    }
  }

  // Message système dans le chat
  await supabaseAdmin.from('chat_history').insert({
    mission_id,
    sender_id:   mission.client_id,
    sender_role: 'system',
    sender_type: 'afrione_system',
    text:        '✅ Un artisan a accepté ta mission urgente. Il est en route vers toi !',
    type:        'system',
  })

  return NextResponse.json({ accepted: true })
}
