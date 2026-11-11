'use client'

import { useState } from 'react'
import { ShieldCheck, Trash2, Wallet } from 'lucide-react'
import { Modal } from '@/components/glass/Modal'

type Demo = 'payment' | 'delete' | 'info' | null

export default function DesignPage() {
  const [open, setOpen] = useState<Demo>(null)
  const close = (o: boolean) => !o && setOpen(null)

  return (
    <main className="liquid liquid-mesh">
      <div className="liquid-mesh__blob liquid-mesh__blob--1" aria-hidden="true" />
      <div className="liquid-mesh__blob liquid-mesh__blob--2" aria-hidden="true" />
      <div className="liquid-mesh__blob liquid-mesh__blob--3" aria-hidden="true" />

      <div className="liquid-mesh__content" style={{ maxWidth: 960, margin: '0 auto', padding: '48px 16px 96px' }}>
        <header className="glass" style={{ borderRadius: 'var(--glass-radius-md)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <strong style={{ font: '700 18px/1 var(--font-display, Satoshi, sans-serif)' }}>AfriOne · Liquid Glass</strong>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Étape 1 : tokens, matériau, Modal</span>
        </header>

        <section style={{ marginTop: 40 }}>
          <h1 style={{ font: '800 clamp(32px, 6vw, 52px)/1.05 var(--font-display, Satoshi, sans-serif)', letterSpacing: '-0.02em', margin: 0 }}>
            Le verre sur ton orange
          </h1>
          <p style={{ marginTop: 12, maxWidth: 560, fontSize: 16, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Ouvre les modales pour tester l&apos;animation, le clavier (Tab, Échap) et le rendu en clair et en sombre.
          </p>
        </section>

        <section style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button className="lg-btn lg-btn--primary" onClick={() => setOpen('payment')}>Modal paiement</button>
          <button className="lg-btn lg-btn--glass" onClick={() => setOpen('delete')}>Modal suppression</button>
          <button className="lg-btn lg-btn--glass" onClick={() => setOpen('info')}>Modal simple</button>
          <button className="lg-btn lg-btn--primary" disabled>Désactivé</button>
        </section>

        <section style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { cls: 'glass', name: '.glass', note: 'Nav, toasts, popovers' },
            { cls: 'glass glass--strong', name: '.glass--strong', note: 'Modales, texte long' },
            { cls: 'glass glass--subtle', name: '.glass--subtle', note: 'Cartes flottantes' },
          ].map(s => (
            <div key={s.name} className={s.cls} style={{ borderRadius: 'var(--glass-radius-md)', padding: 22, minHeight: 130 }}>
              <code style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</code>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>{s.note}</p>
            </div>
          ))}
        </section>
      </div>

      <Modal
        open={open === 'payment'}
        onOpenChange={close}
        icon={<Wallet size={24} />}
        title="Confirmer le paiement"
        description="12 500 FCFA seront bloqués en séquestre jusqu'à la fin de la mission. L'artisan est payé quand tu valides le travail."
        secondaryAction={{ label: 'Annuler' }}
        primaryAction={{ label: 'Payer avec Jèko', closes: true }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
          <ShieldCheck size={16} aria-hidden="true" /> Paiement sécurisé : Wave, Orange Money, MTN, Moov
        </div>
      </Modal>

      <Modal
        open={open === 'delete'}
        onOpenChange={close}
        icon={<Trash2 size={24} />}
        title={'Supprimer cette mission ?'}
        description="La mission et son historique de discussion seront supprimés. Cette action est définitive."
        secondaryAction={{ label: 'Garder' }}
        primaryAction={{ label: 'Supprimer', closes: true }}
      />

      <Modal
        open={open === 'info'}
        onOpenChange={close}
        title="Artisan en route"
        description="Koffi arrive dans environ 25 minutes. Tu recevras un SMS à son arrivée."
        primaryAction={{ label: 'Compris', closes: true }}
      />
    </main>
  )
}
