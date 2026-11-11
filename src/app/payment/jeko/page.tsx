'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import Brand from '@/components/brand/Brand'
import { clientApi } from '@/lib/client-api'

type State = 'loading' | 'creating' | 'pending' | 'paid' | 'review' | 'error'

const COPY: Record<State, { title: string; text: string }> = {
  loading: { title: 'Vérification du paiement', text: 'Un instant, nous retrouvons votre paiement.' },
  creating: { title: 'Préparation du paiement', text: 'Nous préparons votre demande de paiement Jèko.' },
  pending: { title: 'Paiement en attente', text: 'Dès que Jèko confirme votre paiement, cette page se met à jour toute seule.' },
  paid: { title: 'Paiement confirmé', text: 'Merci. Votre paiement est bien reçu et la mission peut avancer.' },
  review: { title: 'Paiement reçu', text: 'AfriOne vérifie le devis avant de poursuivre. Vous serez prévenu dès que c’est fait.' },
  error: { title: 'Le paiement n’a pas abouti', text: 'Aucun montant n’a été débité. Retournez à la mission pour réessayer.' },
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

  const state: State = error ? 'error' : payment ? ((payment.status in COPY ? payment.status : 'pending') as State) : 'loading'
  const copy = COPY[state]
  const tone = state === 'paid' || state === 'review' ? 'ok' : state === 'error' ? 'error' : undefined
  const busy = state === 'loading' || state === 'creating' || state === 'pending'
  const back = mission ? `/warroom/${encodeURIComponent(mission)}` : '/dashboard'

  return (
    <main className="pay-shell afrione-gradient">
      <section className="pay-card" aria-labelledby="pay-title">
        <div className="pay-brand"><Brand /></div>

        <div className="pay-icon" data-tone={tone} aria-hidden="true">
          {busy ? <Loader2 size={30} className="pay-spin" /> : tone === 'error' ? <AlertTriangle size={30} /> : <CheckCircle2 size={30} />}
        </div>

        <h1 id="pay-title" className="pay-title">{copy.title}</h1>
        {error ? <p className="pay-error" role="alert">{error}</p> : <p className="pay-text" role="status">{copy.text}</p>}

        {payment && payment.amount > 0 && (
          <p className="pay-amount">{payment.amount.toLocaleString('fr-FR')} <small>FCFA</small></p>
        )}

        {(state === 'pending' || state === 'creating' || state === 'paid' || state === 'review') && (
          <p className="pay-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Votre argent reste bloqué en séquestre. L’artisan n’est payé que lorsque vous validez le travail.</span>
          </p>
        )}

        <div className="pay-actions">
          {state === 'pending' && payment?.url && (
            <a className="pay-btn pay-btn--primary" href={payment.url}>Ouvrir le paiement Jèko</a>
          )}
          <Link className={`pay-btn ${state === 'pending' && payment?.url ? 'pay-btn--ghost' : 'pay-btn--primary'}`} href={back}>
            {state === 'error' ? 'Retour à la mission pour réessayer' : 'Retour à la mission'}
          </Link>
        </div>
      </section>
    </main>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<main className="pay-shell afrione-gradient"><section className="pay-card"><p className="pay-text">Chargement du paiement…</p></section></main>}>
      <CheckoutStatus />
    </Suspense>
  )
}
