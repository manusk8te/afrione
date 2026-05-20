import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { findNextCandidate, createDispatchAttempt, sendUrgentNotification, cancelAndRefund } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

// Appelé par le client (écran de chargement) quand le timer 45s expire côté frontend

export async function POST(req: NextRequest) {
  const { mission_id } = await req.json()

  if (!mission_id) {
    return NextResponse.json({ error: 'mission_id requis' }, { status: 400 })
  }

  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('id, mode, status, client_id, category')
    .eq('id', mission_id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  if (mission.mode !== 'urgent') return NextResponse.json({ error: 'Mode non urgent' }, { status: 400 })
  if (mission.status !== 'dispatching') return NextResponse.json({ ok: true, skipped: true })

  // Marquer la tentative active comme timeout
  await supabaseAdmin
    .from('dispatch_attempts')
    .update({ response: 'timeout', responded_at: new Date().toISOString() })
    .eq('mission_id', mission_id)
    .is('response', null)

  // Compter les tentatives totales
  const { count } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('mission_id', mission_id)

  const nextCandidate = await findNextCandidate(mission_id)

  if (!nextCandidate) {
    await cancelAndRefund(mission_id, mission.client_id)
    return NextResponse.json({ dispatched: false, reason: 'no_more_candidates' })
  }

  const attempt = await createDispatchAttempt(mission_id, nextCandidate.id, (count ?? 0) + 1)

  await supabaseAdmin
    .from('missions')
    .update({ artisan_id: nextCandidate.id })
    .eq('id', mission_id)

  await sendUrgentNotification(nextCandidate.user_id, mission.category)

  return NextResponse.json({ dispatched: true, attempt_id: attempt?.id })
}
