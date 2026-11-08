'use client'
import { clientApi } from '@/lib/client-api'
import { CATEGORY_TO_METIER } from '@/lib/pricing'
import { parseDuree } from '@/lib/duration'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, Send, RotateCcw, CheckCircle, Zap, X, ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import DiagnosticProducts from '@/components/pricing/DiagnosticProducts'
import ClientQuote from '@/components/pricing/ClientQuote'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import PriceContextCard, { type PriceContextView } from '@/components/pricing/PriceContextCard'

const NEU_SHADOW = 'var(--ui-shadow-card)'
const NEU_SMALL  = 'var(--ui-shadow-soft)'
const NEU_INSET  = 'var(--ui-shadow-inset)'

type Step = 'input' | 'questioning' | 'summarizing' | 'confirming'

type QAType = 'yesno' | 'choice' | 'text'
interface QA { question: string; type: QAType; options?: string[]; answer: string; fact_key?:string }


interface DiagResult {
  summary: string
  technical_notes: string
  category: string
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  price_min: number
  price_max: number
  items_needed: { name: string; qty: number; unit: string }[]
  duration_estimate: string | null
  diagnostic_status?: 'preliminary'|'onsite_required'|'urgent'
  product_requirements?: {item:string;confirmed_specs:string[];unknown_specs:string[];selection_criteria:string[]}[]
  surface_m2?: number | null
  budget_client?: string | null
  mission_id?: string
  mission_status?: string
}

interface PricingData {
  estimate: number
  interval: { low: number; high: number }
  decomp: { labor: number | null; materials: number | null; transport: number | null; premium: number | null }
  artisan_percoit: number | null
  savings_vs_market?: number
  below_market?: boolean
  market_reference_fcfa?: number
  applied_estimator?: string
  price_context?: (PriceContextView & { hours?: number }) | null
}

// Moyenne de la fourchette : le diagnostic annonce une estimation, pas un
// devis. Cette copie locale ignorait les semaines. Voir src/lib/duration.ts.
const parseDuration = (str: string): number => parseDuree(str, 'moyenne')

function pricingBlockReason(diagnostic: DiagResult) {
  if (diagnostic.mission_status && !['diagnostic', 'matching', 'negotiation'].includes(diagnostic.mission_status)) {
    return 'Cette mission ne peut plus être recalculée.'
  }
  if (diagnostic.diagnostic_status === 'urgent') {
    return 'Cette demande relève du parcours urgence.'
  }
  return null
}

const URGENCY = { low: 'Pas urgent', medium: 'Normal', high: 'Urgent', emergency: 'Urgence' }

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
  const [currentQ, setCurrentQ]       = useState<{ question: string; type: QAType; options?: string[]; rationale?:string; fact_key?:string } | null>(null)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [showPrecise, setShowPrecise] = useState(false)
  const [preciseText, setPreciseText] = useState('')
  const [result, setResult]           = useState<DiagResult | null>(null)
  const [userId, setUserId]           = useState<string | null>(null)
  const [quartier, setQuartier]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [pricing, setPricing]         = useState<PricingData | null>(null)
  const [basePricing, setBasePricing] = useState<PricingData | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)
  const [pricingClarification, setPricingClarification] = useState('')
  const [refineText, setRefineText]   = useState('')
  const [refining, setRefining]       = useState(false)
  const [quoteRevision,setQuoteRevision]=useState(0)
  const [navigating, setNavigating]   = useState(false)
  const pricingUnavailableReason = result ? pricingBlockReason(result) : null
  const photoInputRef = useRef<HTMLInputElement>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }
      setUserId(session.user.id)
      supabase.from('users').select('quartier').eq('id', session.user.id).single()
        .then(({ data }) => { if (data?.quartier) setQuartier(data.quartier) })
    })
    // Dev panel scenario injection
    const devScenario = localStorage.getItem('_devScenario')
    if (devScenario) {
      setText(devScenario)
      localStorage.removeItem('_devScenario')
    }
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

  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('mission');if(!id)return;let active=true;setLoading(true)
    clientApi(`/api/diagnostic?mission_id=${encodeURIComponent(id)}`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active){setResult(d);setText(d.original??'');setQA(d.qa??[]);setPhotos(d.photos??[]);setStep('confirming');setPricingError('');if(d.saved_service_total>0){const t=d.saved_service_total;setPricing({estimate:t,interval:{low:t,high:t},decomp:{labor:null,materials:null,transport:null,premium:null},artisan_percoit:null,applied_estimator:'context_v4',price_context:d.price_context??null})}}}).catch(e=>{if(active)toast.error(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}
  },[])

  // ── Étape 1 → 2 : lance le diagnostic, reçoit 1ère question ──
  const startDiagnostic = async () => {
    if (text.trim().length < 10) return
    setLoading(true)
    try {
      const res = await clientApi('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'start', text, photos }),
      })
      const data = await res.json()
      if(!res.ok)throw Error(data.error || 'La demande n’a pas pu être enregistrée')
      if (data.done || !data.question) {
        await finalizeWithQA([])
      } else {
        setCurrentQ({ question: data.question, type: data.type, options: data.options, rationale:data.rationale, fact_key:data.fact_key })
        setStep('questioning')
      }
    } catch {
      toast.error('Le diagnostic est indisponible. Réessayez sans quitter la page.')
    }
    setLoading(false)
  }

  // ── Répondre à la question courante ──
  const answerQuestion = async () => {
    const finalAnswer = showPrecise && preciseText.trim()
      ? `${currentAnswer} — ${preciseText.trim()}`
      : currentAnswer
    if (!finalAnswer.trim()) return

    const newQA: QA[] = [...qa, { question: currentQ!.question, type: currentQ!.type, answer: finalAnswer, fact_key:currentQ!.fact_key }]
    setQA(newQA)
    setCurrentAnswer('')
    setPreciseText('')
    setShowPrecise(false)
    setCurrentQ(null)
    setLoading(true)

    try {
      const res = await clientApi('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'next', text, photos, qa: newQA, index: newQA.length }),
      })
      const data = await res.json()
      if(!res.ok)throw Error(data.error || 'La demande n’a pas pu être enregistrée')
      const isEmpty = !data.question || (data.type === 'choice' && (!data.options || data.options.length < 2))
      if (data.done || isEmpty) {
        await finalizeWithQA(newQA)
      } else {
        setCurrentQ({ question: data.question, type: data.type, options: data.options, rationale:data.rationale, fact_key:data.fact_key })
        setLoading(false)
      }
    } catch {
      setQA(qa)
      setCurrentQ(currentQ)
      setCurrentAnswer(finalAnswer)
      toast.error('La question suivante est indisponible. Votre réponse est conservée ; réessayez.')
      setLoading(false)
    }
  }

  // ── Appel moteur de pricing (Agent IA AfriOne) ──
  /**
   * @param force  ignore le cache et recalcule. Nécessaire après une
   *   précision apportée au diagnostic : la catégorie, la durée ou les
   *   matériaux ont changé, mais le prix en cache, lui, ne bougeait pas —
   *   le client voyait un diagnostic mis à jour sous un prix périmé.
   */
  const fetchPricing = async (diagResult: DiagResult, force = false) => {
    const reason = pricingBlockReason(diagResult)
    if (reason) {
      setPricing(null)
      setBasePricing(null)
      setPricingLoading(false)
      setPricingError(reason)
      return
    }
    // Ne pas recalculer si un prix est déjà en cache pour cette session
    const cacheKey = `afrione_context_v4_saved_${JSON.stringify([diagResult.mission_id, diagResult.category, diagResult.summary, diagResult.technical_notes, diagResult.duration_estimate, diagResult.surface_m2, quartier, diagResult.urgency, pricingClarification])}`
    setPricingError(null)
    if (force) sessionStorage.removeItem(cacheKey)
    const cached = force ? null : sessionStorage.getItem(cacheKey)
    if (cached) {
      try {
        const c = JSON.parse(cached)
        setPricing(c)
        setBasePricing(c)
        setPricingLoading(false)
        return
      } catch {}
    }
    setPricing(null)
    setPricingLoading(true)
    try {
      const itemNames = (diagResult.items_needed || []).map((i: any) => typeof i === 'string' ? i : i.name).filter(Boolean)
      const pricingRes = await clientApi('/api/pricing-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mission_id:     diagResult.mission_id,
            category:       diagResult.category,
            description:    [diagResult.summary, diagResult.technical_notes, pricingClarification ? `Précision du client : ${pricingClarification}` : '', diagResult.surface_m2 ? `Surface confirmée : ${diagResult.surface_m2} m²` : ''].filter(Boolean).join(' — '),
            urgency:        diagResult.urgency,
            hours_estimate: parseDuration(diagResult.duration_estimate ?? ''),
            quartier:       quartier || 'Cocody',
            items_needed:   itemNames,
          }),
        })
      if (pricingRes.ok) {
        const d = await pricingRes.json()
        if (typeof d.total !== 'number' || !Number.isFinite(d.total) || d.total <= 0) {
          throw new Error('Estimation non disponible')
        }
        const bd = d.breakdown || {}
        const newPricing: PricingData = {
          estimate:        d.total || 0,
          interval:        { low: d.fourchette?.min || 0, high: d.fourchette?.max || 0 },
          decomp: {
            labor:     bd.main_oeuvre     ?? null,
            materials: bd.materiaux       ?? null,
            transport: bd.transport       ?? null,
            premium:   bd.commission_afrione == null || bd.assurance_sav == null ? null : bd.commission_afrione + bd.assurance_sav,
          },
          artisan_percoit: d.artisan_percoit ?? null,
          applied_estimator: d.applied_estimator,
          price_context: d.price_context ?? null,
        }
        setPricing(newPricing)
        setBasePricing(newPricing)
        try { sessionStorage.setItem(cacheKey, JSON.stringify(newPricing)) } catch {}

      } else {
        const failure = await pricingRes.json().catch(() => null)
        setPricingError(failure?.status === 'informations_requises' ? failure.error : 'Le prix n’a pas pu être calculé. Demandez un prix ou réessayez.')
      }
    } catch {
      setPricingError('Le prix n’a pas pu être calculé. Demandez un prix ou réessayez.')
    }
    setPricingLoading(false)
  }

  // ── Génère le résumé final ──
  const finalizeWithQA = async (finalQA: QA[]) => {
    setStep('summarizing')
    setLoading(true)
    try {
      const res = await clientApi('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'finalize', text, photos, qa: finalQA, user_id: userId, quartier }),
      })
      const data = await res.json()
      if(!res.ok)throw Error(data.error || 'La demande n’a pas pu être enregistrée')
      const safeResult = { ...data, urgency: safeUrgency(data.urgency) }
      setResult(safeResult)
      router.replace(`/diagnostic?mission=${safeResult.mission_id}`,{scroll:false})
      setStep('confirming')
      fetchPricing(safeResult)
    } catch {
      toast.error('Le diagnostic n’a pas pu être enregistré. Réessayez.')
      setStep('input')
    }
    setLoading(false)
  }

  // ── Affiner le résumé ──
  const refineResult = async () => {
    if (!refineText.trim() || refining) return
    setRefining(true)
    const enrichedText = text + '\n\nPrécision : ' + refineText.trim()
    try {
      const res = await clientApi('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'finalize', text: enrichedText, photos, qa, user_id: userId, quartier }),
      })
      const data = await res.json()
      if(!res.ok)throw Error(data.error || 'La demande n’a pas pu être enregistrée')
      const affine = { ...(result as DiagResult), ...data, mission_status: undefined, urgency: safeUrgency(data.urgency) }
      setResult(affine)
      router.replace(`/diagnostic?mission=${affine.mission_id}`,{scroll:false})
      setRefineText('')
      // Le prix suit le diagnostic. Sans ce recalcul forcé, une précision qui
      // changeait la durée ou les matériaux laissait le montant inchangé.
      await fetchPricing(affine, true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de mettre à jour la demande.')
    }
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
    <div className="mobile-diagnostic mission-mobile" style={{ minHeight: '100dvh', background: 'var(--ui-canvas)', position: 'relative', color: 'var(--ui-ink)' }}>
      <Navbar />

      {/* ── VIDEO BANNER ───────────────────────────────────────────── */}
      {step !== 'confirming' && <div className="mobile-diagnostic-banner" style={{ position: 'relative', overflow: 'hidden', height: '210px', marginTop: '64px' }}>
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
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', letterSpacing: '0.12em', fontFamily: 'var(--font-body)' }}>DIAGNOSTIC AFRIONE</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, color: 'white', margin: '0 0 8px', textShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>
            {step === 'input'       ? 'Décrivez votre problème'  :
             step === 'questioning' ? 'Quelques questions...'     :
             step === 'summarizing' ? 'Analyse en cours...'      :
                                     'Voici mon diagnostic'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '13px', margin: 0 }}>
            {step === 'input'       ? "L'IA analyse et pose des questions — envoyez aussi des photos" :
             step === 'questioning' ? `Une précision utile à la fois · ${qa.length} réponse(s)` :
             step === 'summarizing' ? "L'IA synthétise toutes vos réponses" :
                                     "Résumé · Estimation de prix · Fiche technique"}
          </p>
        </div>
      </div>}

      <div className={'mobile-diagnostic-content' + (step === 'confirming' ? ' diagnostic-result-content' : '')} style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 16px 64px', position: 'relative' }}>

        {step !== 'confirming' && <Link href="/diagnostics" style={{ display: 'block', marginBottom: 16, color: '#963716' }}>Mes diagnostics</Link>}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Description */}
            <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1.5px solid var(--ui-border)', overflow: 'hidden', boxShadow: NEU_SHADOW }}>
              <textarea className="afrione-field"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Décrivez votre problème : lieu précis, symptômes, depuis quand..."
                style={{ width: '100%', minHeight: '130px', border: 'none', outline: 'none', resize: 'none', fontSize: '15px', lineHeight: '1.6', color: 'var(--ui-ink)', fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box', padding: '18px 20px' }}
                maxLength={1000}
              />
              <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--ui-border)' }}>
                <span style={{ fontSize: '11px', color: '#8B95A5', fontFamily: 'var(--font-body)' }}>{text.length}/1000</span>
              </div>
            </div>

            {/* Photos */}
            <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
            {photos.length === 0 ? (
              <button className="afrione-action" onClick={() => photoInputRef.current?.click()} disabled={uploading} style={{
                width: '100%', padding: '18px', border: '2px dashed var(--ui-border)', borderRadius: '16px',
                background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#8B95A5',
                boxShadow: NEU_SMALL,
              }}>
                {uploading
                  ? <div style={{ width: '18px', height: '18px', border: '2px solid rgba(232,93,38,0.3)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  : <Camera size={18} color="#8B95A5" />
                }
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui-muted)' }}>{uploading ? 'Upload en cours…' : 'Ajouter des photos'}</div>
                  <div style={{ fontSize: '11px', color: '#8B95A5', marginTop: '2px' }}>L'IA peut analyser les photos du problème</div>
                </div>
              </button>
            ) : (
              <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '14px', border: '1px solid var(--ui-border)', boxShadow: NEU_SMALL }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'var(--font-body)' }}>
                  {photos.length} PHOTO{photos.length > 1 ? 'S' : ''} AJOUTÉE{photos.length > 1 ? 'S' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {photos.map((url, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', background: 'var(--ui-canvas)' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button className="afrione-action afrione-action--icon" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: '3px', right: '3px', width: '20px', height: '20px', background: 'rgba(61,72,82,0.7)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button className="afrione-action" onClick={() => photoInputRef.current?.click()} style={{ aspectRatio: '1', borderRadius: '10px', border: '2px dashed var(--ui-border)', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', color: '#8B95A5', fontSize: '10px' }}>
                    <Camera size={14} /> <span>Ajouter</span>
                  </button>
                </div>
              </div>
            )}

            {/* Exemples */}
            <div>
              <p style={{ fontSize: '10px', fontFamily: 'var(--font-body)', color: '#8B95A5', letterSpacing: '0.1em', marginBottom: '8px' }}>EXEMPLES</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {EXAMPLES.map(ex => (
                  <button className="afrione-action" key={ex} onClick={() => setText(ex)} style={{ textAlign: 'left', padding: '11px 14px', background: '#FFFFFF', border: '1px solid var(--ui-border)', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', color: 'var(--ui-muted)', boxShadow: NEU_SMALL }}>
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>

            <button onClick={startDiagnostic} disabled={text.length < 10 || loading} className={(text.length >= 10 ? 'btn-primary' : '') + ' afrione-action'} style={{
              width: '100%', padding: '16px', background: text.length >= 10 ? undefined : 'var(--ui-border)', color: text.length >= 10 ? 'white' : '#8B95A5',
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
            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', border: '1px solid var(--ui-border)', boxShadow: NEU_SMALL }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.1em', marginBottom: '6px', fontFamily: 'var(--font-body)' }}>VOTRE PROBLÈME</div>
              <p style={{ fontSize: '13px', color: 'var(--ui-ink)', lineHeight: '1.5', margin: 0 }}>{text}</p>
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
                  <div className="afrione-gradient-text" style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px', fontFamily: 'var(--font-body)' }}>Question {i + 1}</div>
                  <p style={{ fontSize: '14px', color: 'var(--ui-ink)', margin: 0, lineHeight: '1.4' }}>{item.question}</p>
                </div>
                {/* Réponse */}
                <div style={{ background: '#FFFFFF', border: '1px solid var(--ui-border)', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', alignSelf: 'flex-end', maxWidth: '80%', boxShadow: NEU_SMALL }}>
                  <p style={{ fontSize: '14px', color: 'var(--ui-ink)', margin: 0 }}>
                    {item.answer === 'Oui' ? '✓ Oui' : item.answer === 'Non' ? '✗ Non' : item.answer}
                  </p>
                </div>
              </div>
            ))}

            {/* Question en cours */}
            {currentQ && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'rgba(232,93,38,0.06)', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '14px 14px 14px 4px', padding: '14px 16px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <div className="afrione-gradient-text" style={{ fontSize: '10px', fontWeight: 700, marginBottom: '5px', fontFamily: 'var(--font-body)' }}>Question {qa.length + 1}</div>
                  <p style={{ fontSize: '15px', color: 'var(--ui-ink)', margin: 0, lineHeight: '1.5' }}>{currentQ.question}</p>
                  {currentQ.rationale && <p style={{fontSize:12,color:'#64748B',marginTop:8}}>{currentQ.rationale}</p>}
                </div>

                {/* Choix multiple */}
                {currentQ.type === 'choice' && currentQ.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentQ.options.map(opt => (
                      <button key={opt} onClick={() => setCurrentAnswer(opt)} className={(currentAnswer === opt ? 'afrione-gradient' : '') + ' afrione-action'} style={{
                        padding: '14px 16px', borderRadius: '14px', fontWeight: 600, fontSize: '14px',
                        cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left',
                        background: currentAnswer === opt ? undefined : '#FFFFFF',
                        color: currentAnswer === opt ? 'white' : 'var(--ui-ink)',
                        border: `1.5px solid ${currentAnswer === opt ? '#E85D26' : 'var(--ui-border)'}`,
                        boxShadow: currentAnswer === opt ? 'none' : NEU_SMALL,
                      }}>
                        {currentAnswer === opt ? '✓ ' : ''}{opt}
                      </button>
                    ))}
                    <button className="afrione-action" onClick={() => setShowPrecise(p => !p)} style={{
                      padding: '10px', background: '#FFFFFF', border: '1.5px dashed var(--ui-border)', borderRadius: '12px',
                      cursor: 'pointer', fontSize: '13px', color: '#8B95A5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}>
                      {showPrecise ? 'Masquer' : 'Autre réponse…'}
                    </button>
                    {showPrecise && (
                      <input className="afrione-field" type="text" value={preciseText} onChange={e => { setPreciseText(e.target.value); setCurrentAnswer(e.target.value) }} placeholder="Décrivez en quelques mots…"
                        style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--ui-border)', fontSize: '14px', outline: 'none', fontFamily: 'inherit', color: 'var(--ui-ink)', background: '#FFFFFF' }}
                      />
                    )}
                  </div>
                )}

                {/* Oui / Non */}
                {currentQ.type === 'yesno' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {['Oui', 'Non'].map(opt => (
                        <button key={opt} onClick={() => { setCurrentAnswer(opt); setShowPrecise(false) }} className={(currentAnswer === opt ? 'afrione-gradient' : '') + ' afrione-action'} style={{
                          padding: '14px', borderRadius: '14px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', transition: 'all 0.12s',
                          background: currentAnswer === opt ? undefined : '#FFFFFF',
                          color: currentAnswer === opt ? 'white' : 'var(--ui-ink)',
                          border: `1.5px solid ${currentAnswer === opt ? '#E85D26' : 'var(--ui-border)'}`,
                          boxShadow: currentAnswer === opt ? 'none' : NEU_SMALL,
                        }}>
                          {opt === 'Oui' ? '✓  Oui' : '✗  Non'}
                        </button>
                      ))}
                    </div>
                    <button className="afrione-action" onClick={() => setShowPrecise(p => !p)} style={{
                      padding: '10px', background: '#FFFFFF', border: '1.5px dashed var(--ui-border)', borderRadius: '12px',
                      cursor: 'pointer', fontSize: '13px', color: '#8B95A5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}>
                      {showPrecise ? 'Masquer' : 'Préciser ma réponse'}
                    </button>
                    {showPrecise && (
                      <input className="afrione-field" type="text" value={preciseText} onChange={e => setPreciseText(e.target.value)} placeholder="Précisez en quelques mots…"
                        style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid var(--ui-border)', fontSize: '14px', outline: 'none', fontFamily: 'inherit', color: 'var(--ui-ink)', background: '#FFFFFF' }}
                      />
                    )}
                  </div>
                )}

                {/* Réponse texte */}
                {currentQ.type === 'text' && (
                  <textarea className="afrione-field" value={currentAnswer} onChange={e => setCurrentAnswer(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && currentAnswer.trim()) { e.preventDefault(); answerQuestion() } }}
                    placeholder="Votre réponse…" rows={3}
                    style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', border: '1.5px solid var(--ui-border)', fontSize: '14px', resize: 'none', fontFamily: 'inherit', outline: 'none', color: 'var(--ui-ink)', background: '#FFFFFF', boxSizing: 'border-box' }}
                  />
                )}

                <button className="afrione-action" onClick={answerQuestion} disabled={!currentAnswer.trim()}
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

            <p style={{fontSize:12,color:'#64748B'}}>L’échange s’arrête dès que l’intervention est suffisamment précisée. Les points impossibles à vérifier ici seront confiés au prestataire.</p>

            <div ref={bottomRef} />
          </div>
        )}

        {/* ══ ÉTAPE 3 : Génération du résumé ══ */}
        {step === 'summarizing' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div className="afrione-gradient" style={{ width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 40px rgba(232,93,38,0.3)' }}>
              <Zap size={32} color="white" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--ui-ink)', marginBottom: '8px' }}>Génération du diagnostic…</h2>
            <p style={{ color: 'var(--ui-muted)', fontSize: '14px', marginBottom: '24px' }}>L'IA synthétise toutes vos réponses</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {['Analyse', 'Estimation prix', 'Fiche technique'].map((l) => (
                <div key={l} style={{ fontSize: '11px', color: 'var(--ui-muted)', background: '#FFFFFF', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--ui-border)', boxShadow: NEU_SMALL }}>{l}</div>
              ))}
            </div>
          </div>
        )}

        {step === 'confirming' && result && (
          <main className="diagnostic-result">
            <ClientQuote
              key={result.mission_id}
              missionId={result.mission_id}
              revision={quoteRevision + (pricing?.estimate ?? 0)}
              estimate={pricing?.estimate}
              estimating={pricingLoading}
              reason={pricingUnavailableReason}
            />

            <section className="diagnostic-result-panel">
              <h2>Résumé de votre demande</h2>
              <p>{result.summary}</p>
              <details className="diagnostic-edit">
                <summary>Modifier ma demande</summary>
                <form onSubmit={event => { event.preventDefault(); void refineResult() }}>
                  <label htmlFor="diagnostic-refinement">Que souhaitez-vous corriger ou ajouter ?</label>
                  <textarea id="diagnostic-refinement" className="afrione-field" rows={3}
                    value={refineText} onChange={event => setRefineText(event.target.value)}
                    placeholder="Exemple : la fuite vient du tuyau sous l’évier." />
                  <button className="btn-primary afrione-action" disabled={!refineText.trim() || refining}>
                    {refining ? 'Mise à jour…' : 'Mettre à jour'}
                  </button>
                </form>
              </details>
            </section>

            {(result.items_needed.length > 0 || !!result.product_requirements?.length) && (
              <details className="diagnostic-result-panel diagnostic-disclosure">
                <summary>Fournitures</summary>
                {!!result.product_requirements?.length && (
                  <ul>{result.product_requirements.map(item => (
                    <li key={item.item}><strong>{item.item}</strong>{item.unknown_specs.length > 0 && <p>À confirmer · {item.unknown_specs.join(' · ')}</p>}</li>
                  ))}</ul>
                )}
                <DiagnosticProducts key={result.mission_id} missionId={result.mission_id} items={result.items_needed}
                  onChanged={() => setQuoteRevision(value => value + 1)} />
              </details>
            )}

            <details className="diagnostic-result-panel diagnostic-disclosure">
              <summary>Détails de l’intervention</summary>
              <dl className="diagnostic-result-facts">
                <div><dt>Métier</dt><dd>{result.category}</dd></div>
                <div><dt>Urgence</dt><dd>{urgConf}</dd></div>
                <div><dt>Durée</dt><dd>{result.duration_estimate || 'À confirmer'}</dd></div>
              </dl>
              {pricing?.price_context && <PriceContextCard context={pricing.price_context} applied={pricing.applied_estimator === 'context_v4'} />}
              {pricingError && <form onSubmit={event => { event.preventDefault(); void fetchPricing(result, true) }}>
                <p role="status">{pricingError}</p>
                <label htmlFor="diagnostic-price-refinement">Informations pour recalculer le prix</label>
                <input id="diagnostic-price-refinement" className="afrione-field" maxLength={1000}
                  value={pricingClarification} onChange={event => setPricingClarification(event.target.value)} />
                <button className="afrione-action" disabled={pricingLoading}>Réessayer le calcul</button>
              </form>}
              {!pricing && !pricingLoading && !pricingUnavailableReason && !pricingError &&
                <button className="afrione-action" type="button" onClick={() => fetchPricing(result)}>Calculer le prix</button>}
              {photos.length > 0 && (
                <div className="diagnostic-result-photos">
                  {photos.map((url, index) => <img key={url + index} src={url} alt={`Photo de la demande ${index + 1}`} />)}
                </div>
              )}
            </details>

            <div className="diagnostic-result-footer">
              <button className="afrione-action" type="button" onClick={() => {
                router.replace('/diagnostic', { scroll: false })
                setStep('input'); setResult(null); setQA([]); setPhotos([]); setText('')
                setRefineText(''); setPricing(null)
                window.scrollTo(0, 0)
              }}><RotateCcw size={15} /> Nouveau diagnostic</button>
              <Link href="/diagnostics">Mes diagnostics</Link>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
