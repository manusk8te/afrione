'use client'

import { useState } from 'react'
import { clientApi } from '@/lib/client-api'

export default function WaveCheckoutButton({ missionId }: { missionId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function openCheckout() {
    setBusy(true)
    setError('')
    try {
      const quoteResponse = await clientApi(`/api/quote?mission_id=${encodeURIComponent(missionId)}`, { cache: 'no-store' })
      const quote = await quoteResponse.json()
      if (!quoteResponse.ok || !quote.total || !quote.quote_revision) {
        throw new Error(quote.error || 'Confirmez d’abord le devis et les fournitures.')
      }
      const response = await clientApi('/api/payment/jeko', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: missionId, quote_revision: quote.quote_revision }),
      })
      const result = await response.json()
      if (!response.ok || !result.url) throw new Error(result.error || 'Le paiement Wave est indisponible.')
      window.location.assign(result.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le paiement Wave est indisponible.')
      setBusy(false)
    }
  }

  return <>
    <button type="button" className="btn-primary afrione-action" disabled={busy} onClick={openCheckout}>
      {busy ? 'Ouverture de Wave…' : 'Payer avec Wave'}
    </button>
    {error && <p role="alert">{error}</p>}
  </>
}
