'use client'
import { useState, useEffect } from 'react'
import { Edit2, Save, X, RefreshCw, Globe } from 'lucide-react'
import AdminSidebar from '@/components/admin/AdminSidebar'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

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
      setScrapeResult(data.summary || `${data.updated} prix mis à jour depuis Jumia CI`)
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
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#F5F7FA' }}>
      <AdminSidebar activeId="prix" />

      <main className="flex-1 p-6" style={{ maxWidth: '1100px', minWidth: 0 }}>
        <div className="flex items-center justify-between gap-3 mb-8">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#3D4852' }}>Gestionnaire de Prix</h1>
            <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '2px' }}>3 tiers par matériau · Jumia CI · Marchés physiques</p>
          </div>
          <div className="flex items-center gap-2">
            {scrapeResult && <span style={{ fontSize: '12px', color: '#2B6B3E', fontFamily: 'Space Mono' }}>{scrapeResult}</span>}
            <button
              onClick={() => triggerScrape(activeCategory !== 'Tous' ? activeCategory : undefined)}
              disabled={scraping}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '12px',
                fontSize: '14px', fontWeight: 600, cursor: scraping ? 'default' : 'pointer',
                opacity: scraping ? 0.5 : 1, boxShadow: NEU_SMALL,
              }}
            >
              <Globe size={14} className={scraping ? 'animate-spin' : ''} style={{ color: '#E85D26' }} />
              <span className="afrione-gradient-text">{scraping ? 'Scraping…' : 'Sync Jumia CI'}</span>
            </button>
            <button onClick={loadMaterials} style={{ padding: '8px', background: '#FFFFFF', borderRadius: '12px', color: '#6B7280', border: '1.5px solid #E2E8F0', cursor: 'pointer', boxShadow: NEU_SMALL }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveCategory(c)}
              className={activeCategory === c ? 'afrione-gradient' : ''}
              style={{
                flexShrink: 0, padding: '8px 16px', borderRadius: '9999px', fontSize: '14px', fontWeight: 500,
                cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                background: activeCategory === c ? undefined : '#FFFFFF',
                color: activeCategory === c ? 'white' : '#6B7280',
                boxShadow: activeCategory === c ? 'none' : NEU_SMALL,
              }}>
              {c}
            </button>
          ))}
        </div>

        {/* Materials table */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: '32px', boxShadow: NEU_SHADOW }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F5F7FA' }}>
            <span style={{ fontFamily: 'Space Mono', fontSize: '12px', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Prix Matériaux — {filtered.length} références
            </span>
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#6B7280', fontSize: '14px', gap: '8px' }}>
              <RefreshCw size={14} className="animate-spin" /> Chargement depuis Supabase…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F5F7FA' }}>
                    {['Matériau', 'Tier', 'Marque', 'Prix marché', 'Min', 'Max', 'Source', 'Web', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontFamily: 'Space Mono', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #E2E8F0' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F5F7FA'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: '#3D4852', maxWidth: '160px' }} className="truncate">{m.name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {m.tier && (
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '9999px',
                            color: TIER_LABELS[m.tier]?.color,
                            background: `${TIER_LABELS[m.tier]?.color}18`,
                          }}>
                            {TIER_LABELS[m.tier]?.label}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '12px' }}>{m.brand || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {editingId === m.id ? (
                          <input type="number" value={editValues.price_market}
                            onChange={e => setEditValues((v: any) => ({ ...v, price_market: parseInt(e.target.value) }))}
                            style={{ width: '96px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '4px 8px', color: '#3D4852', fontSize: '12px', outline: 'none' }} />
                        ) : (
                          <span style={{ fontWeight: 700, color: '#3D4852' }}>{m.price_market?.toLocaleString()}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {editingId === m.id ? (
                          <input type="number" value={editValues.price_min}
                            onChange={e => setEditValues((v: any) => ({ ...v, price_min: parseInt(e.target.value) }))}
                            style={{ width: '80px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '4px 8px', color: '#6B7280', fontSize: '12px', outline: 'none' }} />
                        ) : (
                          <span style={{ color: '#6B7280' }}>{m.price_min?.toLocaleString()}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {editingId === m.id ? (
                          <input type="number" value={editValues.price_max}
                            onChange={e => setEditValues((v: any) => ({ ...v, price_max: parseInt(e.target.value) }))}
                            style={{ width: '80px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '4px 8px', color: '#6B7280', fontSize: '12px', outline: 'none' }} />
                        ) : (
                          <span style={{ color: '#6B7280' }}>{m.price_max?.toLocaleString()}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '12px', background: '#F5F7FA', border: '1px solid #E2E8F0', padding: '4px 8px', borderRadius: '8px', color: '#6B7280' }}>{m.source}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'Space Mono', color: '#6B7280' }}>
                        {m.web_price ? m.web_price.toLocaleString() : '—'}
                        {m.last_scraped_at && (
                          <div style={{ fontSize: '11px', color: '#8B95A5', marginTop: '2px' }}>
                            {new Date(m.last_scraped_at).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {editingId === m.id ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => saveEdit(m.id)} style={{ padding: '6px', background: 'rgba(34,197,94,0.12)', color: '#16a34a', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                              <Save size={12} />
                            </button>
                            <button onClick={() => setEditingId(null)} style={{ padding: '6px', background: '#F5F7FA', color: '#6B7280', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(m)} style={{ padding: '6px', background: '#F5F7FA', color: '#6B7280', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
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
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: NEU_SHADOW }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', background: '#F5F7FA' }}>
            <span style={{ fontFamily: 'Space Mono', fontSize: '12px', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Taux Horaires par Métier</span>
          </div>
          <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F5F7FA' }}>
                {['Métier', 'Tarif/h', '+Urgence', '+Nuit', '+Weekend'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontFamily: 'Space Mono', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{h}</th>
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
                <tr key={r.metier} style={{ borderBottom: '1px solid #E2E8F0' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F5F7FA'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: '#3D4852' }}>{r.metier}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}><span className="afrione-gradient-text">{r.tarif.toLocaleString()} FCFA/h</span></td>
                  <td style={{ padding: '12px 16px', color: '#ef4444', fontFamily: 'Space Mono', fontSize: '12px' }}>+{r.urgence}%</td>
                  <td style={{ padding: '12px 16px', color: '#6B7280', fontFamily: 'Space Mono', fontSize: '12px' }}>+{r.nuit}%</td>
                  <td style={{ padding: '12px 16px', color: '#6B7280', fontFamily: 'Space Mono', fontSize: '12px' }}>+{r.weekend}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
