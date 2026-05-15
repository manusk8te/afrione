/**
 * GET /api/cron/auto-validate
 * Appelé chaque heure par Vercel Cron.
 * Valide automatiquement les missions en 'pending_validation' dont la deadline est passée.
 * Protégé par CRON_SECRET (header Authorization: Bearer <secret>).
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { releaseEscrow } from '@/lib/escrow'

export const dynamic = 'force-dynamic'


export async function GET(req: NextRequest) {
  // Vérification du secret Vercel Cron
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date().toISOString()

  // Trouver toutes les missions expirées en attente de validation
  const { data: expired, error } = await supabaseAdmin
    .from('missions')
    .select('id, artisan_id, client_id, total_price, artisan_pros(user_id)')
    .eq('status', 'pending_validation')
    .lt('validation_deadline', now)

  if (error) {
    console.error('[cron/auto-validate]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!expired?.length) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://afrione-sepia.vercel.app'
  let processed = 0

  for (const mission of expired) {
    try {
      await releaseEscrow(mission.id, mission.artisan_id)

      // Message système dans le chat
      await supabaseAdmin.from('chat_history').insert({
        mission_id:  mission.id,
        sender_id:   mission.client_id,
        sender_role: 'system',
        text:        '✅ Mission auto-validée — aucune réponse du client sous 24h. Paiement libéré automatiquement.',
        type:        'system',
      })

      // Notification artisan
      const artisanUserId = (mission.artisan_pros as any)?.user_id
      if (artisanUserId) {
        fetch(`${APP_URL}/api/push-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: artisanUserId,
            title:   'AfriOne — Paiement libéré automatiquement',
            body:    'Le délai de 24h est écoulé. La mission a été validée et le paiement libéré.',
            url:     `${APP_URL}/artisan-space/portefeuille`,
          }),
        }).catch(() => {})
      }

      // Notification client
      if (mission.client_id) {
        fetch(`${APP_URL}/api/push-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: mission.client_id,
            title:   'AfriOne — Mission validée automatiquement',
            body:    'Délai de 24h dépassé. La mission a été validée et le paiement libéré à l\'artisan.',
            url:     `${APP_URL}/warroom/${mission.id}`,
          }),
        }).catch(() => {})
      }

      processed++
    } catch (e: any) {
      console.error(`[cron/auto-validate] mission ${mission.id}:`, e.message)
    }
  }

  return NextResponse.json({ ok: true, processed, total: expired.length })
}
