import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelAndRefund } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

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
    .select('status, client_id, category')
    .eq('id', mission_id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })

  // Si déjà assignée (un autre artisan a accepté en premier)
  if (mission.status === 'en_route') {
    return NextResponse.json({ error: 'Mission déjà assignée', already_taken: true }, { status: 409 })
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

  // Enregistrer la réponse de cet artisan
  await supabaseAdmin
    .from('dispatch_attempts')
    .update({ response, responded_at: new Date().toISOString() })
    .eq('id', attempt.id)

  if (response === 'refused') {
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

  // ── Accepté : cet artisan prend la mission ───────────────────────────────
  // Annuler toutes les autres tentatives en attente
  await supabaseAdmin
    .from('dispatch_attempts')
    .update({ response: 'cancelled', responded_at: new Date().toISOString() })
    .eq('mission_id', mission_id)
    .is('response', null)
    .neq('artisan_id', artisan_id)

  // Mission → en_route, artisan assigné
  await supabaseAdmin
    .from('missions')
    .update({ status: 'en_route', artisan_id: artisan_id })
    .eq('id', mission_id)

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
