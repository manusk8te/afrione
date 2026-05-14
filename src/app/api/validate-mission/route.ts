/**
 * POST /api/validate-mission
 * Client valide la mission → escrow libéré vers artisan, status → 'completed'
 * Body : { mission_id }
 * Auth : Bearer token Supabase (client de la mission uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

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

  // Idempotent
  if (mission.status === 'completed') return NextResponse.json({ ok: true })

  if (mission.status !== 'pending_validation') {
    return NextResponse.json({ error: `Impossible de valider — statut actuel : ${mission.status}` }, { status: 409 })
  }

  await releaseEscrow(mission_id, mission.artisan_id)

  // Notifier l'artisan
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

export async function releaseEscrow(mission_id: string, artisan_id: string | null) {
  // Récupérer la transaction escrow
  const { data: tx } = await supabaseAdmin
    .from('transactions')
    .select('id, artisan_amount')
    .eq('mission_id', mission_id)
    .eq('status', 'escrow')
    .maybeSingle()

  const artisanAmount = tx?.artisan_amount || 0

  if (artisanAmount > 0 && artisan_id) {
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('id, balance_escrow, balance_available, total_earned')
      .eq('artisan_id', artisan_id)
      .maybeSingle()

    if (wallet) {
      await supabaseAdmin.from('wallets').update({
        balance_escrow:    Math.max(0, (wallet.balance_escrow || 0) - artisanAmount),
        balance_available: (wallet.balance_available || 0) + artisanAmount,
        total_earned:      (wallet.total_earned || 0) + artisanAmount,
        updated_at:        new Date().toISOString(),
      }).eq('artisan_id', artisan_id)
    }

    if (tx) {
      await supabaseAdmin.from('transactions').update({
        status: 'released', released_at: new Date().toISOString(),
      }).eq('id', tx.id)
    }
  }

  await supabaseAdmin.from('missions').update({
    status:       'completed',
    updated_at:   new Date().toISOString(),
  }).eq('id', mission_id)
}
