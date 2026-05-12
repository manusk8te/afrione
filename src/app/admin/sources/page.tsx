'use client'
import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { Globe, Store, Plus, CheckCircle, Trash2, RefreshCw, Package, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

type Source = {
  id: string
  name: string
  type: 'website' | 'magasin'
  url: string | null
  quartier: string | null
  scraper_type: string | null
  verified: boolean
  notes: string | null
  created_at: string
}

type Material = {
  id: string
  name: string
  category: string
  unit: string
  price_market: number
  price_min: number
  price_max: number
  web_price: number | null
  brand: string | null
  confirmed_at: string | null
}

const SCRAPER_TYPES = ['jumia', 'casashop', 'manual']

export default function AdminSourcesPage() {
  const [sources, setSources]       = useState<Source[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [materials, setMaterials]   = useState<Record<string, Material[]>>({})
  const [matLoading, setMatLoading] = useState<string | null>(null)
  const [scraping, setScraping]     = useState<string | null>(null)
  const [msg, setMsg]               = useState<string | null>(null)

  // Form — ajouter un site web
  const [showWebForm, setShowWebForm] = useState(false)
  const [webName, setWebName]         = useState('')
  const [webUrl, setWebUrl]           = useState('')
  const [webScraper, setWebScraper]   = useState('jumia')
  const [webNotes, setWebNotes]       = useState('')
  const [saving, setSaving]           = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/sources')
    const data = await res.json()
    setSources(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!materials[id]) {
      setMatLoading(id)
      const res = await fetch(`/api/sources?source_id=${id}`)
      const data = await res.json()
      setMaterials(m => ({ ...m, [id]: Array.isArray(data) ? data : [] }))
      setMatLoading(null)
    }
  }

  const verify = async (id: string) => {
    await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_source', id }),
    })
    setSources(s => s.map(x => x.id === id ? { ...x, verified: true } : x))
    flash('Magasin vérifié ✓')
  }

  const remove = async (id: string) => {
    if (!confirm('Supprimer cette source et tous ses articles ?')) return
    await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_source', id }),
    })
    setSources(s => s.filter(x => x.id !== id))
    flash('Source supprimée')
  }

  const confirmMaterial = async (materialId: string, sourceId: string) => {
    await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_material', id: materialId }),
    })
    setMaterials(m => ({
      ...m,
      [sourceId]: m[sourceId].map(x => x.id === materialId
        ? { ...x, confirmed_at: new Date().toISOString() } : x
      ),
    }))
    flash('Article confirmé ✓')
  }

  const triggerScrape = async (source: Source) => {
    setScraping(source.id)
    setMsg(null)
    try {
      // Pour l'instant seul Jumia est scrappable — on passe la requête à scrape-prices
      const res = await fetch('/api/admin/scrape-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      flash(data.summary || `Scraping terminé`)
      // Recharge les matériaux de cette source
      const res2 = await fetch(`/api/sources?source_id=${source.id}`)
      const mats = await res2.json()
      setMaterials(m => ({ ...m, [source.id]: Array.isArray(mats) ? mats : [] }))
    } catch {
      flash('Erreur scraping')
    }
    setScraping(null)
  }

  const addWebsite = async () => {
    if (!webName.trim() || !webUrl.trim()) return
    setSaving(true)
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_source', type: 'website',
        name: webName.trim(), url: webUrl.trim(),
        scraper_type: webScraper, notes: webNotes.trim() || null,
      }),
    })
    const data = await res.json()
    if (data.ok) {
      setSources(s => [data.source, ...s])
      setWebName(''); setWebUrl(''); setWebNotes(''); setWebScraper('jumia')
      setShowWebForm(false)
      flash('Site web ajouté ✓')
    } else {
      flash(`Erreur : ${data.error}`)
    }
    setSaving(false)
  }

  const flash = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 3500)
  }

  const websites = sources.filter(s => s.type === 'website')
  const magasins = sources.filter(s => s.type === 'magasin')

  return (
    <div className="min-h-screen bg-dark text-cream flex flex-col lg:flex-row">
      <AdminSidebar activeId="sources" />

      <main className="flex-1 p-6" style={{ maxWidth: '1100px', minWidth: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-cream">Sources de prix</h1>
            <p className="text-muted text-sm mt-0.5">Sites web scrappables + magasins physiques ajoutés par les artisans</p>
          </div>
          {msg && (
            <div style={{ background: 'rgba(43,107,62,0.2)', border: '1px solid #2B6B3E', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#7EC893' }}>
              {msg}
            </div>
          )}
        </div>

        {/* ── SITES WEB ───────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#C9A84C', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} /> Sites web ({websites.length})
            </h2>
            <button
              onClick={() => setShowWebForm(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Plus size={14} /> Ajouter un site
            </button>
          </div>

          {showWebForm && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px', color: '#FAFAF5' }}>Nouveau site web</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '4px' }}>Nom du site *</label>
                  <input value={webName} onChange={e => setWebName(e.target.value)} placeholder="ex: CasaShop CI"
                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#FAFAF5', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '4px' }}>URL catalogue *</label>
                  <input value={webUrl} onChange={e => setWebUrl(e.target.value)} placeholder="https://..."
                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#FAFAF5', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '4px' }}>Type de scraper</label>
                  <select value={webScraper} onChange={e => setWebScraper(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#1A1F1B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#FAFAF5', fontSize: '13px' }}>
                    {SCRAPER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '4px' }}>Notes (format de la page, spécificités…)</label>
                  <input value={webNotes} onChange={e => setWebNotes(e.target.value)} placeholder="ex: JSON dans window.__data.products"
                    style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#FAFAF5', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addWebsite} disabled={saving}
                  style={{ padding: '8px 20px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Ajout…' : 'Ajouter'}
                </button>
                <button onClick={() => setShowWebForm(false)}
                  style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.06)', color: '#7A7A6E', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ color: '#7A7A6E', fontSize: '13px' }}>Chargement…</div>
          ) : websites.length === 0 ? (
            <div style={{ color: '#7A7A6E', fontSize: '13px', fontStyle: 'italic' }}>Aucun site web configuré. Ajoutez Jumia CI, CasaShop CI, etc.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {websites.map(src => (
                <SourceCard
                  key={src.id}
                  source={src}
                  expanded={expanded === src.id}
                  materials={materials[src.id]}
                  matLoading={matLoading === src.id}
                  scraping={scraping === src.id}
                  onToggle={() => toggleExpand(src.id)}
                  onVerify={() => verify(src.id)}
                  onDelete={() => remove(src.id)}
                  onScrape={() => triggerScrape(src)}
                  onConfirmMaterial={(mid) => confirmMaterial(mid, src.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── MAGASINS PHYSIQUES ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#C9A84C', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={16} /> Magasins physiques ({magasins.length})
            </h2>
            <span style={{ fontSize: '12px', color: '#7A7A6E' }}>Ajoutés par les artisans · à valider</span>
          </div>

          {loading ? null : magasins.length === 0 ? (
            <div style={{ color: '#7A7A6E', fontSize: '13px', fontStyle: 'italic' }}>Aucun magasin soumis par les artisans pour l'instant.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {magasins.map(src => (
                <SourceCard
                  key={src.id}
                  source={src}
                  expanded={expanded === src.id}
                  materials={materials[src.id]}
                  matLoading={matLoading === src.id}
                  scraping={false}
                  onToggle={() => toggleExpand(src.id)}
                  onVerify={() => verify(src.id)}
                  onDelete={() => remove(src.id)}
                  onConfirmMaterial={(mid) => confirmMaterial(mid, src.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

// ── SourceCard ────────────────────────────────────────────────────────────────
function SourceCard({
  source, expanded, materials, matLoading, scraping,
  onToggle, onVerify, onDelete, onScrape, onConfirmMaterial,
}: {
  source: Source
  expanded: boolean
  materials?: Material[]
  matLoading: boolean
  scraping: boolean
  onToggle: () => void
  onVerify: () => void
  onDelete: () => void
  onScrape?: () => void
  onConfirmMaterial: (id: string) => void
}) {
  const isWeb = source.type === 'website'

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${source.verified ? 'rgba(43,107,62,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isWeb ? 'rgba(201,168,76,0.15)' : 'rgba(232,93,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {isWeb ? <Globe size={15} color="#C9A84C" /> : <Store size={15} color="#E85D26" />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#FAFAF5' }}>{source.name}</span>
            {source.verified
              ? <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(43,107,62,0.2)', color: '#7EC893', fontWeight: 600 }}>Vérifié</span>
              : <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: '#7A7A6E', fontWeight: 600 }}>En attente</span>
            }
            {source.scraper_type && isWeb && (
              <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>{source.scraper_type}</span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#7A7A6E', marginTop: '2px' }}>
            {source.quartier ? `📍 ${source.quartier}` : source.url ? source.url.replace(/^https?:\/\//, '').split('/')[0] : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {isWeb && onScrape && (
            <button onClick={onScrape} disabled={scraping}
              style={{ padding: '5px 10px', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '6px', color: '#C9A84C', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', opacity: scraping ? 0.6 : 1 }}>
              <RefreshCw size={11} style={{ animation: scraping ? 'spin 1s linear infinite' : 'none' }} />
              {scraping ? 'Scraping…' : 'Scraper'}
            </button>
          )}
          {!source.verified && (
            <button onClick={onVerify}
              style={{ padding: '5px 10px', background: 'rgba(43,107,62,0.15)', border: '1px solid rgba(43,107,62,0.4)', borderRadius: '6px', color: '#7EC893', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={11} /> Valider
            </button>
          )}
          <button onClick={onDelete}
            style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', fontSize: '11px', cursor: 'pointer' }}>
            <Trash2 size={11} />
          </button>
          {expanded ? <ChevronUp size={14} color="#7A7A6E" /> : <ChevronDown size={14} color="#7A7A6E" />}
        </div>
      </div>

      {/* Expanded — liste des articles */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px' }}>
          {source.notes && (
            <p style={{ fontSize: '12px', color: '#7A7A6E', marginBottom: '12px', fontStyle: 'italic' }}>{source.notes}</p>
          )}
          {source.url && (
            <a href={source.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#C9A84C', marginBottom: '12px', textDecoration: 'none' }}>
              <ExternalLink size={11} /> {source.url}
            </a>
          )}

          {matLoading ? (
            <div style={{ color: '#7A7A6E', fontSize: '12px' }}>Chargement…</div>
          ) : !materials || materials.length === 0 ? (
            <div style={{ color: '#7A7A6E', fontSize: '12px', fontStyle: 'italic' }}>
              <Package size={13} style={{ display: 'inline', marginRight: '6px' }} />
              Aucun article enregistré pour cette source.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ color: '#7A7A6E' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Article</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Catégorie</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Prix marché</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Prix web</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 500 }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(mat => (
                  <tr key={mat.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 8px', color: '#FAFAF5' }}>{mat.name}</td>
                    <td style={{ padding: '6px 8px', color: '#7A7A6E' }}>{mat.category}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#C9A84C', fontWeight: 600 }}>
                      {mat.price_market?.toLocaleString('fr')} F
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#7A7A6E' }}>
                      {mat.web_price ? `${mat.web_price.toLocaleString('fr')} F` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      {mat.confirmed_at ? (
                        <span style={{ fontSize: '10px', color: '#7EC893' }}>✓ Confirmé</span>
                      ) : (
                        <button onClick={() => onConfirmMaterial(mat.id)}
                          style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(43,107,62,0.12)', border: '1px solid rgba(43,107,62,0.3)', borderRadius: '6px', color: '#7EC893', cursor: 'pointer' }}>
                          Confirmer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
