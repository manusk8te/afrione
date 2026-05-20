'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Zap, Clock, Users, ArrowRight, Shield, ChevronRight } from 'lucide-react'
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

  const [loading,  setLoading]  = useState<'urgent' | 'standard' | null>(null)
  const [userId,   setUserId]   = useState<string | null>(null)

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

  // ── Mode Urgent : créer mission → Wave → dispatch ────────────────────────
  const handleUrgent = async () => {
    if (!userId) { toast.error('Connecte-toi d\'abord'); return }
    setLoading('urgent')

    try {
      let currentMissionId = missionId

      // 1. Créer la mission en mode urgent si elle n'existe pas encore
      if (!currentMissionId) {
        const { data: mission, error } = await supabase
          .from('missions')
          .insert({
            client_id: userId,
            mode:      'urgent',
            category,
            status:    'diagnostic',
          })
          .select('id')
          .single()

        if (error || !mission) {
          toast.error('Erreur création mission')
          setLoading(null)
          return
        }
        currentMissionId = mission.id
      } else {
        // Mettre à jour le mode si la mission existait
        await supabase
          .from('missions')
          .update({ mode: 'urgent' })
          .eq('id', currentMissionId)
      }

      const amount = price ?? 8000

      // 2. Créer la session Wave Checkout
      const res = await fetch('/api/wave-checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          mission_id:  currentMissionId,
          amount,
          description: `AfriOne Urgent — ${category}`,
        }),
      })

      const data = await res.json()

      if (data.simulation) {
        // Mode simulation (pas de clé Wave) — on simule le webhook manuellement
        toast('Mode simulation — paiement simulé', { icon: '🧪' })
        await fetch('/api/wave-webhook', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'checkout.session.completed',
            data: {
              client_reference: currentMissionId,
              amount,
              id: `sim_${Date.now()}`,
            },
          }),
        })
        router.push(`/dispatch/${currentMissionId}`)
        return
      }

      if (data.wave_launch_url) {
        // Rediriger vers Wave pour le paiement réel
        window.location.href = data.wave_launch_url
      } else {
        toast.error('Erreur Wave')
        setLoading(null)
      }
    } catch {
      toast.error('Erreur réseau')
      setLoading(null)
    }
  }

  const displayPrice = price
    ? `${price.toLocaleString('fr-FR')} FCFA`
    : 'Prix fixé par l\'IA'

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', color: '#3D4852' }}>
      <Navbar />

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
