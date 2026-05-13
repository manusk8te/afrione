'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import {
  ArrowRight, Shield, Zap, Star, CheckCircle, ChevronRight, Building2,
  Droplets, Hammer, Paintbrush, Ruler, Wind, Lock, LayoutGrid,
  Cpu, Users, CreditCard, Camera, Wrench, MapPin, Clock,
  ChevronDown, ChevronUp, Play,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

/* ─── Video URLs ──────────────────────────────────────────────────────────── */
const HERO_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4'

/* ─── FadingVideo (rAF crossfade — no CSS transitions) ───────────────────── */
const FADE_MS       = 500
const FADE_OUT_LEAD = 0.55

function FadingVideo({ src, className }: { src: string; className?: string }) {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const rafRef       = useRef<number>(0)
  const fadingOutRef = useRef(false)

  const fadeTo = useCallback((target: number, ms: number) => {
    cancelAnimationFrame(rafRef.current)
    const v = videoRef.current
    if (!v) return
    const t0   = performance.now()
    const from = parseFloat(v.style.opacity || '0')
    const tick = (now: number) => {
      const p = Math.min((now - t0) / ms, 1)
      v.style.opacity = String(from + (target - from) * p)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onLoaded = () => { v.style.opacity = '0'; v.play().catch(() => {}); fadeTo(1, FADE_MS) }
    const onTime   = () => {
      if (!fadingOutRef.current && v.duration > 0 && v.duration - v.currentTime <= FADE_OUT_LEAD) {
        fadingOutRef.current = true; fadeTo(0, FADE_MS)
      }
    }
    const onEnded  = () => {
      v.style.opacity = '0'
      setTimeout(() => { v.currentTime = 0; v.play().catch(() => {}); fadingOutRef.current = false; fadeTo(1, FADE_MS) }, 100)
    }
    v.addEventListener('loadeddata', onLoaded)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('ended',      onEnded)
    return () => {
      cancelAnimationFrame(rafRef.current)
      v.removeEventListener('loadeddata', onLoaded)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('ended',      onEnded)
    }
  }, [fadeTo])

  return <video ref={videoRef} src={src} className={className} style={{ opacity: 0 }} muted playsInline preload="auto" />
}

/* ─── BlurText (word-by-word blur-in) ────────────────────────────────────── */
function BlurText({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const ref    = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  return (
    <div ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', rowGap: '0.1em', ...style }}>
      {text.split(' ').map((word, i) => (
        <motion.span
          key={i}
          style={{ display: 'inline-block', marginRight: '0.28em' }}
          initial={{ filter: 'blur(10px)', opacity: 0, y: 50 }}
          animate={inView ? { filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'], opacity: [0, 0.5, 1], y: [50, -5, 0] } : {}}
          transition={{ duration: 0.7, times: [0, 0.5, 1], ease: 'easeOut', delay: i * 0.1 }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
}

/* ─── Static data ─────────────────────────────────────────────────────────── */
const SERVICES = [
  { Icon: Droplets,   label: 'Plomberie',     metier: 'Plomberie'     },
  { Icon: Zap,        label: 'Électricité',   metier: 'Électricité'   },
  { Icon: Hammer,     label: 'Maçonnerie',    metier: 'Maçonnerie'    },
  { Icon: Paintbrush, label: 'Peinture',      metier: 'Peinture'      },
  { Icon: Ruler,      label: 'Menuiserie',    metier: 'Menuiserie'    },
  { Icon: Wind,       label: 'Climatisation', metier: 'Climatisation' },
  { Icon: Lock,       label: 'Serrurerie',    metier: 'Serrurerie'    },
  { Icon: LayoutGrid, label: 'Carrelage',     metier: 'Carrelage'     },
]

const METIER_ICON_MAP: Record<string, React.ElementType> = {
  'Plomberie': Droplets, 'Électricité': Zap, 'Maçonnerie': Hammer,
  'Peinture': Paintbrush, 'Menuiserie': Ruler, 'Climatisation': Wind,
  'Serrurerie': Lock, 'Carrelage': LayoutGrid,
}

const STEPS = [
  { num: '01', title: 'Décrivez votre besoin',  desc: "L'IA analyse votre problème et estime le prix en quelques secondes.", Icon: Cpu        },
  { num: '02', title: 'Choisissez un artisan',  desc: 'Profils sélectionnés selon votre quartier et votre budget.',           Icon: Users      },
  { num: '03', title: 'Confirmez & payez',       desc: "Paiement sécurisé Wave. Les fonds sont bloqués jusqu'à la fin.",       Icon: CreditCard },
  { num: '04', title: 'Mission validée',         desc: "Validez la photo de fin de chantier et notez l'artisan.",             Icon: Camera     },
]

const FAQ_ITEMS = [
  {
    q: "Comment les artisans sont-ils vérifiés ?",
    a: "Chaque artisan passe une vérification d'identité et de compétences avant d'être admis. Nous contrôlons leurs documents, leurs qualifications et vérifions leurs antécédents professionnels.",
  },
  {
    q: "Comment fonctionne le paiement ?",
    a: "Vous payez via Wave au moment de la réservation. Les fonds sont bloqués sur un compte séquestre jusqu'à la fin de la mission et libérés uniquement après votre validation.",
  },
  {
    q: "Combien de temps pour trouver un artisan ?",
    a: "En général moins de 30 minutes après votre demande. Un artisan qualifié de votre quartier vous contacte directement par téléphone ou via l'application.",
  },
  {
    q: "Que faire si je ne suis pas satisfait ?",
    a: "Chaque mission est notée. Si la prestation ne correspond pas, notre équipe intervient sous 24h pour trouver une solution ou procéder au remboursement.",
  },
  {
    q: "Dans quels quartiers êtes-vous disponibles ?",
    a: "Nous couvrons Cocody, Plateau, Marcory, Yopougon, Adjamé, Abobo, Treichville et leurs environs. La couverture s'étend régulièrement.",
  },
]

/* Blue removed — warm cream #C8B49A replaces it for palette coherence */
const TRUST_PILLARS = [
  {
    Icon: Shield, title: 'Artisans vérifiés KYC',
    desc: "Chaque artisan passe une vérification d'identité et de compétence avant d'être admis sur la plateforme.",
    stat: '100% contrôlés', color: '#2B6B3E', bg: 'rgba(43,107,62,0.1)',
  },
  {
    Icon: CreditCard, title: 'Escrow Wave',
    desc: "Votre argent est sécurisé jusqu'à la fin de la mission. Libéré uniquement après votre validation.",
    stat: 'Paiement garanti', color: '#E85D26', bg: 'rgba(232,93,38,0.1)',
  },
  {
    Icon: Star, title: 'Qualité garantie',
    desc: 'Chaque mission est notée. Les artisans sous 3/5 sont automatiquement suspendus de la plateforme.',
    stat: '4.8★ en moyenne', color: '#C9A84C', bg: 'rgba(201,168,76,0.1)',
  },
  {
    Icon: Clock, title: 'Réponse en 30 min',
    desc: 'Un artisan qualifié de votre quartier vous contacte en moins de 30 minutes après votre demande.',
    stat: 'Rapide et local', color: '#C8B49A', bg: 'rgba(200,180,154,0.1)',
  },
]

/* ─── Animation variants ──────────────────────────────────────────────────── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } }
const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 90, damping: 18 } } }
const fadeIn  = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.5 } } }

/* ─── Tokens ──────────────────────────────────────────────────────────────── */
const BG0 = '#060604'   // base — warmest black
const BG1 = '#0B0A07'   // elevated sections
const T1  = 'rgba(255,255,255,0.92)'
const T2  = 'rgba(255,255,255,0.55)'
const T3  = 'rgba(255,255,255,0.32)'
const BO  = 'rgba(255,255,255,0.08)'

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const [faqOpen,         setFaqOpen]         = useState<number | null>(0)
  const [stats,           setStats]           = useState({ artisans: 500, missions: 2400, rating: 4.8, satisfaction: 98 })
  const [topArtisans,     setTopArtisans]     = useState<any[]>([])
  const [topEntreprises,  setTopEntreprises]  = useState<any[]>([])
  const [serviceCounts,   setServiceCounts]   = useState<Record<string, number>>({})
  const [loadingArtisans, setLoadingArtisans] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const [
        { count: artisanCount },
        { count: missionCount },
        { data: ratingsData },
        { data: allArtisans },
      ] = await Promise.all([
        supabase.from('artisan_pros').select('id', { count: 'exact', head: true }).eq('kyc_status', 'approved'),
        supabase.from('missions').select('id',      { count: 'exact', head: true }).eq('status',     'completed'),
        supabase.from('artisan_pros').select('rating_avg').eq('kyc_status', 'approved').not('rating_avg', 'is', null),
        supabase.from('artisan_pros').select('metier').eq('kyc_status', 'approved'),
      ])
      const ratings = ratingsData?.map((a: any) => a.rating_avg).filter(Boolean) || []
      const avgRating = ratings.length
        ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
        : 4.8
      const counts: Record<string, number> = {}
      allArtisans?.forEach((a: any) => { counts[a.metier] = (counts[a.metier] || 0) + 1 })
      setServiceCounts(counts)
      setStats({ artisans: Math.max(artisanCount || 0, 500), missions: Math.max(missionCount || 0, 2400), rating: avgRating || 4.8, satisfaction: 98 })
    }

    const fetchArtisans = async () => {
      const [artisanRes, entrepriseRes] = await Promise.all([
        supabase.from('artisan_pros')
          .select('id, metier, tarif_min, tarif_max, rating_avg, mission_count, users!artisan_pros_user_id_fkey(name, quartier, avatar_url)')
          .eq('kyc_status', 'approved').order('rating_avg', { ascending: false }).limit(3),
        supabase.from('entreprises')
          .select('id, name, description, banner_url, secteurs, artisan_pros(id)')
          .eq('kyc_status', 'approved').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
      ])
      setTopArtisans(artisanRes.data || [])
      setTopEntreprises(entrepriseRes.data || [])
      setLoadingArtisans(false)
    }

    fetchStats()
    fetchArtisans()
  }, [])

  const STATS_DISPLAY = [
    { value: `${stats.artisans}+`,                       label: 'Artisans vérifiés'   },
    { value: `${stats.rating}★`,                         label: 'Note moyenne'         },
    { value: `${stats.missions.toLocaleString()}+`,      label: 'Missions réalisées'   },
    { value: `${stats.satisfaction}%`,                   label: 'Clients satisfaits'   },
  ]

  /* ── helpers ── */
  const mono = { fontFamily: "'Space Mono', monospace" } as const
  const syne = { fontFamily: "'Syne', sans-serif" }      as const
  const body = { fontFamily: "'Bricolage Grotesque', sans-serif" } as const

  return (
    <div style={{ background: BG0, color: T1, minHeight: '100vh' }}>
      <Navbar />

      {/* ━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative overflow-hidden flex flex-col" style={{ minHeight: '100dvh', background: BG0 }}>
        {/* Video */}
        <FadingVideo src={HERO_VIDEO} className="absolute inset-0 w-full h-full object-cover z-0" />
        {/* Vignette — readability, not opacity mask */}
        <div className="absolute inset-0 z-[1] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 100% 80% at 50% 65%, rgba(6,6,4,0.05) 0%, rgba(6,6,4,0.62) 100%)' }} />

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col page-container">
          {/* Main hero body */}
          <div className="flex-1 flex flex-col items-center justify-center text-center pt-32 pb-10 px-4">
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center w-full">

              {/* Badge */}
              <motion.div variants={fadeUp}>
                <div className="liquid-glass rounded-full inline-flex items-center gap-2 mb-10"
                  style={{ padding: '6px 16px 6px 10px' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse-soft" style={{ background: '#E85D26' }} />
                  <span style={{ ...mono, fontSize: '11px', color: T2, letterSpacing: '0.1em' }}>PLATEFORME #1 · ABIDJAN</span>
                </div>
              </motion.div>

              {/* Headline */}
              <BlurText
                text="Trouvez le bon artisan au bon prix"
                style={{ fontSize: 'clamp(44px, 7.5vw, 92px)', lineHeight: 0.88, letterSpacing: '-0.04em', marginBottom: '28px', maxWidth: '16ch', ...syne, fontWeight: 700 }}
              />

              {/* Subtitle */}
              <motion.p variants={fadeUp}
                style={{ ...body, fontSize: '16px', maxWidth: '52ch', color: T2, marginBottom: '40px', lineHeight: 1.65 }}>
                Artisans vérifiés KYC, prix transparents, paiement sécurisé via Wave.
                Votre chantier, géré de bout en bout à Abidjan.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={fadeUp} className="flex flex-wrap gap-3 justify-center" style={{ marginBottom: '48px' }}>
                <Link href="/diagnostic"
                  className="liquid-glass-strong rounded-full inline-flex items-center gap-2"
                  style={{ ...syne, padding: '13px 28px', fontSize: '15px', fontWeight: 700, color: 'white', textDecoration: 'none', cursor: 'pointer' }}>
                  Décrire mon problème <ArrowRight size={16} />
                </Link>
                <Link href="/artisans"
                  className="rounded-full inline-flex items-center gap-2"
                  style={{ ...syne, padding: '13px 28px', fontSize: '15px', fontWeight: 600, color: T2, textDecoration: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T2}>
                  <Play size={13} style={{ fill: 'currentColor' }} /> Voir les artisans
                </Link>
              </motion.div>

              {/* Stats */}
              <motion.div variants={stagger} className="flex flex-wrap gap-4 justify-center">
                {STATS_DISPLAY.map(s => (
                  <motion.div key={s.label} variants={fadeUp}>
                    <div className="liquid-glass rounded-2xl p-5 text-left" style={{ minWidth: '148px' }}>
                      <div style={{ ...syne, fontWeight: 700, fontSize: '28px', letterSpacing: '-0.03em', lineHeight: 1, color: '#E85D26' }}>
                        {s.value}
                      </div>
                      <div style={{ ...mono, fontSize: '10px', color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '8px' }}>
                        {s.label}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>

          {/* Bottom strip — trust + service chips */}
          <div className="pb-8 px-4" style={{ borderTop: `1px solid ${BO}`, paddingTop: '24px' }}>
            <motion.div variants={stagger} initial="hidden" animate="show">

              {/* Trust micro-row */}
              <motion.div variants={fadeIn} className="flex flex-wrap gap-5 justify-center mb-6">
                {[
                  { Icon: Shield,      text: 'Artisans vérifiés KYC' },
                  { Icon: Zap,         text: 'Réponse en 30 min'     },
                  { Icon: CheckCircle, text: 'Paiement sécurisé Wave' },
                ].map(({ Icon, text }) => (
                  <div key={text} className="flex items-center gap-2">
                    <Icon size={13} style={{ color: 'rgba(232,93,38,0.75)' }} />
                    <span style={{ ...body, fontSize: '13px', color: T3 }}>{text}</span>
                  </div>
                ))}
              </motion.div>

              {/* Service chips */}
              <motion.div variants={fadeIn}>
                <p style={{ ...mono, fontSize: '10px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  Accès direct
                </p>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map(({ Icon, label, metier }) => (
                    <Link key={metier} href={`/artisans?metier=${encodeURIComponent(metier)}`}
                      className="liquid-glass rounded-full inline-flex items-center gap-2"
                      style={{ padding: '7px 14px', fontSize: '13px', color: T2, textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T2}>
                      <Icon size={12} />
                      {label}
                    </Link>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ━━━━ CAPABILITIES / SERVICES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative overflow-hidden" style={{ minHeight: '90vh', background: BG1 }}>
        <div className="page-container py-24">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>

            <motion.p variants={fadeUp} style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '20px' }}>
              // Services
            </motion.p>
            <motion.h2 variants={fadeUp}
              style={{ ...syne, fontWeight: 700, fontSize: 'clamp(48px, 7vw, 86px)', lineHeight: 0.9, letterSpacing: '-0.04em', color: 'white', marginBottom: '60px' }}>
              Tous vos corps<br />de métier.
            </motion.h2>

            <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SERVICES.map(({ Icon, label, metier }) => (
                <motion.div key={label} variants={fadeUp}>
                  <Link href={`/artisans?metier=${encodeURIComponent(metier)}`}
                    className="liquid-glass rounded-2xl flex flex-col gap-3"
                    style={{ padding: '20px', textDecoration: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                    <div className="liquid-glass rounded-xl flex items-center justify-center" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                      <Icon size={17} style={{ color: '#E85D26' }} />
                    </div>
                    <div style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white' }}>{label}</div>
                    <div style={{ ...mono, fontSize: '10px', color: T3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {serviceCounts[metier] ? `${serviceCounts[metier]} artisan${serviceCounts[metier] > 1 ? 's' : ''}` : 'Disponible'}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ━━━━ HOW IT WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: BG1, padding: '80px 16px' }}>
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.7fr] gap-16 items-start">

            {/* Left heading */}
            <div className="md:sticky md:top-24">
              <span style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>COMMENT ÇA MARCHE</span>
              <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(28px, 3.5vw, 42px)', lineHeight: 1.05, color: 'white', marginTop: '12px', marginBottom: '16px' }}>
                Simple.<br />Rapide.<br />Sécurisé.
              </h2>
              <p style={{ ...body, fontSize: '14px', color: T2, lineHeight: 1.7, maxWidth: '38ch' }}>
                De la description du problème à la validation finale, tout se passe sur AfriOne.
                Transparent, à chaque étape.
              </p>
              <Link href="/diagnostic"
                className="liquid-glass-strong rounded-lg inline-flex items-center gap-2"
                style={{ ...syne, padding: '11px 22px', marginTop: '32px', fontSize: '14px', fontWeight: 700, color: 'white', textDecoration: 'none', cursor: 'pointer' }}>
                Essayer maintenant <ArrowRight size={15} />
              </Link>
            </div>

            {/* Right steps */}
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
              className="flex flex-col gap-3">
              {STEPS.map((step) => {
                const { Icon } = step
                return (
                  <motion.div key={step.num} variants={fadeUp}
                    className="liquid-glass rounded-2xl flex gap-5"
                    style={{ padding: '20px 24px' }}>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', paddingTop: '2px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(232,93,38,0.1)', border: '1px solid rgba(232,93,38,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={19} style={{ color: '#E85D26' }} />
                      </div>
                      <span style={{ ...mono, fontSize: '9px', color: 'rgba(232,93,38,0.4)', letterSpacing: '0.05em' }}>{step.num}</span>
                    </div>
                    <div style={{ paddingTop: '4px' }}>
                      <h3 style={{ ...syne, fontWeight: 700, fontSize: '16px', color: 'white', marginBottom: '6px' }}>{step.title}</h3>
                      <p style={{ ...body, fontSize: '13px', color: T2, lineHeight: 1.65 }}>{step.desc}</p>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ━━━━ TOP ARTISANS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: BG0, padding: '80px 16px' }}>
        <div className="page-container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ARTISANS EN VEDETTE</span>
              <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(26px, 3vw, 40px)', color: 'white', marginTop: '8px' }}>Les mieux notés</h2>
              <p style={{ ...body, fontSize: '14px', color: T2, marginTop: '4px' }}>Tous vérifiés, tous fiables</p>
            </div>
            <Link href="/artisans"
              className="hidden sm:flex items-center gap-1 font-semibold hover:gap-2 transition-all"
              style={{ fontSize: '14px', cursor: 'pointer', textDecoration: 'none', color: '#E85D26' }}>
              Voir tous <ChevronRight size={15} />
            </Link>
          </div>

          {loadingArtisans ? (
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
              <div className="liquid-glass rounded-2xl animate-pulse" style={{ padding: '24px', minHeight: '220px' }} />
              <div className="flex flex-col gap-4">
                {[1, 2].map(i => <div key={i} className="liquid-glass rounded-2xl animate-pulse" style={{ height: '96px' }} />)}
              </div>
            </div>
          ) : topArtisans.length > 0 ? (
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">

              {/* Featured artisan */}
              {topArtisans[0] && (() => {
                const a = topArtisans[0]
                const MetierIcon = METIER_ICON_MAP[a.metier] || Wrench
                return (
                  <motion.div variants={fadeUp}
                    className="liquid-glass rounded-2xl"
                    style={{ padding: '24px', transition: 'background 0.2s', cursor: 'default' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.07)', flexShrink: 0 }}>
                        {a.users?.avatar_url
                          ? <img src={a.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : <MetierIcon size={26} style={{ color: '#E85D26' }} />
                        }
                      </div>
                      <span className="badge-green">Vérifié</span>
                    </div>
                    <h3 style={{ ...syne, fontWeight: 700, fontSize: '20px', color: 'white', marginBottom: '4px' }}>
                      {a.users?.name || a.metier}
                    </h3>
                    <div className="flex items-center gap-2 mb-6" style={{ ...body, fontSize: '13px', color: T2 }}>
                      <span>{a.metier}</span>
                      {a.users?.quartier && (
                        <><span style={{ color: BO }}>·</span><MapPin size={11} /><span>{a.users.quartier}</span></>
                      )}
                    </div>
                    <div className="flex items-center gap-5 pt-4 mb-6" style={{ borderTop: `1px solid ${BO}` }}>
                      <div className="flex items-center gap-1">
                        <Star size={14} style={{ color: '#C9A84C', fill: '#C9A84C' }} />
                        <span style={{ ...syne, fontWeight: 600, fontSize: '14px', color: 'white' }}>
                          {(a.rating_avg || 0).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1" style={{ ...body, fontSize: '13px', color: T2 }}>
                        <CheckCircle size={12} style={{ color: '#2B6B3E' }} />
                        {a.mission_count || 0} missions
                      </div>
                      {a.tarif_min > 0 && (
                        <div className="ml-auto" style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white' }}>
                          Dès {a.tarif_min.toLocaleString()} F
                        </div>
                      )}
                    </div>
                    <Link href={`/artisans/${a.id}`} className="btn-primary block text-center"
                      style={{ fontSize: '14px', padding: '12px', cursor: 'pointer', textDecoration: 'none' }}>
                      Voir le profil <ArrowRight size={14} className="inline ml-1" />
                    </Link>
                  </motion.div>
                )
              })()}

              {/* Two compact artisans */}
              <div className="flex flex-col gap-3">
                {topArtisans.slice(1, 3).map(a => {
                  const MetierIcon = METIER_ICON_MAP[a.metier] || Wrench
                  return (
                    <motion.div key={a.id} variants={fadeUp}
                      className="liquid-glass rounded-2xl"
                      style={{ padding: '16px 20px', transition: 'background 0.2s', cursor: 'default' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.07)' }}>
                          {a.users?.avatar_url
                            ? <img src={a.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            : <MetierIcon size={18} style={{ color: '#E85D26' }} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.users?.name || a.metier}
                          </div>
                          <div style={{ ...body, fontSize: '12px', color: T2, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            {a.metier}
                            {a.users?.quartier && <><span style={{ color: BO }}>·</span><MapPin size={10} />{a.users.quartier}</>}
                          </div>
                        </div>
                        <span className="badge-green flex-shrink-0" style={{ fontSize: '11px' }}>Vérifié</span>
                      </div>
                      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${BO}` }}>
                        <div className="flex items-center gap-1">
                          <Star size={12} style={{ color: '#C9A84C', fill: '#C9A84C' }} />
                          <span style={{ ...syne, fontWeight: 600, fontSize: '13px', color: 'white' }}>{(a.rating_avg || 0).toFixed(1)}</span>
                        </div>
                        <span style={{ ...body, fontSize: '12px', color: T2 }}>{a.mission_count || 0} missions</span>
                        <Link href={`/artisans/${a.id}`}
                          className="ml-auto flex items-center gap-1 hover:gap-2 transition-all"
                          style={{ fontSize: '12px', fontWeight: 600, color: '#E85D26', cursor: 'pointer', textDecoration: 'none' }}>
                          Voir <ChevronRight size={12} />
                        </Link>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-16 rounded-2xl" style={{ border: `1.5px dashed ${BO}` }}>
              <Wrench size={28} style={{ color: T3, margin: '0 auto 16px' }} />
              <p style={{ ...body, fontSize: '15px', color: T2, marginBottom: '24px' }}>
                Nos artisans complètent leur inscription — revenez bientôt !
              </p>
              <Link href="/diagnostic" className="btn-primary inline-flex items-center gap-2" style={{ cursor: 'pointer', textDecoration: 'none' }}>
                Décrire mon besoin <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ━━━━ TRUST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: BG1, padding: '80px 16px' }}>
        <div className="page-container">
          <div className="mb-12">
            <span style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>POURQUOI AFRIONE</span>
            <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(26px, 3.5vw, 42px)', lineHeight: 1.05, color: 'white', marginTop: '8px', maxWidth: '20ch' }}>
              Construit pour que vous ayez confiance.
            </h2>
          </div>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TRUST_PILLARS.map(({ Icon, title, desc, stat, color, bg }) => (
              <motion.div key={title} variants={fadeUp}
                className="liquid-glass rounded-2xl p-6"
                style={{ background: bg, border: `1px solid ${color}20` }}>
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div>
                    <h3 style={{ ...syne, fontWeight: 700, fontSize: '16px', color: 'white', marginBottom: '4px' }}>{title}</h3>
                    <span style={{ ...mono, fontSize: '10px', color, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat}</span>
                  </div>
                </div>
                <p style={{ ...body, fontSize: '13px', color: T2, lineHeight: 1.65, paddingLeft: '56px' }}>{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ━━━━ ENTREPRISES PARTENAIRES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {topEntreprises.length > 0 && (
        <section style={{ background: BG0, padding: '80px 16px' }}>
          <div className="page-container">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>STRUCTURES PARTENAIRES</span>
                <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(26px, 3vw, 40px)', color: 'white', marginTop: '8px' }}>Entreprises multi-corps</h2>
                <p style={{ ...body, fontSize: '14px', color: T2, marginTop: '4px' }}>Des équipes complètes pour vos grands travaux</p>
              </div>
              <Link href="/entreprises"
                className="hidden sm:flex items-center gap-1 font-semibold hover:gap-2 transition-all"
                style={{ fontSize: '14px', cursor: 'pointer', textDecoration: 'none', color: '#C9A84C' }}>
                Voir tout <ChevronRight size={15} />
              </Link>
            </div>

            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {topEntreprises.slice(0, 2).map(e => (
                  <motion.div key={e.id} variants={fadeUp}>
                    <Link href={`/entreprise-space/dashboard?id=${e.id}`} style={{ textDecoration: 'none' }}>
                      <div className="liquid-glass rounded-2xl overflow-hidden group"
                        style={{ transition: 'background 0.2s', cursor: 'pointer' }}
                        onMouseEnter={el => (el.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}
                        onMouseLeave={el => (el.currentTarget as HTMLElement).style.background = ''}>
                        <div style={{ height: '110px', overflow: 'hidden', background: e.banner_url ? '#0A0A08' : 'linear-gradient(135deg, #1A2F1E, #0F1E14)', position: 'relative' }}>
                          {e.banner_url
                            ? <img src={e.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} />
                            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Building2 size={36} style={{ color: 'rgba(255,255,255,0.07)' }} />
                              </div>
                          }
                        </div>
                        <div style={{ padding: '16px 20px 20px' }}>
                          <div className="flex items-start justify-between mb-2">
                            <h3 style={{ ...syne, fontWeight: 700, fontSize: '15px', color: 'white' }}>{e.name}</h3>
                            <span className="badge-green" style={{ flexShrink: 0, marginLeft: '8px', fontSize: '11px' }}>Vérifié</span>
                          </div>
                          {e.description && (
                            <p style={{ ...body, fontSize: '12px', color: T2, marginBottom: '10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                              {e.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                            {(e.secteurs || []).slice(0, 3).map((s: string) => (
                              <span key={s} style={{ ...body, fontSize: '11px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${BO}`, padding: '2px 8px', borderRadius: '10px', color: T2 }}>{s}</span>
                            ))}
                            {(e.secteurs || []).length > 3 && <span style={{ ...body, fontSize: '11px', color: T3 }}>+{e.secteurs.length - 3}</span>}
                          </div>
                          <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${BO}` }}>
                            <span style={{ ...body, fontSize: '12px', color: T2 }}>{(e.artisan_pros || []).length} artisan{(e.artisan_pros || []).length !== 1 ? 's' : ''}</span>
                            <span style={{ ...syne, fontSize: '12px', fontWeight: 600, color: '#C9A84C' }}>Voir l'équipe →</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {topEntreprises[2] && (
                <motion.div variants={fadeUp}>
                  <Link href={`/entreprise-space/dashboard?id=${topEntreprises[2].id}`} style={{ textDecoration: 'none' }}>
                    <div className="liquid-glass rounded-2xl flex items-center gap-4"
                      style={{ padding: '14px 20px', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <div style={{ width: '48px', height: '48px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: topEntreprises[2].banner_url ? '#0A0A08' : 'linear-gradient(135deg,#1A2F1E,#0F1E14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {topEntreprises[2].banner_url
                          ? <img src={topEntreprises[2].banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} />
                          : <Building2 size={18} style={{ color: 'rgba(255,255,255,0.15)' }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white' }}>{topEntreprises[2].name}</div>
                        <div style={{ ...body, fontSize: '12px', color: T2, marginTop: '2px' }}>
                          {(topEntreprises[2].artisan_pros || []).length} artisans
                          {(topEntreprises[2].secteurs || []).length > 0 && ` · ${(topEntreprises[2].secteurs || []).slice(0, 2).join(', ')}`}
                        </div>
                      </div>
                      <span className="badge-green flex-shrink-0" style={{ fontSize: '11px' }}>Vérifié</span>
                      <ChevronRight size={14} style={{ color: T3, flexShrink: 0 }} />
                    </div>
                  </Link>
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ━━━━ CTA ENTREPRISE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: topEntreprises.length > 0 ? BG1 : BG0, padding: '64px 16px' }}>
        <div className="page-container">
          <div className="rounded-2xl p-10 flex flex-wrap items-center justify-between gap-8"
            style={{ background: 'linear-gradient(135deg, #151208 0%, #1E1A08 55%, #151208 100%)', border: `1px solid rgba(201,168,76,0.12)` }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div className="flex items-center gap-3 mb-4">
                <div style={{ width: '34px', height: '34px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={16} style={{ color: '#C9A84C' }} />
                </div>
                <span style={{ ...mono, fontSize: '11px', color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  Structures professionnelles
                </span>
              </div>
              <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(22px, 2.5vw, 30px)', lineHeight: 1.15, color: 'white', marginBottom: '10px' }}>
                Vous gérez une équipe<br />d'artisans ?
              </h2>
              <p style={{ ...body, fontSize: '14px', color: T2, lineHeight: 1.7, maxWidth: '46ch' }}>
                Créez un espace entreprise sur AfriOne. Gérez vos artisans, vos missions
                et accédez à des clients professionnels à Abidjan.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
              <Link href="/entreprise-space/register"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#C9A84C', borderRadius: '6px', color: '#0F1410', fontSize: '14px', fontWeight: 700, textDecoration: 'none', cursor: 'pointer', transition: 'opacity 0.15s', whiteSpace: 'nowrap', ...syne }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                <Building2 size={15} /> Créer mon espace entreprise
              </Link>
              <p style={{ ...mono, fontSize: '11px', color: T3, textAlign: 'center' }}>Validation sous 24h · Gratuit</p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━ CTA ARTISAN + FAQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: BG0, padding: '80px 16px' }}>
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-8 items-stretch">

            {/* Gradient CTA card — afrione-gradient stays */}
            <div className="afrione-gradient rounded-2xl py-16 px-10 flex flex-col justify-center items-center text-center"
              style={{ boxShadow: '0 20px 60px rgba(232,93,38,0.3)' }}>
              <p style={{ ...mono, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.65)', marginBottom: '16px' }}>
                Pour les artisans
              </p>
              <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(28px, 3.5vw, 46px)', lineHeight: 1, letterSpacing: '-0.03em', color: 'white', marginBottom: '16px' }}>
                Rejoignez des centaines<br />d'artisans à Abidjan.
              </h2>
              <p style={{ ...body, fontSize: '15px', color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, marginBottom: '32px', maxWidth: '38ch' }}>
                Inscription gratuite. Accédez à vos premiers clients qualifiés dès aujourd'hui. Paiement garanti par AfriOne.
              </p>
              <Link href="/auth"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '13px 28px', background: '#0F1410', borderRadius: '6px',
                  color: 'white', fontSize: '14px', fontWeight: 700, ...syne,
                  textDecoration: 'none', cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)', transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.5)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)' }}>
                S'inscrire gratuitement <ArrowRight size={15} />
              </Link>
            </div>

            {/* FAQ accordion */}
            <div className="flex flex-col justify-center gap-2">
              <p style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
                Questions fréquentes
              </p>
              {FAQ_ITEMS.map((item, i) => {
                const isOpen = faqOpen === i
                return (
                  <div key={i}
                    onClick={() => setFaqOpen(isOpen ? null : i)}
                    className="liquid-glass rounded-xl"
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      background: isOpen ? 'rgba(255,255,255,0.08)' : '',
                    }}>
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white', lineHeight: 1.35 }}>{item.q}</span>
                      {isOpen
                        ? <ChevronUp size={16} style={{ color: '#E85D26', flexShrink: 0 }} />
                        : <ChevronDown size={16} style={{ color: T3, flexShrink: 0 }} />
                      }
                    </div>
                    {isOpen && (
                      <p style={{ ...body, marginTop: '10px', fontSize: '13px', color: T2, lineHeight: 1.65 }}>
                        {item.a}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer style={{ background: '#08080A', borderTop: `1px solid ${BO}` }}>
        <div className="page-container" style={{ paddingTop: '64px', paddingBottom: '20px' }}>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_2fr] gap-10" style={{ marginBottom: '48px' }}>

            {/* Logo + baseline */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-accent rounded flex items-center justify-center" style={{ background: '#E85D26' }}>
                  <Zap size={13} color="white" />
                </div>
                <span style={{ ...syne, fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em', color: 'white' }}>
                  AFRI<span style={{ color: '#E85D26' }}>ONE</span>
                </span>
              </div>
              <p style={{ ...body, fontSize: '13px', color: T2, lineHeight: 1.65, maxWidth: '200px' }}>
                La plateforme des artisans vérifiés à Abidjan. Rapide, sécurisé, transparent.
              </p>
            </div>

            {/* Navigation */}
            <div>
              <h4 style={{ ...syne, fontWeight: 700, fontSize: '13px', color: 'white', marginBottom: '16px', letterSpacing: '-0.01em' }}>Plateforme</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { href: '/artisans',    label: 'Artisans'          },
                  { href: '/entreprises', label: 'Entreprises'        },
                  { href: '/diagnostic',  label: 'Diagnostic'         },
                  { href: '/aide',        label: 'Comment ça marche'  },
                ].map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href}
                      style={{ ...body, fontSize: '13px', color: T2, textDecoration: 'none', transition: 'color 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T2}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 style={{ ...syne, fontWeight: 700, fontSize: '13px', color: 'white', marginBottom: '16px', letterSpacing: '-0.01em' }}>Légal</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { href: '/aide', label: 'CGU'             },
                  { href: '/aide', label: 'Confidentialité' },
                  { href: '/aide', label: 'Contact'         },
                ].map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href}
                      style={{ ...body, fontSize: '13px', color: T2, textDecoration: 'none', transition: 'color 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T2}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Espaces */}
            <div>
              <h4 style={{ ...syne, fontWeight: 700, fontSize: '13px', color: 'white', marginBottom: '16px', letterSpacing: '-0.01em' }}>Votre espace</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link href="/artisan-space/dashboard"
                  className="liquid-glass rounded-lg inline-flex items-center gap-2"
                  style={{ padding: '9px 14px', fontSize: '13px', color: 'white', textDecoration: 'none', cursor: 'pointer', ...syne, fontWeight: 600, transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                  <Wrench size={13} style={{ color: '#E85D26' }} /> Espace artisan
                </Link>
                <Link href="/entreprise-space/register"
                  className="liquid-glass rounded-lg inline-flex items-center gap-2"
                  style={{ padding: '9px 14px', fontSize: '13px', color: 'white', textDecoration: 'none', cursor: 'pointer', ...syne, fontWeight: 600, transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                  <Building2 size={13} style={{ color: '#C9A84C' }} /> Espace entreprise
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderTop: `1px solid ${BO}`, paddingTop: '20px', paddingBottom: '8px' }}>
            <p style={{ ...mono, fontSize: '11px', color: T3 }}>
              © 2025 AFRIONE · Abidjan, Côte d'Ivoire · Tous droits réservés
            </p>
            <p style={{ ...mono, fontSize: '11px', color: T3 }}>
              Artisans vérifiés · Paiement Wave · KYC
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
