'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Clock3, Package, X } from 'lucide-react'
import { clientApi } from '@/lib/client-api'

type Kind = 'diagnostic' | 'material' | 'time'
type Adjustment = {
  id: string
  kind: Kind
  label: string
  reason: string
  quantity: number
  minutes: number
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'included'
}
type FinalQuote = {
  amount: number
  base_amount?: number
  adjustment_total?: number
  adjustment_ids?: string[]
  reason: string
}
type Quote = {
  base: number | null
  materials: number
  adjustments: Adjustment[]
  agreement: {
    version: number
    pending: FinalQuote | null
    history: { action: string; payload?: FinalQuote }[]
  } | null
}

const labels = { diagnostic: 'Précision du diagnostic', material: 'Matériau', time: 'Temps supplémentaire' }
const statuses = { pending: 'À valider', approved: 'Accepté', rejected: 'Refusé', included: 'Inclus dans le devis' }
const currency = (amount: number) => `${amount.toLocaleString('fr-FR')} FCFA`

export default function QuoteAdjustments({ missionId, role, editable, openDetails, onChange }: {
  missionId: string
  role: string
  editable: boolean
  openDetails: () => void
  onChange: () => void
}) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [form, setForm] = useState<Kind | 'final' | null>(null)
  const [label, setLabel] = useState('')
  const [reason, setReason] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [minutes, setMinutes] = useState('')
  const [baseInput, setBaseInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const response = await clientApi(`/api/warroom/agreement?mission_id=${missionId}`, { cache: 'no-store' })
    if (!response.ok) throw Error('Le devis est momentanément indisponible.')
    setQuote(await response.json())
  }, [missionId])

  useEffect(() => {
    const load = () => { if (!document.hidden) void refresh().catch(() => {}) }
    load()
    const timer = window.setInterval(load, 5000)
    window.addEventListener('focus', load)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [refresh])

  function open(next: Kind | 'final') {
    setError('')
    setForm(next)
    setLabel('')
    setReason('')
    setQuantity('1')
    setPrice('')
    setMinutes('')
    setBaseInput('')
  }

  async function act(action: string, payload: Record<string, string | number> = {}) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await clientApi('/api/warroom/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: missionId, version: quote?.agreement?.version ?? 0, action, payload }),
      })
      const result = await response.json()
      if (!response.ok) throw Error(result.error)
      setForm(null)
      onChange()
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action indisponible.')
    } finally {
      setBusy(false)
    }
  }

  if (!quote) return null
  const { adjustments, agreement, materials } = quote
  const pending = adjustments.some(item => item.status === 'pending')
  const approvedTotal = adjustments.reduce((total, item) => item.status === 'approved' ? total + item.amount : total, 0)
  const originalBase = quote.base ?? 0
  const base = originalBase || Number(baseInput)
  const subtotal = base + approvedTotal
  const proposed = agreement?.pending
  const awaitingFinal = !!proposed?.adjustment_ids
  const finalQuote = awaitingFinal ? proposed : agreement?.history.slice().reverse().find(event =>
    event.action === 'accept' && event.payload?.adjustment_ids,
  )?.payload
  const isArtisan = role === 'artisan'
  const isClient = role === 'client'
  const addAmount = form === 'diagnostic' ? 0 : Number(price) * (form === 'material' ? Number(quantity) : 1)
  const showComposer = isArtisan && editable && !proposed
  if (!showComposer && !adjustments.length && !finalQuote && !error) return null

  return <section className="warroom-adjustments" aria-label="Ajustements du diagnostic">
    {adjustments.map(item => {
      const Icon = item.kind === 'material' ? Package : item.kind === 'time' ? Clock3 : ClipboardList
      return <article className="warroom-quote-card" key={item.id}>
        <header>
          <span className="warroom-raised-icon"><Icon size={18} aria-hidden="true" /></span>
          <span>{labels[item.kind]}</span>
          <span className="warroom-quote-status" data-status={item.status}>{statuses[item.status]}</span>
        </header>
        <h3>{item.label}</h3>
        <p>{item.reason}</p>
        {item.kind !== 'diagnostic' && <div className="warroom-quote-line">
          <span>{item.kind === 'material' ? `Quantité ${item.quantity} · ${currency(item.amount / item.quantity)} l’unité` : `${item.minutes} min supplémentaires`}</span>
          <strong>+{currency(item.amount)}</strong>
        </div>}
        {isClient && editable && item.status === 'pending' && <div className="warroom-quote-actions">
          <button type="button" className="afrione-action" disabled={busy} onClick={() => act('reject_adjustment', { adjustment_id: item.id })}>Refuser</button>
          <button type="button" className="btn-primary afrione-action" disabled={busy} onClick={() => act('approve_adjustment', { adjustment_id: item.id })}>Accepter l’ajustement</button>
        </div>}
      </article>
    })}
    {finalQuote && <article className="warroom-quote-card warroom-quote-final">
      <header><span className="warroom-raised-icon"><ClipboardList size={18} aria-hidden="true" /></span><span>{awaitingFinal ? 'Devis final à valider' : 'Devis validé'}</span></header>
      <p>{finalQuote.reason}</p>
      <div className="warroom-quote-line"><span>Prix de base</span><strong>{currency(finalQuote.base_amount ?? finalQuote.amount)}</strong></div>
      <div className="warroom-quote-line"><span>Ajustements acceptés</span><strong>{currency(finalQuote.adjustment_total ?? 0)}</strong></div>
      {materials > 0 && <div className="warroom-quote-line"><span>Fournitures confirmées</span><strong>{currency(materials)}</strong></div>}
      <div className="warroom-quote-line warroom-quote-total"><span>Total</span><strong>{currency(finalQuote.amount + materials)}</strong></div>
      {awaitingFinal && isClient && editable && <div className="warroom-quote-actions">
        <button type="button" className="afrione-action" disabled={busy} onClick={() => act('reject')}>Refuser le devis</button>
        <button type="button" className="btn-primary afrione-action" disabled={busy} onClick={() => act('accept')}>Valider le devis final</button>
      </div>}
      {!awaitingFinal && isClient && <button type="button" className="afrione-action" onClick={openDetails}>Voir le devis et le paiement</button>}
    </article>}
    {showComposer && <div className="warroom-quote-toolbar">
      <button type="button" className="afrione-action" disabled={pending || busy} onClick={() => open('diagnostic')}><ClipboardList size={16} /> Préciser</button>
      <button type="button" className="afrione-action" disabled={pending || busy} onClick={() => open('material')}><Package size={16} /> Matériau</button>
      <button type="button" className="afrione-action" disabled={pending || busy} onClick={() => open('time')}><Clock3 size={16} /> Temps</button>
      <button type="button" className="afrione-action" disabled={pending || busy} onClick={() => agreement ? open('final') : openDetails()}>Devis final</button>
    </div>}
    {showComposer && pending && <small>Le client doit répondre à la proposition en cours.</small>}
    {showComposer && form && <form className="warroom-quote-card warroom-quote-form" onSubmit={event => {
      event.preventDefault()
      if (form === 'final') {
        void act('propose_adjusted', { reason: reason.trim(), expected_total: subtotal, ...(!originalBase ? { base_amount: base } : {}) })
      } else {
        void act('add_adjustment', {
          kind: form, label: label.trim(), reason: reason.trim(), amount: addAmount,
          quantity: form === 'material' ? Number(quantity) : 1, minutes: form === 'time' ? Number(minutes) : 0,
        })
      }
    }}>
      <header>
        <strong>{form === 'final' ? 'Préparer le devis final' : labels[form]}</strong>
        <button type="button" className="afrione-action afrione-action--icon" onClick={() => setForm(null)} aria-label="Fermer le formulaire"><X size={18} /></button>
      </header>
      {form !== 'final' && <label>Intitulé<input className="input afrione-field" required minLength={3} maxLength={120} value={label} onChange={event => setLabel(event.target.value)} /></label>}
      <label>{form === 'final' ? 'Note pour le client' : 'Pourquoi cet ajout est nécessaire'}<textarea className="input afrione-field" required minLength={10} maxLength={600} rows={2} value={reason} onChange={event => setReason(event.target.value)} /></label>
      {form === 'material' && <label>Quantité<input className="input afrione-field" type="number" required min={1} max={100} value={quantity} onChange={event => setQuantity(event.target.value)} /></label>}
      {form === 'time' && <label>Temps supplémentaire, en minutes<input className="input afrione-field" type="number" required min={1} max={1440} value={minutes} onChange={event => setMinutes(event.target.value)} /></label>}
      {(form === 'time' || form === 'material') && <label>{form === 'material' ? 'Prix unitaire, FCFA' : 'Supplément de main-d’œuvre, FCFA'}<input className="input afrione-field" type="number" required min={1} max={2000000} value={price} onChange={event => setPrice(event.target.value)} /></label>}
      {form === 'final' && <>
        {originalBase > 0 ? <div className="warroom-quote-line"><span>Prix de base</span><strong>{currency(originalBase)}</strong></div>
          : <label>Prix de base, FCFA<input className="input afrione-field" type="number" required min={1} max={2000000} value={baseInput} onChange={event => setBaseInput(event.target.value)} /></label>}
        <div className="warroom-quote-line"><span>Ajustements acceptés</span><strong>{currency(approvedTotal)}</strong></div>
        {materials > 0 && <div className="warroom-quote-line"><span>Fournitures confirmées</span><strong>{currency(materials)}</strong></div>}
      </>}
      <div className="warroom-quote-line warroom-quote-total"><span>{form === 'final' ? 'Total proposé' : 'Supplément proposé'}</span><strong>{currency(form === 'final' ? subtotal + materials : addAmount)}</strong></div>
      <button className="btn-primary afrione-action" disabled={busy || (form === 'final' ? subtotal + materials : addAmount) > 2000000} type="submit">Envoyer au client</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>
}
