'use client'
import { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Link from 'next/link'
import { ChevronDown, MessageCircle, Phone, Mail, Zap } from 'lucide-react'

const FAQS = {
  client: [
    { q: 'Comment fonctionne le diagnostic IA ?', a: 'Décrivez votre problème en texte libre. Notre IA (GPT-4o) analyse votre demande, identifie la catégorie de service, estime le prix en se basant sur les tarifs de référence du marché d\'Abidjan (Adjamé, Treichville), et prépare un briefing pour les artisans.' },
    { q: 'Comment est sécurisé mon paiement ?', a: 'Votre paiement via Wave est placé en séquestre sur le compte AfriOne. L\'artisan ne reçoit pas encore l\'argent. Les fonds ne sont libérés que lorsque vous validez la photo de fin de chantier et confirmez que vous êtes satisfait.' },
    { q: 'Que faire si je ne suis pas satisfait ?', a: 'Si la prestation n\'est pas conforme, vous pouvez ouvrir un litige directement depuis votre dashboard. Notre équipe analyse la situation avec l\'aide de l\'IA et rend une décision dans les 48h. Remboursement partiel ou total possible.' },
    { q: 'Comment choisir entre les 3 artisans proposés ?', a: 'Notre algorithme sélectionne les 3 artisans les plus pertinents selon : distance depuis votre quartier, note moyenne, taux de ponctualité, nombre de missions réussies dans votre catégorie de besoin, et disponibilité temps réel.' },
    { q: 'Puis-je annuler une mission ?', a: 'Vous pouvez annuler une mission avant que l\'artisan n\'ait accepté, sans frais. Après acceptation mais avant démarrage, une pénalité de 10% s\'applique. Une fois la mission commencée, le paiement est engagé.' },
  ],
  artisan: [
    { q: 'Comment m\'inscrire comme artisan ?', a: 'Cliquez sur "Devenir artisan", renseignez votre profil (nom, métier, quartier, tarif), puis envoyez vos documents KYC (CNI recto/verso, diplôme si disponible). Votre dossier est vérifié en 24-48h.' },
    { q: 'Comment sont calculées mes commissions ?', a: 'AfriOne prend 12% du montant total de chaque mission. Vous gardez 88%. Sur une mission à 25 000 FCFA, vous recevez 22 000 FCFA. Le paiement est fait directement sur votre compte Wave.' },
    { q: 'Quand est-ce que je reçois mon argent ?', a: 'Les fonds sont libérés dès que le client valide la photo de fin de chantier. En général dans les 30 minutes après la fin de la mission. Retrait vers Wave disponible immédiatement, 24h/24.' },
    { q: 'Mon score baisse, que faire ?', a: 'Votre score est calculé sur : ponctualité, qualité du travail (notes clients), taux de réussite des missions, et rapidité de réponse aux demandes. Pour l\'améliorer : soyez ponctuel, soignez la qualité, répondez rapidement aux missions.' },
  ],
}

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

function Accordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen(o => !o)}
      style={{
        width: '100%', textAlign: 'left',
        background: '#FFFFFF',
        border: '1.5px solid #E2E8F0',
        borderRadius: '16px', overflow: 'hidden',
        transition: 'all 0.2s',
        boxShadow: NEU_SMALL,
        cursor: 'pointer', padding: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}>
        <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, color: '#3D4852', fontSize: '14px', paddingRight: '16px' }}>{q}</span>
        <ChevronDown size={16} style={{ color: '#8B95A5', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {open && (
        <div style={{ padding: '0 20px 20px', background: '#F5F7FA', fontSize: '14px', color: '#6B7280', lineHeight: '1.7' }}>
          {a}
        </div>
      )}
    </button>
  )
}

export default function AidePage() {
  const [tab, setTab] = useState<'client' | 'artisan'>('client')

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      <Navbar />
      <div style={{ paddingTop: '96px', paddingBottom: '64px', paddingLeft: '16px', paddingRight: '16px' }}>
        <div className="page-container" style={{ maxWidth: '768px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '8px' }}>CENTRE D'AIDE</span>
            <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontSize: '36px', fontWeight: 700, color: '#3D4852', marginBottom: '12px' }}>
              Comment pouvons-nous<br />vous aider ?
            </h1>
            <p style={{ color: '#6B7280' }}>Trouvez des réponses à vos questions ci-dessous</p>
          </div>

          {/* Quick links */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '48px' }}>
            {[
              { icon: Zap, title: 'Faire un diagnostic', href: '/diagnostic', color: '#E85D26' },
              { icon: MessageCircle, title: 'Nous écrire', href: 'mailto:support@afrione.ci', color: '#E85D26' },
              { icon: Phone, title: '+225 XX XX XX XX', href: 'tel:+225XXXXXXXX', color: '#C9A84C' },
            ].map(item => (
              <Link key={item.title} href={item.href}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px',
                  padding: '24px 16px', background: '#FFFFFF', borderRadius: '16px',
                  border: '1.5px solid #E2E8F0',
                  boxShadow: NEU_SHADOW,
                  textDecoration: 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '10px 10px 22px rgba(163,177,198,0.65), -6px -6px 16px rgba(255,255,255,1)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = NEU_SHADOW
                }}
              >
                <item.icon size={24} style={{ color: item.color }} />
                <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, color: '#3D4852', fontSize: '14px' }}>{item.title}</span>
              </Link>
            ))}
          </div>

          {/* Tab */}
          <div style={{ display: 'flex', background: '#F5F7FA', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '4px', marginBottom: '32px', boxShadow: 'inset 4px 4px 10px rgba(163,177,198,0.45), inset -4px -4px 8px rgba(255,255,255,0.9)' }}>
            {[
              { id: 'client' as const, label: '🏠 Questions clients' },
              { id: 'artisan' as const, label: '🔧 Questions artisans' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: '10px', fontSize: '14px', fontWeight: 600, borderRadius: '12px', border: 'none', cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: tab === t.id ? '#FFFFFF' : 'transparent',
                  color: tab === t.id ? '#3D4852' : '#6B7280',
                  boxShadow: tab === t.id ? NEU_SMALL : 'none',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* FAQ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {FAQS[tab].map(faq => <Accordion key={faq.q} q={faq.q} a={faq.a} />)}
          </div>

          {/* Contact CTA */}
          <div style={{
            marginTop: '48px', background: '#FFFFFF', borderRadius: '20px', padding: '32px', textAlign: 'center',
            boxShadow: NEU_SHADOW, border: '1.5px solid #E2E8F0',
          }}>
            <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontSize: '22px', fontWeight: 700, color: '#3D4852', marginBottom: '8px' }}>
              Vous n'avez pas trouvé votre réponse ?
            </h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>Notre équipe répond en moins de 2h en heures ouvrées</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
              <Link href="mailto:support@afrione.ci"
                className="afrione-gradient"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', padding: '12px 24px', borderRadius: '12px', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
                <Mail size={16} /> Envoyer un email
              </Link>
              <Link href="https://wa.me/225XXXXXXXX" target="_blank"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#FFFFFF', border: '1.5px solid #E2E8F0',
                  color: '#3D4852', padding: '12px 24px', borderRadius: '12px', fontWeight: 600,
                  textDecoration: 'none', fontSize: '14px',
                  boxShadow: NEU_SMALL, transition: 'box-shadow 0.15s',
                }}>
                <MessageCircle size={16} /> WhatsApp
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
