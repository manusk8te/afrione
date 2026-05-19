/**
 * POST /api/cancel-mission
 * Annule une mission et rembourse l'escrow si un paiement a eu lieu.
 * Body : { mission_id }
 * Auth : Bearer token Supabase (client ou admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { refundEscrow } from '@/lib/escrow'

export const dynamic = 'force-dynamic'

const STATUTS_AVEC_ESCROW = ['en_cours', 'payment', 'pending_validation', 'disputed']

export async function POST(req: NextRequest) {
  const { mission_id } = await req.json()
  if (!mission_id) return NextResponse.json({ error: 'mission_id requis' }, { status: 400 })

  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await userClient.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })

  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('id, client_id, artisan_id, status')
    .eq('id', mission_id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })

  // Seul le client de la mission ou un admin peut annuler
  const { data: userRecord } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).single()
  const isAdmin = userRecord?.role === 'admin'

  if (mission.client_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  if (['completed', 'cancelled'].includes(mission.status)) {
    return NextResponse.json({ error: `Mission déjà ${mission.status}` }, { status: 409 })
  }

  // Si un paiement a eu lieu, rembourser l'escrow
  if (STATUTS_AVEC_ESCROW.includes(mission.status)) {
    await refundEscrow(mission_id, mission.artisan_id)
  }

  await supabaseAdmin.from('missions').update({
    status:     'cancelled',
    updated_at: new Date().toISOString(),
  }).eq('id', mission_id)

  await supabaseAdmin.from('chat_history').insert({
    mission_id,
    sender_id:   user.id,
    sender_role: isAdmin ? 'admin' : 'client',
    text:        STATUTS_AVEC_ESCROW.includes(mission.status)
      ? '❌ Mission annulée. Le remboursement a été initié.'
      : '❌ Mission annulée.',
    type: 'system',
  })

  return NextResponse.json({ ok: true })
}
