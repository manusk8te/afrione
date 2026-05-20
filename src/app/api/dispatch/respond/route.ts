import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { findNextCandidate, createDispatchAttempt, sendUrgentNotification, cancelAndRefund } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { mission_id, artisan_id, response } = await req.json()

  if (!mission_id || !artisan_id || !response) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  if (!['accepted', 'refused'].includes(response)) {
    return NextResponse.json({ error: 'Réponse invalide' }, { status: 400 })
  }

  // Vérifier que la tentative est encore active (pas expirée, pas déjà répondu)
  const { data: attempt } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('id, attempt_number, expires_at, response')
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
    // Marquer comme timeout et passer au suivant
    await supabaseAdmin
      .from('dispatch_attempts')
      .update({ response: 'timeout', responded_at: new Date().toISOString() })
      .eq('id', attempt.id)

    return handleNext(mission_id, attempt.attempt_number)
  }

  // Enregistrer la réponse
  await supabaseAdmin
    .from('dispatch_attempts')
    .update({ response, responded_at: new Date().toISOString() })
    .eq('id', attempt.id)

  if (response === 'accepted') {
    return handleAccepted(mission_id, artisan_id)
  }

  return handleNext(mission_id, attempt.attempt_number)
}

// ── Artisan accepte ───────────────────────────────────────────────────────────

async function handleAccepted(missionId: string, artisanId: string) {
  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('client_id, category')
    .eq('id', missionId)
    .single()

  // Mission → en_route, artisan confirmé
  await supabaseAdmin
    .from('missions')
    .update({ status: 'en_route', artisan_id: artisanId })
    .eq('id', missionId)

  // Créditer l'escrow du wallet artisan maintenant qu'il est assigné
  const { data: transaction } = await supabaseAdmin
    .from('transactions')
    .select('artisan_amount')
    .eq('mission_id', missionId)
    .eq('status', 'escrow')
    .single()

  if (transaction?.artisan_amount) {
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('artisan_id', artisanId)
      .maybeSingle()

    if (wallet) {
      await supabaseAdmin
        .from('wallets')
        .update({ balance_escrow: (wallet.balance_escrow || 0) + transaction.artisan_amount })
        .eq('artisan_id', artisanId)
    } else {
      await supabaseAdmin.from('wallets').insert({
        artisan_id:        artisanId,
        balance_escrow:    transaction.artisan_amount,
        balance_available: 0,
        total_earned:      0,
      })
    }
  }

  // Message système dans le chat
  await supabaseAdmin.from('chat_history').insert({
    mission_id:  missionId,
    sender_id:   mission?.client_id,
    sender_role: 'system',
    sender_type: 'afrione_system',
    text:        '✅ Un artisan a accepté ta mission urgente. Il est en route vers toi !',
    type:        'system',
  })

  return NextResponse.json({ accepted: true })
}

// ── Artisan refuse ou timeout → passer au suivant ────────────────────────────

async function handleNext(missionId: string, lastAttemptNumber: number) {
  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('client_id, category')
    .eq('id', missionId)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })

  const nextCandidate = await findNextCandidate(missionId)

  if (!nextCandidate) {
    await cancelAndRefund(missionId, mission.client_id)
    return NextResponse.json({ dispatched: false, reason: 'no_more_candidates' })
  }

  const attempt = await createDispatchAttempt(missionId, nextCandidate.id, lastAttemptNumber + 1)

  await supabaseAdmin
    .from('missions')
    .update({ artisan_id: nextCandidate.id })
    .eq('id', missionId)

  await sendUrgentNotification(nextCandidate.user_id, mission.category)

  return NextResponse.json({ dispatched: true, attempt_id: attempt?.id })
}
