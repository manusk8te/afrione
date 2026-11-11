'use client'

import { useState } from 'react'
import '@/styles/warroom.css'
import { nextStepHint } from '@/lib/mission-roles'
import {
  ChatBubble, Composer, MissionProgress, SummaryCard, SystemNote, WarRoomHeader, type WarRole,
} from '@/components/warroom/ui'

/* Aperçu de la War Room avec des données fictives : même composants et même CSS
   que la vraie page, sans connexion ni base de données. */

const STATUSES: { value: string; label: string }[] = [
  { value: 'negotiation', label: 'En discussion' },
  { value: 'payment', label: 'Paiement' },
  { value: 'scheduled', label: 'Intervention programmée' },
  { value: 'en_cours', label: 'Mission en cours' },
  { value: 'pending_validation', label: 'En attente de validation' },
  { value: 'completed', label: 'Mission terminée' },
  { value: 'disputed', label: 'Litige en cours' },
]

const MESSAGES = [
  { who: 'other', afrione: false, text: 'Bonjour, j’ai vu votre demande pour la fuite sous l’évier. Vous pouvez m’envoyer une photo ?', time: '09:12' },
  { who: 'me', afrione: false, text: 'Bonjour ! Oui, je vous l’envoie tout de suite. Le robinet goutte aussi un peu.', time: '09:14' },
  { who: 'system', text: 'Devis envoyé : 12 500 FCFA (main-d’œuvre 3 000, matériel 9 500).', time: '09:20', afrione: true },
  { who: 'other', afrione: false, text: 'Je peux passer demain à 10 h si le devis vous convient.', time: '09:21' },
  { who: 'system', afrione: false, time: '09:25', text: 'Le client a accepté le devis.' },
]

export default function WarRoomPreview() {
  const [role, setRole] = useState<WarRole>('client')
  const [status, setStatus] = useState('negotiation')
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const label = STATUSES.find(s => s.value === status)?.label ?? ''
  const hint = nextStepHint(role === 'guest' ? 'client' : role, status)
  const other = role === 'artisan' ? 'Awa Koné (cliente)' : 'Koffi Yao · Plombier'
  const open_ = () => setOpen(true)
  const actions: Record<string, Record<string, string>> = {
    artisan: { negotiation: 'Ouvrir le devis', scheduled: 'Démarrer le suivi', en_cours: 'Photos et clôture' },
    client: { negotiation: 'Voir le devis et payer', payment: 'Choisir le moment', scheduled: 'Voir le suivi', en_cours: 'Suivre l’intervention', pending_validation: 'Valider les travaux' },
  }
  const label_ = actions[role]?.[status]
  const action = label_ ? { label: label_, onClick: open_ } : null

  return (
    <div style={{ minHeight: '100vh', background: '#f1ece6', padding: '12px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 12, font: '600 13px Inter, sans-serif' }}>
        {(['client', 'artisan'] as const).map(r => (
          <button key={r} onClick={() => setRole(r)} aria-pressed={role === r}
            style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid #c9b8aa', background: role === r ? '#c2410c' : '#fff', color: role === r ? '#fff' : '#1f1611', cursor: 'pointer' }}>
            Vue {r}
          </button>
        ))}
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Statut"
          style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid #c9b8aa', background: '#fff' }}>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="mobile-warroom mission-mobile afrione-conversation" style={{ display: 'flex', flexDirection: 'column', height: 'min(860px, calc(100dvh - 72px))', position: 'relative' }}>
        <WarRoomHeader
          backHref="/design"
          name={other}
          statusLabel={label}
          phone={role === 'client' ? '+22501020304' : null}
          phoneLabel="Appeler Koffi Yao"
          showDiagnostic
          detailsOpen={open}
          onToggleDetails={() => setOpen(o => !o)}
        >
          <MissionProgress status={status} role={role} statusLabel={label} hint={hint} action={action} />
        </WarRoomHeader>

        {!open && (
          <SummaryCard
            title="Plomberie"
            place="Cocody, Riviera 2"
            statusLabel={label}
            priceLabel="Estimation"
            priceValue="12 500 FCFA"
            hint={hint}
            action={action}
            onOpen={() => setOpen(true)}
          />
        )}

        {open && (
          <div id="conversation-mission-details" className="afrione-conversation-details">
            <div className="warroom-quote-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
              <header style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Devis</strong><span className="warroom-quote-status" data-status="included">Accepté</span></header>
              <div className="warroom-quote-line" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Main-d’œuvre</span><span>3 000 FCFA</span></div>
              <div className="warroom-quote-line" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Matériel</span><span>9 500 FCFA</span></div>
              <div className="warroom-quote-total" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total</span><strong>12 500 FCFA</strong></div>
            </div>
          </div>
        )}

        <div className="afrione-conversation-thread" aria-label="Messages de la mission">
          <div style={{ maxWidth: 672, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MESSAGES.map((m, i) =>
              m.who === 'system'
                ? <SystemNote key={i} text={m.text} time={m.time} afrione={m.afrione} />
                : <ChatBubble key={i} own={(m.who === 'me') === (role === 'client')} text={m.text} time={m.time} />,
            )}
          </div>
        </div>

        <div className="warroom-composer">
          <div style={{ maxWidth: 672, margin: '0 auto' }}>
            <Composer value={input} onChange={setInput} onSend={() => setInput('')} />
          </div>
        </div>
      </div>
    </div>
  )
}
