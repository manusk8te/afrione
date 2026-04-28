'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Zap, Star, Clock, CheckCircle, Wallet, Camera, Calendar, AlertCircle } from 'lucide-react'

const TABS = [
  { id: 'missions', label: 'Missions', icon: Clock },
  { id: 'wallet', label: 'Portefeuille', icon: Wallet },
  { id: 'profile', label: 'Mon Profil', icon: Star },
  { id: 'planning', label: 'Planning', icon: Calendar },
]

const MOCK_MISSIONS = [
  { id: 'm1', client: 'Aya Konaté', category: 'Plomberie', quartier: 'Cocody', status: 'pending', price: 18000, date: 'Aujourd\'hui 14h' },
  { id: 'm2', client: 'Jean-Marc Gbagbo', category: 'Plomberie', quartier: 'Plateau', status: 'en_cours', price: 25000, date: 'En cours' },
  { id: 'm3', client: 'Fatou Diallo', category: 'Plomberie', quartier: 'Marcory', status: 'completed', price: 12000, date: '03 Mar' },
]

export default function ArtisanDashboardPage() {
  const [tab, setTab] = useState('missions')

  return (
    <div className="min-h-screen bg-bg">
      {/* Header artisan */}
      <div className="bg-dark text-cream">
        <div className="page-container py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-lg">AFRI<span className="text-accent">ONE</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-accent2 bg-accent2/10 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-accent2 rounded-full animate-pulse-soft" />
              Disponible
            </span>
            <div className="w-8 h-8 bg-bg2 rounded-full flex items-center justify-center text-dark font-bold text-sm">K</div>
          </div>
        </div>
      </div>

      <div className="page-container py-8 max-w-4xl">
        {/* Profile card */}
        <div className="card mb-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-bg2 rounded-2xl flex items-center justify-center text-3xl">🔧</div>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-dark">Kouadio Brou Emmanuel</h1>
            <p className="text-sm text-muted">Plombier · Cocody</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-sm"><Star size={14} className="text-gold fill-gold" /> 4.9</span>
              <span className="text-sm text-muted">184 missions</span>
              <span className="badge-green">✓ KYC Vérifié</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold text-accent2">47 500</div>
            <div className="font-mono text-xs text-muted">FCFA disponible</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg2 p-1 rounded-xl mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-white text-dark shadow-sm' : 'text-muted hover:text-dark'
              }`}
            >
              <t.icon size={15} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab: Missions */}
        {tab === 'missions' && (
          <div className="space-y-4">
            {MOCK_MISSIONS.map(m => (
              <div key={m.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-dark">{m.client}</h3>
                    <p className="text-sm text-muted">{m.category} · {m.quartier}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-dark">{m.price.toLocaleString()} FCFA</div>
                    <div className="text-xs text-muted">{m.date}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {m.status === 'pending' && (
                    <>
                      <button className="btn-primary flex-1 py-2 text-sm">✓ Accepter</button>
                      <button className="btn-outline flex-1 py-2 text-sm">✗ Refuser</button>
                    </>
                  )}
                  {m.status === 'en_cours' && (
                    <Link href={`/artisan-space/mission/${m.id}`} className="btn-primary flex-1 py-2 text-sm text-center">
                      Voir la mission en cours →
                    </Link>
                  )}
                  {m.status === 'completed' && (
                    <span className="flex items-center gap-2 text-sm text-accent2">
                      <CheckCircle size={14} /> Mission terminée
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Wallet */}
        {tab === 'wallet' && (
          <div className="space-y-4">
            <div className="card bg-dark text-cream">
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-3">PORTEFEUILLE</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="font-display text-3xl font-bold text-accent">47 500</div>
                  <div className="font-mono text-xs text-muted mt-1">FCFA disponible</div>
                </div>
                <div>
                  <div className="font-display text-3xl font-bold text-gold">18 000</div>
                  <div className="font-mono text-xs text-muted mt-1">FCFA en séquestre</div>
                </div>
              </div>
              <button className="btn-primary w-full mt-6 py-3">
                Retirer vers Wave
              </button>
            </div>

            <div className="card">
              <h3 className="font-display font-bold text-dark mb-4">Historique</h3>
              <div className="space-y-3">
                {[
                  { label: 'Mission Aya Konaté', amount: '+12 000', date: '03 Mar', type: 'credit' },
                  { label: 'Mission Jean-Marc', amount: '+22 000', date: '28 Fév', type: 'credit' },
                  { label: 'Retrait Wave', amount: '-30 000', date: '25 Fév', type: 'debit' },
                ].map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <div className="text-sm font-medium text-dark">{t.label}</div>
                      <div className="text-xs text-muted">{t.date}</div>
                    </div>
                    <span className={`font-bold font-mono ${t.type === 'credit' ? 'text-accent2' : 'text-accent'}`}>
                      {t.amount} FCFA
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Profile */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-display font-bold text-dark mb-4">Documents KYC</h3>
              <div className="space-y-3">
                {['CNI Recto', 'CNI Verso', 'Diplôme / Certification'].map(doc => (
                  <div key={doc} className="flex items-center justify-between p-3 bg-bg2 rounded-xl">
                    <span className="text-sm text-dark">{doc}</span>
                    <button className="flex items-center gap-2 text-sm text-accent hover:underline">
                      <Camera size={14} /> Ajouter
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-display font-bold text-dark mb-4">Mes spécialités</h3>
              <div className="flex flex-wrap gap-2">
                {['Fuites d\'eau', 'WC & sanitaires', 'Tuyauterie', 'Urgences 24h', 'Installation neuve'].map(s => (
                  <span key={s} className="badge-orange">{s}</span>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-display font-bold text-dark mb-4">Tarifs</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Tarif minimum</span>
                  <span className="font-bold text-dark">8 000 FCFA</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Rayon d'intervention</span>
                  <span className="font-bold text-dark">15 km</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Temps de réponse</span>
                  <span className="font-bold text-dark">~10 min</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Planning */}
        {tab === 'planning' && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-dark">Mars 2025</h3>
              <div className="flex items-center gap-1 text-xs text-accent2 bg-accent2/10 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-accent2 rounded-full" />
                Disponible aujourd'hui
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-xs font-mono text-muted py-2">{d}</div>
              ))}
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                    day === 5 ? 'bg-accent text-white' :
                    [3, 4, 10].includes(day) ? 'bg-dark text-cream' :
                    [8, 15, 22].includes(day) ? 'bg-accent2/20 text-accent2' :
                    'hover:bg-bg2 text-dark'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="flex gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted"><span className="w-3 h-3 rounded bg-dark" />Indisponible</div>
              <div className="flex items-center gap-2 text-xs text-muted"><span className="w-3 h-3 rounded bg-accent2/20" />Mission</div>
              <div className="flex items-center gap-2 text-xs text-muted"><span className="w-3 h-3 rounded bg-accent" />Aujourd'hui</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
