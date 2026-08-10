import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelAndRefund, closeAttempts, DISPATCH_GRACE_SECONDS } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

// Appelé par le client quand le timer 45s expire.
// Avec le broadcast, tous les artisans ont été notifiés en même temps.
// Si personne n'a accepté → on rembourse.

export async function POST(req: NextRequest) {
  const { mission_id } = await req.json()

  if (!mission_id) return NextResponse.json({ error: 'mission_id requis' }, { status: 400 })

  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('id, mode, status, client_id, category')
    .eq('id', mission_id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  if (mission.mode !== 'urgent') return NextResponse.json({ ok: true, skipped: true })

  // Si déjà acceptée, ne rien faire
  if (mission.status !== 'dispatching') {
    return NextResponse.json({ dispatched: true, already_accepted: true, status: mission.status })
  }

  // Le timer client et la fenêtre artisan durent tous deux 60s : sans marge,
  // l'artisan qui clique à 59,8s voit sa mission annulée sous ses doigts et
  // reçoit « mission expirée » alors qu'il a répondu dans les temps. On ne
  // conclut au timeout que si plus aucune tentative n'est dans sa grâce.
  const graceCutoff = new Date(Date.now() - DISPATCH_GRACE_SECONDS * 1000).toISOString()

  const { data: stillLive } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('id')
    .eq('mission_id', mission_id)
    .is('response', null)
    .gt('expires_at', graceCutoff)
    .limit(1)

  if (stillLive?.length) {
    return NextResponse.json({ dispatched: true, waiting: true, grace: true })
  }

  // Marquer toutes les tentatives encore en attente comme timeout
  await closeAttempts(mission_id, 'timeout')

  // Plus personne n'a accepté → remboursement (sauf si un artisan a accepté
  // dans l'intervalle — la garde de statut de cancelAndRefund tranche)
  const result = await cancelAndRefund(mission_id, mission.client_id)
  if (!result.cancelled) {
    return NextResponse.json({ dispatched: true, already_accepted: true })
  }
  return NextResponse.json({ dispatched: false, reason: 'timeout_all' })
}
