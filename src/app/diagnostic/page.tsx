'use client'
import { CATEGORY_TO_METIER } from '@/lib/pricing'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Send, RotateCcw, CheckCircle, Zap, AlertCircle, Clock, Wrench, X, ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'
const NEU_INSET  = 'inset 4px 4px 10px rgba(163,177,198,0.45), inset -4px -4px 8px rgba(255,255,255,0.9)'

type Step = 'input' | 'questioning' | 'summarizing' | 'confirming'

type QAType = 'yesno' | 'choice' | 'text'
interface QA { question: string; type: QAType; options?: string[]; answer: string }


interface DiagResult {
  summary: string
  technical_notes: string
  category: string
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  price_min: number
  price_max: number
  items_needed: { name: string; qty: number; unit: string }[]
  duration_estimate: string
  surface_m2?: number | null
  budget_client?: string | null
  mission_id?: string
}

interface PricingData {
  estimate: number
  interval: { low: number; high: number }
  decomp: { labor: number; materials: number; transport: number; premium: number }
  artisan_percoit: number
  savings_vs_market?: number
  below_market?: boolean
  market_reference_fcfa?: number
}

function parseDuration(str: string): number {
  if (!str) return 2
  const lower = str.toLowerCase()
  const isJours = lower.includes('jour')
  const minMatch = lower.match(/(\d+)\s*min/)
  if (minMatch && !lower.includes('heure') && !lower.match(/\d+\s*h(?:eure)?s?\s+\d+/)) {
    return Math.max(0.25, parseInt(minMatch[1]) / 60)
  }
  const hMinMatch = lower.match(/(\d+)\s*h(?:eure)?s?\s*(\d+)/)
  if (hMinMatch) return parseInt(hMinMatch[1]) + parseInt(hMinMatch[2]) / 60
  const rangeMatch = lower.match(/(\d+(?:\.\d+)?)\s*[àa-]\s*(\d+(?:\.\d+)?)/)
  if (rangeMatch) {
    const avg = (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2
    return isJours ? avg * 8 : avg
  }
  const nums = str.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const val = nums.length ? nums[0] : 2
  return isJours ? val * 8 : val
}

function materialEmoji(name: string): string {
  const n = name.toLowerCase()
  if (/robinet|mitigeur|mélangeur/.test(n)) return '🚿'
  if (/tuyau|tube|pvc|flexible/.test(n)) return '🔧'
  if (/joint|torique|plomberie/.test(n)) return '🔩'
  if (/siphon|bonde|collecteur/.test(n)) return '🔧'
  if (/câble|fil électrique|conducteur/.test(n)) return '⚡'
  if (/disjoncteur|différentiel|interrupteur/.test(n)) return '🔌'
  if (/prise|tableau|bornier/.test(n)) return '🔌'
  if (/ampoule|led|luminaire/.test(n)) return '💡'
  if (/ciment|béton|mortier|sac/.test(n)) return '🧱'
  if (/carrelage|dalle|faïence/.test(n)) return '🟦'
  if (/peinture|laque|enduit|apprêt/.test(n)) return '🎨'
  if (/rouleau|pinceau|bâche/.test(n)) return '🖌️'
  if (/porte|fenêtre|volet/.test(n)) return '🚪'
  if (/serrure|cadenas|verrou|clé/.test(n)) return '🔑'
  if (/clim|climatiseur|filtre|réfrigérant/.test(n)) return '❄️'
  if (/sable|gravier|parpaing/.test(n)) return '🧱'
  if (/vis|boulon|cheville|écrou/.test(n)) return '🔩'
  if (/taloche|truelle|spatule/.test(n)) return '🧱'
  if (/bois|planche|contreplaqué/.test(n)) return '🪵'
  return '🔧'
}

const URGENCY = {
  low:       { label: 'Pas urgent', color: '#2B6B3E', bg: 'rgba(43,107,62,0.08)',  icon: '🟢' },
  medium:    { label: 'Normal',     color: '#C9A84C', bg: 'rgba(201,168,76,0.08)', icon: '🟡' },
  high:      { label: 'Urgent',     color: '#E85D26', bg: 'rgba(232,93,38,0.08)',  icon: '🟠' },
  emergency: { label: 'Urgence !',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  icon: '🔴' },
}

const EXAMPLES = [
  "Ma fuite d'eau sous l'évier de cuisine s'aggrave depuis ce matin",
  "Le disjoncteur de ma chambre saute chaque fois que j'allume la clim",
  "Je veux peindre mon salon de 25m² en blanc cassé",
]

export default function DiagnosticPage() {
  const router = useRouter()
  const [step, setStep]               = useState<Step>('input')
  const [text, setText]               = useState('')
  const [photos, setPhotos]           = useState<string[]>([])
  const [uploading, setUploading]     = useState(false)
  const [qa, setQA]                   = useState<QA[]>([])
  const [currentQ, setCurrentQ]       = useState<{ question: string; type: QAType; options?: string[] } | null>(null)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [showPrecise, setShowPrecise] = useState(false)
  const [preciseText, setPreciseText] = useState('')
  const [result, setResult]           = useState<DiagResult | null>(null)
  const [userId, setUserId]           = useState<string | null>(null)
  const [quartier, setQuartier]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [pricing, setPricing]         = useState<PricingData | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [materialTiers, setMaterialTiers]   = useState<any[]>([])
  const [selectedTiers, setSelectedTiers]   = useState<Record<string, 'economique'|'standard'|'premium'>>({})
  const [marketRef, setMarketRef]           = useState<number | null>(null)
  const [refineText, setRefineText]   = useState('')
  const [refining, setRefining]       = useState(false)
  const [navigating, setNavigating]   = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/auth?redirect=/diagnostic')
        return
      }
      setUserId(session.user.id)
      supabase.from('users').select('quartier').eq('id', session.user.id).single()
        .then(({ data }) => { if (data?.quartier) setQuartier(data.quartier) })
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [qa, currentQ, step])

  // ── Upload photo → Supabase storage ──
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `diagnostic/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('portfolio').upload(path, file, { upsert: false })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
        setPhotos(prev => [...prev, publicUrl])
      } else {
        toast.error(`Échec upload : ${file.name}`)
      }
    }
    setUploading(false)
  }

  // ── Étape 1 → 2 : lance le diagnostic, reçoit 1ère question ──
  const startDiagnostic = async () => {
    if (text.trim().length < 10) return
    setLoading(true)
    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'start', text, photos }),
      })
      const data = await res.json()
      if (data.done || !data.question) {
        await finalizeWithQA([])
      } else {
        setCurrentQ({ question: data.question, type: data.type, options: data.options })
        setStep('questioning')
      }
    } catch {
      setCurrentQ({ question: "Depuis combien de temps avez-vous ce problème ?", type: 'text' })
      setStep('questioning')
    }
    setLoading(false)
  }

  // ── Répondre à la question courante ──
  const answerQuestion = async () => {
    const finalAnswer = showPrecise && preciseText.trim()
      ? `${currentAnswer} — ${preciseText.trim()}`
      : currentAnswer
    if (!finalAnswer.trim()) return

    const newQA: QA[] = [...qa, { question: currentQ!.question, type: currentQ!.type, answer: finalAnswer }]
    setQA(newQA)
    setCurrentAnswer('')
    setPreciseText('')
    setShowPrecise(false)
    setCurrentQ(null)
    setLoading(true)

    try {
      if (newQA.length >= 4) {
        await finalizeWithQA(newQA)
        return
      }
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'next', text, photos, qa: newQA, index: newQA.length }),
      })
      const data = await res.json()
      const isEmpty = !data.question || (data.type === 'choice' && (!data.options || data.options.length < 2))
      if (data.done || isEmpty) {
        await finalizeWithQA(newQA)
      } else {
        setCurrentQ({ question: data.question, type: data.type, options: data.options })
        setLoading(false)
      }
    } catch {
      await finalizeWithQA(newQA)
    }
  }

  // ── Appel moteur de pricing (Agent IA AfriOne) ──
  const fetchPricing = async (diagResult: DiagResult) => {
    setPricing(null)
    setPricingLoading(true)
    try {
      const itemNames = (diagResult.items_needed || []).map((i: any) => typeof i === 'string' ? i : i.name).filter(Boolean)
      const [pricingRes, tiersRes] = await Promise.all([
        fetch('/api/pricing-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category:       diagResult.category,
            description:    diagResult.summary || diagResult.technical_notes || '',
            urgency:        diagResult.urgency,
            hours_estimate: parseDuration(diagResult.duration_estimate),
            quartier:       quartier || 'Cocody',
            items_needed:   itemNames,
          }),
        }),
        itemNames.length > 0
          ? fetch(`/api/materials?category=${encodeURIComponent(diagResult.category)}&items=${encodeURIComponent(itemNames.join(','))}&client_quartier=${encodeURIComponent(quartier || 'Cocody')}`)
          : Promise.resolve(null),
      ])
      if (pricingRes.ok) {
        const d = await pricingRes.json()
        const bd = d.breakdown || {}
        setPricing({
          estimate:        d.total || 0,
          interval:        { low: d.fourchette?.min || 0, high: d.fourchette?.max || 0 },
          decomp: {
            labor:     bd.main_oeuvre     || 0,
            materials: bd.materiaux       || 0,
            transport: bd.transport       || 0,
            premium:   (bd.commission_afrione || 0) + (bd.assurance_sav || 0),
          },
          artisan_percoit: d.artisan_percoit || 0,
        })
      }
      if (tiersRes?.ok) {
        const td = await tiersRes.json()
        setMaterialTiers(td.materials || [])
        if (td.market_reference_fcfa) setMarketRef(td.market_reference_fcfa)
        const defaults: Record<string, 'economique'|'standard'|'premium'> = {}
        for (const m of td.materials || []) defaults[m.name] = 'standard'
        setSelectedTiers(defaults)
      }
    } catch {}
    setPricingLoading(false)
  }

  // Recalcule localement quand le client change un tier matériau
  const updatePricingForTier = (_diagResult: DiagResult, tiers: Record<string, 'economique'|'standard'|'premium'>) => {
    if (!pricing) return
    const newMat = materialTiers.reduce((sum: number, mat: any) => {
      const tier = tiers[mat.name] || 'standard'
      const tierData = mat.tiers?.[tier]
      const price = tierData?.price_unit ?? tierData?.price_market ?? 0
      const qty = mat.qty || 1
      return sum + price * qty
    }, 0)
    const subtotal   = pricing.decomp.labor + newMat + pricing.decomp.transport
    const commission = Math.round(subtotal * 0.10)
    const assurance  = Math.round(subtotal * 0.02)
    const total      = subtotal + commission + assurance
    setPricing({
      ...pricing,
      estimate:        total,
      interval:        { low: Math.round(total * 0.92), high: Math.round(total * 1.08) },
      decomp:          { ...pricing.decomp, materials: newMat, premium: commission + assurance },
      artisan_percoit: Math.round(total * 0.88),
    })
  }

  // ── Génère le résumé final ──
  const finalizeWithQA = async (finalQA: QA[]) => {
    setStep('summarizing')
    setLoading(true)
    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'finalize', text, photos, qa: finalQA, user_id: userId, quartier }),
      })
      const data = await res.json()
      const safeResult = { ...data, urgency: safeUrgency(data.urgency) }
      setResult(safeResult)
      setStep('confirming')
      fetchPricing(safeResult)
    } catch {
      const fallback: DiagResult = { summary: 'Problème artisanal détecté, intervention professionnelle recommandée.', technical_notes: 'Diagnostic à affiner sur place.', category: 'Plomberie', urgency: 'medium', price_min: 5000, price_max: 20000, items_needed: [{ name: 'Matériaux selon diagnostic', qty: 1, unit: 'unité' }], duration_estimate: '1 heure' }
      setResult(fallback)
      setStep('confirming')
      fetchPricing(fallback)
    }
    setLoading(false)
  }

  // ── Affiner le résumé ──
  const refineResult = async () => {
    if (!refineText.trim() || refining) return
    setRefining(true)
    const enrichedText = text + '\n\nPrécision : ' + refineText.trim()
    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'finalize', text: enrichedText, photos, qa, user_id: userId, quartier }),
      })
      const data = await res.json()
      setResult(prev => ({ ...prev!, ...data, urgency: safeUrgency(data.urgency) }))
      setRefineText('')
    } catch {}
    setRefining(false)
  }

  const safeUrgency = (u: string): DiagResult['urgency'] => {
    const map: Record<string, DiagResult['urgency']> = { low:'low', faible:'low', medium:'medium', moyen:'medium', normal:'medium', high:'high', haute:'high', urgent:'high', emergency:'emergency', urgence:'emergency' }
    return map[u?.toLowerCase()] || 'medium'
  }

  const urgConf = result ? URGENCY[result.urgency] : URGENCY.medium

  const DIAG_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4'

  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', position: 'relative', color: '#3D4852' }}>
      <Navbar />

      {/* ── VIDEO BANNER ───────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', height: '210px', marginTop: '64px' }}>
        <video autoPlay muted loop playsInline
          src={DIAG_VIDEO}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Orange gradient overlay */}
        <div className="afrione-gradient" style={{ position: 'absolute', inset: 0, opacity: 0.78 }} />

        {/* Floating white squares */}
        <div style={{ position: 'absolute', top: '18%', left: '4%',  width: 52, height: 52, border: '2px solid rgba(255,255,255,0.22)', borderRadius: 12, animation: 'floatSquare 5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '55%', right: '6%',  width: 34, height: 34, background: 'rgba(255,255,255,0.12)', borderRadius: 8, animation: 'floatSquare 4s ease-in-out infinite 1.2s' }} />
        <div style={{ position: 'absolute', top: '25%', right: '18%', width: 20, height: 20, background: 'rgba(255,255,255,0.18)', borderRadius: 5, animation: 'floatSquareSlow 6.5s ease-in-out infinite 2s' }} />
        <div style={{ position: 'absolute', bottom: '18%', left: '16%', width: 64, height: 64, border: '1.5px solid rgba(255,255,255,0.14)', borderRadius: 16, animation: 'floatSquareSlow 7s ease-in-out infinite 0.5s' }} />
        <div style={{ position: 'absolute', top: '40%', left: '40%',  width: 16, height: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 4, animation: 'floatSquareDrift 5s ease-in-out infinite 3s' }} />

        {/* Text */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '20px', padding: '5px 14px', marginBottom: '12px' }}>
            <Zap size={12} color="white" />
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', letterSpacing: '0.12em', fontFamily: 'Tahoma' }}>DIAGNOSTIC IA</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, color: 'white', margin: '0 0 8px', textShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>
            {step === 'input'       ? 'Décrivez votre problème'  :
             step === 'questioning' ? 'Quelques questions...'     :
             step === 'summarizing' ? 'Analyse en cours...'      :
                                     'Voici mon diagnostic'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '13px', margin: 0 }}>
            {step === 'input'       ? "L'IA analyse et pose des questions — envoyez aussi des photos" :
             step === 'questioning' ? `Répondez pour un diagnostic précis · ${qa.length}/4 questions` :
             step === 'summarizing' ? "L'IA synthétise toutes vos réponses" :
                                     "Résumé · Estimation de prix · Fiche technique"}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 16px 64px', position: 'relative' }}>

        {/* Orange decorative squares in white area */}
        <div style={{ position: 'absolute', top: '4%',  right: '-24px', width: 58, height: 58, background: 'rgba(232,93,38,0.07)', borderRadius: 14, animation: 'floatSquare 5.5s ease-in-out infinite', transform: 'rotate(15deg)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '35%', left: '-22px',  width: 42, height: 42, border: '2px solid rgba(232,93,38,0.11)', borderRadius: 10, animation: 'floatSquareSlow 6s ease-in-out infinite 1.5s', transform: 'rotate(-10deg)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '68%', right: '-16px', width: 26, height: 26, background: 'rgba(232,93,38,0.09)', borderRadius: 6, animation: 'floatSquareDrift 4.5s ease-in-out infinite 2.5s', pointerEvents: 'none' }} />

        {/* Back link */}
        <div style={{ marginBottom: '20px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#8B95A5', fontSize: '13px', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Retour
          </Link>
        </div>

        {/* ══ ÉTAPE 1 : Input ══ */}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Description */}
            <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1.5px solid #E2E8F0', overflow: 'hidden', boxShadow: NEU_SHADOW }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Décrivez votre problème : lieu précis, symptômes, depuis quand..."
                style={{ width: '100%', minHeight: '130px', border: 'none', outline: 'none', resize: 'none', fontSize: '15px', lineHeight: '1.6', color: '#3D4852', fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box', padding: '18px 20px' }}
                maxLength={1000}
              />
              <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '11px', color: '#8B95A5', fontFamily: 'Tahoma' }}>{text.length}/1000</span>
              </div>
            </div>

            {/* Photos */}
            <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
            {photos.length === 0 ? (
              <button onClick={() => photoInputRef.current?.click()} disabled={uploading} style={{
                width: '100%', padding: '18px', border: '2px dashed #E2E8F0', borderRadius: '16px',
                background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#8B95A5',
                boxShadow: NEU_SMALL,
              }}>
                {uploading
                  ? <div style={{ width: '18px', height: '18px', border: '2px solid rgba(232,93,38,0.3)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  : <Camera size={18} color="#8B95A5" />
                }
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>{uploading ? 'Upload en cours…' : 'Ajouter des photos'}</div>
                  <div style={{ fontSize: '11px', color: '#8B95A5', marginTop: '2px' }}>L'IA peut analyser les photos du problème</div>
                </div>
              </button>
            ) : (
              <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '14px', border: '1px solid #E2E8F0', boxShadow: NEU_SMALL }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'Tahoma' }}>
                  📸 {photos.length} PHOTO{photos.length > 1 ? 'S' : ''} AJOUTÉE{photos.length > 1 ? 'S' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {photos.map((url, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', background: '#F5F7FA' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: '3px', right: '3px', width: '20px', height: '20px', background: 'rgba(61,72,82,0.7)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => photoInputRef.current?.click()} style={{ aspectRatio: '1', borderRadius: '10px', border: '2px dashed #E2E8F0', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', color: '#8B95A5', fontSize: '10px' }}>
                    <Camera size={14} /> <span>Ajouter</span>
                  </button>
                </div>
              </div>
            )}

            {/* Exemples */}
            <div>
              <p style={{ fontSize: '10px', fontFamily: 'Tahoma', color: '#8B95A5', letterSpacing: '0.1em', marginBottom: '8px' }}>EXEMPLES</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => setText(ex)} style={{ textAlign: 'left', padding: '11px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', color: '#6B7280', boxShadow: NEU_SMALL }}>
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>

            <button onClick={startDiagnostic} disabled={text.length < 10 || loading} className={text.length >= 10 ? 'btn-primary' : ''} style={{
              width: '100%', padding: '16px', background: text.length >= 10 ? undefined : '#E2E8F0', color: text.length >= 10 ? 'white' : '#8B95A5',
              border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '15px', cursor: text.length >= 10 ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1,
            }}>
              {loading
                ? <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Analyse en cours…</>
                : <><Zap size={18} /> Analyser avec l'IA</>
              }
            </button>
          </div>
        )}

        {/* ══ ÉTAPE 2 : Conversation Q&A ══ */}
        {step === 'questioning' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Résumé du problème initial */}
            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0', boxShadow: NEU_SMALL }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.1em', marginBottom: '6px', fontFamily: 'Tahoma' }}>VOTRE PROBLÈME</div>
              <p style={{ fontSize: '13px', color: '#3D4852', lineHeight: '1.5', margin: 0 }}>{text}</p>
              {photos.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {photos.map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
                  ))}
                </div>
              )}
            </div>

            {/* Q&A répondues */}
            {qa.map((item, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Question */}
                <div style={{ background: 'rgba(232,93,38,0.06)', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <div className="afrione-gradient-text" style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px', fontFamily: 'Tahoma' }}>IA · Question {i + 1}</div>
                  <p style={{ fontSize: '14px', color: '#3D4852', margin: 0, lineHeight: '1.4' }}>{item.question}</p>
                </div>
                {/* Réponse */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', alignSelf: 'flex-end', maxWidth: '80%', boxShadow: NEU_SMALL }}>
                  <p style={{ fontSize: '14px', color: '#3D4852', margin: 0 }}>
                    {item.answer === 'Oui' ? '✓ Oui' : item.answer === 'Non' ? '✗ Non' : item.answer}
                  </p>
                </div>
              </div>
            ))}

            {/* Question en cours */}
            {currentQ && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'rgba(232,93,38,0.06)', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '14px 14px 14px 4px', padding: '14px 16px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <div className="afrione-gradient-text" style={{ fontSize: '10px', fontWeight: 700, marginBottom: '5px', fontFamily: 'Tahoma' }}>IA · Question {qa.length + 1}</div>
                  <p style={{ fontSize: '15px', color: '#3D4852', margin: 0, lineHeight: '1.5' }}>{currentQ.question}</p>
                </div>

                {/* Choix multiple */}
                {currentQ.type === 'choice' && currentQ.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentQ.options.map(opt => (
                      <button key={opt} onClick={() => setCurrentAnswer(opt)} className={currentAnswer === opt ? 'afrione-gradient' : ''} style={{
                        padding: '14px 16px', borderRadius: '14px', fontWeight: 600, fontSize: '14px',
                        cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left',
                        background: currentAnswer === opt ? undefined : '#FFFFFF',
                        color: currentAnswer === opt ? 'white' : '#3D4852',
                        border: `1.5px solid ${currentAnswer === opt ? '#E85D26' : '#E2E8F0'}`,
                        boxShadow: currentAnswer === opt ? 'none' : NEU_SMALL,
                      }}>
                        {currentAnswer === opt ? '✓ ' : ''}{opt}
                      </button>
                    ))}
                    <button onClick={() => setShowPrecise(p => !p)} style={{
                      padding: '10px', background: '#FFFFFF', border: '1.5px dashed #E2E8F0', borderRadius: '12px',
                      cursor: 'pointer', fontSize: '13px', color: '#8B95A5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}>
                      ✏️ {showPrecise ? 'Masquer' : 'Autre réponse…'}
                    </button>
                    {showPrecise && (
                      <input type="text" value={preciseText} onChange={e => { setPreciseText(e.target.value); setCurrentAnswer(e.target.value) }} placeholder="Décrivez en quelques mots…"
                        style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none', fontFamily: 'inherit', color: '#3D4852', background: '#FFFFFF' }}
                      />
                    )}
                  </div>
                )}

                {/* Oui / Non */}
                {currentQ.type === 'yesno' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {['Oui', 'Non'].map(opt => (
                        <button key={opt} onClick={() => { setCurrentAnswer(opt); setShowPrecise(false) }} className={currentAnswer === opt ? 'afrione-gradient' : ''} style={{
                          padding: '14px', borderRadius: '14px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', transition: 'all 0.12s',
                          background: currentAnswer === opt ? undefined : '#FFFFFF',
                          color: currentAnswer === opt ? 'white' : '#3D4852',
                          border: `1.5px solid ${currentAnswer === opt ? '#E85D26' : '#E2E8F0'}`,
                          boxShadow: currentAnswer === opt ? 'none' : NEU_SMALL,
                        }}>
                          {opt === 'Oui' ? '✓  Oui' : '✗  Non'}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowPrecise(p => !p)} style={{
                      padding: '10px', background: '#FFFFFF', border: '1.5px dashed #E2E8F0', borderRadius: '12px',
                      cursor: 'pointer', fontSize: '13px', color: '#8B95A5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}>
                      ✏️ {showPrecise ? 'Masquer' : 'Préciser ma réponse'}
                    </button>
                    {showPrecise && (
                      <input type="text" value={preciseText} onChange={e => setPreciseText(e.target.value)} placeholder="Précisez en quelques mots…"
                        style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none', fontFamily: 'inherit', color: '#3D4852', background: '#FFFFFF' }}
                      />
                    )}
                  </div>
                )}

                {/* Réponse texte */}
                {currentQ.type === 'text' && (
                  <textarea value={currentAnswer} onChange={e => setCurrentAnswer(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && currentAnswer.trim()) { e.preventDefault(); answerQuestion() } }}
                    placeholder="Votre réponse…" rows={3}
                    style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', border: '1.5px solid #E2E8F0', fontSize: '14px', resize: 'none', fontFamily: 'inherit', outline: 'none', color: '#3D4852', background: '#FFFFFF', boxSizing: 'border-box' }}
                  />
                )}

                <button onClick={answerQuestion} disabled={!currentAnswer.trim()}
                  style={{
                    padding: '13px 20px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '14px',
                    fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: !currentAnswer.trim() ? 0.3 : 1, alignSelf: 'flex-end',
                  }}
                >
                  <Send size={15} /> Répondre
                </button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', color: '#8B95A5', fontSize: '13px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(232,93,38,0.2)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                L'IA analyse votre réponse…
              </div>
            )}

            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
              <div style={{ flex: 1, height: '3px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
                <div className="afrione-gradient" style={{ height: '100%', borderRadius: '2px', width: `${(qa.length / 4) * 100}%`, transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: '10px', color: '#8B95A5', fontFamily: 'Tahoma', whiteSpace: 'nowrap' }}>{qa.length} / 4</span>
            </div>

            <div ref={bottomRef} />
          </div>
        )}

        {/* ══ ÉTAPE 3 : Génération du résumé ══ */}
        {step === 'summarizing' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div className="afrione-gradient" style={{ width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 40px rgba(232,93,38,0.3)' }}>
              <Zap size={32} color="white" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: '#3D4852', marginBottom: '8px' }}>Génération du diagnostic…</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>L'IA synthétise toutes vos réponses</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {['Analyse', 'Estimation prix', 'Fiche technique'].map((l) => (
                <div key={l} style={{ fontSize: '11px', color: '#6B7280', background: '#FFFFFF', padding: '6px 12px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: NEU_SMALL }}>{l}</div>
              ))}
            </div>
          </div>
        )}

        {/* ══ ÉTAPE 4 : Résultat + confirmation ══ */}
        {step === 'confirming' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Résumé IA */}
            <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid rgba(232,93,38,0.3)', padding: '22px', boxShadow: NEU_SHADOW }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div className="afrione-gradient" style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={16} color="white" />
                </div>
                <div>
                  <div className="afrione-gradient-text" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'Tahoma' }}>ANALYSE IA</div>
                  <div style={{ fontSize: '11px', color: '#8B95A5' }}>Résumé de votre situation</div>
                </div>
              </div>
              <p style={{ fontSize: '15px', color: '#3D4852', lineHeight: '1.7', margin: 0 }}>{result.summary}</p>
            </div>

            {/* Infos clés */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { icon: <Wrench size={18} color="#E85D26" />, label: 'Catégorie',  value: result.category,          color: '#3D4852' },
                { icon: <span style={{ fontSize: '18px', lineHeight: 1 }}>{urgConf.icon}</span>, label: 'Urgence', value: urgConf.label, color: urgConf.color },
                { icon: <Clock size={18} color="#C9A84C" />, label: 'Durée',       value: result.duration_estimate, color: '#3D4852' },
              ].map(k => (
                <div key={k.label} style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', textAlign: 'center', border: '1px solid #E2E8F0', boxShadow: NEU_SMALL }}>
                  <div style={{ marginBottom: '8px' }}>{k.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: k.color, lineHeight: '1.2' }}>{k.value}</div>
                  <div style={{ fontSize: '10px', color: '#8B95A5', fontFamily: 'Tahoma', marginTop: '3px' }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Prix — Agent IA AfriOne */}
            <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '22px', border: '1px solid #E2E8F0', boxShadow: NEU_SHADOW }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.1em', marginBottom: '14px', fontFamily: 'Tahoma', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>ESTIMATION AFRIONE</span>
                {!pricingLoading && pricing && (
                  <span style={{ fontSize: '9px', color: '#E85D26', fontFamily: 'Tahoma' }}>AGENT IA</span>
                )}
              </div>

              {pricingLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '14px', height: '14px', border: '2px solid rgba(232,93,38,0.3)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  <span style={{ color: '#8B95A5', fontSize: '13px' }}>Agent IA en cours…</span>
                  <span style={{ marginLeft: 'auto', color: '#8B95A5', fontSize: '11px', fontFamily: 'Tahoma' }}>
                    {result.price_min.toLocaleString('fr')} – {result.price_max.toLocaleString('fr')} FCFA
                  </span>
                </div>
              ) : pricing ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span className="afrione-gradient-text" style={{ fontFamily: 'Tahoma', fontSize: '36px', fontWeight: 700, lineHeight: 1 }}>{pricing.estimate.toLocaleString('fr')}</span>
                    <span style={{ color: '#8B95A5', fontSize: '13px', fontFamily: 'Tahoma' }}>FCFA</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#8B95A5', fontFamily: 'Tahoma', marginBottom: '16px' }}>
                    [{pricing.interval.low.toLocaleString('fr')} – {pricing.interval.high.toLocaleString('fr')}] ±8%
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {([
                      { key: 'labor' as const,     label: "Main-d'œuvre", color: '#E85D26' },
                      { key: 'materials' as const, label: 'Matériaux',    color: '#C9A84C' },
                      { key: 'transport' as const, label: 'Transport',    color: '#2B6B3E' },
                      { key: 'premium' as const,   label: 'Com.+Ass.',    color: '#8B95A5' },
                    ]).map(({ key, label, color }) => {
                      const val = pricing.decomp[key]
                      const pct = pricing.estimate > 0 ? Math.round(val / pricing.estimate * 100) : 0
                      return (
                        <div key={key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ fontSize: '10px', color: '#6B7280' }}>{label}</span>
                            <span style={{ fontSize: '10px', color: '#6B7280', fontFamily: 'Tahoma' }}>{pct}% · {val.toLocaleString('fr')} FCFA</span>
                          </div>
                          <div style={{ height: '3px', background: '#F5F7FA', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span className="afrione-gradient-text" style={{ fontFamily: 'Tahoma', fontSize: '34px', fontWeight: 700, lineHeight: 1 }}>{result.price_min.toLocaleString('fr')}</span>
                  <span style={{ color: '#8B95A5', fontSize: '20px' }}>—</span>
                  <span style={{ fontFamily: 'Tahoma', fontSize: '34px', fontWeight: 700, color: '#3D4852', lineHeight: 1 }}>{result.price_max.toLocaleString('fr')}</span>
                  <span style={{ color: '#8B95A5', fontSize: '12px', fontFamily: 'Tahoma' }}>FCFA</span>
                </div>
              )}

              <p style={{ fontSize: '11px', color: '#8B95A5', marginTop: '12px', margin: '12px 0 0' }}>
                {pricing
                  ? `Artisan perçoit ~${pricing.artisan_percoit.toLocaleString('fr')} FCFA · Fixé par AfriOne`
                  : "Indicatif · Prix fixé par AfriOne"}
              </p>
            </div>

            {/* Sélecteur qualité matériaux */}
            {materialTiers.length > 0 && (
              <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: NEU_SHADOW }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.12em', marginBottom: '14px', fontFamily: 'Tahoma' }}>
                  QUALITÉ DES MATÉRIAUX
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {materialTiers.slice(0, 4).map((mat: any) => {
                    const TIER_COLORS = { economique: '#2B6B3E', standard: '#C9A84C', premium: '#E85D26' } as const
                    const TIER_LABELS = { economique: 'Éco', standard: 'Standard', premium: 'Premium' } as const
                    const activeTierKey = selectedTiers[mat.name] || 'standard'
                    const activeTierData = mat.tiers[activeTierKey]
                    const isJumia = activeTierData?.source === 'Jumia CI'
                    const hasPhoto = !!activeTierData?.photo_url
                    const hasVendorQuartier = !isJumia && !!activeTierData?.vendor_quartier
                    return (
                      <div key={mat.name}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#3D4852', marginBottom: '7px' }}>{mat.name}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                          {(['economique', 'standard', 'premium'] as const).map(tier => {
                            const t = mat.tiers[tier]
                            const active = activeTierKey === tier
                            const color = TIER_COLORS[tier]
                            return (
                              <button key={tier} onClick={() => {
                                const next = { ...selectedTiers, [mat.name]: tier }
                                setSelectedTiers(next)
                                updatePricingForTier(result!, next)
                              }} style={{
                                padding: '9px 4px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                                border: `1.5px solid ${active ? color : '#E2E8F0'}`,
                                background: active ? `${color}12` : '#FFFFFF',
                                transition: 'all 0.14s',
                                boxShadow: active ? 'none' : NEU_SMALL,
                              }}>
                                <div style={{ fontSize: '9px', fontWeight: 700, color: active ? color : '#8B95A5', letterSpacing: '0.06em' }}>{TIER_LABELS[tier]}</div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: active ? color : '#3D4852', marginTop: '3px', fontFamily: 'Tahoma' }}>
                                  {t?.price_market?.toLocaleString('fr') ?? '—'}
                                </div>
                                {t?.brand && (
                                  <div style={{ fontSize: '8px', color: '#8B95A5', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.brand}</div>
                                )}
                              </button>
                            )
                          })}
                        </div>

                        {/* Carte produit */}
                        {(hasPhoto || hasVendorQuartier) && (() => {
                          const proximityColor = hasVendorQuartier && activeTierData.km_to_client <= 3 ? '#2B6B3E' : '#C9A84C'
                          const proximityBg    = hasVendorQuartier && activeTierData.km_to_client <= 3 ? 'rgba(43,107,62,0.06)' : 'rgba(201,168,76,0.06)'
                          const proximityBd    = hasVendorQuartier && activeTierData.km_to_client <= 3 ? 'rgba(43,107,62,0.15)' : 'rgba(201,168,76,0.15)'
                          return (
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: hasPhoto ? '#F5F7FA' : proximityBg, borderRadius: '10px', border: `1px solid ${hasPhoto ? '#E2E8F0' : proximityBd}` }}>

                              {hasPhoto ? (
                                <a href={activeTierData.source_url || '#'} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: 'block', lineHeight: 0 }}>
                                  <img
                                    src={activeTierData.photo_url}
                                    alt={mat.name}
                                    style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', background: '#E2E8F0', display: 'block' }}
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                  />
                                </a>
                              ) : (
                                <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: proximityBg, border: `1px solid ${proximityBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                                  {materialEmoji(mat.name)}
                                </div>
                              )}

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#3D4852', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {activeTierData.brand || mat.name}
                                </div>
                                {hasPhoto && activeTierData.source_url && (
                                  <a href={activeTierData.source_url} target="_blank" rel="noreferrer" className="afrione-gradient-text" style={{ fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                                    Voir sur Jumia CI →
                                  </a>
                                )}
                                {hasVendorQuartier && (
                                  <div style={{ fontSize: '10px', color: proximityColor, fontWeight: 500 }}>
                                    📍 {activeTierData.vendor_quartier}
                                    {activeTierData.km_to_client != null && <span style={{ color: '#6B7280', fontWeight: 400 }}> · {activeTierData.km_to_client} km de vous</span>}
                                  </div>
                                )}
                              </div>

                              <span className={hasPhoto ? 'afrione-gradient-text' : ''} style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', flexShrink: 0, whiteSpace: 'nowrap', background: hasPhoto ? 'rgba(232,93,38,0.07)' : proximityBg, color: hasPhoto ? undefined : proximityColor, border: `1px solid ${hasPhoto ? 'rgba(232,93,38,0.15)' : proximityBd}` }}>
                                {hasPhoto ? 'Jumia CI' : activeTierData.vendor_quartier}
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>

                {/* Badge économies */}
                {pricing?.below_market && pricing.savings_vs_market != null && pricing.savings_vs_market > 0 && (
                  <div style={{ marginTop: '14px', background: 'rgba(43,107,62,0.06)', border: '1px solid rgba(43,107,62,0.15)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>💰</span>
                    <div style={{ fontSize: '12px', color: '#2B6B3E', fontWeight: 600 }}>
                      Vous économisez{' '}
                      <span style={{ fontFamily: 'Tahoma' }}>{pricing.savings_vs_market.toLocaleString('fr')} FCFA</span>
                      {' '}vs le marché traditionnel
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Matériel probable */}
            {result.items_needed.length > 0 && (
              <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0', boxShadow: NEU_SMALL }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'Tahoma' }}>MATÉRIEL PROBABLE</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {result.items_needed.map(item => (
                    <span key={item.name} className="afrione-gradient-text" style={{ fontSize: '12px', background: 'rgba(232,93,38,0.06)', border: '1px solid rgba(232,93,38,0.15)', padding: '4px 12px', borderRadius: '20px', fontWeight: 500 }}>
                      {item.qty > 1 ? `${item.qty}× ` : ''}{item.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Photos jointes */}
            {photos.length > 0 && (
              <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0', boxShadow: NEU_SMALL }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'Tahoma' }}>📸 VOS PHOTOS JOINTES</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {photos.map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '10px' }} />
                  ))}
                </div>
              </div>
            )}

            {/* Affiner */}
            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', border: '1.5px dashed #E2E8F0', boxShadow: NEU_SMALL }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#8B95A5', marginBottom: '10px' }}>
                ✏️ Ce résumé n'est pas exact ? Précisez :
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={refineText} onChange={e => setRefineText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && refineResult()}
                  placeholder="Ex : c'est en fait le robinet de la salle de bain…"
                  style={{ flex: 1, padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', color: '#3D4852', background: '#FFFFFF' }}
                />
                <button onClick={refineResult} disabled={!refineText.trim() || refining} style={{
                  padding: '11px 16px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '12px',
                  cursor: 'pointer', fontWeight: 600, fontSize: '13px', opacity: (!refineText.trim() || refining) ? 0.4 : 1, whiteSpace: 'nowrap',
                }}>
                  {refining ? '…' : 'Affiner'}
                </button>
              </div>
            </div>

            {/* CTA principal */}
            <button
              onClick={() => {
                if (navigating) return
                setNavigating(true)
                const href = result.mission_id
                  ? `/matching?mission=${result.mission_id}&category=${encodeURIComponent(result.category)}`
                  : `/matching?category=${encodeURIComponent(result.category)}`
                router.push(href)
              }}
              disabled={navigating}
              className="btn-primary"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                padding: '18px', color: 'white', border: 'none',
                borderRadius: '16px', fontWeight: 700, fontSize: '16px', cursor: navigating ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 24px rgba(232,93,38,0.25)', width: '100%', opacity: navigating ? 0.8 : 1,
              }}
            >
              {navigating
                ? <><div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Recherche des artisans…</>
                : <><CheckCircle size={20} /> Valider et trouver un artisan <ChevronRight size={18} /></>
              }
            </button>

            <button onClick={() => { setStep('input'); setResult(null); setQA([]); setPhotos([]); setText(''); setRefineText(''); setPricing(null); setMaterialTiers([]) }} style={{
              padding: '13px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '14px',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: '#6B7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              boxShadow: NEU_SMALL,
            }}>
              <RotateCcw size={14} /> Recommencer
            </button>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '14px', padding: '14px' }}>
              <AlertCircle size={14} color="#C9A84C" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: '1.6' }}>
                Ce résumé et la fiche technique seront envoyés automatiquement à l'artisan pour qu'il arrive préparé.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
