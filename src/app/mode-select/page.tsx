'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Zap, Clock, Users, ArrowRight, Shield, ChevronRight, CheckCircle } from 'lucide-react'
import SuppliesNotice from '@/components/pricing/SuppliesNotice'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import JekoCheckoutButton from '@/components/payment/JekoCheckoutButton'
import { openJekoCheckout } from '@/lib/open-jeko-checkout'
import { clientApi } from '@/lib/client-api'

const NEU_SHADOW = 'var(--ui-shadow-card)'
const NEU_HOVER  = 'var(--ui-shadow-card)'
const NEU_SMALL  = 'var(--ui-shadow-soft)'

const syne = { fontFamily: "'Satoshi', sans-serif" }  as const
const body = { fontFamily: "'Inter', sans-serif" }    as const
const mono = { fontFamily: "'Tahoma', sans-serif" }   as const

function ModeSelectContent() {
  const router       = useRouter()
  const params       = useSearchParams()
  const missionId    = params.get('mission')
  const preferredArtisan = params.get('artisan')
  const requestedCategory = params.get('category') || 'Intervention'
  const [quote,setQuote]=useState<{quote_revision?:string;category?:string;total:number|null;service_total:number|null;materials_total:number;needs_quote:boolean;sources:{id?:string;source_scope?:string;url?:string}[]}|null>(null)
  const [quoteError,setQuoteError]=useState('')
  const price=quote?.total??null
  const category=quote?.category??requestedCategory
  const summary      = params.get('summary')

  const [loading,       setLoading]       = useState<'urgent' | 'standard' | null>(null)
  const [workflow, setWorkflow] = useState<{
    jeko_checkout_enabled: boolean
    mission: { status: string; artisan_id: string | null; is_test: boolean; logic_version: number; provider_accepted_at: string | null; price_confirmed_version: number | null }
  } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)); return }
    })
  }, [router])

  useEffect(()=>{if(!missionId){setQuoteError('Commencez par un diagnostic pour obtenir un devis.');return}
    let active=true;clientApi(`/api/quote?mission_id=${encodeURIComponent(missionId)}`).then(async r=>{const result=await r.json();if(!r.ok)throw Error(result.error);if(active)setQuote(result)}).catch(e=>{if(active)setQuoteError(e.message)});return()=>{active=false}
  },[missionId])

  useEffect(() => {
    setWorkflow(null)
    if (!missionId) return
    let active = true
    clientApi(`/api/mission/workflow?mission_id=${encodeURIComponent(missionId)}`)
      .then(async response => {
        if (response.ok && active) setWorkflow(await response.json())
      }).catch(() => {})
    return () => { active = false }
  }, [missionId])

  async function chooseMode(mode: 'urgent' | 'standard') {
    setLoading(mode)
    if (mode === 'urgent') {
      try {
        if (!missionId) throw new Error('Commencez par un diagnostic.')
        setQuoteError('')
        window.location.assign(await openJekoCheckout(missionId, true))
      } catch (error) {
        setQuoteError(error instanceof Error ? error.message : 'Le paiement Jèko est indisponible.')
        setLoading(null)
      }
      return
    }
    const query = new URLSearchParams({ category, mode })
    if (missionId) query.set('mission', missionId)
    if (preferredArtisan) query.set('artisan', preferredArtisan)
    router.push(`/matching?${query}`)
  }

  const assigned = workflow?.mission.artisan_id
  const payable = workflow?.jeko_checkout_enabled && workflow.mission.status === 'negotiation'
    && !workflow.mission.is_test && workflow.mission.logic_version >= 2
    && workflow.mission.provider_accepted_at && workflow.mission.price_confirmed_version && price

  const displayPrice = price
    ? `${price.toLocaleString('fr-FR')} FCFA`
    : 'Devis nécessaire'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ui-canvas)', color: 'var(--ui-ink)' }}>
      <Navbar />

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}`}</style>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '96px 16px 64px' }}>
        {quoteError && <p role="alert">{quoteError}</p>}
        {quote&&<section style={{padding:16,border:'1px solid #CBD5E1',borderRadius:12,marginBottom:16}}><p>Prestation : {quote.service_total?.toLocaleString('fr-FR')??'à confirmer'} FCFA · Fournitures supplémentaires confirmées : {quote.materials_total.toLocaleString('fr-FR')} FCFA</p>{quote.needs_quote&&<Link href={`/diagnostic?mission=${missionId}`}>Préciser le devis et les fournitures avant paiement</Link>}</section>}

        {quote && <SuppliesNotice sources={quote.sources} />}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(232,93,38,0.08)', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '20px', padding: '5px 14px', marginBottom: '16px' }}>
            <Zap size={11} color="#E85D26" />
            <span style={{ ...mono, fontSize: '10px', color: '#E85D26', letterSpacing: '0.1em' }}>CHOISIR MON MODE</span>
          </div>
          <h1 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(26px, 5vw, 38px)', color: 'var(--ui-ink)', marginBottom: '8px', lineHeight: 1.1 }}>
            Comment tu veux procéder ?
          </h1>
          <p style={{ ...body, fontSize: '15px', color: 'var(--ui-muted)', lineHeight: 1.6 }}>
            {category} · {displayPrice}
          </p>
        </div>

        {assigned && missionId ? (
          <section className="card" style={{ padding: 20 }}>
            {payable ? <JekoCheckoutButton missionId={missionId} /> : <p>Le paiement Jèko est disponible après confirmation du devis.</p>}
            <p><Link href={`/warroom/${encodeURIComponent(missionId)}#paiement-jeko`}>Retour à la mission</Link></p>
          </section>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Résumé IA diagnostic ──────────────────────────────────────── */}
          {summary && (
            <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid rgba(232,93,38,0.25)', padding: '18px 20px', boxShadow: NEU_SMALL }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg,#E85D26,#ff7043)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={13} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#E85D26', letterSpacing: '0.1em', fontFamily: 'var(--font-body)' }}>ANALYSE IA</div>
                  <div style={{ fontSize: '10px', color: '#8B95A5' }}>Résumé de votre situation</div>
                </div>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--ui-ink)', lineHeight: 1.65, margin: 0 }}>{summary}</p>
            </div>
          )}

          {/* ── Mode URGENT ────────────────────────────────────────────────── */}
          <button className="afrione-action"
            onClick={() => chooseMode('urgent')}
            disabled={!!loading||!price}
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
                  <span style={{ ...syne, fontWeight: 800, fontSize: '20px', color: 'var(--ui-ink)' }}>Mode Urgent</span>
                </div>
                <p style={{ ...body, fontSize: '14px', color: 'var(--ui-muted)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  Les artisans disponibles les plus pertinents reçoivent ta demande. Le premier qui accepte est affecté à ton intervention.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { text: 'Choisis ton moyen de paiement sur Jèko' },
                    { text: 'Suis l’artisan sur AfriOne dès qu’il accepte' },
                  ].map(({ text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={14} aria-hidden="true" />
                      <span style={{ ...body, fontSize: '13px', color: 'var(--ui-ink)' }}>{text}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--ui-border)' }}>
                  <div>
                    <div style={{ ...mono, fontSize: '22px', fontWeight: 700, color: '#E85D26' }}>
                      {displayPrice}
                    </div>
                    <div style={{ ...mono, fontSize: '10px', color: '#8B95A5', marginTop: '2px' }}>Montant à payer</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #E85D26, #ff7043)', borderRadius: '12px', padding: '10px 16px' }}>
                    <span style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white' }}>Payer avec Jèko</span>
                    <ArrowRight size={16} color="white" />
                  </div>
                </div>
              </div>
            </div>
          </button>

          {/* ── Mode STANDARD ──────────────────────────────────────────────── */}
          <button className="afrione-action"
            onClick={() => chooseMode('standard')}
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
                  <span style={{ ...syne, fontWeight: 800, fontSize: '20px', color: 'var(--ui-ink)' }}>Mode Standard</span>
                </div>
                <p style={{ ...body, fontSize: '14px', color: 'var(--ui-muted)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  Consulte les artisans disponibles du métier demandé et échange sur ton besoin avant de convenir d’un devis.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { text: 'Profils du métier, selon les disponibilités' },
                    { text: 'Discussion avant confirmation' },
                    { text: 'Paiement sécurisé sur Jèko du devis' },
                  ].map(({ text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={14} aria-hidden="true" />
                      <span style={{ ...body, fontSize: '13px', color: 'var(--ui-ink)' }}>{text}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--ui-border)' }}>
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
            <div style={{ flex: 1, height: '1px', background: 'var(--ui-border)' }} />
            <span style={{ ...mono, fontSize: '10px', color: '#8B95A5', letterSpacing: '0.08em' }}>OU</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--ui-border)' }} />
          </div>

          {/* ── Mode Libre ─────────────────────────────────────────────────── */}
          <Link href="/artisans"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '14px', background: 'white', borderRadius: '16px', textDecoration: 'none', boxShadow: NEU_SMALL, transition: 'box-shadow 0.2s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = NEU_SHADOW}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = NEU_SMALL}>
            <span style={{ ...body, fontSize: '14px', color: 'var(--ui-muted)' }}>Pas urgent ? Parcourir les artisans librement</span>
            <ChevronRight size={14} color="#8B95A5" />
          </Link>

          {/* ── Badge de confiance ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', paddingTop: '8px' }}>
            {[
              { Icon: Shield, text: 'KYC vérifié' },
              { Icon: Clock,  text: 'Paiement après devis' },
              { Icon: Zap,    text: 'Paiement sécurisé' },
            ].map(({ Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon size={11} color="#8B95A5" />
                <span style={{ ...mono, fontSize: '10px', color: '#8B95A5' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        )}
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
