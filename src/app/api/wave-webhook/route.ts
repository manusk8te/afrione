/**
 * Wave Webhook Handler
 * ─────────────────────────────────────────────────────────────────────────────
 * Configure this URL in Wave Business dashboard → Settings → Webhooks:
 *   https://afrione-sepia.vercel.app/api/wave-webhook
 *
 * Wave sends POST requests signed with HMAC-SHA256.
 * Verify with the header:  Wave-Signature: t=<timestamp>,v1=<hmac>
 *
 * ENV VAR required:
 *   WAVE_WEBHOOK_SECRET   → from Wave Business dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function verifyWaveSignature(payload: string, signature: string, secret: string): boolean {
  // Header format: t=<timestamp>,v1=<hmac_hex>
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')))
  const timestamp = parts['t']
  const hmac = parts['v1']
  if (!timestamp || !hmac) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('Wave-Signature') || ''
  const secret = process.env.WAVE_WEBHOOK_SECRET

  // Verify signature in production
  if (secret && !verifyWaveSignature(rawBody, signature, secret)) {
    console.error('[Wave Webhook] Invalid signature')
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  console.log('[Wave Webhook] Event received:', event.type)

  // ── checkout.session.completed ────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const { client_reference: missionId, amount, id: sessionId } = event.data

    if (!missionId) {
      return Response.json({ error: 'Missing client_reference' }, { status: 400 })
    }

    // 1. Idempotence — rejeter si cet event a déjà été traité
    if (sessionId) {
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('wave_transaction_id', sessionId)
        .maybeSingle()
      if (existing) {
        console.log('[Wave Webhook] Event déjà traité, ignoré:', sessionId)
        return Response.json({ received: true })
      }
    }

    const totalAmount   = Number(amount)
    const platformFee   = Math.round(totalAmount * 0.12)
    const artisanAmount = totalAmount - platformFee

    // 2. Update mission: total_price + status payment
    await supabase
      .from('missions')
      .update({ total_price: totalAmount, status: 'payment' })
      .eq('id', missionId)

    // 3. Get mission to find artisan
    const { data: mission } = await supabase
      .from('missions')
      .select('artisan_id, client_id')
      .eq('id', missionId)
      .single()

    // 4. Insérer la transaction en escrow (clé pour releaseEscrow)
    await supabase.from('transactions').insert({
      mission_id:           missionId,
      wave_transaction_id:  sessionId || null,
      amount:               totalAmount,
      platform_fee:         platformFee,
      artisan_amount:       artisanAmount,
      status:               'escrow',
      payment_method:       'wave',
      created_at:           new Date().toISOString(),
    })

    if (mission?.artisan_id) {
      // 5. Créditer l'escrow du wallet artisan
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('artisan_id', mission.artisan_id)
        .maybeSingle()

      if (wallet) {
        await supabase.from('wallets').update({
          balance_escrow: (wallet.balance_escrow || 0) + artisanAmount,
        }).eq('artisan_id', mission.artisan_id)
      } else {
        await supabase.from('wallets').insert({
          artisan_id:        mission.artisan_id,
          balance_escrow:    artisanAmount,
          balance_available: 0,
          total_earned:      0,
        })
      }
    }

    // 6. Message système dans le chat
    await supabase.from('chat_history').insert({
      mission_id:  missionId,
      sender_id:   mission?.client_id,
      sender_role: 'client',
      text:        `💳 Paiement de ${totalAmount.toLocaleString('fr-FR')} FCFA confirmé via Wave (réf. ${sessionId?.slice(0, 8)}). Fonds sécurisés jusqu'à la fin de la mission.`,
      type:        'system',
    })

    return Response.json({ received: true })
  }

  // ── checkout.session.expired / failed ─────────────────────────────────────
  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.failed') {
    const { client_reference: missionId } = event.data
    // Optionally revert status or notify client
    console.log(`[Wave Webhook] Session ${event.type} for mission ${missionId}`)
    return Response.json({ received: true })
  }

  // Unknown event — acknowledge to avoid Wave retries
  return Response.json({ received: true })
}
