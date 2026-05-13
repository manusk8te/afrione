'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import {
  ArrowRight, Shield, Zap, Star, CheckCircle, ChevronRight, Building2,
  Droplets, Hammer, Paintbrush, Ruler, Wind, Lock, LayoutGrid,
  Cpu, Users, CreditCard, Camera, Wrench, MapPin, Clock,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

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

const TRUST_PILLARS = [
  {
    Icon: Shield,
    title: 'Artisans vérifiés KYC',
    desc: "Chaque artisan passe une vérification d'identité et de compétence avant d'être admis sur la plateforme.",
    stat: '100% contrôlés',
    color: '#2B6B3E',
    bg: 'rgba(43,107,62,0.08)',
  },
  {
    Icon: CreditCard,
    title: 'Escrow Wave',
    desc: "Votre argent est sécurisé jusqu'à la fin de la mission. Libéré uniquement après votre validation.",
    stat: 'Paiement garanti',
    color: '#E85D26',
    bg: 'rgba(232,93,38,0.08)',
  },
  {
    Icon: Star,
    title: 'Qualité garantie',
    desc: 'Chaque mission est notée. Les artisans sous 3/5 sont automatiquement suspendus de la plateforme.',
    stat: '4.8★ en moyenne',
    color: '#C9A84C',
    bg: 'rgba(201,168,76,0.08)',
  },
  {
    Icon: Clock,
    title: 'Réponse en 30 min',
    desc: 'Un artisan qualifié de votre quartier vous contacte en moins de 30 minutes après votre demande.',
    stat: 'Rapide et local',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
  },
]

const MARQUEE_ITEMS = [
  'Plomberie', 'Électricité', 'Maçonnerie', 'Peinture', 'Menuiserie',
  'Climatisation', 'Serrurerie', 'Carrelage', 'Soudure', 'Toiture',
  'Cocody', 'Yopougon', 'Plateau', 'Adjamé', 'Marcory',
]

/* ─── Animation variants ──────────────────────────────────────────────────── */

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const fadeUp  = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0,  transition: { type: 'spring' as const, stiffness: 90, damping: 18 } },
}
const fadeIn  = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.4 } },
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [stats, setStats]             = useState({ artisans: 500, missions: 2400, rating: 4.8, satisfaction: 98 })
  const [topArtisans, setTopArtisans] = useState<any[]>([])
  const [topEntreprises, setTopEntreprises] = useState<any[]>([])
  const [serviceCounts, setServiceCounts]   = useState<Record<string, number>>({})
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
      setStats({
        artisans:     Math.max(artisanCount || 0, 500),
        missions:     Math.max(missionCount  || 0, 2400),
        rating:       avgRating || 4.8,
        satisfaction: 98,
      })
    }

    const fetchArtisans = async () => {
      const [artisanRes, entrepriseRes] = await Promise.all([
        supabase
          .from('artisan_pros')
          .select('id, metier, tarif_min, tarif_max, rating_avg, mission_count, users!artisan_pros_user_id_fkey(name, quartier, avatar_url)')
          .eq('kyc_status', 'approved')
          .order('rating_avg', { ascending: false })
          .limit(3),
        supabase
          .from('entreprises')
          .select('id, name, description, banner_url, secteurs, artisan_pros(id)')
          .eq('kyc_status', 'approved')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(3),
      ])
      setTopArtisans(artisanRes.data || [])
      setTopEntreprises(entrepriseRes.data || [])
      setLoadingArtisans(false)
    }

    fetchStats()
    fetchArtisans()
  }, [])

  const STATS_DISPLAY = [
    { value: `${stats.artisans}+`, label: 'Artisans vérifiés' },
    { value: `${stats.rating}★`,   label: 'Note moyenne'      },
    { value: `${stats.missions.toLocaleString()}+`, label: 'Missions' },
    { value: `${stats.satisfaction}%`, label: 'Clients satisfaits' },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      {/* ━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="min-h-[100dvh] flex items-start md:items-center pt-24 pb-16 px-4 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-12 right-[3%] w-[560px] h-[560px] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(232,93,38,0.07) 0%, transparent 70%)' }} />
          <div className="absolute bottom-20 left-4 w-[300px] h-[300px] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(43,107,62,0.06) 0%, transparent 70%)' }} />
        </div>

        <div className="page-container relative w-full">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_420px] gap-12 xl:gap-20 items-center">

            {/* Left: content */}
            <motion.div variants={stagger} initial="hidden" animate="show">
              {/* Badge */}
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 mb-8"
                style={{ background: 'rgba(232,93,38,0.08)', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '40px', padding: '6px 14px 6px 10px' }}>
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse-soft flex-shrink-0" />
                <span className="font-mono text-xs text-accent tracking-wider">PLATEFORME #1 À ABIDJAN</span>
              </motion.div>

              {/* Headline */}
              <motion.h1 variants={fadeUp}
                className="font-display font-bold text-dark tracking-tight leading-[0.9]"
                style={{ fontSize: 'clamp(40px, 6vw, 76px)', marginBottom: '20px' }}>
                Trouver le bon<br />
                <span className="text-accent">artisan</span>,<br />
                au bon prix.
              </motion.h1>

              {/* Subtitle */}
              <motion.p variants={fadeUp}
                className="font-body text-muted leading-relaxed"
                style={{ fontSize: '17px', maxWidth: '50ch', marginBottom: '32px' }}>
                Artisans vérifiés, prix transparents, paiement sécurisé via Wave.
                Votre chantier, géré de bout en bout.
              </motion.p>

              {/* Primary CTAs */}
              <motion.div variants={fadeUp} className="flex flex-wrap gap-3" style={{ marginBottom: '28px' }}>
                <Link href="/diagnostic"
                  className="btn-primary"
                  style={{ fontSize: '15px', padding: '13px 26px', cursor: 'pointer' }}>
                  Décrire mon problème <ArrowRight size={17} />
                </Link>
                <Link href="/artisans"
                  className="btn-outline"
                  style={{ fontSize: '15px', padding: '13px 26px', cursor: 'pointer' }}>
                  Voir les artisans
                </Link>
              </motion.div>

              {/* Quick service chips */}
              <motion.div variants={fadeUp}>
                <p className="font-mono text-xs text-muted uppercase tracking-widest mb-3">
                  Accès direct
                </p>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map(({ Icon, label, metier }) => (
                    <Link key={metier} href={`/artisans?metier=${encodeURIComponent(metier)}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 500,
                        background: 'white', border: '1px solid #D8D2C4', color: '#1A1A1A',
                        cursor: 'pointer', textDecoration: 'none', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.borderColor = '#E85D26'
                        el.style.color = '#E85D26'
                        el.style.background = 'rgba(232,93,38,0.05)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.borderColor = '#D8D2C4'
                        el.style.color = '#1A1A1A'
                        el.style.background = 'white'
                      }}>
                      <Icon size={13} />
                      {label}
                    </Link>
                  ))}
                </div>
              </motion.div>

              {/* Trust micro-line */}
              <motion.div variants={fadeUp} className="flex flex-wrap gap-5 mt-8">
                {[
                  { Icon: Shield,      text: 'Artisans vérifiés KYC', color: 'text-accent2' },
                  { Icon: Zap,         text: 'Réponse en 30 min',     color: 'text-accent'  },
                  { Icon: CheckCircle, text: 'Paiement sécurisé Wave', color: 'text-accent2' },
                ].map(({ Icon, text, color }) => (
                  <div key={text} className="flex items-center gap-2">
                    <Icon size={14} className={color} />
                    <span style={{ fontSize: '13px', color: '#7A7A6E' }}>{text}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right: stats panel (desktop) */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 65, damping: 17, delay: 0.4 }}
              className="hidden md:block"
            >
              <div className="bg-dark rounded-xl p-7 relative overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                {/* Glow */}
                <div className="absolute top-0 right-0 w-52 h-52 rounded-full blur-3xl pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(232,93,38,0.12) 0%, transparent 70%)' }} aria-hidden="true" />

                <p className="font-mono uppercase tracking-widest mb-5 relative"
                  style={{ fontSize: '10px', color: 'rgba(250,250,245,0.35)' }}>
                  Activité en direct
                </p>

                {/* Stats 2×2 */}
                <div className="grid grid-cols-2 gap-px rounded-lg overflow-hidden mb-5 relative"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {STATS_DISPLAY.map(s => (
                    <div key={s.label} className="bg-dark2 p-5">
                      <div className="font-display font-bold text-accent"
                        style={{ fontSize: '30px', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {s.value}
                      </div>
                      <div className="font-mono mt-1"
                        style={{ fontSize: '10px', color: 'rgba(250,250,245,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 pt-4 relative"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  <span className="font-mono" style={{ fontSize: '10px', color: 'rgba(250,250,245,0.35)' }}>
                    Plateforme opérationnelle · Abidjan
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Mobile stats strip */}
          <div className="md:hidden grid grid-cols-2 gap-3 mt-10">
            {STATS_DISPLAY.map(s => (
              <div key={s.label} className="bg-dark rounded-lg p-4"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="font-display font-bold text-accent" style={{ fontSize: '24px' }}>{s.value}</div>
                <div className="font-mono mt-0.5" style={{ fontSize: '10px', color: 'rgba(250,250,245,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━ MARQUEE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-dark overflow-hidden py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }} aria-hidden="true">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'flex', whiteSpace: 'nowrap', willChange: 'transform' }}
        >
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="font-mono"
              style={{ padding: '0 20px', fontSize: '11px', color: 'rgba(250,250,245,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {item}
              <span style={{ margin: '0 12px', color: '#E85D26', opacity: 0.5 }}>·</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* ━━━━ SERVICES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 px-4">
        <div className="page-container">
          <div className="mb-10">
            <span className="section-label">NOS SERVICES</span>
            <h2 className="font-display font-bold text-dark tracking-tight mt-2"
              style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', lineHeight: 1.05 }}>
              Tous vos services,<br />au même endroit.
            </h2>
            <p className="text-muted mt-3" style={{ maxWidth: '48ch', fontSize: '15px' }}>
              Des artisans qualifiés dans chaque corps de métier, disponibles à Abidjan.
            </p>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {SERVICES.map(({ Icon, label, metier }, i) => (
              <motion.div key={label} variants={fadeUp}>
                <Link href={`/artisans?metier=${encodeURIComponent(metier)}`}
                  className="card group block"
                  style={{ cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)', textDecoration: 'none' }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = 'translateY(-4px)'
                    el.style.borderColor = 'rgba(232,93,38,0.35)'
                    el.style.boxShadow = '0 8px 24px rgba(232,93,38,0.08)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = 'translateY(0)'
                    el.style.borderColor = '#D8D2C4'
                    el.style.boxShadow = 'none'
                  }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-bg2"
                    style={{ transition: 'background 0.2s' }}>
                    <Icon size={17} className="text-accent" />
                  </div>
                  <div className="font-display font-bold text-dark" style={{ fontSize: '14px', transition: 'color 0.2s' }}>
                    {label}
                  </div>
                  <div className="font-mono mt-1" style={{ fontSize: '11px', color: '#7A7A6E' }}>
                    {serviceCounts[metier]
                      ? `${serviceCounts[metier]} artisan${serviceCounts[metier] > 1 ? 's' : ''}`
                      : 'Disponible'}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ━━━━ HOW IT WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 px-4 bg-dark">
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.7fr] gap-16 items-start">

            {/* Left: heading (sticky on desktop) */}
            <div className="md:sticky md:top-24">
              <span className="font-mono text-xs text-muted uppercase tracking-wider">COMMENT ÇA MARCHE</span>
              <h2 className="font-display font-bold text-cream tracking-tight mt-3 mb-4"
                style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', lineHeight: 1.05 }}>
                Simple.<br />Rapide.<br />Sécurisé.
              </h2>
              <p className="text-muted leading-relaxed" style={{ fontSize: '14px', maxWidth: '38ch' }}>
                De la description du problème à la validation finale, tout se passe sur AfriOne.
                Transparent, à chaque étape.
              </p>
              <Link href="/diagnostic"
                className="btn-primary inline-flex items-center gap-2 mt-8"
                style={{ cursor: 'pointer' }}>
                Essayer maintenant <ArrowRight size={15} />
              </Link>
            </div>

            {/* Right: numbered steps */}
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
            >
              {STEPS.map((step, i) => {
                const { Icon } = step
                const isLast = i === STEPS.length - 1
                return (
                  <motion.div key={step.num} variants={fadeUp}
                    className="flex gap-5"
                    style={{ paddingBottom: !isLast ? '32px' : undefined, marginBottom: !isLast ? '32px' : undefined, borderBottom: !isLast ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
                    {/* Icon + number */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', paddingTop: '2px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'rgba(232,93,38,0.1)', border: '1px solid rgba(232,93,38,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={19} className="text-accent" />
                      </div>
                      <span className="font-mono" style={{ fontSize: '9px', color: 'rgba(232,93,38,0.35)', letterSpacing: '0.05em' }}>{step.num}</span>
                    </div>
                    {/* Text */}
                    <div style={{ paddingTop: '4px' }}>
                      <h3 className="font-display font-bold text-cream" style={{ fontSize: '17px', marginBottom: '6px' }}>
                        {step.title}
                      </h3>
                      <p className="text-muted leading-relaxed" style={{ fontSize: '14px' }}>{step.desc}</p>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ━━━━ TOP ARTISANS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 px-4">
        <div className="page-container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="section-label">ARTISANS EN VEDETTE</span>
              <h2 className="font-display font-bold text-dark tracking-tight mt-2"
                style={{ fontSize: 'clamp(26px, 3vw, 40px)' }}>
                Les mieux notés
              </h2>
              <p className="text-muted mt-1" style={{ fontSize: '14px' }}>Tous vérifiés, tous fiables</p>
            </div>
            <Link href="/artisans"
              className="hidden sm:flex items-center gap-1 text-accent font-semibold hover:gap-2 transition-all"
              style={{ fontSize: '14px', cursor: 'pointer', textDecoration: 'none' }}>
              Voir tous <ChevronRight size={15} />
            </Link>
          </div>

          {loadingArtisans ? (
            /* Skeleton matching 2fr+1fr layout */
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-5">
              <div className="card animate-pulse">
                <div className="w-16 h-16 rounded-2xl bg-bg2 mb-5" />
                <div className="h-5 bg-bg2 rounded-lg w-2/3 mb-2" />
                <div className="h-4 bg-bg2 rounded-lg w-1/2 mb-8" />
                <div className="h-px bg-bg2 mb-5" />
                <div className="h-11 bg-bg2 rounded-xl" />
              </div>
              <div className="flex flex-col gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="card animate-pulse flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-bg2 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 bg-bg2 rounded-lg w-2/3 mb-2" />
                      <div className="h-3 bg-bg2 rounded-lg w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : topArtisans.length > 0 ? (
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-5"
            >
              {/* Featured artisan */}
              {topArtisans[0] && (() => {
                const a = topArtisans[0]
                const MetierIcon = METIER_ICON_MAP[a.metier] || Wrench
                return (
                  <motion.div variants={fadeUp} className="card"
                    style={{ transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)', cursor: 'default' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-16 h-16 rounded-2xl bg-bg2 overflow-hidden flex items-center justify-center">
                        {a.users?.avatar_url
                          ? <img src={a.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : <MetierIcon size={26} className="text-accent" />
                        }
                      </div>
                      <span className="badge-green">Vérifié</span>
                    </div>

                    <h3 className="font-display font-bold text-dark" style={{ fontSize: '20px', marginBottom: '4px' }}>
                      {a.users?.name || a.metier}
                    </h3>
                    <div className="flex items-center gap-2 mb-6" style={{ fontSize: '13px', color: '#7A7A6E' }}>
                      <span>{a.metier}</span>
                      {a.users?.quartier && (
                        <>
                          <span style={{ color: '#D8D2C4' }}>·</span>
                          <MapPin size={11} />
                          <span>{a.users.quartier}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-5 pt-4 mb-6" style={{ borderTop: '1px solid #D8D2C4' }}>
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-gold fill-gold" />
                        <span className="font-semibold" style={{ fontSize: '14px' }}>
                          {(a.rating_avg || 0).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted" style={{ fontSize: '13px' }}>
                        <CheckCircle size={12} className="text-accent2" />
                        {a.mission_count || 0} missions
                      </div>
                      {a.tarif_min > 0 && (
                        <div className="ml-auto font-bold text-dark" style={{ fontSize: '14px' }}>
                          Dès {a.tarif_min.toLocaleString()} F
                        </div>
                      )}
                    </div>

                    <Link href={`/artisans/${a.id}`}
                      className="btn-primary block text-center"
                      style={{ fontSize: '14px', padding: '12px', cursor: 'pointer', textDecoration: 'none' }}>
                      Voir le profil <ArrowRight size={14} className="inline ml-1" />
                    </Link>
                  </motion.div>
                )
              })()}

              {/* Two compact artisans */}
              <div className="flex flex-col gap-4">
                {topArtisans.slice(1, 3).map(a => {
                  const MetierIcon = METIER_ICON_MAP[a.metier] || Wrench
                  return (
                    <motion.div key={a.id} variants={fadeUp} className="card"
                      style={{ transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)', cursor: 'default' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.07)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-bg2 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {a.users?.avatar_url
                            ? <img src={a.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            : <MetierIcon size={18} className="text-accent" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-bold text-dark truncate" style={{ fontSize: '14px' }}>
                            {a.users?.name || a.metier}
                          </div>
                          <div style={{ fontSize: '12px', color: '#7A7A6E', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            {a.metier}
                            {a.users?.quartier && <><span style={{ color: '#D8D2C4' }}>·</span><MapPin size={10} />{a.users.quartier}</>}
                          </div>
                        </div>
                        <span className="badge-green flex-shrink-0" style={{ fontSize: '11px' }}>Vérifié</span>
                      </div>
                      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid #D8D2C4' }}>
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-gold fill-gold" />
                          <span className="font-semibold" style={{ fontSize: '13px' }}>{(a.rating_avg || 0).toFixed(1)}</span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#7A7A6E' }}>{a.mission_count || 0} missions</span>
                        <Link href={`/artisans/${a.id}`}
                          className="ml-auto text-accent font-semibold flex items-center gap-1 hover:gap-2 transition-all"
                          style={{ fontSize: '12px', cursor: 'pointer', textDecoration: 'none' }}>
                          Voir <ChevronRight size={12} />
                        </Link>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-16 rounded-2xl" style={{ border: '1.5px dashed #D8D2C4' }}>
              <Wrench size={28} className="text-muted mx-auto mb-4" />
              <p className="text-muted mb-6" style={{ fontSize: '15px' }}>Nos artisans complètent leur inscription — revenez bientôt !</p>
              <Link href="/diagnostic" className="btn-primary inline-flex items-center gap-2" style={{ cursor: 'pointer', textDecoration: 'none' }}>
                Décrire mon besoin <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ━━━━ TRUST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 px-4 bg-dark">
        <div className="page-container">
          <div className="mb-12">
            <span className="font-mono text-xs text-muted uppercase tracking-wider">POURQUOI AFRIONE</span>
            <h2 className="font-display font-bold text-cream tracking-tight mt-2"
              style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', lineHeight: 1.05, maxWidth: '18ch' }}>
              Construit pour que vous ayez confiance.
            </h2>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-5"
          >
            {TRUST_PILLARS.map(({ Icon, title, desc, stat, color, bg }) => (
              <motion.div key={title} variants={fadeUp}
                className="rounded-xl p-6"
                style={{ background: bg, border: `1px solid ${color}22` }}>
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-cream" style={{ fontSize: '16px', marginBottom: '4px' }}>
                      {title}
                    </h3>
                    <span className="font-mono" style={{ fontSize: '10px', color, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {stat}
                    </span>
                  </div>
                </div>
                <p className="text-muted leading-relaxed" style={{ fontSize: '13px', paddingLeft: '56px' }}>
                  {desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ━━━━ ENTREPRISES PARTENAIRES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {topEntreprises.length > 0 && (
        <section className="py-20 px-4">
          <div className="page-container">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="section-label">STRUCTURES PARTENAIRES</span>
                <h2 className="font-display font-bold text-dark tracking-tight mt-2"
                  style={{ fontSize: 'clamp(26px, 3vw, 40px)' }}>
                  Entreprises multi-corps
                </h2>
                <p className="text-muted mt-1" style={{ fontSize: '14px' }}>Des équipes complètes pour vos grands travaux</p>
              </div>
              <Link href="/entreprises"
                className="hidden sm:flex items-center gap-1 text-accent font-semibold hover:gap-2 transition-all"
                style={{ fontSize: '14px', cursor: 'pointer', textDecoration: 'none' }}>
                Voir tout <ChevronRight size={15} />
              </Link>
            </div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              {/* First 2 side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
                {topEntreprises.slice(0, 2).map(e => (
                  <motion.div key={e.id} variants={fadeUp}>
                    <Link href={`/entreprise-space/dashboard?id=${e.id}`} style={{ textDecoration: 'none' }}>
                      <div className="card overflow-hidden group"
                        style={{ padding: 0, transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)', cursor: 'pointer' }}
                        onMouseEnter={el => { (el.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (el.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.09)' }}
                        onMouseLeave={el => { (el.currentTarget as HTMLElement).style.transform = ''; (el.currentTarget as HTMLElement).style.boxShadow = '' }}>
                        <div style={{ height: '120px', overflow: 'hidden', background: e.banner_url ? '#1A1A1A' : 'linear-gradient(135deg,#1A2F1E,#0F1410)', position: 'relative' }}>
                          {e.banner_url
                            ? <img src={e.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Building2 size={38} color="rgba(255,255,255,0.1)" />
                              </div>
                          }
                        </div>
                        <div style={{ padding: '16px 20px 20px' }}>
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-display font-bold text-dark" style={{ fontSize: '15px', transition: 'color 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#E85D26')}
                              onMouseLeave={e => (e.currentTarget.style.color = '')}>
                              {e.name}
                            </h3>
                            <span className="badge-green" style={{ flexShrink: 0, marginLeft: '8px', fontSize: '11px' }}>Vérifié</span>
                          </div>
                          {e.description && (
                            <p style={{ fontSize: '12px', color: '#7A7A6E', marginBottom: '10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                              {e.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                            {(e.secteurs || []).slice(0, 3).map((s: string) => (
                              <span key={s} style={{ fontSize: '11px', background: '#F5F3EE', border: '1px solid #D8D2C4', padding: '2px 8px', borderRadius: '10px', color: '#7A7A6E' }}>{s}</span>
                            ))}
                            {(e.secteurs || []).length > 3 && <span style={{ fontSize: '11px', color: '#7A7A6E' }}>+{e.secteurs.length - 3}</span>}
                          </div>
                          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #D8D2C4' }}>
                            <span style={{ fontSize: '12px', color: '#7A7A6E' }}>
                              {(e.artisan_pros || []).length} artisan{(e.artisan_pros || []).length !== 1 ? 's' : ''}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#E85D26' }}>Voir l'équipe →</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Third enterprise: horizontal compact card */}
              {topEntreprises[2] && (
                <motion.div variants={fadeUp}>
                  <Link href={`/entreprise-space/dashboard?id=${topEntreprises[2].id}`} style={{ textDecoration: 'none' }}>
                    <div className="card flex items-center gap-4 group"
                      style={{ padding: '14px 20px', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.07)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
                      <div style={{ width: '52px', height: '52px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: topEntreprises[2].banner_url ? '#1A1A1A' : 'linear-gradient(135deg,#1A2F1E,#0F1410)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {topEntreprises[2].banner_url
                          ? <img src={topEntreprises[2].banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                          : <Building2 size={20} color="rgba(255,255,255,0.18)" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-dark" style={{ fontSize: '14px' }}>{topEntreprises[2].name}</div>
                        <div style={{ fontSize: '12px', color: '#7A7A6E', marginTop: '2px' }}>
                          {(topEntreprises[2].artisan_pros || []).length} artisans
                          {(topEntreprises[2].secteurs || []).length > 0 && ` · ${(topEntreprises[2].secteurs || []).slice(0, 2).join(', ')}`}
                        </div>
                      </div>
                      <span className="badge-green flex-shrink-0" style={{ fontSize: '11px' }}>Vérifié</span>
                      <ChevronRight size={14} className="text-muted flex-shrink-0" style={{ transition: 'color 0.15s' }} />
                    </div>
                  </Link>
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ━━━━ CTA ENTREPRISE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className={`py-16 px-4 ${topEntreprises.length > 0 ? 'bg-bg2' : ''}`}>
        <div className="page-container">
          <div className="rounded-2xl p-10 flex flex-wrap items-center justify-between gap-8"
            style={{ background: 'linear-gradient(135deg, #0F1E14 0%, #1A2F1E 60%, #0F1E14 100%)', border: '1px solid rgba(96,165,250,0.12)' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div className="flex items-center gap-3 mb-4">
                <div style={{ width: '34px', height: '34px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={16} color="#60a5fa" />
                </div>
                <span className="font-mono" style={{ fontSize: '11px', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  Structures professionnelles
                </span>
              </div>
              <h2 className="font-display font-bold text-cream"
                style={{ fontSize: 'clamp(22px, 2.5vw, 30px)', lineHeight: 1.15, marginBottom: '10px' }}>
                Vous gérez une équipe<br />d'artisans ?
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(250,250,245,0.5)', lineHeight: 1.7, maxWidth: '46ch' }}>
                Créez un espace entreprise sur AfriOne. Gérez vos artisans, vos missions
                et accédez à des clients professionnels à Abidjan.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
              <Link href="/entreprise-space/register"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#60a5fa', borderRadius: '6px', color: 'white', fontSize: '14px', fontWeight: 700, textDecoration: 'none', cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap', fontFamily: "'Syne', sans-serif" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#3b82f6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#60a5fa'}>
                <Building2 size={15} /> Créer mon espace entreprise
              </Link>
              <p style={{ fontSize: '11px', color: 'rgba(250,250,245,0.28)', textAlign: 'center' }}>
                Validation sous 24h · Gratuit
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━ CTA ARTISAN + FAQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 px-4">
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-8 items-stretch">

            {/* Gradient CTA card */}
            <div className="afrione-gradient rounded-xl py-16 px-10 text-white flex flex-col justify-center items-center text-center"
              style={{ boxShadow: '0 10px 40px rgba(232,93,38,0.25)' }}>
              <p className="font-mono mb-4" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>
                Pour les artisans
              </p>
              <h2 className="font-display font-bold text-white"
                style={{ fontSize: 'clamp(28px, 3.5vw, 46px)', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '16px' }}>
                Rejoignez des centaines<br />d'artisans à Abidjan.
              </h2>
              <p style={{ fontSize: '15px', opacity: 0.82, lineHeight: 1.6, marginBottom: '32px', maxWidth: '38ch' }}>
                Inscription gratuite. Accédez à vos premiers clients qualifiés dès aujourd'hui. Paiement garanti par AfriOne.
              </p>
              <Link href="/auth"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '13px 28px', background: '#0F1410', borderRadius: '6px',
                  color: 'white', fontSize: '14px', fontWeight: 700,
                  fontFamily: "'Syne', sans-serif", textDecoration: 'none', cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.35)', transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 28px rgba(0,0,0,0.45)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 8px 20px rgba(0,0,0,0.35)' }}>
                S'inscrire gratuitement <ArrowRight size={15} />
              </Link>
            </div>

            {/* FAQ accordion */}
            <div className="flex flex-col justify-center gap-2">
              <p className="section-label mb-4">Questions fréquentes</p>
              {FAQ_ITEMS.map((item, i) => {
                const isOpen = faqOpen === i
                return (
                  <div key={i}
                    onClick={() => setFaqOpen(isOpen ? null : i)}
                    style={{
                      background: 'white',
                      border: `1px solid ${isOpen ? '#D8D2C4' : '#EDE8DE'}`,
                      borderRadius: '8px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isOpen ? '0 4px 14px rgba(0,0,0,0.05)' : '0 1px 4px rgba(0,0,0,0.03)',
                    }}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display font-bold text-dark" style={{ fontSize: '14px', lineHeight: 1.35 }}>
                        {item.q}
                      </span>
                      {isOpen
                        ? <ChevronUp size={17} className="text-accent flex-shrink-0" />
                        : <ChevronDown size={17} className="text-muted flex-shrink-0" />
                      }
                    </div>
                    {isOpen && (
                      <p style={{ marginTop: '10px', fontSize: '13px', color: '#7A7A6E', lineHeight: 1.65 }}>
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
      <footer style={{ background: '#FAFAF8', borderTop: '1px solid #EDE8DE' }}>
        <div className="page-container" style={{ paddingTop: '64px', paddingBottom: '20px' }}>

          {/* 4-col grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_2fr] gap-10" style={{ marginBottom: '48px' }}>

            {/* Logo + baseline */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-accent rounded flex items-center justify-center">
                  <Zap size={13} className="text-white fill-white" />
                </div>
                <span className="font-display font-bold text-dark" style={{ fontSize: '16px', letterSpacing: '-0.02em' }}>
                  AFRI<span className="text-accent">ONE</span>
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#7A7A6E', lineHeight: 1.65, maxWidth: '200px' }}>
                La plateforme des artisans vérifiés à Abidjan. Rapide, sécurisé, transparent.
              </p>
            </div>

            {/* Navigation */}
            <div>
              <h4 className="font-display font-bold text-dark" style={{ fontSize: '13px', marginBottom: '16px', letterSpacing: '-0.01em' }}>
                Plateforme
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { href: '/artisans',   label: 'Artisans'    },
                  { href: '/entreprises',label: 'Entreprises' },
                  { href: '/diagnostic', label: 'Diagnostic'  },
                  { href: '/aide',       label: 'Comment ça marche' },
                ].map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href} style={{ fontSize: '13px', color: '#7A7A6E', textDecoration: 'none', transition: 'color 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#7A7A6E'}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-display font-bold text-dark" style={{ fontSize: '13px', marginBottom: '16px', letterSpacing: '-0.01em' }}>
                Légal
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { href: '/aide', label: 'CGU'            },
                  { href: '/aide', label: 'Confidentialité'},
                  { href: '/aide', label: 'Contact'        },
                ].map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href} style={{ fontSize: '13px', color: '#7A7A6E', textDecoration: 'none', transition: 'color 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#7A7A6E'}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Espaces */}
            <div>
              <h4 className="font-display font-bold text-dark" style={{ fontSize: '13px', marginBottom: '16px', letterSpacing: '-0.01em' }}>
                Votre espace
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link href="/artisan-space/dashboard"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'white', border: '1px solid #D8D2C4', borderRadius: '6px', fontSize: '13px', color: '#1A1A1A', textDecoration: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontWeight: 600, transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#E85D26'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#D8D2C4'}>
                  <Wrench size={13} className="text-accent" /> Espace artisan
                </Link>
                <Link href="/entreprise-space/register"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'white', border: '1px solid #D8D2C4', borderRadius: '6px', fontSize: '13px', color: '#1A1A1A', textDecoration: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontWeight: 600, transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#60a5fa'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#D8D2C4'}>
                  <Building2 size={13} style={{ color: '#60a5fa' }} /> Espace entreprise
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderTop: '1px solid #EDE8DE', paddingTop: '20px', paddingBottom: '8px' }}>
            <p className="font-mono" style={{ fontSize: '11px', color: '#9A9A8E' }}>
              © 2025 AFRIONE · Abidjan, Côte d'Ivoire · Tous droits réservés
            </p>
            <p className="font-mono" style={{ fontSize: '11px', color: '#C0BAB0' }}>
              Artisans vérifiés · Paiement Wave · KYC
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
