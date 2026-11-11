'use client'

import { useState } from 'react'
import { ArrowRight, ChevronRight, ShieldCheck, Trash2, Wallet, Droplets, Zap, Hammer, Paintbrush } from 'lucide-react'
import { Modal } from '@/components/glass/Modal'

type Demo = 'payment' | 'delete' | 'info' | null

const TRADES = [
  { Icon: Droplets, label: 'Plomberie' },
  { Icon: Zap, label: 'Électricité' },
  { Icon: Hammer, label: 'Maçonnerie' },
  { Icon: Paintbrush, label: 'Peinture' },
]

const label: React.CSSProperties = { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 10 }

export default function DesignPage() {
  const [open, setOpen] = useState<Demo>(null)
  const close = (o: boolean) => !o && setOpen(null)

  return (
    <main className="liquid" style={{ background: 'var(--page-bg)', minHeight: '100vh' }}>
      {/* Le vrai fond de l'accueil : même classe, rien de recréé. */}
      <section className="afrione-gradient on-color" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <header className="glass" style={{ margin: '16px', borderRadius: 'var(--glass-radius-md)', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <strong style={{ font: '700 18px/1 var(--font-display, Satoshi, sans-serif)' }}>AfriOne</strong>
          <span style={{ fontSize: 13 }}>Navbar en verre fumé</span>
        </header>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 16px' }}>
          <h1 style={{ font: '700 clamp(40px, 7vw, 84px)/0.9 var(--font-display, Satoshi, sans-serif)', letterSpacing: '-0.04em', maxWidth: '16ch', margin: '0 0 24px' }}>
            Trouvez le bon artisan au bon prix
          </h1>
          <p style={{ maxWidth: '52ch', fontSize: 16, lineHeight: 1.65, margin: '0 0 36px', color: 'var(--text-secondary)' }}>
            Même fond animé que l&apos;accueil. Seuls les boutons et la navbar changent.
          </p>

          <div style={{ display: 'grid', gap: 28, width: 'min(100%, 560px)' }}>
            <div>
              <div style={label}>Aujourd&apos;hui</div>
              <div className="home-hero-actions" style={{ justifyContent: 'center' }}>
                <a className="home-hero-action home-hero-action-primary" href="#" onClick={e => e.preventDefault()}>
                  Décrire mon problème <ArrowRight size={16} aria-hidden="true" />
                </a>
                <a className="home-hero-action" href="#" onClick={e => e.preventDefault()}>
                  Voir les artisans <ChevronRight size={16} aria-hidden="true" />
                </a>
              </div>
            </div>

            <div>
              <div style={label}>Proposé</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                <button className="lg-btn lg-btn--light" onClick={() => setOpen('payment')}>
                  Décrire mon problème <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button className="lg-btn lg-btn--glass" onClick={() => setOpen('info')}>
                  Voir les artisans <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                {TRADES.map(({ Icon, label: l }) => (
                  <button key={l} className="lg-btn lg-btn--glass" style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}>
                    <Icon size={15} aria-hidden="true" /> {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section claire, comme le reste du site : pas de verre ici. */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '56px 16px 96px' }}>
        <h2 style={{ font: '700 28px/1.1 var(--font-display, Satoshi, sans-serif)', margin: 0 }}>Modales</h2>
        <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 15 }}>
          Le verre n&apos;apparaît que sur ce qui flotte. Le contenu de la page reste net et lisible.
        </p>
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button className="lg-btn lg-btn--primary" onClick={() => setOpen('payment')}>Modal paiement</button>
          <button className="lg-btn lg-btn--primary" onClick={() => setOpen('delete')}>Modal suppression</button>
          <button className="lg-btn lg-btn--primary" disabled>Désactivé</button>
        </div>
      </section>

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
