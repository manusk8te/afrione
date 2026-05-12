'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Store, Plus, Package, ChevronDown, ChevronUp, MapPin, Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = ['Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie', 'Climatisation', 'Carrelage', 'Serrurerie']
const QUARTIERS  = ['Adjamé','Koumassi','Yopougon','Cocody','Plateau','Marcory','Treichville','Abobo','Port-Bouët','Attécoubé','Bingerville','Anyama']
const UNITS      = ['unité', 'mètre', 'm²', 'kg', 'litre', 'sac', 'rouleau', 'boîte', 'kit', 'lot']

type Source = {
  id: string
  name: string
  quartier: string | null
  verified: boolean
  type: string
}

export default function ArtisanMateriauxPage() {
  const router = useRouter()
  const [userId, setUserId]         = useState<string | null>(null)
  const [sources, setSources]       = useState<Source[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [msg, setMsg]               = useState<{ text: string; ok: boolean } | null>(null)

  // Tab : 'browse' = parcourir, 'new-store' = ajouter un magasin
  const [tab, setTab] = useState<'browse' | 'new-store'>('browse')

  // Formulaire nouveau magasin
  const [storeName, setStoreName]       = useState('')
  const [storeQuartier, setStoreQuartier] = useState('')
  const [storeNotes, setStoreNotes]     = useState('')
  const [savingStore, setSavingStore]   = useState(false)

  // Formulaire nouveau article (par source)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [artName, setArtName]       = useState('')
  const [artCategory, setArtCategory] = useState('Plomberie')
  const [artUnit, setArtUnit]         = useState('unité')
  const [artPrice, setArtPrice]       = useState('')
  const [savingArt, setSavingArt]     = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth'); return }
      setUserId(data.user.id)
    })
    loadSources()
  }, [])

  const loadSources = async () => {
    setLoading(true)
    const res = await fetch('/api/sources?type=magasin')
    const data = await res.json()
    setSources(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3500)
  }

  // Ajouter un nouveau magasin
  const submitStore = async () => {
    if (!storeName.trim() || !storeQuartier) return
    setSavingStore(true)
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_source',
        type: 'magasin',
        name: storeName.trim(),
        quartier: storeQuartier,
        notes: storeNotes.trim() || null,
        added_by: userId,
      }),
    })
    const data = await res.json()
    if (data.ok) {
      setSources(s => [data.source, ...s])
      setStoreName(''); setStoreQuartier(''); setStoreNotes('')
      setTab('browse')
      flash('Magasin ajouté — en attente de validation par l\'équipe AfriOne')
    } else {
      flash(`Erreur : ${data.error}`, false)
    }
    setSavingStore(false)
  }

  // Ajouter un article à un magasin
  const submitArticle = async (sourceId: string) => {
    if (!artName.trim() || !artPrice) return
    setSavingArt(true)
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_material',
        source_id: sourceId,
        name: artName.trim(),
        category: artCategory,
        unit: artUnit,
        price_observed: parseInt(artPrice),
        added_by: userId,
      }),
    })
    const data = await res.json()
    if (data.ok) {
      setArtName(''); setArtPrice(''); setArtUnit('unité')
      setAddingTo(null)
      flash('Article ajouté — merci pour votre contribution !')
    } else {
      flash(`Erreur : ${data.error}`, false)
    }
    setSavingArt(false)
  }

  const magasins = sources.filter(s => s.type === 'magasin')

  return (
    <div className="min-h-screen bg-dark text-cream" style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link href="/artisan-space/dashboard" style={{ color: '#7A7A6E', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#FAFAF5' }}>Prix matériaux</h1>
          <p style={{ fontSize: '12px', color: '#7A7A6E', marginTop: '2px' }}>Partagez les prix que vous observez dans les magasins d'Abidjan</p>
        </div>
      </div>

      {/* Flash */}
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px',
          background: msg.ok ? 'rgba(43,107,62,0.2)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${msg.ok ? '#2B6B3E' : 'rgba(239,68,68,0.4)'}`,
          color: msg.ok ? '#7EC893' : '#f87171',
        }}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['browse', 'new-store'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
              background: tab === t ? '#E85D26' : 'rgba(255,255,255,0.06)',
              color: tab === t ? 'white' : '#7A7A6E',
            }}>
            {t === 'browse' ? <><Package size={13} style={{ display: 'inline', marginRight: '6px' }} />Magasins</> : <><Plus size={13} style={{ display: 'inline', marginRight: '6px' }} />Ajouter un magasin</>}
          </button>
        ))}
      </div>

      {/* ── TAB : NOUVEAU MAGASIN ─────────────────────────────────────────────── */}
      {tab === 'new-store' && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#FAFAF5' }}>Nouveau magasin</h2>
          <p style={{ fontSize: '12px', color: '#7A7A6E', marginBottom: '16px', lineHeight: 1.6 }}>
            Vous connaissez un magasin de matériaux à Abidjan ? Ajoutez-le ici. Une fois validé par l'équipe AfriOne, n'importe quel artisan pourra y ajouter des articles avec leurs prix.
          </p>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nom du magasin *</label>
            <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="ex: Quincaillerie Centrale Adjamé"
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#FAFAF5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quartier *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {QUARTIERS.map(q => (
                <button key={q} onClick={() => setStoreQuartier(q)}
                  style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: 'none', fontWeight: storeQuartier === q ? 600 : 400, background: storeQuartier === q ? '#E85D26' : 'rgba(255,255,255,0.06)', color: storeQuartier === q ? 'white' : '#7A7A6E' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Précisions (adresse, spécialité…)</label>
            <input value={storeNotes} onChange={e => setStoreNotes(e.target.value)} placeholder="ex: En face du marché, spécialisé plomberie et sanitaire"
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#FAFAF5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <button onClick={submitStore} disabled={savingStore || !storeName.trim() || !storeQuartier}
            style={{ width: '100%', padding: '12px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: savingStore || !storeName.trim() || !storeQuartier ? 0.5 : 1 }}>
            {savingStore ? 'Envoi…' : 'Soumettre le magasin'}
          </button>
        </div>
      )}

      {/* ── TAB : PARCOURIR ──────────────────────────────────────────────────── */}
      {tab === 'browse' && (
        <>
          {loading ? (
            <div style={{ color: '#7A7A6E', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Chargement…</div>
          ) : magasins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#7A7A6E' }}>
              <Store size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>Aucun magasin encore enregistré.</p>
              <p style={{ fontSize: '12px' }}>Soyez le premier à ajouter un magasin que vous connaissez !</p>
              <button onClick={() => setTab('new-store')}
                style={{ marginTop: '16px', padding: '10px 20px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                Ajouter un magasin
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {magasins.map(src => (
                <MagasinCard
                  key={src.id}
                  source={src}
                  expanded={expanded === src.id}
                  onToggle={() => setExpanded(v => v === src.id ? null : src.id)}
                  addingArticle={addingTo === src.id}
                  onStartAdd={() => { setAddingTo(src.id); setArtName(''); setArtPrice('') }}
                  onCancelAdd={() => setAddingTo(null)}
                  artName={artName}
                  artCategory={artCategory}
                  artUnit={artUnit}
                  artPrice={artPrice}
                  savingArt={savingArt}
                  setArtName={setArtName}
                  setArtCategory={setArtCategory}
                  setArtUnit={setArtUnit}
                  setArtPrice={setArtPrice}
                  onSubmitArticle={() => submitArticle(src.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── MagasinCard ───────────────────────────────────────────────────────────────
function MagasinCard({
  source, expanded, onToggle,
  addingArticle, onStartAdd, onCancelAdd,
  artName, artCategory, artUnit, artPrice, savingArt,
  setArtName, setArtCategory, setArtUnit, setArtPrice,
  onSubmitArticle,
}: {
  source: Source
  expanded: boolean
  onToggle: () => void
  addingArticle: boolean
  onStartAdd: () => void
  onCancelAdd: () => void
  artName: string; artCategory: string; artUnit: string; artPrice: string; savingArt: boolean
  setArtName: (v: string) => void
  setArtCategory: (v: string) => void
  setArtUnit: (v: string) => void
  setArtPrice: (v: string) => void
  onSubmitArticle: () => void
}) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${source.verified ? 'rgba(43,107,62,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', overflow: 'hidden' }}>
      {/* Store header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(232,93,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Store size={16} color="#E85D26" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#FAFAF5' }}>{source.name}</span>
            {source.verified
              ? <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(43,107,62,0.2)', color: '#7EC893' }}>Vérifié</span>
              : <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(255,200,0,0.1)', color: '#C9A84C' }}>En validation</span>
            }
          </div>
          {source.quartier && (
            <div style={{ fontSize: '12px', color: '#7A7A6E', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
              <MapPin size={10} /> {source.quartier}
            </div>
          )}
        </div>

        {expanded ? <ChevronUp size={15} color="#7A7A6E" /> : <ChevronDown size={15} color="#7A7A6E" />}
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
          {!addingArticle ? (
            <button onClick={onStartAdd}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: 'rgba(232,93,38,0.1)', border: '1px solid rgba(232,93,38,0.3)', borderRadius: '8px', color: '#E85D26', fontSize: '13px', cursor: 'pointer', fontWeight: 600, width: '100%', justifyContent: 'center' }}>
              <Plus size={14} /> Ajouter un article avec son prix
            </button>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#FAFAF5' }}>Nouvel article</h3>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '3px' }}>Nom de l'article *</label>
                <input value={artName} onChange={e => setArtName(e.target.value)} placeholder="ex: Robinet chromé simple"
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#FAFAF5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '3px' }}>Catégorie</label>
                  <select value={artCategory} onChange={e => setArtCategory(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#1A1F1B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#FAFAF5', fontSize: '13px' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '3px' }}>Unité</label>
                  <select value={artUnit} onChange={e => setArtUnit(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#1A1F1B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#FAFAF5', fontSize: '13px' }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#7A7A6E', marginBottom: '3px' }}>Prix observé en magasin (FCFA) *</label>
                <input
                  type="number" value={artPrice} onChange={e => setArtPrice(e.target.value)}
                  placeholder="ex: 3500"
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#FAFAF5', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ fontSize: '11px', color: '#7A7A6E', marginTop: '4px' }}>C'est le prix que vous avez vu sur l'étiquette ou que le vendeur vous a donné.</p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={onSubmitArticle} disabled={savingArt || !artName.trim() || !artPrice}
                  style={{ flex: 1, padding: '9px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: savingArt || !artName.trim() || !artPrice ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {savingArt ? 'Enregistrement…' : <><Check size={13} /> Enregistrer</>}
                </button>
                <button onClick={onCancelAdd}
                  style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.06)', color: '#7A7A6E', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
