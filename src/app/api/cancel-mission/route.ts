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

/**
 * Statuts atteignables APRÈS le paiement : dans chacun, des fonds sont bloqués
 * en escrow et une annulation doit rembourser.
 *
 * `scheduled` et `en_route` manquaient. Or le parcours est
 * payment → scheduled (« programmer ») ou en_route (« maintenant ») → en_cours.
 * Un client qui payait, choisissait une date, puis annulait n'était jamais
 * remboursé : la mission passait à 'cancelled' et sa transaction restait
 * 'escrow' pour toujours. Constaté le 2026-08-21 sur une mission annulée le
 * 10 août — 20 966 FCFA immobilisés.
 */
const STATUTS_AVEC_ESCROW = [
  'payment', 'scheduled', 'en_route', 'en_cours', 'pending_validation', 'disputed',
]

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

  // Si un paiement a eu lieu, rembourser l'escrow AVANT d'annuler. Une mission
  // annulée dont la transaction reste en 'escrow' immobilise l'argent sans que
  // rien ne le signale — constaté sur une annulation du 10 août, 20 966 FCFA.
  if (STATUTS_AVEC_ESCROW.includes(mission.status)) {
    const remboursement = await refundEscrow(mission_id, mission.artisan_id)
    if (!remboursement.ok) {
      return NextResponse.json(
        { error: "Le remboursement a échoué. La mission n'a pas été annulée — réessayez.", detail: remboursement.motif },
        { status: 500 },
      )
    }
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
