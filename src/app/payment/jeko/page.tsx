'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { clientApi } from '@/lib/client-api'

const messages: Record<string, string> = {
  creating: 'La demande de paiement est en cours de vérification.',
  pending: 'Nous attendons la confirmation de Jèko.',
  paid: 'Paiement Jèko confirmé.',
  error: 'Le paiement a échoué. Retournez à la mission pour réessayer.',
  review: 'Paiement reçu. AfriOne doit vérifier le devis avant de poursuivre.',
}

function CheckoutStatus() {
  const params = useSearchParams()
  const mission = params.get('mission')
  const checkout = params.get('checkout')
  const autoOpen = params.get('open') === '1'
  const [payment, setPayment] = useState<{ status: string; amount: number; url: string | null; urgent: boolean }>()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!mission || !checkout) {
      setError('Référence de paiement manquante.')
      return
    }

    let active = true
    let timer: ReturnType<typeof setTimeout>
    const query = new URLSearchParams({ mission, checkout })
    async function refresh() {
      try {
        const response = await clientApi(`/api/payment/jeko?${query}`, { cache: 'no-store' })
        const result = await response.json()
        if (!active) return
        if (!response.ok) throw new Error(result.error)
        if (autoOpen && result.status === 'pending' && result.url) {
          window.history.replaceState(null, '', `/payment/jeko?${query}`)
          window.location.assign(result.url)
          return
        }
        if (result.status === 'paid' && result.urgent) {
          window.location.replace(`/dispatch/${encodeURIComponent(mission!)}?paid=jeko`)
          return
        }
        setPayment(result)
        setError('')
        if (['pending', 'creating'].includes(result.status)) timer = setTimeout(refresh, 6000)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Le suivi du paiement est indisponible.')
      }
    }

    void refresh()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [mission, checkout, autoOpen])

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
    <section className="card" style={{ maxWidth: 520, width: '100%', padding: 28 }}>
      <p>AfriOne · Jèko Checkout</p>
      <h1>Suivi du paiement Jèko</h1>
      {error ? <p role="alert">{error}</p> : <p role="status">{payment ? messages[payment.status] || messages.pending : 'Vérification du paiement…'}</p>}
      {payment && <p><strong>{payment.amount.toLocaleString('fr-FR')} FCFA</strong></p>}
      {payment?.status === 'pending' && payment.url && <p><a href={payment.url}>Ouvrir le paiement Jèko</a></p>}
      {mission && <Link href={`/warroom/${encodeURIComponent(mission)}`}>Retour à la mission</Link>}
    </section>
  </main>
}

export default function Page() {
  return <Suspense fallback={<p>Chargement du paiement…</p>}><CheckoutStatus /></Suspense>
}
