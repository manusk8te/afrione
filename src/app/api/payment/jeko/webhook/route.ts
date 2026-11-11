import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { jekoRequest, jekoSettings, reconcileJekoPayment } from '@/lib/jeko-checkout'
import { startPaidUrgentDispatch } from '@/lib/dispatch'
import { supabaseAdmin } from '@/lib/supabase'

const transaction = z.object({
  status: z.enum(['success', 'error']),
  transactionType: z.literal('payment'),
  paymentMethod: z.string(),
  amount: z.object({ amount: z.number().int(), currency: z.string() }).optional(),
  storeId: z.string().uuid(),
  transactionDetails: z.object({ id: z.string().min(1), reference: z.string().nullish(), paymentLinkId: z.string().uuid().nullish() }),
})

export async function POST(req: Request) {
  const settings = jekoSettings()
  if (!settings) return new Response(null, { status: 503 })
  const raw = await req.text()
  const signature = req.headers.get('jeko-signature') ?? ''
  const expected = createHmac('sha256', settings.secret).update(raw).digest()
  if (!/^[a-f0-9]{64}$/i.test(signature) || !timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
    return new Response(null, { status: 401 })
  }

  if (req.headers.get('jeko-event') !== 'TRANSACTION_COMPLETED') return new Response(null, { status: 204 })
  const parsed = transaction.safeParse(await new Response(raw).json().catch(() => null))
  if (!parsed.success) return new Response(null, { status: 204 })
  const { transactionDetails, storeId } = parsed.data
  if (transactionDetails.paymentLinkId) {
    if (parsed.data.status !== 'success') return new Response(null, { status: 204 })
    const { data: checkout, error } = await supabaseAdmin.from('jeko_checkouts')
      .select('id,store_id,amount,mission_id,urgent_before_matching').eq('payment_link_id', transactionDetails.paymentLinkId).maybeSingle()
    if (error) return new Response(null, { status: 503 })
    if (!checkout || checkout.store_id !== storeId || parsed.data.amount?.currency !== 'XOF' ||
        parsed.data.amount.amount !== checkout.amount * 100) return new Response(null, { status: 204 })

    const { data: status, error: confirmError } = await supabaseAdmin.rpc('confirm_jeko_checkout', {
      checkout_id: checkout.id, provider_id: transactionDetails.paymentLinkId,
    })
    if (confirmError) return new Response(null, { status: 503 })
    if (status === 'paid' && checkout.urgent_before_matching) {
      try {
        const { data: mission, error } = await supabaseAdmin.from('missions').select('status,category')
          .eq('id', checkout.mission_id).single()
        if (error) throw error
        if (mission.status === 'payment') await startPaidUrgentDispatch(checkout.mission_id, mission.category)
      } catch (error) {
        console.error('[jeko] Urgent dispatch unavailable', error)
        return new Response(null, { status: 503 })
      }
    }
    return new Response(null, { status: 204 })
  }

  if (parsed.data.paymentMethod !== 'wave' || !z.string().uuid().safeParse(transactionDetails.reference).success) {
    return new Response(null, { status: 204 })
  }
  const { data: checkout, error } = await supabaseAdmin.from('jeko_checkouts')
    .select('id,store_id,amount,status,request_id').eq('id', transactionDetails.reference).maybeSingle()
  if (error) return new Response(null, { status: 503 })
  if (!checkout || checkout.store_id !== storeId) return new Response(null, { status: 204 })

  try {
    const response = await jekoRequest(`/payment_requests/${encodeURIComponent(transactionDetails.id)}`, settings)
    if (!response.ok) return new Response(null, { status: 503 })
    const status = await reconcileJekoPayment(checkout, await response.json())
    if (status === 'error' && parsed.data.status === 'error') {
      const { error: updateError } = await supabaseAdmin.from('jeko_checkouts')
        .update({ status: 'error', request_id: transactionDetails.id })
        .eq('id', checkout.id).in('status', ['creating', 'pending'])
      if (updateError) return new Response(null, { status: 503 })
    } else if (status !== 'paid' && status !== 'review') {
      return new Response(null, { status: 503 })
    }
    return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 503 })
  }
}
