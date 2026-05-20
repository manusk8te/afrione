'use client'
import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const DISPATCH_TIMEOUT_MS = 45_000

const syne = { fontFamily: "'Satoshi', sans-serif" }  as const
const body = { fontFamily: "'Inter', sans-serif" }    as const
const mono = { fontFamily: "'Tahoma', sans-serif" }   as const

type State = 'searching' | 'found' | 'failed'

export default function DispatchLoadingPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = use(params)
  const router = useRouter()

  const [state,       setState]       = useState<State>('searching')
  const [attemptNum,  setAttemptNum]  = useState(1)
  const [timeLeft,    setTimeLeft]    = useState(DISPATCH_TIMEOUT_MS)
  const [category,    setCategory]    = useState('')

  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptNumRef = useRef(attemptNum)
  attemptNumRef.current = attemptNum

  // ── Tick du timer local ───────────────────────────────────────────────────
  const startCountdown = (durationMs: number) => {
    clearInterval(intervalRef.current!)
    clearTimeout(timerRef.current!)

    setTimeLeft(durationMs)
    const start = Date.now()

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      setTimeLeft(Math.max(0, durationMs - elapsed))
    }, 200)

    timerRef.current = setTimeout(() => {
      clearInterval(intervalRef.current!)
      advanceDispatch()
    }, durationMs)
  }

  // ── Passer au candidat suivant (timeout côté client) ─────────────────────
  const advanceDispatch = async () => {
    try {
      const res = await fetch('/api/dispatch/next', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mission_id: missionId }),
      })
      const data = await res.json()

      if (!data.dispatched) {
        setState('failed')
        return
      }

      setAttemptNum(n => n + 1)
      startCountdown(DISPATCH_TIMEOUT_MS)
    } catch {
      setState('failed')
    }
  }

  // ── Synchroniser le countdown avec l'attempt réelle en DB ────────────────
  const syncWithDB = async () => {
    const { data: attempt } = await supabase
      .from('dispatch_attempts')
      .select('expires_at, attempt_number')
      .eq('mission_id', missionId)
      .is('response', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!attempt) return

    setAttemptNum(attempt.attempt_number)
    const remaining = new Date(attempt.expires_at).getTime() - Date.now()

    if (remaining > 0) {
      startCountdown(remaining)
    } else {
      advanceDispatch()
    }
  }

  // ── Init : charger mission + lancer Realtime ──────────────────────────────
  useEffect(() => {
    supabase
      .from('missions')
      .select('status, category, mode')
      .eq('id', missionId)
      .single()
      .then(({ data }) => {
        if (!data) return

        setCategory(data.category || '')

        if (data.status === 'en_route') { setState('found'); return }
        if (data.status === 'cancelled') { setState('failed'); return }

        syncWithDB()
      })

    // Realtime : écoute les changements de statut de la mission
    const channel = supabase
      .channel(`dispatch:${missionId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'missions',
        filter: `id=eq.${missionId}`,
      }, (payload) => {
        const newStatus = payload.new?.status
        if (newStatus === 'en_route')  { setState('found');  clearTimers() }
        if (newStatus === 'cancelled') { setState('failed'); clearTimers() }
      })
      .subscribe()

    return () => {
      clearTimers()
      supabase.removeChannel(channel)
    }
  }, [missionId])

  const clearTimers = () => {
    clearInterval(intervalRef.current!)
    clearTimeout(timerRef.current!)
  }

  const pct = timeLeft / DISPATCH_TIMEOUT_MS

  // ── Redirection après succès ─────────────────────────────────────────────
  useEffect(() => {
    if (state === 'found') {
      const t = setTimeout(() => router.push(`/warroom/${missionId}`), 2500)
      return () => clearTimeout(t)
    }
  }, [state, missionId, router])

  return (
    <div style={{ minHeight: '100vh', background: '#0F1410', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>

      {/* Fond animé orange */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(232,93,38,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(232,93,38,0.08) 0%, transparent 70%)', borderRadius: '50%', animation: 'pulse 2s ease-in-out infinite' }} />
      </div>

      {state === 'searching' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', zIndex: 1, maxWidth: '360px', width: '100%' }}>

          {/* Icône pulsante */}
          <div style={{ position: 'relative' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #E85D26, #ff7043)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 60px rgba(232,93,38,0.5)', animation: 'pulse 1.5s ease-in-out infinite' }}>
              <Zap size={44} color="white" />
            </div>
            {/* Anneau de progression */}
            <svg style={{ position: 'absolute', top: '-8px', left: '-8px' }} width="116" height="116">
              <circle cx="58" cy="58" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle
                cx="58" cy="58" r="54" fill="none"
                stroke="#E85D26" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - pct)}`}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '58px 58px', transition: 'stroke-dashoffset 0.2s linear' }}
              />
            </svg>
          </div>

          {/* Texte */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: '10px', color: 'rgba(232,93,38,0.8)', letterSpacing: '0.15em', marginBottom: '12px' }}>
              TENTATIVE {attemptNum}
            </div>
            <h1 style={{ ...syne, fontWeight: 700, fontSize: '26px', color: 'white', marginBottom: '8px', lineHeight: 1.2 }}>
              Recherche en cours...
            </h1>
            <p style={{ ...body, fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              On cherche le meilleur artisan {category ? `pour ton ${category.toLowerCase()}` : 'disponible'} dans ton secteur
            </p>
          </div>

          {/* Barre de temps */}
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', height: '6px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct * 100}%`,
              borderRadius: '8px',
              background: pct > 0.4 ? '#E85D26' : pct > 0.2 ? '#C9A84C' : '#ef4444',
              transition: 'width 0.2s linear, background 0.5s ease',
            }} />
          </div>

          <div style={{ ...mono, fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
            {Math.ceil(timeLeft / 1000)}s
          </div>

          {/* Points de chargement */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E85D26', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>

          <p style={{ ...body, fontSize: '12px', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
            Si personne n'accepte, tu seras remboursé automatiquement
          </p>
        </div>
      )}

      {state === 'found' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', zIndex: 1, textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #2B6B3E, #38a169)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 60px rgba(43,107,62,0.5)' }}>
            <CheckCircle size={44} color="white" />
          </div>
          <h1 style={{ ...syne, fontWeight: 700, fontSize: '28px', color: 'white' }}>Artisan trouvé !</h1>
          <p style={{ ...body, fontSize: '15px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            Un artisan a accepté ta mission. Il est en route vers toi.
          </p>
          <div style={{ ...body, fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            Redirection vers le suivi de mission...
          </div>
        </div>
      )}

      {state === 'failed' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', zIndex: 1, textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={44} color="#ef4444" />
          </div>
          <h1 style={{ ...syne, fontWeight: 700, fontSize: '26px', color: 'white' }}>Aucun artisan disponible</h1>
          <p style={{ ...body, fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
            Tous les artisans disponibles ont été contactés sans succès. Tu seras remboursé intégralement sous 24h.
          </p>
          <button
            onClick={() => router.push('/mode-select?category=' + encodeURIComponent(category))}
            style={{ padding: '14px 28px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '14px', ...syne, fontWeight: 700, fontSize: '15px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(232,93,38,0.35)' }}>
            Essayer en mode Standard
          </button>
          <button
            onClick={() => router.push('/')}
            style={{ ...body, fontSize: '13px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Retour à l'accueil
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
