/**
 * POST /api/validate-mission
 * Client valide la mission → escrow libéré vers artisan, status → 'completed'
 * Body : { mission_id }
 * Auth : Bearer token Supabase (client de la mission uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { releaseEscrow } from '@/lib/escrow'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { mission_id } = await req.json()
  if (!mission_id) return NextResponse.json({ error: 'mission_id requis' }, { status: 400 })

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
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
  if (mission.client_id !== user.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  if (mission.status === 'completed') return NextResponse.json({ ok: true })

  if (mission.status !== 'pending_validation') {
    return NextResponse.json({ error: `Impossible de valider — statut actuel : ${mission.status}` }, { status: 409 })
  }

  await releaseEscrow(mission_id, mission.artisan_id)

  if (mission.artisan_id) {
    const { data: artisanPro } = await supabaseAdmin
      .from('artisan_pros').select('user_id').eq('id', mission.artisan_id).single()
    if (artisanPro?.user_id) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://afrione-sepia.vercel.app'}/api/push-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: artisanPro.user_id,
          title: 'AfriOne — Paiement libéré !',
          body: 'Le client a validé la mission. Le paiement est maintenant disponible sur votre wallet.',
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://afrione-sepia.vercel.app'}/artisan-space/portefeuille`,
        }),
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
