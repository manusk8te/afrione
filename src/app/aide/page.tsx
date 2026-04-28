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

function Accordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen(o => !o)}
      className="w-full text-left border border-border rounded-2xl overflow-hidden transition-all hover:border-dark/30"
    >
      <div className="flex items-center justify-between p-5 bg-white">
        <span className="font-display font-bold text-dark text-sm pr-4">{q}</span>
        <ChevronDown size={16} className={`text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="px-5 pb-5 bg-bg2 text-sm text-muted leading-relaxed">
          {a}
        </div>
      )}
    </button>
  )
}

export default function AidePage() {
  const [tab, setTab] = useState<'client' | 'artisan'>('client')

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="page-container max-w-3xl">

          {/* Header */}
          <div className="text-center mb-12">
            <span className="section-label block mb-2">CENTRE D'AIDE</span>
            <h1 className="font-display text-4xl font-bold text-dark mb-3">Comment pouvons-nous<br />vous aider ?</h1>
            <p className="text-muted">Trouvez des réponses à vos questions ci-dessous</p>
          </div>

          {/* Quick links */}
          <div className="grid sm:grid-cols-3 gap-4 mb-12">
            {[
              { icon: Zap, title: 'Faire un diagnostic', href: '/diagnostic', color: 'text-accent' },
              { icon: MessageCircle, title: 'Nous écrire', href: 'mailto:support@afrione.ci', color: 'text-accent2' },
              { icon: Phone, title: '+225 XX XX XX XX', href: 'tel:+225XXXXXXXX', color: 'text-gold' },
            ].map(item => (
              <Link key={item.title} href={item.href}
                className="card flex flex-col items-center text-center gap-3 hover:border-dark/30 hover:-translate-y-0.5 transition-all">
                <item.icon size={24} className={item.color} />
                <span className="font-display font-bold text-dark text-sm">{item.title}</span>
              </Link>
            ))}
          </div>

          {/* Tab */}
          <div className="flex bg-bg2 border border-border rounded-2xl p-1 mb-8">
            {[
              { id: 'client' as const, label: '🏠 Questions clients' },
              { id: 'artisan' as const, label: '🔧 Questions artisans' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                  tab === t.id ? 'bg-white text-dark shadow-sm' : 'text-muted hover:text-dark'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* FAQ */}
          <div className="space-y-3">
            {FAQS[tab].map(faq => <Accordion key={faq.q} q={faq.q} a={faq.a} />)}
          </div>

          {/* Contact CTA */}
          <div className="mt-12 bg-dark rounded-2xl p-8 text-center">
            <h2 className="font-display text-2xl font-bold text-cream mb-2">Vous n'avez pas trouvé votre réponse ?</h2>
            <p className="text-muted text-sm mb-6">Notre équipe répond en moins de 2h en heures ouvrées</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="mailto:support@afrione.ci"
                className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors text-sm">
                <Mail size={16} /> Envoyer un email
              </Link>
              <Link href="https://wa.me/225XXXXXXXX" target="_blank"
                className="flex items-center gap-2 bg-white/10 border border-white/20 text-cream px-6 py-3 rounded-xl font-semibold hover:bg-white/20 transition-colors text-sm">
                <MessageCircle size={16} /> WhatsApp
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
