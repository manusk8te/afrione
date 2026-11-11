'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { clientApi } from '@/lib/client-api'

type Quote = {
  total?: number | null
  category?: string
  service_total?: number | null
  materials_total?: number
  payment_simulation_id?: string | null
  checkout?: { id: string; status: string; amount: number; urgent_before_matching: boolean } | null
  quote_request?: { status?: string }
}

export default function ClientQuote({
  missionId, revision = 0, estimate, estimating, reason, preferredArtisan,
}: {
  missionId?: string
  preferredArtisan?: string | null
  revision?: number
  estimate?: number
  estimating?: boolean
  reason?: string | null
}) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!!missionId)
  const [requestSaved, setRequestSaved] = useState(false)

  useEffect(() => {
    if (!missionId) return
    let active = true
    setLoading(true)
    clientApi(`/api/quote?mission_id=${missionId}&revision=${revision}`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw Error(data.error)
        if (active) {
          setQuote(data)
          setRequestSaved(data.quote_request?.status === 'requested')
        }
      })
      .catch(error => { if (active) setMessage(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [missionId, revision])

  async function requestQuote() {
    setBusy(true)
    try {
      const response = await clientApi('/api/quote-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: missionId }),
      })
      const data = await response.json()
      if (!response.ok) throw Error(data.error)
      setMessage('Demande de prix enregistrée.')
      setRequestSaved(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Demande impossible')
    } finally {
      setBusy(false)
    }
  }

  const amount = quote?.checkout?.amount || quote?.total || estimate
  const category = encodeURIComponent(quote?.category ?? '')
  const artisanQuery = preferredArtisan ? `&artisan=${encodeURIComponent(preferredArtisan)}` : ''
  const calculating = !amount && (loading || estimating)

  return (
    <section className="diagnostic-price" aria-label="Prix de votre intervention">
      <p className="diagnostic-price-brand">Powered by AfriOne</p>
      <h1 className="diagnostic-price-amount" aria-live="polite">
        {amount ? <>{amount.toLocaleString('fr-FR')} <span>FCFA</span></> : calculating ? 'Calcul du prix…' : 'Prix à confirmer'}
      </h1>
      {amount ? <p>{quote?.checkout?.status === 'paid' ? 'Montant payé sur Jèko' : 'Estimation de votre intervention'}</p> : !calculating && reason && <p>{reason}</p>}
      {!!quote?.materials_total && (
        <details>
          <summary>Détail du prix</summary>
          <p>Prestation · {quote.service_total?.toLocaleString('fr-FR')} FCFA</p>
          <p>Fournitures confirmées · {quote.materials_total.toLocaleString('fr-FR')} FCFA</p>
        </details>
      )}
      {message && <p role="status">{message}</p>}
      {quote?.checkout ? (
        <Link className="diagnostic-price-action" href={quote.checkout.status === 'paid' && quote.checkout.urgent_before_matching
          ? `/dispatch/${missionId}?paid=jeko`
          : `/payment/jeko?mission=${missionId}&checkout=${quote.checkout.id}`}>
          {quote.checkout.status === 'paid' ? 'Suivre mon intervention' : 'Reprendre le paiement Jèko'} <ArrowRight size={16} />
        </Link>
      ) : quote?.payment_simulation_id ? (
        <Link className="diagnostic-price-action" href={`/payment/success?mission=${missionId}`}>Voir le reçu <ArrowRight size={16} /></Link>
      ) : quote?.total ? (
        <Link className="diagnostic-price-action" href={`/mode-select?mission=${missionId}&category=${category}${artisanQuery}`}>Choisir une intervention <ArrowRight size={16} /></Link>
      ) : requestSaved ? (
        <Link className="diagnostic-price-action" href={`/matching?mission=${missionId}&category=${category}${artisanQuery}`}>Choisir un artisan <ArrowRight size={16} /></Link>
      ) : !calculating && (
        <button className="diagnostic-price-action" type="button" disabled={busy || !missionId} onClick={requestQuote}>
          {busy ? 'Enregistrement…' : 'Demander un prix'} <ArrowRight size={16} />
        </button>
      )}
    </section>
  )
}
