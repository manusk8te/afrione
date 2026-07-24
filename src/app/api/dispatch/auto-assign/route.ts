/**
 * POST /api/dispatch/auto-assign
 * Called by Vercel Cron every 2 minutes.
 * For each urgent mission still in 'dispatching' status whose broadcast
 * window has fully expired (all dispatch_attempts.expires_at < now),
 * force-assigns the best-ranked candidate (lowest attempt_number) that
 * has not yet been cancelled, instead of cancelling immediately.
 * Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date().toISOString()
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://afrione-sepia.vercel.app'

  // Find missions still in dispatching status
  const { data: dispatchingMissions } = await supabaseAdmin
    .from('missions')
    .select('id, client_id, category')
    .eq('status', 'dispatching')

  if (!dispatchingMissions?.length) {
    return NextResponse.json({ ok: true, assigned: 0, cancelled: 0 })
  }

  let assigned = 0
  let cancelled = 0

  for (const mission of dispatchingMissions) {
    // Check if ALL dispatch attempts for this mission have expired
    const { data: pendingAttempts } = await supabaseAdmin
      .from('dispatch_attempts')
      .select('id')
      .eq('mission_id', mission.id)
      .is('response', null)
      .gt('expires_at', now)

    // Still has live attempts — skip, let the normal flow handle it
    if (pendingAttempts && pendingAttempts.length > 0) continue

    // All attempts expired — pick the best-ranked candidate (lowest attempt_number)
    const { data: bestAttempt } = await supabaseAdmin
      .from('dispatch_attempts')
      .select('artisan_id, attempt_number')
      .eq('mission_id', mission.id)
      .is('response', null)
      .order('attempt_number', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!bestAttempt) {
      // No candidates at all — cancel and refund
      await supabaseAdmin
        .from('missions')
        .update({ status: 'cancelled' })
        .eq('id', mission.id)
        .eq('status', 'dispatching')

      await supabaseAdmin
        .from('transactions')
        .update({ status: 'refunded', released_at: now })
        .eq('mission_id', mission.id)
        .eq('status', 'escrow')

      await supabaseAdmin.from('chat_history').insert({
        mission_id:  mission.id,
        sender_id:   mission.client_id,
        sender_role: 'system',
        sender_type: 'afrione_system',
        text:        '😔 Aucun artisan disponible n\'a pu accepter ta mission urgente. Tu seras remboursé intégralement sous 24h.',
        type:        'system',
      })

      cancelled++
      continue
    }

    const artisanId = bestAttempt.artisan_id

    // Atomic claim — only proceeds if mission is still dispatching
    const { data: claimed } = await supabaseAdmin
      .from('missions')
      .update({ status: 'en_route', artisan_id: artisanId })
      .eq('id', mission.id)
      .eq('status', 'dispatching')
      .select('id')
      .maybeSingle()

    if (!claimed) continue // Another process already claimed it

    // Mark all attempts as auto-assigned / cancelled
    await supabaseAdmin
      .from('dispatch_attempts')
      .update({ response: 'cancelled', responded_at: now })
      .eq('mission_id', mission.id)
      .is('response', null)
      .neq('artisan_id', artisanId)

    await supabaseAdmin
      .from('dispatch_attempts')
      .update({ response: 'accepted', responded_at: now })
      .eq('mission_id', mission.id)
      .eq('artisan_id', artisanId)
      .is('response', null)

    // Credit artisan escrow wallet
    const { data: tx } = await supabaseAdmin
      .from('transactions')
      .select('artisan_amount')
      .eq('mission_id', mission.id)
      .eq('status', 'escrow')
      .maybeSingle()

    if (tx?.artisan_amount) {
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('id, balance_escrow')
        .eq('artisan_id', artisanId)
        .maybeSingle()

      if (wallet) {
        await supabaseAdmin
          .from('wallets')
          .update({ balance_escrow: (wallet.balance_escrow || 0) + tx.artisan_amount })
          .eq('artisan_id', artisanId)
      } else {
        await supabaseAdmin.from('wallets').insert({
          artisan_id:        artisanId,
          balance_escrow:    tx.artisan_amount,
          balance_available: 0,
          total_earned:      0,
        })
      }
    }

    // Notify artisan
    const { data: artisanUser } = await supabaseAdmin
      .from('artisan_pros')
      .select('user_id')
      .eq('id', artisanId)
      .maybeSingle()

    if (artisanUser?.user_id) {
      fetch(`${APP_URL}/api/push-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: artisanUser.user_id,
          title:   'AfriOne — Mission assignée',
          body:    `${mission.category} — Tu as été sélectionné automatiquement. Rends-toi chez le client !`,
          url:     `${APP_URL}/artisan-space/dashboard`,
        }),
      }).catch(() => {})
    }

    // System message in chat
    await supabaseAdmin.from('chat_history').insert({
      mission_id:  mission.id,
      sender_id:   mission.client_id,
      sender_role: 'system',
      sender_type: 'afrione_system',
      text:        '✅ Un artisan a été assigné automatiquement à ta mission urgente. Il est en route vers toi !',
      type:        'system',
    })

    assigned++
  }

  return NextResponse.json({ ok: true, assigned, cancelled })
}
