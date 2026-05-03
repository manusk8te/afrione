'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, Send, RotateCcw, CheckCircle, Zap, AlertCircle, Clock, Wrench, X, ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'

type Step = 'input' | 'questioning' | 'summarizing' | 'confirming'

interface QA { question: string; type: 'yesno' | 'text'; answer: string }

interface DiagResult {
  summary: string
  technical_notes: string
  category: string
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  price_min: number
  price_max: number
  items_needed: string[]
  duration_estimate: string
  mission_id?: string
}

const URGENCY = {
  low:       { label: 'Pas urgent', color: '#2B6B3E', bg: 'rgba(43,107,62,0.1)',  icon: '🟢' },
  medium:    { label: 'Normal',     color: '#C9A84C', bg: 'rgba(201,168,76,0.1)', icon: '🟡' },
  high:      { label: 'Urgent',     color: '#E85D26', bg: 'rgba(232,93,38,0.1)',  icon: '🟠' },
  emergency: { label: 'Urgence !',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: '🔴' },
}

const EXAMPLES = [
  "Ma fuite d'eau sous l'évier de cuisine s'aggrave depuis ce matin",
  "Le disjoncteur de ma chambre saute chaque fois que j'allume la clim",
  "Je veux peindre mon salon de 25m² en blanc cassé",
]

export default function DiagnosticPage() {
  const [step, setStep]               = useState<Step>('input')
  const [text, setText]               = useState('')
  const [photos, setPhotos]           = useState<string[]>([])
  const [uploading, setUploading]     = useState(false)
  const [qa, setQA]                   = useState<QA[]>([])
  const [currentQ, setCurrentQ]       = useState<{ question: string; type: 'yesno' | 'text' } | null>(null)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [showPrecise, setShowPrecise] = useState(false)
  const [preciseText, setPreciseText] = useState('')
  const [result, setResult]           = useState<DiagResult | null>(null)
  const [userId, setUserId]           = useState<string | null>(null)
  const [quartier, setQuartier]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [refineText, setRefineText]   = useState('')
  const [refining, setRefining]       = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
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
      if (data.done) {
        await finalizeWithQA([])
      } else {
        setCurrentQ({ question: data.question, type: data.type })
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
      if (data.done) {
        await finalizeWithQA(newQA)
      } else {
        setCurrentQ({ question: data.question, type: data.type })
        setLoading(false)
      }
    } catch {
      await finalizeWithQA(newQA)
    }
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
      setResult({ ...data, urgency: safeUrgency(data.urgency) })
      setStep('confirming')
    } catch {
      setResult({ summary: 'Problème artisanal détecté, intervention professionnelle recommandée.', technical_notes: 'Diagnostic à affiner sur place.', category: 'Plomberie', urgency: 'medium', price_min: 8000, price_max: 35000, items_needed: ['Matériaux selon diagnostic'], duration_estimate: '1 à 3 heures' })
      setStep('confirming')
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

  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      <Navbar />
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '96px 16px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#7A7A6E', fontSize: '13px', textDecoration: 'none', marginBottom: '16px' }}>
            <ArrowLeft size={14} /> Retour
          </Link>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#E85D26', letterSpacing: '0.12em', marginBottom: '8px', fontFamily: 'Space Mono' }}>
            DIAGNOSTIC IA
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: 700, color: '#0F1410', margin: '0 0 6px' }}>
            {step === 'input'      ? 'Décrivez votre problème' :
             step === 'questioning'? 'Quelques questions...' :
             step === 'summarizing'? 'Analyse en cours...' :
                                    'Voici mon diagnostic'}
          </h1>
          {step === 'input' && (
            <p style={{ color: '#7A7A6E', fontSize: '14px', margin: 0 }}>
              L'IA analyse et pose quelques questions pour affiner le diagnostic — vous pouvez aussi envoyer des photos
            </p>
          )}
          {step === 'questioning' && (
            <p style={{ color: '#7A7A6E', fontSize: '14px', margin: 0 }}>
              Répondez aux questions pour un diagnostic précis · {qa.length}/4 questions
            </p>
          )}
        </div>

        {/* ══ ÉTAPE 1 : Input ══ */}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Description */}
            <div style={{ background: 'white', borderRadius: '20px', border: '2px solid #D8D2C4', overflow: 'hidden' }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Décrivez votre problème : lieu précis, symptômes, depuis quand..."
                style={{ width: '100%', minHeight: '130px', border: 'none', outline: 'none', resize: 'none', fontSize: '15px', lineHeight: '1.6', color: '#0F1410', fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box', padding: '18px 20px' }}
                maxLength={1000}
              />
              <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '11px', color: '#7A7A6E', fontFamily: 'Space Mono' }}>{text.length}/1000</span>
              </div>
            </div>

            {/* Photos */}
            <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
            {photos.length === 0 ? (
              <button onClick={() => photoInputRef.current?.click()} disabled={uploading} style={{
                width: '100%', padding: '18px', border: '2px dashed #D8D2C4', borderRadius: '16px',
                background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#7A7A6E',
              }}>
                {uploading
                  ? <div style={{ width: '18px', height: '18px', border: '2px solid rgba(232,93,38,0.3)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  : <Camera size={18} color="#D8D2C4" />
                }
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{uploading ? 'Upload en cours…' : 'Ajouter des photos'}</div>
                  <div style={{ fontSize: '11px', color: '#A09A8E', marginTop: '2px' }}>L'IA peut analyser les photos du problème</div>
                </div>
              </button>
            ) : (
              <div style={{ background: 'white', borderRadius: '16px', padding: '14px', border: '1px solid #D8D2C4' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A6E', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'Space Mono' }}>
                  📸 {photos.length} PHOTO{photos.length > 1 ? 'S' : ''} AJOUTÉE{photos.length > 1 ? 'S' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {photos.map((url, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', background: '#EDE8DE' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: '3px', right: '3px', width: '20px', height: '20px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => photoInputRef.current?.click()} style={{ aspectRatio: '1', borderRadius: '10px', border: '2px dashed #D8D2C4', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', color: '#7A7A6E', fontSize: '10px' }}>
                    <Camera size={14} /> <span>Ajouter</span>
                  </button>
                </div>
              </div>
            )}

            {/* Exemples */}
            <div>
              <p style={{ fontSize: '10px', fontFamily: 'Space Mono', color: '#7A7A6E', letterSpacing: '0.1em', marginBottom: '8px' }}>EXEMPLES</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => setText(ex)} style={{ textAlign: 'left', padding: '11px 14px', background: 'white', border: '1px solid #D8D2C4', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', color: '#7A7A6E' }}>
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>

            <button onClick={startDiagnostic} disabled={text.length < 10 || loading} style={{
              width: '100%', padding: '16px', background: text.length >= 10 ? '#E85D26' : '#D8D2C4', color: 'white',
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
            <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #D8D2C4' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A6E', letterSpacing: '0.1em', marginBottom: '6px', fontFamily: 'Space Mono' }}>VOTRE PROBLÈME</div>
              <p style={{ fontSize: '13px', color: '#0F1410', lineHeight: '1.5', margin: 0 }}>{text}</p>
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
                <div style={{ background: 'rgba(232,93,38,0.05)', border: '1px solid rgba(232,93,38,0.15)', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#E85D26', marginBottom: '4px', fontFamily: 'Space Mono' }}>IA · Question {i + 1}</div>
                  <p style={{ fontSize: '14px', color: '#0F1410', margin: 0, lineHeight: '1.4' }}>{item.question}</p>
                </div>
                {/* Réponse */}
                <div style={{ background: '#0F1410', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', alignSelf: 'flex-end', maxWidth: '80%' }}>
                  <p style={{ fontSize: '14px', color: 'white', margin: 0 }}>
                    {item.answer === 'Oui' ? '✓ Oui' : item.answer === 'Non' ? '✗ Non' : item.answer}
                  </p>
                </div>
              </div>
            ))}

            {/* Question en cours */}
            {currentQ && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'rgba(232,93,38,0.05)', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '14px 14px 14px 4px', padding: '14px 16px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#E85D26', marginBottom: '5px', fontFamily: 'Space Mono' }}>IA · Question {qa.length + 1}</div>
                  <p style={{ fontSize: '15px', color: '#0F1410', margin: 0, lineHeight: '1.5' }}>{currentQ.question}</p>
                </div>

                {/* Réponse oui/non */}
                {currentQ.type === 'yesno' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {['Oui', 'Non'].map(opt => (
                        <button key={opt} onClick={() => { setCurrentAnswer(opt); setShowPrecise(false) }} style={{
                          padding: '14px', borderRadius: '14px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', transition: 'all 0.12s',
                          background: currentAnswer === opt ? '#E85D26' : 'white',
                          color: currentAnswer === opt ? 'white' : '#0F1410',
                          border: `2px solid ${currentAnswer === opt ? '#E85D26' : '#D8D2C4'}`,
                        }}>
                          {opt === 'Oui' ? '✓  Oui' : '✗  Non'}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowPrecise(p => !p)} style={{
                      padding: '10px', background: 'transparent', border: '1.5px dashed #D8D2C4', borderRadius: '12px',
                      cursor: 'pointer', fontSize: '13px', color: '#7A7A6E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}>
                      ✏️ {showPrecise ? 'Masquer le détail' : 'Préciser ma réponse'}
                    </button>
                    {showPrecise && (
                      <input type="text" value={preciseText} onChange={e => setPreciseText(e.target.value)} placeholder="Précisez en quelques mots…"
                        style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #D8D2C4', fontSize: '14px', outline: 'none', fontFamily: 'inherit', color: '#0F1410' }}
                      />
                    )}
                  </div>
                )}

                {/* Réponse texte */}
                {currentQ.type === 'text' && (
                  <textarea value={currentAnswer} onChange={e => setCurrentAnswer(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && currentAnswer.trim()) { e.preventDefault(); answerQuestion() } }}
                    placeholder="Votre réponse…" rows={3}
                    style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', border: '1.5px solid #D8D2C4', fontSize: '14px', resize: 'none', fontFamily: 'inherit', outline: 'none', color: '#0F1410', boxSizing: 'border-box' }}
                  />
                )}

                <button onClick={answerQuestion} disabled={!currentAnswer.trim()}
                  style={{
                    padding: '13px 20px', background: '#0F1410', color: 'white', border: 'none', borderRadius: '14px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', color: '#7A7A6E', fontSize: '13px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(232,93,38,0.2)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                L'IA analyse votre réponse…
              </div>
            )}

            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
              <div style={{ flex: 1, height: '3px', background: '#D8D2C4', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#E85D26', borderRadius: '2px', width: `${(qa.length / 4) * 100}%`, transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: '10px', color: '#7A7A6E', fontFamily: 'Space Mono', whiteSpace: 'nowrap' }}>{qa.length} / 4</span>
            </div>

            <div ref={bottomRef} />
          </div>
        )}

        {/* ══ ÉTAPE 3 : Génération du résumé ══ */}
        {step === 'summarizing' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '72px', height: '72px', background: 'rgba(232,93,38,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Zap size={32} color="#E85D26" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: '#0F1410', marginBottom: '8px' }}>Génération du diagnostic…</h2>
            <p style={{ color: '#7A7A6E', fontSize: '14px', marginBottom: '24px' }}>L'IA synthétise toutes vos réponses</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {['Analyse', 'Estimation prix', 'Fiche technique'].map((l, i) => (
                <div key={l} style={{ fontSize: '11px', color: '#7A7A6E', background: 'white', padding: '6px 12px', borderRadius: '20px', border: '1px solid #D8D2C4', opacity: 0.8 }}>{l}</div>
              ))}
            </div>
          </div>
        )}

        {/* ══ ÉTAPE 4 : Résultat + confirmation ══ */}
        {step === 'confirming' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Résumé IA */}
            <div style={{ background: 'white', borderRadius: '20px', border: '2px solid #E85D26', padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{ width: '34px', height: '34px', background: 'rgba(232,93,38,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={16} color="#E85D26" />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#E85D26', letterSpacing: '0.1em', fontFamily: 'Space Mono' }}>ANALYSE IA</div>
                  <div style={{ fontSize: '11px', color: '#7A7A6E' }}>Résumé de votre situation</div>
                </div>
              </div>
              <p style={{ fontSize: '15px', color: '#0F1410', lineHeight: '1.7', margin: 0 }}>{result.summary}</p>
            </div>

            {/* Infos clés */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { icon: <Wrench size={18} color="#E85D26" />, label: 'Catégorie',  value: result.category,           color: '#0F1410' },
                { icon: <span style={{ fontSize: '18px', lineHeight: 1 }}>{urgConf.icon}</span>, label: 'Urgence', value: urgConf.label, color: urgConf.color },
                { icon: <Clock size={18} color="#C9A84C" />, label: 'Durée',       value: result.duration_estimate,  color: '#0F1410' },
              ].map(k => (
                <div key={k.label} style={{ background: 'white', borderRadius: '16px', padding: '16px', textAlign: 'center', border: '1px solid #D8D2C4' }}>
                  <div style={{ marginBottom: '8px' }}>{k.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: k.color, lineHeight: '1.2' }}>{k.value}</div>
                  <div style={{ fontSize: '10px', color: '#7A7A6E', fontFamily: 'Space Mono', marginTop: '3px' }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Prix */}
            <div style={{ background: '#0F1410', borderRadius: '20px', padding: '22px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'Space Mono' }}>ESTIMATION DE PRIX</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontFamily: 'Space Mono', fontSize: '34px', fontWeight: 700, color: '#E85D26', lineHeight: 1 }}>{result.price_min.toLocaleString()}</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '20px' }}>—</span>
                <span style={{ fontFamily: 'Space Mono', fontSize: '34px', fontWeight: 700, color: '#FAFAF5', lineHeight: 1 }}>{result.price_max.toLocaleString()}</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontFamily: 'Space Mono' }}>FCFA</span>
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', margin: '8px 0 0' }}>Indicatif · Prix exact confirmé par l'artisan</p>
            </div>

            {/* Matériel probable */}
            {result.items_needed.length > 0 && (
              <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #D8D2C4' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A6E', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'Space Mono' }}>MATÉRIEL PROBABLE</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {result.items_needed.map(item => (
                    <span key={item} style={{ fontSize: '12px', background: 'rgba(232,93,38,0.07)', border: '1px solid rgba(232,93,38,0.2)', padding: '4px 12px', borderRadius: '20px', color: '#E85D26', fontWeight: 500 }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Photos jointes */}
            {photos.length > 0 && (
              <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #D8D2C4' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A6E', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'Space Mono' }}>📸 VOS PHOTOS JOINTES</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {photos.map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '10px' }} />
                  ))}
                </div>
              </div>
            )}

            {/* Affiner */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1.5px dashed #D8D2C4' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#7A7A6E', marginBottom: '10px' }}>
                ✏️ Ce résumé n'est pas exact ? Précisez :
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={refineText} onChange={e => setRefineText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && refineResult()}
                  placeholder="Ex : c'est en fait le robinet de la salle de bain…"
                  style={{ flex: 1, padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #D8D2C4', fontSize: '13px', outline: 'none', fontFamily: 'inherit', color: '#0F1410' }}
                />
                <button onClick={refineResult} disabled={!refineText.trim() || refining} style={{
                  padding: '11px 16px', background: '#0F1410', color: 'white', border: 'none', borderRadius: '12px',
                  cursor: 'pointer', fontWeight: 600, fontSize: '13px', opacity: (!refineText.trim() || refining) ? 0.4 : 1, whiteSpace: 'nowrap',
                }}>
                  {refining ? '…' : 'Affiner'}
                </button>
              </div>
            </div>

            {/* CTA principal */}
            <Link
              href={result.mission_id
                ? `/matching?mission=${result.mission_id}&category=${encodeURIComponent(result.category)}`
                : `/matching?category=${encodeURIComponent(result.category)}`
              }
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                padding: '18px', background: '#E85D26', color: 'white', textDecoration: 'none',
                borderRadius: '16px', fontWeight: 700, fontSize: '16px',
                boxShadow: '0 8px 24px rgba(232,93,38,0.3)',
              }}
            >
              <CheckCircle size={20} />
              Valider et trouver un artisan
              <ChevronRight size={18} />
            </Link>

            <button onClick={() => { setStep('input'); setResult(null); setQA([]); setPhotos([]); setText('') }} style={{
              padding: '13px', background: 'transparent', border: '1.5px solid #D8D2C4', borderRadius: '14px',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: '#7A7A6E',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <RotateCcw size={14} /> Recommencer
            </button>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '14px', padding: '14px' }}>
              <AlertCircle size={14} color="#C9A84C" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '12px', color: '#7A7A6E', margin: 0, lineHeight: '1.6' }}>
                Ce résumé et la fiche technique seront envoyés automatiquement à l'artisan pour qu'il arrive préparé.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
