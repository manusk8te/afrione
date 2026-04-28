'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { Search, Star, CheckCircle, MapPin, Filter, Zap } from 'lucide-react'

const METIERS = ['Tous', 'Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie', 'Climatisation', 'Serrurerie', 'Carrelage']
const QUARTIERS = ['Tous les quartiers', 'Cocody', 'Plateau', 'Marcory', 'Treichville', 'Yopougon', 'Adjamé', 'Abobo']

// Mock data — remplacer par requête Supabase
const MOCK_ARTISANS = [
  { id: '1', name: 'Kouadio Brou Emmanuel', metier: 'Plomberie', quartier: 'Cocody', rating: 4.9, missions: 184, tarif: 8000, exp: 12, badge: 'Vérifié', icon: '🔧', available: true, response_time: 10 },
  { id: '2', name: 'Diallo Mamadou', metier: 'Électricité', quartier: 'Plateau', rating: 4.8, missions: 132, tarif: 12000, exp: 8, badge: 'Top 10', icon: '⚡', available: true, response_time: 15 },
  { id: '3', name: 'Koné Adama', metier: 'Peinture', quartier: 'Marcory', rating: 4.6, missions: 98, tarif: 6000, exp: 5, badge: 'Vérifié', icon: '🎨', available: true, response_time: 20 },
  { id: '4', name: 'Traoré Sékou', metier: 'Plomberie', quartier: 'Plateau', rating: 4.5, missions: 97, tarif: 6500, exp: 8, badge: 'Vérifié', icon: '🔧', available: false, response_time: 30 },
  { id: '5', name: 'Coulibaly Ibrahim', metier: 'Plomberie', quartier: 'Marcory', rating: 4.7, missions: 61, tarif: 7000, exp: 5, badge: 'Nouveau', icon: '🔧', available: true, response_time: 25 },
  { id: '6', name: 'Bamba Seydou', metier: 'Électricité', quartier: 'Cocody', rating: 4.4, missions: 44, tarif: 10000, exp: 3, badge: 'Vérifié', icon: '⚡', available: true, response_time: 18 },
  { id: '7', name: 'Touré Moussa', metier: 'Maçonnerie', quartier: 'Yopougon', rating: 4.3, missions: 78, tarif: 9000, exp: 10, badge: 'Vérifié', icon: '🏗️', available: true, response_time: 40 },
  { id: '8', name: 'Sanogo Cheick', metier: 'Menuiserie', quartier: 'Adjamé', rating: 4.6, missions: 53, tarif: 7500, exp: 7, badge: 'Vérifié', icon: '🪵', available: true, response_time: 30 },
]

export default function ArtisansPage() {
  const [search, setSearch] = useState('')
  const [metier, setMetier] = useState('Tous')
  const [quartier, setQuartier] = useState('Tous les quartiers')
  const [sort, setSort] = useState('rating')
  const [artisans, setArtisans] = useState(MOCK_ARTISANS)

  useEffect(() => {
    // TODO: remplacer par requête Supabase
    let filtered = MOCK_ARTISANS.filter(a => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
      const matchMetier = metier === 'Tous' || a.metier === metier
      const matchQuartier = quartier === 'Tous les quartiers' || a.quartier === quartier
      return matchSearch && matchMetier && matchQuartier
    })
    if (sort === 'rating') filtered.sort((a, b) => b.rating - a.rating)
    if (sort === 'price') filtered.sort((a, b) => a.tarif - b.tarif)
    if (sort === 'missions') filtered.sort((a, b) => b.missions - a.missions)
    setArtisans(filtered)
  }, [search, metier, quartier, sort])

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="page-container">
          {/* Header */}
          <div className="mb-8">
            <span className="section-label">ANNUAIRE</span>
            <h1 className="font-display text-4xl font-bold text-dark mt-2">
              Trouver un artisan
            </h1>
            <p className="text-muted mt-2">{artisans.length} professionnels vérifiés à Abidjan</p>
          </div>

          {/* Filters */}
          <div className="bg-white border border-border rounded-2xl p-4 mb-8 space-y-4">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom..."
                className="input pl-12"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-40">
                <select value={metier} onChange={e => setMetier(e.target.value)} className="input">
                  {METIERS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-40">
                <select value={quartier} onChange={e => setQuartier(e.target.value)} className="input">
                  {QUARTIERS.map(q => <option key={q}>{q}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-40">
                <select value={sort} onChange={e => setSort(e.target.value)} className="input">
                  <option value="rating">⭐ Mieux notés</option>
                  <option value="price">💰 Prix croissant</option>
                  <option value="missions">🏆 Plus de missions</option>
                </select>
              </div>
            </div>
          </div>

          {/* Metier tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {METIERS.map(m => (
              <button
                key={m}
                onClick={() => setMetier(m)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  metier === m
                    ? 'bg-dark text-cream'
                    : 'bg-white border border-border text-muted hover:border-dark hover:text-dark'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {artisans.map(a => (
              <Link key={a.id} href={`/artisans/${a.id}`} className="card group hover:-translate-y-1 transition-all duration-200 cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-bg2 rounded-xl flex items-center justify-center text-2xl">{a.icon}</div>
                  <div className="flex flex-col items-end gap-1">
                    {a.badge === 'Top 10' && <span className="badge bg-gold/20 text-yellow-700">Top 10</span>}
                    {a.badge === 'Vérifié' && <span className="badge-green">✓ Vérifié</span>}
                    {a.badge === 'Nouveau' && <span className="badge bg-accent2/10 text-accent2">Nouveau</span>}
                    {a.available
                      ? <span className="flex items-center gap-1 text-xs text-accent2"><span className="w-1.5 h-1.5 bg-accent2 rounded-full" />Disponible</span>
                      : <span className="flex items-center gap-1 text-xs text-muted"><span className="w-1.5 h-1.5 bg-muted rounded-full" />Occupé</span>
                    }
                  </div>
                </div>

                <h3 className="font-display font-bold text-dark group-hover:text-accent transition-colors leading-tight">{a.name}</h3>
                <div className="flex items-center gap-1 mt-1 text-sm text-muted">
                  <MapPin size={12} />
                  {a.metier} · {a.quartier}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-bg2 rounded-lg p-2">
                    <div className="font-bold text-sm text-dark">{a.rating}</div>
                    <div className="text-xs text-muted">Note</div>
                  </div>
                  <div className="bg-bg2 rounded-lg p-2">
                    <div className="font-bold text-sm text-dark">{a.missions}</div>
                    <div className="text-xs text-muted">Missions</div>
                  </div>
                  <div className="bg-bg2 rounded-lg p-2">
                    <div className="font-bold text-sm text-dark">{a.exp}ans</div>
                    <div className="text-xs text-muted">Exp.</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div>
                    <span className="font-bold text-dark">{a.tarif.toLocaleString()}</span>
                    <span className="text-xs text-muted"> FCFA min</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Zap size={10} className="text-accent" />
                    Répond en {a.response_time} min
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {artisans.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="font-display text-xl font-bold text-dark mb-2">Aucun artisan trouvé</h3>
              <p className="text-muted">Essayez d'autres filtres</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
