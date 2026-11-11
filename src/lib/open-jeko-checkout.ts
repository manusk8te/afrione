import { clientApi } from '@/lib/client-api'

export async function openJekoCheckout(missionId: string, urgent = false) {
  const params = new URLSearchParams({ mission_id: missionId })
  const quoteResponse = await clientApi(`/api/quote?${params}`, { cache: 'no-store' })
  const quote = await quoteResponse.json()
  if (!quoteResponse.ok || !quote.total || !quote.quote_revision) {
    throw new Error(quote.error || 'Précisez le devis et confirmez les fournitures avant de payer.')
  }
  const response = await clientApi('/api/payment/jeko', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mission_id: missionId, quote_revision: quote.quote_revision, urgent }),
  })
  const result = await response.json()
  if (!response.ok || !result.url) throw new Error(result.error || 'Le paiement Jèko est indisponible.')
  return result.url as string
}
