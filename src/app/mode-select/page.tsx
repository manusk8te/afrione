'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Zap, Clock, Users, ArrowRight, Shield, ChevronRight, CheckCircle } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_HOVER  = '10px 10px 22px rgba(163,177,198,0.65), -6px -6px 16px rgba(255,255,255,1)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

const syne = { fontFamily: "'Satoshi', sans-serif" }  as const
const body = { fontFamily: "'Inter', sans-serif" }    as const
const mono = { fontFamily: "'Tahoma', sans-serif" }   as const

function ModeSelectContent() {
  const router       = useRouter()
  const params       = useSearchParams()
  const missionId    = params.get('mission')
  const category     = params.get('category') || 'Intervention'
  const priceParam   = params.get('price')
  const price        = priceParam ? parseInt(priceParam) : null

  const [loading,       setLoading]       = useState<'urgent' | 'standard' | null>(null)
  const [userId,        setUserId]        = useState<string | null>(null)
  const [currentMission, setCurrentMission] = useState<string | null>(null)
  const [showWave,      setShowWave]      = useState(false)
  const [wavePhone,     setWavePhone]     = useState('')
  const [waveStep,      setWaveStep]      = useState<'form' | 'processing' | 'success'>('form')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth?redirect=/mode-select'); return }
      setUserId(session.user.id)
    })
  }, [])

  // ── Mode Standard : comportement existant → matching ─────────────────────
  const handleStandard = () => {
    setLoading('standard')
    const href = missionId
      ? `/matching?mission=${missionId}&category=${encodeURIComponent(category)}`
      : `/matching?category=${encodeURIComponent(category)}`
    router.push(href)
  }

  // ── Mode Urgent : créer mission → ouvrir modal Wave ─────────────────────
  const handleUrgent = async () => {
    if (!userId) { toast.error('Connecte-toi d\'abord'); return }
    setLoading('urgent')

    try {
      let resolvedMissionId = missionId

      if (!resolvedMissionId) {
        const { data: mission, error } = await supabase
          .from('missions')
          .insert({ client_id: userId, mode: 'urgent', category, status: 'diagnostic' })
          .select('id')
          .single()
        if (error || !mission) { toast.error('Erreur création mission'); setLoading(null); return }
        resolvedMissionId = mission.id
      } else {
        await supabase.from('missions').update({ mode: 'urgent' }).eq('id', resolvedMissionId)
      }

      setCurrentMission(resolvedMissionId)
      setLoading(null)
      setWaveStep('form')
      setShowWave(true)
    } catch {
      toast.error('Erreur réseau')
      setLoading(null)
    }
  }

  // ── Confirmation paiement Wave (mock) ────────────────────────────────────
  const confirmWave = async () => {
    if (!wavePhone.trim() || !currentMission) return
    setWaveStep('processing')

    await new Promise(r => setTimeout(r, 2000))

    await fetch('/api/dispatch/simulate-pay', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mission_id: currentMission, amount: price ?? 8000 }),
    })

    setWaveStep('success')
  }

  const afterWave = () => {
    setShowWave(false)
    router.push(`/dispatch/${currentMission}`)
  }

  const displayPrice = price
    ? `${price.toLocaleString('fr-FR')} FCFA`
    : 'Prix fixé par l\'IA'

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', color: '#3D4852' }}>
      <Navbar />

      {/* ── Modal Wave ─────────────────────────────────────────────────────── */}
      {showWave && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div style={{ width: '100%', maxWidth: '380px', background: 'linear-gradient(180deg,#1A1D2E 0%,#0D0F1C 100%)', borderRadius: '28px', padding: '28px 24px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

            {/* Header Wave */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', background: 'linear-gradient(135deg,#4144FF,#1DC6FF)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '16px', color: 'white', fontFamily: 'Arial Black,sans-serif' }}>W</div>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>Wave</span>
              </div>
              {waveStep === 'form' && (
                <button onClick={() => setShowWave(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>✕</button>
              )}
            </div>

            {/* Étape 1 — Formulaire */}
            {waveStep === 'form' && (
              <>
                <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Montant total</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ color: 'white', fontSize: '52px', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1, fontFamily: 'Tahoma' }}>{(price ?? 8000).toLocaleString()}</span>
                    <span style={{ color: '#1DC6FF', fontSize: '18px', fontWeight: 700 }}>FCFA</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '6px' }}>Urgent · {category}</div>
                </div>

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 0 20px' }} />

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Votre numéro Wave</div>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: `1.5px solid ${wavePhone.trim() ? '#1DC6FF' : 'rgba(255,255,255,0.08)'}`, borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                    <div style={{ padding: '15px 16px', borderRight: '1px solid rgba(255,255,255,0.08)', fontSize: '14px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', flexShrink: 0 }}>🇨🇮 +225</div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="07 00 00 00 00"
                      value={wavePhone}
                      onChange={e => setWavePhone(e.target.value)}
                      style={{ flex: 1, padding: '15px 16px', background: 'transparent', border: 'none', outline: 'none', fontSize: '17px', color: 'white', fontFamily: 'Tahoma', letterSpacing: '0.06em' }}
                    />
                  </div>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(248,121,0,0.08)', border: '1px solid rgba(248,121,0,0.2)', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>🔒</span>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                    Fonds sécurisés par AfriOne · Transférés à l'artisan après validation
                  </div>
                </div>

                <button
                  onClick={confirmWave}
                  disabled={!wavePhone.trim()}
                  style={{ width: '100%', padding: '18px', background: wavePhone.trim() ? 'linear-gradient(135deg,#4144FF,#0D99FF)' : 'rgba(255,255,255,0.08)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.2px', cursor: wavePhone.trim() ? 'pointer' : 'default', boxShadow: wavePhone.trim() ? '0 8px 28px rgba(65,68,255,0.45)' : 'none', transition: 'all 0.2s' }}
                >
                  Payer avec Wave
                </button>
                <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
                  Sécurisé par <strong style={{ color: '#1DC6FF' }}>Wave</strong> · Chiffrement TLS 1.3
                </div>
              </>
            )}

            {/* Étape 2 — Processing */}
            {waveStep === 'processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '280px', gap: '24px' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                  <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(13,153,255,0.12)', borderRadius: '50%' }} />
                  <div style={{ position: 'absolute', inset: 0, border: '3px solid transparent', borderTopColor: '#0D99FF', borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} />
                  <div style={{ position: 'absolute', inset: '10px', background: 'linear-gradient(135deg,#4144FF,#1DC6FF)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(29,198,255,0.3)' }}>
                    <span style={{ color: 'white', fontWeight: 900, fontSize: '22px', fontFamily: 'Arial Black,sans-serif' }}>W</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>Traitement en cours…</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>Vérification via Wave sécurisée</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#1DC6FF', opacity: 0.4, animation: `pulse 1.2s ease-in-out ${i * 0.35}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Étape 3 — Succès */}
            {waveStep === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '8px' }}>
                <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'linear-gradient(135deg,#4144FF,#1DC6FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 0 0 14px rgba(29,198,255,0.07), 0 0 0 28px rgba(29,198,255,0.03)' }}>
                  <CheckCircle size={44} color="white" strokeWidth={2.5} />
                </div>
                <div style={{ color: 'white', fontSize: '22px', fontWeight: 900, marginBottom: '4px', letterSpacing: '-0.5px' }}>Paiement réussi !</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '24px' }}>Transaction sécurisée par Wave</div>

                <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px' }}>
                  {[
                    { label: 'Montant', value: `${(price ?? 8000).toLocaleString()} FCFA`, color: 'white' },
                    { label: 'Bénéficiaire', value: 'AfriOne Escrow', color: 'rgba(255,255,255,0.8)' },
                    { label: 'Numéro Wave', value: `+225 ${wavePhone}`, color: 'rgba(255,255,255,0.8)' },
                    { label: 'Statut', value: '✓ Escrow sécurisé', color: '#1DC6FF' },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{row.label}</span>
                      <span style={{ color: row.color, fontSize: '13px', fontWeight: 600, fontFamily: row.label === 'Numéro Wave' ? 'Tahoma' : undefined }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={afterWave}
                  style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg,#4144FF,#0D99FF)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 28px rgba(65,68,255,0.4)', letterSpacing: '-0.2px' }}
                >
                  Trouver un artisan →
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}`}</style>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '96px 16px 64px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(232,93,38,0.08)', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '20px', padding: '5px 14px', marginBottom: '16px' }}>
            <Zap size={11} color="#E85D26" />
            <span style={{ ...mono, fontSize: '10px', color: '#E85D26', letterSpacing: '0.1em' }}>CHOISIR MON MODE</span>
          </div>
          <h1 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(26px, 5vw, 38px)', color: '#3D4852', marginBottom: '8px', lineHeight: 1.1 }}>
            Comment tu veux procéder ?
          </h1>
          <p style={{ ...body, fontSize: '15px', color: '#6B7280', lineHeight: 1.6 }}>
            {category} · {displayPrice}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Mode URGENT ────────────────────────────────────────────────── */}
          <button
            onClick={handleUrgent}
            disabled={!!loading}
            style={{
              width: '100%', textAlign: 'left', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: 'white', borderRadius: '24px', padding: '28px',
              boxShadow: loading === 'urgent' ? NEU_SHADOW : NEU_SHADOW,
              transition: 'box-shadow 0.25s, transform 0.25s',
              opacity: loading && loading !== 'urgent' ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.boxShadow = NEU_HOVER; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = NEU_SHADOW; (e.currentTarget as HTMLElement).style.transform = '' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>

              {/* Icône */}
              <div style={{ flexShrink: 0, width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #E85D26, #ff7043)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(232,93,38,0.35)' }}>
                {loading === 'urgent'
                  ? <div style={{ width: '22px', height: '22px', border: '2.5px solid rgba(255,255,255,0.4)', borderTop: '2.5px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  : <Zap size={24} color="white" />
                }
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ ...syne, fontWeight: 800, fontSize: '20px', color: '#3D4852' }}>Mode Urgent</span>
                  <span style={{ ...mono, fontSize: '9px', color: '#E85D26', background: 'rgba(232,93,38,0.1)', border: '1px solid rgba(232,93,38,0.25)', borderRadius: '20px', padding: '2px 8px', letterSpacing: '0.08em' }}>RECOMMANDÉ</span>
                </div>
                <p style={{ ...body, fontSize: '14px', color: '#6B7280', lineHeight: 1.6, margin: '0 0 16px' }}>
                  Tu paies maintenant, on envoie le meilleur artisan disponible directement chez toi. Comme Uber.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { icon: '⚡', text: 'Artisan dispatché en moins de 2 minutes' },
                    { icon: '🔒', text: 'Prix fixé — aucune négociation' },
                    { icon: '💳', text: 'Paiement sécurisé Wave maintenant' },
                  ].map(({ icon, text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>{icon}</span>
                      <span style={{ ...body, fontSize: '13px', color: '#3D4852' }}>{text}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ ...mono, fontSize: '22px', fontWeight: 700, color: '#E85D26' }}>
                      {displayPrice}
                    </div>
                    <div style={{ ...mono, fontSize: '10px', color: '#8B95A5', marginTop: '2px' }}>Tout inclus · Fonds sécurisés</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #E85D26, #ff7043)', borderRadius: '12px', padding: '10px 16px' }}>
                    <span style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white' }}>Payer maintenant</span>
                    <ArrowRight size={16} color="white" />
                  </div>
                </div>
              </div>
            </div>
          </button>

          {/* ── Mode STANDARD ──────────────────────────────────────────────── */}
          <button
            onClick={handleStandard}
            disabled={!!loading}
            style={{
              width: '100%', textAlign: 'left', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: 'white', borderRadius: '24px', padding: '28px',
              boxShadow: NEU_SHADOW,
              transition: 'box-shadow 0.25s, transform 0.25s',
              opacity: loading && loading !== 'standard' ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.boxShadow = NEU_HOVER; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = NEU_SHADOW; (e.currentTarget as HTMLElement).style.transform = '' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>

              <div style={{ flexShrink: 0, width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #2B6B3E, #38a169)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(43,107,62,0.25)' }}>
                {loading === 'standard'
                  ? <div style={{ width: '22px', height: '22px', border: '2.5px solid rgba(255,255,255,0.4)', borderTop: '2.5px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  : <Users size={24} color="white" />
                }
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ ...syne, fontWeight: 800, fontSize: '20px', color: '#3D4852' }}>Mode Standard</span>
                </div>
                <p style={{ ...body, fontSize: '14px', color: '#6B7280', lineHeight: 1.6, margin: '0 0 16px' }}>
                  On te propose 3 artisans qualifiés. Tu discutes, tu choisis, tu paies quand tu es prêt.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { icon: '👥', text: '3 artisans proposés selon ton quartier' },
                    { icon: '💬', text: 'Discussion avant confirmation' },
                    { icon: '🕐', text: 'Intervention planifiée à ta convenance' },
                  ].map(({ icon, text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>{icon}</span>
                      <span style={{ ...body, fontSize: '13px', color: '#3D4852' }}>{text}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                  <div style={{ ...body, fontSize: '13px', color: '#8B95A5' }}>
                    Prix négocié avec l'artisan
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#2B6B3E', borderRadius: '12px', padding: '10px 16px' }}>
                    <span style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white' }}>Choisir</span>
                    <ChevronRight size={16} color="white" />
                  </div>
                </div>
              </div>
            </div>
          </button>

          {/* ── Séparateur ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
            <span style={{ ...mono, fontSize: '10px', color: '#8B95A5', letterSpacing: '0.08em' }}>OU</span>
            <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
          </div>

          {/* ── Mode Libre ─────────────────────────────────────────────────── */}
          <Link href="/artisans"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '14px', background: 'white', borderRadius: '16px', textDecoration: 'none', boxShadow: NEU_SMALL, transition: 'box-shadow 0.2s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = NEU_SHADOW}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = NEU_SMALL}>
            <span style={{ ...body, fontSize: '14px', color: '#6B7280' }}>Pas urgent ? Parcourir les artisans librement</span>
            <ChevronRight size={14} color="#8B95A5" />
          </Link>

          {/* ── Badge de confiance ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', paddingTop: '8px' }}>
            {[
              { Icon: Shield, text: 'KYC vérifié' },
              { Icon: Clock,  text: 'Remboursé si personne' },
              { Icon: Zap,    text: 'Paiement Wave sécurisé' },
            ].map(({ Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon size={11} color="#8B95A5" />
                <span style={{ ...mono, fontSize: '10px', color: '#8B95A5' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ModeSelectPage() {
  return (
    <Suspense>
      <ModeSelectContent />
    </Suspense>
  )
}
