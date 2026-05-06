'use client'
import { useState, useEffect } from 'react'
import { Edit2, Save, X, RefreshCw, Globe } from 'lucide-react'
import AdminSidebar from '@/components/admin/AdminSidebar'

const CATEGORIES = ['Tous', 'Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie', 'Climatisation', 'Carrelage']
const TIER_LABELS: Record<string, { label: string; color: string }> = {
  economique: { label: 'Éco',      color: '#2B6B3E' },
  standard:   { label: 'Standard', color: '#C9A84C' },
  premium:    { label: 'Premium',  color: '#E85D26' },
}

export default function AdminPrixPage() {
  const [materials, setMaterials] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [activeCategory, setActiveCategory] = useState('Tous')
  const [loading, setLoading]     = useState(true)
  const [scraping, setScraping]   = useState(false)
  const [scrapeResult, setScrapeResult] = useState<string | null>(null)

  useEffect(() => { loadMaterials() }, [])

  const loadMaterials = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/data?type=prices')
    const data = await res.json()
    setMaterials(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const startEdit = (m: any) => {
    setEditingId(m.id)
    setEditValues({ price_market: m.price_market, price_min: m.price_min, price_max: m.price_max })
  }

  const saveEdit = async (id: string) => {
    await fetch('/api/admin/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_price', id, ...editValues }),
    })
    setMaterials(ms => ms.map(m => m.id === id ? { ...m, ...editValues } : m))
    setEditingId(null)
  }

  const triggerScrape = async (category?: string) => {
    setScraping(true)
    setScrapeResult(null)
    try {
      const res = await fetch('/api/admin/scrape-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category ? { category } : {}),
      })
      const data = await res.json()
      setScrapeResult(`${data.updated} prix mis à jour depuis Jumia CI`)
      await loadMaterials()
    } catch {
      setScrapeResult('Erreur lors du scraping')
    }
    setScraping(false)
  }

  const filtered = activeCategory === 'Tous'
    ? materials
    : materials.filter(m => m.category === activeCategory)

  return (
    <div className="min-h-screen bg-dark text-cream flex flex-col lg:flex-row">
      <AdminSidebar activeId="prix" />

      <main className="flex-1 p-6" style={{maxWidth:'1100px',minWidth:0}}>
          <div className="flex items-center justify-between gap-3 mb-8">
            <div>
              <h1 className="font-display text-2xl font-bold text-cream">Gestionnaire de Prix</h1>
              <p className="text-muted text-sm mt-0.5">3 tiers par matériau · Jumia CI · Marchés physiques</p>
            </div>
            <div className="flex items-center gap-2">
              {scrapeResult && <span className="text-xs text-green-400 font-mono">{scrapeResult}</span>}
              <button
                onClick={() => triggerScrape(activeCategory !== 'Tous' ? activeCategory : undefined)}
                disabled={scraping}
                className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 rounded-xl text-accent text-sm font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50"
              >
                <Globe size={14} className={scraping ? 'animate-spin' : ''} />
                {scraping ? 'Scraping…' : 'Sync Jumia CI'}
              </button>
              <button onClick={loadMaterials} className="p-2 bg-white/5 rounded-xl text-muted hover:text-cream transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === c ? 'bg-accent text-white' : 'bg-dark2 text-muted hover:text-cream'
                }`}>
                {c}
              </button>
            ))}
          </div>

          {/* Materials table */}
          <div className="bg-dark2 rounded-2xl border border-border/30 overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <span className="font-mono text-xs text-muted uppercase tracking-wider">
                Prix Matériaux — {filtered.length} références
              </span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted text-sm gap-2">
                <RefreshCw size={14} className="animate-spin" /> Chargement depuis Supabase…
              </div>
            ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20">
                    {['Matériau', 'Tier', 'Marque', 'Prix marché', 'Min', 'Max', 'Source', 'Web', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id} className="border-b border-border/10 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-medium text-cream max-w-[160px] truncate">{m.name}</td>
                      <td className="px-4 py-3">
                        {m.tier && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                            color: TIER_LABELS[m.tier]?.color,
                            background: `${TIER_LABELS[m.tier]?.color}22`,
                          }}>
                            {TIER_LABELS[m.tier]?.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{m.brand || '—'}</td>
                      <td className="px-4 py-3">
                        {editingId === m.id ? (
                          <input type="number" value={editValues.price_market}
                            onChange={e => setEditValues((v: any) => ({ ...v, price_market: parseInt(e.target.value) }))}
                            className="w-24 bg-dark border border-accent/50 rounded-lg px-2 py-1 text-cream text-xs focus:outline-none" />
                        ) : (
                          <span className="font-bold text-cream">{m.price_market?.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === m.id ? (
                          <input type="number" value={editValues.price_min}
                            onChange={e => setEditValues((v: any) => ({ ...v, price_min: parseInt(e.target.value) }))}
                            className="w-20 bg-dark border border-border/50 rounded-lg px-2 py-1 text-muted text-xs focus:outline-none" />
                        ) : (
                          <span className="text-muted">{m.price_min?.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === m.id ? (
                          <input type="number" value={editValues.price_max}
                            onChange={e => setEditValues((v: any) => ({ ...v, price_max: parseInt(e.target.value) }))}
                            className="w-20 bg-dark border border-border/50 rounded-lg px-2 py-1 text-muted text-xs focus:outline-none" />
                        ) : (
                          <span className="text-muted">{m.price_max?.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-dark px-2 py-1 rounded-lg text-muted">{m.source}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted">
                        {m.web_price ? m.web_price.toLocaleString() : '—'}
                        {m.last_scraped_at && (
                          <div className="text-xs text-muted/40 mt-0.5">
                            {new Date(m.last_scraped_at).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === m.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(m.id)} className="p-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors">
                              <Save size={12} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-white/10 text-muted rounded-lg hover:bg-white/20 transition-colors">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(m)} className="p-1.5 bg-white/5 text-muted rounded-lg hover:bg-white/10 hover:text-cream transition-colors">
                            <Edit2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Labor rates */}
          <div className="bg-dark2 rounded-2xl border border-border/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30">
              <span className="font-mono text-xs text-muted uppercase tracking-wider">Taux Horaires par Métier</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20">
                  {['Métier', 'Tarif/h', '+Urgence', '+Nuit', '+Weekend'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { metier: 'Plombier',    tarif: 3000, urgence: 50, nuit: 30, weekend: 20 },
                  { metier: 'Électricien', tarif: 3500, urgence: 50, nuit: 30, weekend: 25 },
                  { metier: 'Peintre',     tarif: 2500, urgence: 40, nuit: 20, weekend: 15 },
                  { metier: 'Maçon',       tarif: 2800, urgence: 45, nuit: 25, weekend: 20 },
                  { metier: 'Climaticien', tarif: 4000, urgence: 60, nuit: 30, weekend: 25 },
                  { metier: 'Serrurier',   tarif: 3000, urgence: 50, nuit: 30, weekend: 20 },
                  { metier: 'Carreleur',   tarif: 2800, urgence: 40, nuit: 20, weekend: 15 },
                ].map(r => (
                  <tr key={r.metier} className="border-b border-border/10 hover:bg-white/3">
                    <td className="px-4 py-3 font-medium text-cream">{r.metier}</td>
                    <td className="px-4 py-3 font-bold text-accent">{r.tarif.toLocaleString()} FCFA/h</td>
                    <td className="px-4 py-3 text-red-400 font-mono text-xs">+{r.urgence}%</td>
                    <td className="px-4 py-3 text-muted font-mono text-xs">+{r.nuit}%</td>
                    <td className="px-4 py-3 text-muted font-mono text-xs">+{r.weekend}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
    </div>
  )
}
