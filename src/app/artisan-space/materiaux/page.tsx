'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Store, Plus, Package, ChevronDown, ChevronUp, MapPin, Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

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
    <div className="min-h-screen" style={{ background: '#F5F7FA', maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link href="/artisan-space/dashboard" style={{ color: '#8B95A5', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#3D4852' }}>Prix matériaux</h1>
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>Partagez les prix que vous observez dans les magasins d'Abidjan</p>
        </div>
      </div>

      {/* Flash */}
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px',
          background: msg.ok ? 'rgba(43,107,62,0.1)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${msg.ok ? 'rgba(43,107,62,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: msg.ok ? '#2B6B3E' : '#ef4444',
        }}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['browse', 'new-store'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? 'afrione-gradient' : ''}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
              background: tab === t ? undefined : '#FFFFFF',
              boxShadow: tab === t ? 'none' : NEU_SMALL,
              color: tab === t ? 'white' : '#6B7280',
            }}>
            {t === 'browse' ? <><Package size={13} style={{ display: 'inline', marginRight: '6px' }} />Magasins</> : <><Plus size={13} style={{ display: 'inline', marginRight: '6px' }} />Ajouter un magasin</>}
          </button>
        ))}
      </div>

      {/* ── TAB : NOUVEAU MAGASIN ─────────────────────────────────────────────── */}
      {tab === 'new-store' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '20px', boxShadow: NEU_SHADOW }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#3D4852' }}>Nouveau magasin</h2>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', lineHeight: 1.6 }}>
            Vous connaissez un magasin de matériaux à Abidjan ? Ajoutez-le ici. Une fois validé par l'équipe AfriOne, n'importe quel artisan pourra y ajouter des articles avec leurs prix.
          </p>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nom du magasin *</label>
            <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="ex: Quincaillerie Centrale Adjamé"
              style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '8px', color: '#3D4852', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quartier *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {QUARTIERS.map(q => (
                <button key={q} onClick={() => setStoreQuartier(q)}
                  className={storeQuartier === q ? 'afrione-gradient' : ''}
                  style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: 'none', fontWeight: storeQuartier === q ? 600 : 400, background: storeQuartier === q ? undefined : '#F5F7FA', boxShadow: storeQuartier === q ? 'none' : NEU_SMALL, color: storeQuartier === q ? 'white' : '#6B7280' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Précisions (adresse, spécialité…)</label>
            <input value={storeNotes} onChange={e => setStoreNotes(e.target.value)} placeholder="ex: En face du marché, spécialisé plomberie et sanitaire"
              style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '8px', color: '#3D4852', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <button onClick={submitStore} disabled={savingStore || !storeName.trim() || !storeQuartier}
            className="afrione-gradient"
            style={{ width: '100%', padding: '12px', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: savingStore || !storeName.trim() || !storeQuartier ? 0.5 : 1 }}>
            {savingStore ? 'Envoi…' : 'Soumettre le magasin'}
          </button>
        </div>
      )}

      {/* ── TAB : PARCOURIR ──────────────────────────────────────────────────── */}
      {tab === 'browse' && (
        <>
          {loading ? (
            <div style={{ color: '#8B95A5', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Chargement…</div>
          ) : magasins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#6B7280' }}>
              <Store size={36} style={{ margin: '0 auto 12px', opacity: 0.4, color: '#8B95A5' }} />
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>Aucun magasin encore enregistré.</p>
              <p style={{ fontSize: '12px' }}>Soyez le premier à ajouter un magasin que vous connaissez !</p>
              <button onClick={() => setTab('new-store')}
                className="afrione-gradient"
                style={{ marginTop: '16px', padding: '10px 20px', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
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
const NEU_SHADOW_CARD = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL_CARD  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

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
    <div style={{ background: '#FFFFFF', border: `1px solid ${source.verified ? 'rgba(43,107,62,0.25)' : '#E2E8F0'}`, borderRadius: '16px', overflow: 'hidden', boxShadow: NEU_SHADOW_CARD }}>
      {/* Store header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(232,93,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: NEU_SMALL_CARD }}>
          <Store size={16} color="#E85D26" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#3D4852' }}>{source.name}</span>
            {source.verified
              ? <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(43,107,62,0.1)', color: '#2B6B3E' }}>Vérifié</span>
              : <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>En validation</span>
            }
          </div>
          {source.quartier && (
            <div style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
              <MapPin size={10} /> {source.quartier}
            </div>
          )}
        </div>

        {expanded ? <ChevronUp size={15} color="#8B95A5" /> : <ChevronDown size={15} color="#8B95A5" />}
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: '1px solid #E2E8F0', padding: '14px 16px' }}>
          {!addingArticle ? (
            <button onClick={onStartAdd}
              className="afrione-gradient-text"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: 'rgba(232,93,38,0.08)', border: '1px solid rgba(232,93,38,0.25)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, width: '100%', justifyContent: 'center' }}>
              <Plus size={14} /> Ajouter un article avec son prix
            </button>
          ) : (
            <div style={{ background: '#F5F7FA', borderRadius: '10px', padding: '14px', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#3D4852' }}>Nouvel article</h3>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '3px' }}>Nom de l'article *</label>
                <input value={artName} onChange={e => setArtName(e.target.value)} placeholder="ex: Robinet chromé simple"
                  style={{ width: '100%', padding: '8px 10px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '7px', color: '#3D4852', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '3px' }}>Catégorie</label>
                  <select value={artCategory} onChange={e => setArtCategory(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '7px', color: '#3D4852', fontSize: '13px' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '3px' }}>Unité</label>
                  <select value={artUnit} onChange={e => setArtUnit(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '7px', color: '#3D4852', fontSize: '13px' }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '3px' }}>Prix observé en magasin (FCFA) *</label>
                <input
                  type="number" value={artPrice} onChange={e => setArtPrice(e.target.value)}
                  placeholder="ex: 3500"
                  style={{ width: '100%', padding: '8px 10px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '7px', color: '#3D4852', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>C'est le prix que vous avez vu sur l'étiquette ou que le vendeur vous a donné.</p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={onSubmitArticle} disabled={savingArt || !artName.trim() || !artPrice}
                  className="afrione-gradient"
                  style={{ flex: 1, padding: '9px', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: savingArt || !artName.trim() || !artPrice ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {savingArt ? 'Enregistrement…' : <><Check size={13} /> Enregistrer</>}
                </button>
                <button onClick={onCancelAdd}
                  style={{ padding: '9px 14px', background: '#FFFFFF', color: '#6B7280', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', boxShadow: NEU_SMALL_CARD }}>
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
