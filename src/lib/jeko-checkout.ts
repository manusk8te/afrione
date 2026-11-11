import { supabaseAdmin } from '@/lib/supabase'

export function jekoSettings() {
  const { JEKO_API_KEY: key, JEKO_API_KEY_ID: keyId, JEKO_STORE_ID: storeId,
    JEKO_WEBHOOK_SECRET: secret, NEXT_PUBLIC_APP_URL: appUrl } = process.env
  return key && keyId && storeId && secret && appUrl ? { key, keyId, storeId, secret, appUrl } : null
}

export async function jekoRequest(path: string, settings: NonNullable<ReturnType<typeof jekoSettings>>, body?: object) {
  return fetch(`https://api.jeko.africa/partner_api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': settings.key,
      'X-API-KEY-ID': settings.keyId,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
}

type Checkout = { id: string; store_id: string; amount: number; request_id: string | null }
type Payment = { id: string; storeId: string; reference: string; paymentMethod: string; status: string;
  transaction?: { status: string; amount: { amount: number; currency: string } } }

export async function reconcileJekoPayment(checkout: Checkout, payment: Payment) {
  if (!payment.id || payment.storeId !== checkout.store_id || payment.reference !== checkout.id ||
      payment.paymentMethod !== 'wave' || (checkout.request_id && checkout.request_id !== payment.id)) {
    throw new Error('Référence de paiement Jèko incohérente')
  }

  if (payment.status !== 'success') return payment.status
  if (payment.transaction?.status !== 'success' || payment.transaction.amount?.currency !== 'XOF' ||
      payment.transaction.amount.amount !== checkout.amount * 100) {
    throw new Error('Montant du paiement Jèko incohérent')
  }

  const { data, error } = await supabaseAdmin.rpc('confirm_jeko_checkout', {
    checkout_id: checkout.id, provider_id: payment.id,
  })
  if (error || !data) throw new Error('Confirmation du paiement indisponible')
  return data as string
}
