'use client'

import { useState } from 'react'
import { openJekoCheckout } from '@/lib/open-jeko-checkout'

export default function JekoCheckoutButton({ missionId }: { missionId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function openCheckout() {
    setBusy(true)
    setError('')
    try {
      const url = await openJekoCheckout(missionId)
      window.location.assign(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le paiement Jèko est indisponible.')
      setBusy(false)
    }
  }

  return <>
    <button type="button" className="btn-primary afrione-action" disabled={busy} onClick={openCheckout}>
      {busy ? 'Ouverture de Jèko…' : 'Payer avec Jèko'}
    </button>
    {error && <p role="alert">{error}</p>}
  </>
}
