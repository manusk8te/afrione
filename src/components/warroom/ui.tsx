'use client'

import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, FileText, Phone, Send, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

/* ─────────────────────────────────────────────────────────────────────────────
 * Pièces visuelles de la War Room. Elles ne contiennent aucune logique métier :
 * la page leur passe des données et des actions, et la page d'aperçu
 * (/design/warroom) les utilise avec des données fictives.
 * ──────────────────────────────────────────────────────────────────────────── */

export type WarRole = 'client' | 'artisan' | 'admin' | 'guest'

const STEPS = ['Discussion', 'Paiement', 'Intervention', 'Validation', 'Terminé'] as const

const STATUS_STEP: Record<string, number> = {
  diagnostic: 0, dispatching: 0, matching: 0, negotiation: 0,
  payment: 1,
  scheduled: 2, en_route: 2, en_cours: 2,
  pending_validation: 3,
  completed: 4,
}

const ROLE_LABEL: Record<WarRole, string | null> = {
  client: 'Vous êtes le client',
  artisan: 'Vous êtes l’artisan',
  admin: 'Vue administrateur',
  guest: null,
}

/** Texte court et sans emoji pour un statut (le libellé complet reste dans la page). */
export function cleanStatus(label: string) {
  return label.replace(/^[^A-Za-zÀ-ÿ0-9]+/, '').trim()
}

/* ── Avancement ───────────────────────────────────────────────────────────── */
export function MissionProgress({
  status, role, statusLabel, hint,
}: { status: string; role: WarRole; statusLabel: string; hint?: string }) {
  const special = status === 'cancelled' || status === 'disputed'
  const index = STATUS_STEP[status] ?? 0
  const roleLabel = ROLE_LABEL[role]

  return (
    <div className="wr-progress" role="group" aria-label="Avancement de la mission">
      <div className="wr-progress__row">
        <span className="wr-progress__label">
          {special ? (
            <strong data-tone={status === 'disputed' ? 'danger' : 'muted'}>{cleanStatus(statusLabel)}</strong>
          ) : (
            <>
              <strong>{STEPS[index]}</strong>
              <span> · étape {index + 1} sur {STEPS.length}</span>
            </>
          )}
        </span>
        {roleLabel && <span className="wr-role" data-role={role}>{roleLabel}</span>}
      </div>

      <ol className="wr-progress__bar" aria-hidden="true">
        {STEPS.map((step, i) => (
          <li
            key={step}
            data-state={special ? 'off' : i < index ? 'done' : i === index ? 'current' : 'todo'}
            data-tone={special ? (status === 'disputed' ? 'danger' : 'muted') : undefined}
          />
        ))}
      </ol>

      {hint && (
        <p className="wr-hint">
          <Sparkles size={14} aria-hidden="true" />
          <span>{hint}</span>
        </p>
      )}
    </div>
  )
}

/* ── En-tête ──────────────────────────────────────────────────────────────── */
export function WarRoomHeader({
  backHref, name, avatar, statusLabel, statusTone, phone, phoneLabel,
  showDiagnostic, diagnosticOpen, onToggleDiagnostic,
  detailsOpen, onToggleDetails, children,
}: {
  backHref: string
  name: string
  avatar?: string | null
  statusLabel: string
  statusTone?: string
  phone?: string | null
  phoneLabel?: string
  showDiagnostic?: boolean
  diagnosticOpen?: boolean
  onToggleDiagnostic?: () => void
  detailsOpen: boolean
  onToggleDetails: () => void
  /** Zone sous la ligne principale (avancement). */
  children?: ReactNode
}) {
  const initials = String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <header className="afrione-conversation-header">
      <div className="warroom-header-content">
        <Link className="warroom-icon-button" href={backHref} aria-label="Retour aux missions">
          <ArrowLeft size={19} />
        </Link>
        <div className="warroom-avatar" aria-hidden="true">
          {avatar ? <img src={avatar} alt="" /> : initials}
        </div>
        <div className="warroom-participant">
          <div className="warroom-participant-name">{name}</div>
          <div className="warroom-participant-status" data-tone={statusTone}><i />{cleanStatus(statusLabel)}</div>
        </div>
        {phone && (
          <a className="warroom-icon-button" href={`tel:${phone}`} aria-label={phoneLabel || 'Appeler'}><Phone size={17} /></a>
        )}
        {showDiagnostic && (
          <button type="button" className="warroom-icon-button" aria-label="Ouvrir le diagnostic"
            onClick={onToggleDiagnostic} aria-expanded={!!diagnosticOpen}><FileText size={18} /></button>
        )}
        <button type="button" className="afrione-conversation-details-button"
          aria-expanded={detailsOpen} aria-controls="conversation-mission-details" onClick={onToggleDetails}>
          <span className="wr-long">Devis et suivi</span><span className="wr-short">Devis</span><ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>
      {children}
    </header>
  )
}

/* ── Panneau latéral (ordinateur) ─────────────────────────────────────────── */
export function SummaryCard({
  title, place, statusLabel, priceLabel, priceValue, hint, onOpen,
}: {
  title: string
  place?: string | null
  statusLabel: string
  priceLabel?: string
  priceValue?: string
  hint?: string
  onOpen: () => void
}) {
  return (
    <aside className="warroom-overview" aria-label="Résumé de la mission">
      <div className="warroom-overview-card">
        <p className="wr-eyebrow">Intervention</p>
        <h2>{title}</h2>
        {place && <p className="wr-place">{place}</p>}
        <dl className="wr-facts">
          <div><dt>Statut</dt><dd>{cleanStatus(statusLabel)}</dd></div>
          {priceValue && <div><dt>{priceLabel}</dt><dd>{priceValue}</dd></div>}
        </dl>
        <button type="button" className="warroom-overview-action" onClick={onOpen}>
          Ouvrir le devis et le suivi <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {hint && (
        <div className="wr-next">
          <p className="wr-eyebrow">Prochaine étape</p>
          <p>{hint}</p>
        </div>
      )}
    </aside>
  )
}

/* ── Messages ─────────────────────────────────────────────────────────────── */
export function ChatBubble({ own, text, time, iso }: { own: boolean; text: string; time: string; iso?: string }) {
  return (
    <div className={`afrione-chat-row${own ? ' afrione-chat-row--own' : ''}`}>
      <div className="afrione-chat-bubble">
        <span>{text}</span>
        <time dateTime={iso}>{time}</time>
      </div>
    </div>
  )
}

/** Message système : une ligne discrète, sans carte. `afrione` ajoute le sceau AfriOne. */
export function SystemNote({
  text, time, afrione, severity,
}: { text: string; time?: string; afrione?: boolean; severity?: 'info' | 'warning' | 'critical' }) {
  return (
    <div className="wr-note-row">
      <div className="wr-note" data-afrione={afrione || undefined} data-severity={severity}>
        {afrione && <span className="wr-note__seal"><Sparkles size={12} aria-hidden="true" />AfriOne</span>}
        <span className="wr-note__text">{text}</span>
        {time && <time>{time}</time>}
      </div>
    </div>
  )
}

/* ── Zone de saisie ───────────────────────────────────────────────────────── */
export function Composer({
  value, onChange, onSend, status = 'idle', loading,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  status?: 'idle' | 'sending' | 'sent' | string
  loading?: boolean
}) {
  const canSend = !loading && value.trim().length > 0 && status === 'idle'
  return (
    <form className="wr-composer" onSubmit={e => { e.preventDefault(); if (canSend) onSend() }}>
      <input
        type="text"
        className="wr-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={4000}
        placeholder="Votre message…"
        aria-label="Votre message"
        enterKeyHint="send"
        autoComplete="off"
      />
      <button type="submit" className="wr-send" aria-label="Envoyer le message" disabled={!canSend && status === 'idle'}
        data-status={status}>
        {status === 'sending' ? <span className="wr-spinner" /> : status === 'sent' ? <Check size={18} /> : <Send size={18} />}
      </button>
    </form>
  )
}
