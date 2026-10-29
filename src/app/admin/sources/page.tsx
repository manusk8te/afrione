'use client'
import { observationLabel } from '@/lib/supplies'
import { clientApi } from '@/lib/client-api'
import { useState, useEffect } from 'react'
import MaterialObservationForm, {PartnerRegistration} from '@/components/admin/MaterialObservationForm'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { Globe, Store, Plus, CheckCircle, Trash2, RefreshCw, Package, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

const NEU_SHADOW = 'var(--ui-shadow-card)'
const NEU_SMALL  = 'var(--ui-shadow-soft)'

type Source = {
  id: string
  name: string
  type: 'website' | 'magasin'
  url: string | null
  quartier: string | null
  scraper_type: string | null
  verified: boolean
  is_partner?: boolean
  access_status?: string
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
  observed_at?: string | null
  evidence_url?: string | null
  source_url?: string | null
  price_provenance?: string
  observed_quantity?: number
  confirmed_at: string | null
}

const SCRAPER_TYPES = ['jumia', 'casashop', 'manual']

export default function AdminSourcesPage() {
  const [sources, setSources]       = useState<Source[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [materials, setMaterials]   = useState<Record<string, Material[]>>({})
  const [matLoading, setMatLoading]   = useState<string | null>(null)
  const [scraping, setScraping]       = useState<string | null>(null)
  const [msg, setMsg]                 = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [lookupQuery,setLookupQuery]=useState('')
  const [lookupResult,setLookupResult]=useState<any>(null)
  const [lookupBusy,setLookupBusy]=useState(false)
  const searchOffers=async()=>{
    setLookupBusy(true);setLookupResult(null)
    try{const r=await clientApi('/api/materials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:lookupQuery})});const data=await r.json();if(!r.ok)throw Error(data.error||'Recherche impossible');setLookupResult(data)}catch(error){setLookupResult({offers:[],note:error instanceof Error?error.message:'Recherche impossible'})}finally{setLookupBusy(false)}
  }
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
    const res = await clientApi('/api/sources')
    const data = await res.json()
    setSources(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!materials[id]) {
      setMatLoading(id)
      const res = await clientApi(`/api/sources?source_id=${id}`)
      const data = await res.json()
      setMaterials(m => ({ ...m, [id]: Array.isArray(data) ? data : [] }))
      setMatLoading(null)
    }
  }

  const verify = async (id: string) => {
    const response = await clientApi('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_source', id }),
    })
    if(!response.ok){const failure=await response.json();flash(failure.error || 'Validation impossible');return}
    setSources(s => s.map(x => x.id === id ? { ...x, verified: true } : x))
    flash('Magasin vérifié ✓')
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return }
    setConfirmDelete(null)
    const response = await clientApi('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_source', id }),
    })
    if(!response.ok){const failure=await response.json();flash(failure.error || 'Validation impossible');return}
    setSources(s => s.filter(x => x.id !== id))
    flash('Source supprimée')
  }

  const confirmMaterial = async (materialId: string, sourceId: string) => {
    const response = await clientApi('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_material', id: materialId }),
    })
    if(!response.ok){const failure=await response.json();flash(failure.error || 'Validation impossible');return}
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
      const res = await clientApi(source.scraper_type === 'public_catalogue' ? '/api/admin/collect-material-prices' : '/api/admin/scrape-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source.scraper_type === 'public_catalogue' ? {source_id:source.id} : {}),
      })
      const data = await res.json()
      if(!res.ok)throw Error(data.error || 'Collecte impossible')
      flash(data.summary || `Collecte terminée`)
      const res2 = await clientApi(`/api/sources?source_id=${source.id}`)
      const mats = await res2.json()
      setMaterials(m => ({ ...m, [source.id]: Array.isArray(mats) ? mats : [] }))
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Collecte impossible')
    }
    setScraping(null)
  }

  const addWebsite = async () => {
    if (!webName.trim() || !webUrl.trim()) return
    setSaving(true)
    const res = await clientApi('/api/sources', {
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
  }

  const websites = sources.filter(s => s.type === 'website')
  const magasins = sources.filter(s => s.type === 'magasin')

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'var(--ui-canvas)' }}>
      <AdminSidebar activeId="sources" />

      <main className="afrione-admin-content flex-1 p-6" style={{ maxWidth: '1100px', minWidth: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--ui-ink)' }}>Sources de prix</h1>
            <p style={{ color: 'var(--ui-muted)', fontSize: '14px', marginTop: '2px' }}>Fiches publiques collectables + relevés de magasins, avec contrôle des prix</p>
          </div>
          {msg && (
            <div style={{ background: 'rgba(43,107,62,0.1)', border: '1px solid rgba(43,107,62,0.3)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#2B6B3E' }}>
              {msg}
            </div>
          )}
        </div>

        <section className="mb-6 p-5 bg-white rounded-xl border border-gray-200">
          <h2 className="font-semibold mb-2">Rechercher un prix à la demande</h2>
          <p className="text-sm text-gray-500 mb-3">Décrivez la fourniture précise : usage, type, dimensions et conditionnement. Si une caractéristique manque, elle sera demandée. Aucun article ajouté au catalogue, aucune validation individuelle. Les résultats sont réutilisés pendant une heure. Fournitures séparées de la prestation ; modèle, conditionnement et livraison à confirmer.</p>
          <div className="flex gap-2">
            <input aria-label="Fourniture à rechercher" maxLength={120} value={lookupQuery} onChange={e=>setLookupQuery(e.target.value)} placeholder="Ex. ciment CPJ 32.5R la tonne, mitigeur cuisine" className="border rounded-lg p-2 flex-1 min-w-0 afrione-field" />
            <button onClick={searchOffers} disabled={lookupBusy||lookupQuery.trim().length<2} className="afrione-gradient text-white rounded-lg px-4 disabled:opacity-50 afrione-action">{lookupBusy?'Recherche…':'Chercher les prix'}</button>
          </div>
          {lookupResult && <div role="status" className="mt-4 text-sm">
            <p>{lookupResult.note}</p>
            {!lookupResult.offers?.length && <p>Aucun prix exploitable trouvé.</p>}
            {lookupResult.comparison_references?.map((ref:any)=><p key={ref.url} className="mt-3"><a href={ref.url} target="_blank" rel="noopener noreferrer" className="underline">{ref.source}</a> — {ref.note}</p>)}
            {lookupResult.offers?.map((offer:any)=><div key={offer.source_url} className="border-t mt-3 pt-3">
              <a href={offer.source_url} target="_blank" rel="noopener noreferrer" className="underline">{offer.name} — {offer.source}</a>
              <p>{offer.price.toLocaleString('fr-FR')} FCFA / {offer.unit}</p>
              <p className="text-gray-500">Consulté le {new Date(offer.observed_at).toLocaleString('fr-FR')}</p>
            </div>)}
          </div>}
        </section>

        <MaterialObservationForm sources={sources} onSaved={()=>{setMaterials({});load()}} />
        <PartnerRegistration sources={sources} onSaved={load} />
        {/* ── SITES WEB ───────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#C9A84C', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} /> Sites web ({websites.length})
            </h2>
            <button
              onClick={() => setShowWebForm(v => !v)}
              className="afrione-gradient afrione-action"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Plus size={14} /> Ajouter un site
            </button>
          </div>

          {showWebForm && (
            <div style={{ background: '#FFFFFF', border: '1px solid var(--ui-border)', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: NEU_SHADOW }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px', color: 'var(--ui-ink)' }}>Nouveau site web</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--ui-muted)', marginBottom: '4px' }}>Nom du site *</label>
                  <input className="afrione-field" value={webName} onChange={e => setWebName(e.target.value)} placeholder="ex: CasaShop CI"
                    style={{ width: '100%', padding: '8px 12px', background: '#FFFFFF', border: '1.5px solid var(--ui-border)', borderRadius: '8px', color: 'var(--ui-ink)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--ui-muted)', marginBottom: '4px' }}>URL catalogue *</label>
                  <input className="afrione-field" value={webUrl} onChange={e => setWebUrl(e.target.value)} placeholder="https://..."
                    style={{ width: '100%', padding: '8px 12px', background: '#FFFFFF', border: '1.5px solid var(--ui-border)', borderRadius: '8px', color: 'var(--ui-ink)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--ui-muted)', marginBottom: '4px' }}>Type de scraper</label>
                  <select className="afrione-field" value={webScraper} onChange={e => setWebScraper(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#FFFFFF', border: '1.5px solid var(--ui-border)', borderRadius: '8px', color: 'var(--ui-ink)', fontSize: '13px' }}>
                    {SCRAPER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--ui-muted)', marginBottom: '4px' }}>Notes (format de la page, spécificités…)</label>
                  <input className="afrione-field" value={webNotes} onChange={e => setWebNotes(e.target.value)} placeholder="ex: JSON dans window.__data.products"
                    style={{ width: '100%', padding: '8px 12px', background: '#FFFFFF', border: '1.5px solid var(--ui-border)', borderRadius: '8px', color: 'var(--ui-ink)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addWebsite} disabled={saving}
                  className="afrione-gradient afrione-action"
                  style={{ padding: '8px 20px', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Ajout…' : 'Ajouter'}
                </button>
                <button className="afrione-action" onClick={() => setShowWebForm(false)}
                  style={{ padding: '8px 14px', background: 'var(--ui-canvas)', color: 'var(--ui-muted)', border: '1px solid var(--ui-border)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ color: 'var(--ui-muted)', fontSize: '13px' }}>Chargement…</div>
          ) : websites.length === 0 ? (
            <div style={{ color: '#8B95A5', fontSize: '13px', fontStyle: 'italic' }}>Aucun site web configuré. Ajoutez Jumia CI, CasaShop CI, etc.</div>
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
                  isConfirmingDelete={confirmDelete === src.id}
                  onToggle={() => toggleExpand(src.id)}
                  onVerify={() => verify(src.id)}
                  onDelete={() => remove(src.id)}
                  onScrape={(src.scraper_type === 'public_catalogue' || src.scraper_type === 'jumia') && src.access_status !== 'blocked' ? () => triggerScrape(src) : undefined}
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
            <span style={{ fontSize: '12px', color: '#8B95A5' }}>Ajoutés par les artisans · à valider</span>
          </div>

          {loading ? null : magasins.length === 0 ? (
            <div style={{ color: '#8B95A5', fontSize: '13px', fontStyle: 'italic' }}>Aucun magasin soumis par les artisans pour l'instant.</div>
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
                  isConfirmingDelete={confirmDelete === src.id}
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
  source, expanded, materials, matLoading, scraping, isConfirmingDelete,
  onToggle, onVerify, onDelete, onScrape, onConfirmMaterial,
}: {
  source: Source
  expanded: boolean
  materials?: Material[]
  matLoading: boolean
  scraping: boolean
  isConfirmingDelete: boolean
  onToggle: () => void
  onVerify: () => void
  onDelete: () => void
  onScrape?: () => void
  onConfirmMaterial: (id: string) => void
}) {
  const isWeb = source.type === 'website'
  const NEU_SMALL = 'var(--ui-shadow-soft)'

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${source.verified ? 'rgba(43,107,62,0.3)' : 'var(--ui-border)'}`, borderRadius: '12px', overflow: 'hidden', boxShadow: NEU_SMALL }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isWeb ? 'rgba(201,168,76,0.1)' : 'rgba(232,93,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {isWeb ? <Globe size={15} color="#C9A84C" /> : <Store size={15} color="#E85D26" />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ui-ink)' }}>{source.name}</span>
            {source.verified
              ? <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(43,107,62,0.1)', color: '#2B6B3E', fontWeight: 600 }}>Vérifié</span>
              : <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'var(--ui-canvas)', color: 'var(--ui-muted)', fontWeight: 600, border: '1px solid var(--ui-border)' }}>En attente</span>
            }
            {source.is_partner && <span>Partenaire AfriOne confirmé</span>}
            {source.access_status && <span style={{fontSize:11}}>Accès : {source.access_status === 'blocked' ? 'automatisation bloquée' : source.access_status === 'unreachable' ? 'site non accessible au dernier contrôle' : source.access_status === 'available' ? 'site accessible au dernier contrôle' : 'à contrôler'}</span>}
            {source.scraper_type && isWeb && (
              <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(201,168,76,0.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>{source.scraper_type === 'public_catalogue' ? 'Fiches publiques' : source.scraper_type === 'manual' ? 'Relevé manuel' : source.scraper_type}</span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ui-muted)', marginTop: '2px' }}>
            {source.quartier ? `📍 ${source.quartier}` : source.url ? source.url.replace(/^https?:\/\//, '').split('/')[0] : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {isWeb && onScrape && (
            <button className="afrione-action" onClick={onScrape} disabled={scraping}
              style={{ padding: '5px 10px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '6px', color: '#C9A84C', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', opacity: scraping ? 0.6 : 1 }}>
              <RefreshCw size={11} style={{ animation: scraping ? 'spin 1s linear infinite' : 'none' }} />
              {scraping ? 'Collecte…' : 'Actualiser les prix'}
            </button>
          )}
          {!source.verified && (
            <button className="afrione-action" onClick={onVerify}
              style={{ padding: '5px 10px', background: 'rgba(43,107,62,0.08)', border: '1px solid rgba(43,107,62,0.25)', borderRadius: '6px', color: '#2B6B3E', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={11} /> Valider
            </button>
          )}
          <button className="afrione-action" onClick={onDelete}
            style={{ padding: '5px 8px', background: isConfirmingDelete ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.05)', border: `1px solid ${isConfirmingDelete ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.15)'}`, borderRadius: '6px', color: '#f87171', fontSize: '11px', cursor: 'pointer', fontWeight: isConfirmingDelete ? 700 : 400, whiteSpace: 'nowrap' }}>
            {isConfirmingDelete ? '⚠️ Confirmer ?' : <Trash2 size={11} />}
          </button>
          {expanded ? <ChevronUp size={14} color="#8B95A5" /> : <ChevronDown size={14} color="#8B95A5" />}
        </div>
      </div>

      {/* Expanded — liste des articles */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--ui-border)', padding: '12px 16px', background: 'var(--ui-canvas)' }}>
          {source.notes && (
            <p style={{ fontSize: '12px', color: 'var(--ui-muted)', marginBottom: '12px', fontStyle: 'italic' }}>{source.notes}</p>
          )}
          {source.url && (
            <a href={source.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#C9A84C', marginBottom: '12px', textDecoration: 'none' }}>
              <ExternalLink size={11} /> {source.url}
            </a>
          )}

          {matLoading ? (
            <div style={{ color: 'var(--ui-muted)', fontSize: '12px' }}>Chargement…</div>
          ) : !materials || materials.length === 0 ? (
            <div style={{ color: '#8B95A5', fontSize: '12px', fontStyle: 'italic' }}>
              <Package size={13} style={{ display: 'inline', marginRight: '6px' }} />
              Aucun article enregistré pour cette source.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#FFFFFF', borderRadius: '8px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: 'var(--ui-canvas)', borderBottom: '1px solid var(--ui-border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: 'var(--ui-muted)' }}>Article</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: 'var(--ui-muted)' }}>Catégorie</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ui-muted)' }}>Prix marché</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ui-muted)' }}>Prix web</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, color: 'var(--ui-muted)' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(mat => (
                  <tr key={mat.id} style={{ borderTop: '1px solid var(--ui-border)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--ui-ink)' }}>{mat.name}<small style={{display:'block'}}>Unité : {mat.unit} · {observationLabel(mat.price_provenance)} · {mat.observed_at ? new Date(mat.observed_at).toLocaleDateString('fr-FR') : 'date manquante'}</small>{(mat.evidence_url || mat.source_url) && <a href={mat.evidence_url || mat.source_url || ''} target="_blank" rel="noopener noreferrer">Voir le justificatif / produit</a>}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--ui-muted)' }}>{mat.category}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#C9A84C', fontWeight: 600 }}>
                      {mat.price_market?.toLocaleString('fr')} F
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--ui-muted)' }}>
                      {mat.web_price ? `${mat.web_price.toLocaleString('fr')} F` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {mat.confirmed_at ? (
                        <span style={{ fontSize: '10px', color: '#2B6B3E', fontWeight: 600 }}>✓ Confirmé</span>
                      ) : (
                        <button className="afrione-action" onClick={() => onConfirmMaterial(mat.id)}
                          style={{ fontSize: '10px', padding: '3px 10px', background: 'rgba(43,107,62,0.08)', border: '1px solid rgba(43,107,62,0.2)', borderRadius: '6px', color: '#2B6B3E', cursor: 'pointer' }}>
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
