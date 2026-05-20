import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelAndRefund } from '@/lib/dispatch'

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

  // Si déjà acceptée (en_route), ne rien faire
  if (mission.status === 'en_route') return NextResponse.json({ dispatched: true, already_accepted: true })

  // Marquer toutes les tentatives encore en attente comme timeout
  await supabaseAdmin
    .from('dispatch_attempts')
    .update({ response: 'timeout', responded_at: new Date().toISOString() })
    .eq('mission_id', mission_id)
    .is('response', null)

  // Plus personne n'a accepté → remboursement
  await cancelAndRefund(mission_id, mission.client_id)
  return NextResponse.json({ dispatched: false, reason: 'timeout_all' })
}
