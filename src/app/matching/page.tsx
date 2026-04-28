'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { ArrowLeft, Star, MapPin, Clock, CheckCircle, Zap, Shield, ChevronRight } from 'lucide-react'

const MOCK_MATCHES = [
  {
    id: '1', name: 'Kouadio Brou Emmanuel', metier: 'Plomberie', quartier: 'Cocody',
    rating: 4.9, missions: 184, tarif: 8000, exp: 12, response_time: 10,
    distance: '2.3 km', available: true, icon: '🔧', score: 98,
    why: ['Le plus proche de vous', 'Spécialiste fuites', '184 missions réussies'],
  },
  {
    id: '4', name: 'Traoré Sékou', metier: 'Plomberie', quartier: 'Plateau',
    rating: 4.5, missions: 97, tarif: 6500, exp: 8, response_time: 20,
    distance: '4.1 km', available: true, icon: '🔧', score: 87,
    why: ['Meilleur rapport qualité/prix', '8 ans d\'expérience', 'Disponible maintenant'],
  },
  {
    id: '5', name: 'Coulibaly Ibrahim', metier: 'Plomberie', quartier: 'Marcory',
    rating: 4.7, missions: 61, tarif: 7000, exp: 5, response_time: 25,
    distance: '5.8 km', available: true, icon: '🔧', score: 82,
    why: ['Très bien noté', 'Réactif sur missions urgentes'],
  },
]

export default function MatchingPage() {
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const category = searchParams.get('category') || 'Plomberie'
  const budget = searchParams.get('budget') || '8 000 – 25 000'

  const confirm = () => {
    if (!selected) return
    setConfirming(true)
    setTimeout(() => {
      window.location.href = `/warroom/${selected}`
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="page-container max-w-3xl">

          {/* Header */}
          <div className="mb-8">
            <Link href="/diagnostic" className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-4 transition-colors">
              <ArrowLeft size={16} /> Retour au diagnostic
            </Link>
            <span className="section-label block mb-2">MATCHING IA</span>
            <h1 className="font-display text-4xl font-bold text-dark">
              3 artisans disponibles
            </h1>
            <p className="text-muted mt-2">Sélectionnés selon votre zone, votre budget et leurs notes</p>
          </div>

          {/* Context recap */}
          <div className="bg-dark rounded-2xl p-4 mb-8 flex flex-wrap gap-6">
            {[
              { label: 'Catégorie', value: category },
              { label: 'Budget estimé', value: `${budget} FCFA` },
              { label: 'Votre zone', value: 'Cocody' },
            ].map(item => (
              <div key={item.label}>
                <div className="font-mono text-xs text-muted uppercase tracking-wider">{item.label}</div>
                <div className="font-display font-bold text-cream mt-0.5">{item.value}</div>
              </div>
            ))}
          </div>

          {/* Artisan cards */}
          <div className="space-y-4 mb-8">
            {MOCK_MATCHES.map((a, idx) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`w-full text-left rounded-2xl border-2 transition-all duration-200 p-6 ${
                  selected === a.id
                    ? 'border-accent bg-accent/5 shadow-sm'
                    : 'border-border bg-white hover:border-dark/30'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Rank badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1 ${
                    idx === 0 ? 'bg-gold/20 text-yellow-700' : 'bg-bg2 text-muted'
                  }`}>
                    {idx + 1}
                  </div>

                  {/* Icon */}
                  <div className="w-14 h-14 bg-bg2 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                    {a.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-display font-bold text-dark">{a.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted mt-0.5">
                          <MapPin size={12} /> {a.quartier}
                          <span className="text-border">·</span>
                          <span className="text-accent font-medium">{a.distance}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-display font-bold text-dark">{a.tarif.toLocaleString()} FCFA</div>
                        <div className="text-xs text-muted">min / intervention</div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-4 mt-3">
                      <div className="flex items-center gap-1 text-sm">
                        <Star size={13} className="text-gold fill-gold" />
                        <span className="font-semibold">{a.rating}</span>
                        <span className="text-muted text-xs">({a.missions})</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted">
                        <Clock size={13} /> Répond en ~{a.response_time} min
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted">
                        <CheckCircle size={13} className="text-accent2" /> {a.exp} ans d'exp.
                      </div>
                    </div>

                    {/* Why suggested */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {a.why.map(w => (
                        <span key={w} className="text-xs bg-bg2 text-muted px-3 py-1 rounded-full border border-border">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Score */}
                  <div className={`flex-shrink-0 text-center hidden sm:block`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-lg ${
                      a.score >= 95 ? 'bg-accent2/10 text-accent2' :
                      a.score >= 85 ? 'bg-gold/10 text-yellow-700' :
                      'bg-bg2 text-muted'
                    }`}>
                      {a.score}
                    </div>
                    <div className="text-xs text-muted mt-1">score</div>
                  </div>
                </div>

                {selected === a.id && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-accent font-medium">
                    <CheckCircle size={16} /> Artisan sélectionné
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Security note */}
          <div className="flex items-start gap-3 bg-accent2/5 border border-accent2/20 rounded-xl p-4 mb-6">
            <Shield size={16} className="text-accent2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted">
              Votre paiement sera sécurisé en séquestre Wave. Les fonds ne seront libérés qu'après validation de la fin des travaux.
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={confirm}
            disabled={!selected || confirming}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base disabled:opacity-40"
          >
            {confirming ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Connexion...</>
            ) : (
              <><Zap size={18} /> Contacter cet artisan <ChevronRight size={16} /></>
            )}
          </button>

          <p className="text-center text-xs text-muted mt-3">
            Vous discuterez du devis avant tout paiement
          </p>
        </div>
      </div>
    </div>
  )
}
