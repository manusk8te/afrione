import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { startUrgentDispatch } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { missionId } = await req.json()

  if (!missionId) {
    return NextResponse.json({ error: 'missionId requis' }, { status: 400 })
  }

  const { data: mission, error } = await supabaseAdmin
    .from('missions')
    .select('id, mode, category, status, client_id')
    .eq('id', missionId)
    .single()

  if (error || !mission) {
    return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  }

  if (mission.mode !== 'urgent') {
    return NextResponse.json({ error: 'Mode non urgent' }, { status: 400 })
  }

  if (mission.status === 'cancelled' || mission.status === 'completed') {
    return NextResponse.json({ error: 'Mission terminée' }, { status: 400 })
  }

  const result = await startUrgentDispatch(missionId, mission.client_id, mission.category)

  return NextResponse.json(result)
}
