'use client'
import { useState, useEffect, useRef } from 'react'
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

/* ─── BlurText ────────────────────────────────────────────────────────────── */
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
  { q: "Comment les artisans sont-ils vérifiés ?",   a: "Chaque artisan passe une vérification d'identité et de compétences avant d'être admis. Nous contrôlons leurs documents, leurs qualifications et vérifions leurs antécédents professionnels." },
  { q: "Comment fonctionne le paiement ?",           a: "Vous payez via Wave au moment de la réservation. Les fonds sont bloqués sur un compte séquestre jusqu'à la fin de la mission et libérés uniquement après votre validation." },
  { q: "Combien de temps pour trouver un artisan ?", a: "En général moins de 30 minutes après votre demande. Un artisan qualifié de votre quartier vous contacte directement par téléphone ou via l'application." },
  { q: "Que faire si je ne suis pas satisfait ?",    a: "Chaque mission est notée. Si la prestation ne correspond pas, notre équipe intervient sous 24h pour trouver une solution ou procéder au remboursement." },
  { q: "Dans quels quartiers êtes-vous disponibles ?", a: "Nous couvrons Cocody, Plateau, Marcory, Yopougon, Adjamé, Abobo, Treichville et leurs environs. La couverture s'étend régulièrement." },
]

const TRUST_PILLARS = [
  { Icon: Shield,     title: 'Artisans vérifiés KYC', desc: "Chaque artisan passe une vérification d'identité et de compétence avant d'être admis sur la plateforme.",          stat: '100% contrôlés',   color: '#2B6B3E' },
  { Icon: CreditCard, title: 'Escrow Wave',            desc: "Votre argent est sécurisé jusqu'à la fin de la mission. Libéré uniquement après votre validation.",                stat: 'Paiement garanti', color: '#E85D26' },
  { Icon: Star,       title: 'Qualité garantie',       desc: 'Chaque mission est notée. Les artisans sous 3/5 sont automatiquement suspendus de la plateforme.',                stat: '4.8★ en moyenne',  color: '#C9A84C' },
  { Icon: Clock,      title: 'Réponse en 30 min',      desc: 'Un artisan qualifié de votre quartier vous contacte en moins de 30 minutes après votre demande.',                 stat: 'Rapide et local',  color: '#C8B49A' },
]

/* ─── Animation variants ──────────────────────────────────────────────────── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } }
const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 90, damping: 18 } } }
const fadeIn  = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.5 } } }

/* ─── Design tokens — 100% white ─────────────────────────────────────────── */
const W   = '#FFFFFF'
const W2  = '#F5F7FA'
const T1  = '#3D4852'
const T2  = '#6B7280'
const T3  = '#8B95A5'
const BO  = '#E2E8F0'

const NEU_SHADOW    = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_HOVER     = '10px 10px 22px rgba(163,177,198,0.65), -6px -6px 16px rgba(255,255,255,1)'
const NEU_INSET     = 'inset 4px 4px 10px rgba(163,177,198,0.45), inset -4px -4px 8px rgba(255,255,255,0.9)'
const NEU_INSET_DEEP = 'inset 8px 8px 18px rgba(163,177,198,0.55), inset -6px -6px 12px rgba(255,255,255,0.95)'
const NEU_SMALL     = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

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
    { value: `${stats.artisans}+`,                  label: 'Artisans vérifiés' },
    { value: `${stats.rating}★`,                    label: 'Note moyenne'       },
    { value: `${stats.missions.toLocaleString()}+`, label: 'Missions réalisées' },
    { value: `${stats.satisfaction}%`,              label: 'Clients satisfaits' },
  ]

  const mono = { fontFamily: "'Space Mono', monospace" } as const
  const syne = { fontFamily: "'Syne', sans-serif" }      as const
  const body = { fontFamily: "'Bricolage Grotesque', sans-serif" } as const

  return (
    <div style={{ background: W, color: T1, minHeight: '100vh' }}>
      <Navbar />

      {/* ━━━━ HERO — fond orange animé ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="afrione-gradient" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-1 flex flex-col page-container">
          <div className="flex-1 flex flex-col items-center justify-center text-center pt-32 pb-10 px-4">
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center w-full">

              {/* Badge */}
              <motion.div variants={fadeUp}>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 20px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', marginBottom: '40px' }}>
                  <span style={{ ...mono, fontSize: '11px', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.1em' }}>PLATEFORME #1 · ABIDJAN</span>
                </div>
              </motion.div>

              {/* Headline */}
              <BlurText
                text="Trouvez le bon artisan au bon prix"
                style={{ fontSize: 'clamp(44px, 7.5vw, 92px)', lineHeight: 0.88, letterSpacing: '-0.04em', marginBottom: '28px', maxWidth: '16ch', ...syne, fontWeight: 700, color: 'white' }}
              />

              {/* Subtitle */}
              <motion.p variants={fadeUp}
                style={{ ...body, fontSize: '16px', maxWidth: '52ch', color: 'rgba(255,255,255,0.82)', marginBottom: '40px', lineHeight: 1.65 }}>
                Artisans vérifiés KYC, prix transparents, paiement sécurisé via Wave.
                Votre chantier, géré de bout en bout à Abidjan.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={fadeUp} className="flex flex-wrap gap-3 justify-center" style={{ marginBottom: '56px' }}>
                <Link href="/diagnostic"
                  style={{ ...syne, padding: '13px 28px', fontSize: '15px', fontWeight: 700, color: '#E85D26', textDecoration: 'none', cursor: 'pointer', background: 'white', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.2)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)' }}>
                  Décrire mon problème <ArrowRight size={16} />
                </Link>
                <Link href="/artisans"
                  style={{ ...syne, padding: '13px 28px', fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', transition: 'background 0.2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.28)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)'}>
                  <Play size={13} style={{ fill: 'currentColor' }} /> Voir les artisans
                </Link>
              </motion.div>

              {/* Stats */}
              <motion.div variants={stagger} className="flex flex-wrap gap-4 justify-center">
                {STATS_DISPLAY.map(s => (
                  <motion.div key={s.label} variants={fadeUp}>
                    <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '20px', padding: '20px', minWidth: '148px', textAlign: 'left' }}>
                      <div style={{ ...syne, fontWeight: 700, fontSize: '28px', color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {s.value}
                      </div>
                      <div style={{ ...mono, fontSize: '10px', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '8px' }}>
                        {s.label}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>

          {/* Bottom strip — trust + service chips */}
          <div className="pb-8 px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '24px' }}>
            <motion.div variants={stagger} initial="hidden" animate="show">

              <motion.div variants={fadeIn} className="flex flex-wrap gap-5 justify-center mb-6">
                {[
                  { Icon: Shield,      text: 'Artisans vérifiés KYC' },
                  { Icon: Zap,         text: 'Réponse en 30 min'     },
                  { Icon: CheckCircle, text: 'Paiement sécurisé Wave' },
                ].map(({ Icon, text }) => (
                  <div key={text} className="flex items-center gap-2">
                    <Icon size={13} style={{ color: 'rgba(255,255,255,0.7)' }} />
                    <span style={{ ...body, fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{text}</span>
                  </div>
                ))}
              </motion.div>

              <motion.div variants={fadeIn}>
                <p style={{ ...mono, fontSize: '10px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  Accès direct
                </p>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map(({ Icon, label, metier }) => (
                    <Link key={metier} href={`/artisans?metier=${encodeURIComponent(metier)}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderRadius: '999px', fontSize: '13px', color: 'rgba(255,255,255,0.88)', textDecoration: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.28)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)'}>
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
      <section style={{ background: W2, padding: '96px 0' }}>
        <div className="page-container">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>

            <motion.p variants={fadeUp} style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '20px' }}>
              // Services
            </motion.p>
            <motion.h2 variants={fadeUp}
              style={{ ...syne, fontWeight: 700, fontSize: 'clamp(48px, 7vw, 86px)', lineHeight: 0.9, letterSpacing: '-0.04em', color: T1, marginBottom: '60px' }}>
              Tous vos corps<br />de métier.
            </motion.h2>

            <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              {SERVICES.map(({ Icon, label, metier }) => (
                <motion.div key={label} variants={fadeUp}>
                  <Link href={`/artisans?metier=${encodeURIComponent(metier)}`}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px',
                      textDecoration: 'none', cursor: 'pointer',
                      background: W, borderRadius: '24px',
                      boxShadow: NEU_SHADOW,
                      transition: 'box-shadow 0.3s ease-out, transform 0.3s ease-out',
                    }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_HOVER; el.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_SHADOW; el.style.transform = '' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '16px', boxShadow: NEU_INSET, background: W, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div className="afrione-gradient rounded-xl flex items-center justify-center" style={{ width: '38px', height: '38px' }}>
                        <Icon size={17} color="white" />
                      </div>
                    </div>
                    <div style={{ ...syne, fontWeight: 700, fontSize: '14px', color: T1 }}>{label}</div>
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
      <section style={{ background: W, padding: '80px 16px' }}>
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.7fr] gap-16 items-start">

            <div className="md:sticky md:top-24">
              <span style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>COMMENT ÇA MARCHE</span>
              <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(28px, 3.5vw, 42px)', lineHeight: 1.05, color: T1, marginTop: '12px', marginBottom: '16px' }}>
                Simple.<br />Rapide.<br />Sécurisé.
              </h2>
              <p style={{ ...body, fontSize: '14px', color: T2, lineHeight: 1.7, maxWidth: '38ch' }}>
                De la description du problème à la validation finale, tout se passe sur AfriOne.
                Transparent, à chaque étape.
              </p>
              <Link href="/diagnostic" className="btn-primary"
                style={{ ...syne, marginTop: '32px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', cursor: 'pointer', borderRadius: '12px' }}>
                Essayer maintenant <ArrowRight size={15} />
              </Link>
            </div>

            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
              className="flex flex-col gap-4">
              {STEPS.map((step) => {
                const { Icon } = step
                return (
                  <motion.div key={step.num} variants={fadeUp}
                    style={{ background: W, borderRadius: '24px', padding: '22px 26px', display: 'flex', gap: '20px', boxShadow: NEU_SHADOW, transition: 'box-shadow 0.3s ease-out, transform 0.3s ease-out' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_HOVER; el.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_SHADOW; el.style.transform = '' }}>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', paddingTop: '2px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '16px', boxShadow: NEU_INSET, background: W, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="afrione-gradient" style={{ width: '38px', height: '38px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={19} color="white" />
                        </div>
                      </div>
                      <span style={{ ...mono, fontSize: '9px', color: 'rgba(232,93,38,0.55)', letterSpacing: '0.05em' }}>{step.num}</span>
                    </div>
                    <div style={{ paddingTop: '4px' }}>
                      <h3 style={{ ...syne, fontWeight: 700, fontSize: '16px', color: T1, marginBottom: '6px' }}>{step.title}</h3>
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
      <section style={{ background: W2, padding: '80px 16px' }}>
        <div className="page-container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ARTISANS EN VEDETTE</span>
              <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(26px, 3vw, 40px)', color: T1, marginTop: '8px' }}>Les mieux notés</h2>
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
              <div style={{ background: W, borderRadius: '28px', padding: '24px', minHeight: '220px', boxShadow: NEU_SHADOW }} className="animate-pulse" />
              <div className="flex flex-col gap-4">
                {[1, 2].map(i => <div key={i} style={{ background: W, borderRadius: '24px', height: '96px', boxShadow: NEU_SHADOW }} className="animate-pulse" />)}
              </div>
            </div>
          ) : topArtisans.length > 0 ? (
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">

              {topArtisans[0] && (() => {
                const a = topArtisans[0]
                const MetierIcon = METIER_ICON_MAP[a.metier] || Wrench
                return (
                  <motion.div variants={fadeUp}
                    style={{ background: W, borderRadius: '28px', padding: '24px', boxShadow: NEU_SHADOW, transition: 'box-shadow 0.3s ease-out, transform 0.3s ease-out', cursor: 'default' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_HOVER; el.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_SHADOW; el.style.transform = '' }}>
                    <div className="flex items-start justify-between mb-5">
                      <div style={{ width: '64px', height: '64px', borderRadius: '20px', boxShadow: NEU_INSET, background: W, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {a.users?.avatar_url
                          ? <img src={a.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : <MetierIcon size={26} style={{ color: '#E85D26' }} />
                        }
                      </div>
                      <span className="badge-green">Vérifié</span>
                    </div>
                    <h3 style={{ ...syne, fontWeight: 700, fontSize: '20px', color: T1, marginBottom: '4px' }}>
                      {a.users?.name || a.metier}
                    </h3>
                    <div className="flex items-center gap-2 mb-6" style={{ ...body, fontSize: '13px', color: T2 }}>
                      <span>{a.metier}</span>
                      {a.users?.quartier && <><span style={{ color: BO }}>·</span><MapPin size={11} /><span>{a.users.quartier}</span></>}
                    </div>
                    <div className="flex items-center gap-5 pt-4 mb-6" style={{ borderTop: `1px solid ${BO}` }}>
                      <div className="flex items-center gap-1">
                        <Star size={14} style={{ color: '#C9A84C', fill: '#C9A84C' }} />
                        <span style={{ ...syne, fontWeight: 600, fontSize: '14px', color: T1 }}>{(a.rating_avg || 0).toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1" style={{ ...body, fontSize: '13px', color: T2 }}>
                        <CheckCircle size={12} style={{ color: '#2B6B3E' }} />
                        {a.mission_count || 0} missions
                      </div>
                      {a.tarif_min > 0 && (
                        <div className="ml-auto" style={{ ...syne, fontWeight: 700, fontSize: '14px', color: T1 }}>
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

              <div className="flex flex-col gap-3">
                {topArtisans.slice(1, 3).map(a => {
                  const MetierIcon = METIER_ICON_MAP[a.metier] || Wrench
                  return (
                    <motion.div key={a.id} variants={fadeUp}
                      style={{ background: W, borderRadius: '24px', padding: '16px 20px', boxShadow: NEU_SHADOW, transition: 'box-shadow 0.3s ease-out, transform 0.3s ease-out', cursor: 'default' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_HOVER; el.style.transform = 'translateY(-1px)' }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_SHADOW; el.style.transform = '' }}>
                      <div className="flex items-center gap-3">
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', boxShadow: NEU_INSET, background: W, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {a.users?.avatar_url
                            ? <img src={a.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            : <MetierIcon size={18} style={{ color: '#E85D26' }} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ ...syne, fontWeight: 700, fontSize: '14px', color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                          <span style={{ ...syne, fontWeight: 600, fontSize: '13px', color: T1 }}>{(a.rating_avg || 0).toFixed(1)}</span>
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
            <div className="text-center py-16 rounded-[28px]" style={{ boxShadow: NEU_SHADOW, background: W }}>
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
      <section style={{ background: W, padding: '80px 16px' }}>
        <div className="page-container">
          <div className="mb-14">
            <span style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>POURQUOI AFRIONE</span>
            <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(26px, 3.5vw, 42px)', lineHeight: 1.05, color: T1, marginTop: '8px', maxWidth: '20ch' }}>
              Construit pour que vous ayez confiance.
            </h2>
          </div>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {TRUST_PILLARS.map(({ Icon, title, desc, stat, color }) => (
              <motion.div key={title} variants={fadeUp}
                style={{ background: W, borderRadius: '28px', padding: '28px', boxShadow: NEU_SHADOW, transition: 'box-shadow 0.3s ease-out, transform 0.3s ease-out' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_HOVER; el.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_SHADOW; el.style.transform = '' }}>
                <div className="flex items-start gap-4 mb-4">
                  <div style={{ width: '52px', height: '52px', borderRadius: '16px', boxShadow: NEU_INSET, background: W, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <div>
                    <h3 style={{ ...syne, fontWeight: 700, fontSize: '16px', color: T1, marginBottom: '4px' }}>{title}</h3>
                    <span style={{ ...mono, fontSize: '10px', color, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat}</span>
                  </div>
                </div>
                <p style={{ ...body, fontSize: '13px', color: T2, lineHeight: 1.65 }}>{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ━━━━ ENTREPRISES PARTENAIRES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {topEntreprises.length > 0 && (
        <section style={{ background: W2, padding: '80px 16px' }}>
          <div className="page-container">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span style={{ ...mono, fontSize: '11px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>STRUCTURES PARTENAIRES</span>
                <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(26px, 3vw, 40px)', color: T1, marginTop: '8px' }}>Entreprises multi-corps</h2>
                <p style={{ ...body, fontSize: '14px', color: T2, marginTop: '4px' }}>Des équipes complètes pour vos grands travaux</p>
              </div>
              <Link href="/entreprises"
                className="hidden sm:flex items-center gap-1 font-semibold hover:gap-2 transition-all"
                style={{ fontSize: '14px', cursor: 'pointer', textDecoration: 'none', color: '#E85D26' }}>
                Voir tout <ChevronRight size={15} />
              </Link>
            </div>

            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {topEntreprises.slice(0, 2).map(e => (
                  <motion.div key={e.id} variants={fadeUp}>
                    <Link href={`/entreprise-space/dashboard?id=${e.id}`} style={{ textDecoration: 'none' }}>
                      <div
                        style={{ background: W, borderRadius: '28px', overflow: 'hidden', boxShadow: NEU_SHADOW, transition: 'box-shadow 0.3s ease-out, transform 0.3s ease-out', cursor: 'pointer' }}
                        onMouseEnter={el => { (el.currentTarget as HTMLElement).style.boxShadow = NEU_HOVER; (el.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                        onMouseLeave={el => { (el.currentTarget as HTMLElement).style.boxShadow = NEU_SHADOW; (el.currentTarget as HTMLElement).style.transform = '' }}>
                        <div style={{ height: '110px', overflow: 'hidden', background: e.banner_url ? W : `linear-gradient(135deg, ${W2}, ${W})`, position: 'relative' }}>
                          {e.banner_url
                            ? <img src={e.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Building2 size={36} style={{ color: T3 }} />
                              </div>
                          }
                        </div>
                        <div style={{ padding: '16px 20px 20px' }}>
                          <div className="flex items-start justify-between mb-2">
                            <h3 style={{ ...syne, fontWeight: 700, fontSize: '15px', color: T1 }}>{e.name}</h3>
                            <span className="badge-green" style={{ flexShrink: 0, marginLeft: '8px', fontSize: '11px' }}>Vérifié</span>
                          </div>
                          {e.description && (
                            <p style={{ ...body, fontSize: '12px', color: T2, marginBottom: '10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                              {e.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                            {(e.secteurs || []).slice(0, 3).map((s: string) => (
                              <span key={s} style={{ ...body, fontSize: '11px', background: W, boxShadow: NEU_SMALL, padding: '2px 10px', borderRadius: '10px', color: T2 }}>{s}</span>
                            ))}
                            {(e.secteurs || []).length > 3 && <span style={{ ...body, fontSize: '11px', color: T3 }}>+{e.secteurs.length - 3}</span>}
                          </div>
                          <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${BO}` }}>
                            <span style={{ ...body, fontSize: '12px', color: T2 }}>{(e.artisan_pros || []).length} artisan{(e.artisan_pros || []).length !== 1 ? 's' : ''}</span>
                            <span style={{ ...syne, fontSize: '12px', fontWeight: 600, color: '#E85D26' }}>Voir l'équipe →</span>
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
                    <div
                      style={{ background: W, borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px', cursor: 'pointer', boxShadow: NEU_SHADOW, transition: 'box-shadow 0.3s ease-out, transform 0.3s ease-out' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_HOVER; el.style.transform = 'translateY(-1px)' }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = NEU_SHADOW; el.style.transform = '' }}>
                      <div style={{ width: '48px', height: '48px', flexShrink: 0, borderRadius: '12px', overflow: 'hidden', boxShadow: NEU_INSET, background: W, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {topEntreprises[2].banner_url
                          ? <img src={topEntreprises[2].banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Building2 size={18} style={{ color: T3 }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ ...syne, fontWeight: 700, fontSize: '14px', color: T1 }}>{topEntreprises[2].name}</div>
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
      <section style={{ background: W, padding: '64px 16px' }}>
        <div className="page-container">
          <div className="rounded-[32px] p-10 flex flex-wrap items-center justify-between gap-8"
            style={{ background: W, boxShadow: NEU_SHADOW }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div className="flex items-center gap-3 mb-4">
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', boxShadow: NEU_INSET, background: W, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={18} style={{ color: '#E85D26' }} />
                </div>
                <span style={{ ...mono, fontSize: '11px', color: '#E85D26', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  Structures professionnelles
                </span>
              </div>
              <h2 style={{ ...syne, fontWeight: 700, fontSize: 'clamp(22px, 2.5vw, 30px)', lineHeight: 1.15, color: T1, marginBottom: '10px' }}>
                Vous gérez une équipe<br />d'artisans ?
              </h2>
              <p style={{ ...body, fontSize: '14px', color: T2, lineHeight: 1.7, maxWidth: '46ch' }}>
                Créez un espace entreprise sur AfriOne. Gérez vos artisans, vos missions
                et accédez à des clients professionnels à Abidjan.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
              <Link href="/entreprise-space/register" className="btn-primary"
                style={{ whiteSpace: 'nowrap', ...syne, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={15} /> Créer mon espace entreprise
              </Link>
              <p style={{ ...mono, fontSize: '11px', color: T3, textAlign: 'center' }}>Validation sous 24h · Gratuit</p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━ CTA ARTISAN + FAQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{ background: W2, padding: '80px 16px' }}>
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-8 items-stretch">

            {/* Orange animated CTA card */}
            <div className="afrione-gradient rounded-[32px] py-16 px-10 flex flex-col justify-center items-center text-center"
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
                  padding: '13px 28px', background: W, borderRadius: '16px',
                  color: T1, fontSize: '14px', fontWeight: 700, ...syne,
                  textDecoration: 'none', cursor: 'pointer',
                  boxShadow: NEU_SHADOW, transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = NEU_HOVER }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = NEU_SHADOW }}>
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
                    style={{
                      background: W,
                      borderRadius: '20px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      boxShadow: isOpen ? NEU_INSET_DEEP : NEU_SHADOW,
                      transition: 'box-shadow 0.3s ease-out',
                    }}>
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ ...syne, fontWeight: 700, fontSize: '14px', color: T1, lineHeight: 1.35 }}>{item.q}</span>
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
      <footer style={{ background: W2, borderTop: `1px solid ${BO}` }}>
        <div className="page-container" style={{ paddingTop: '64px', paddingBottom: '20px' }}>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_2fr] gap-10" style={{ marginBottom: '48px' }}>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="afrione-gradient rounded flex items-center justify-center" style={{ width: '28px', height: '28px' }}>
                  <Zap size={13} color="white" />
                </div>
                <span style={{ ...syne, fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em', color: T1 }}>
                  AFRI<span className="afrione-gradient-text">ONE</span>
                </span>
              </div>
              <p style={{ ...body, fontSize: '13px', color: T2, lineHeight: 1.65, maxWidth: '200px' }}>
                La plateforme des artisans vérifiés à Abidjan. Rapide, sécurisé, transparent.
              </p>
            </div>

            <div>
              <h4 style={{ ...syne, fontWeight: 700, fontSize: '13px', color: T1, marginBottom: '16px', letterSpacing: '-0.01em' }}>Plateforme</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { href: '/artisans',    label: 'Artisans'         },
                  { href: '/entreprises', label: 'Entreprises'       },
                  { href: '/diagnostic',  label: 'Diagnostic'        },
                  { href: '/aide',        label: 'Comment ça marche' },
                ].map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href}
                      style={{ ...body, fontSize: '13px', color: T2, textDecoration: 'none', transition: 'color 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T1}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T2}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ ...syne, fontWeight: 700, fontSize: '13px', color: T1, marginBottom: '16px', letterSpacing: '-0.01em' }}>Légal</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { href: '/aide', label: 'CGU'             },
                  { href: '/aide', label: 'Confidentialité' },
                  { href: '/aide', label: 'Contact'         },
                ].map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href}
                      style={{ ...body, fontSize: '13px', color: T2, textDecoration: 'none', transition: 'color 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T1}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T2}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ ...syne, fontWeight: 700, fontSize: '13px', color: T1, marginBottom: '16px', letterSpacing: '-0.01em' }}>Votre espace</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link href="/artisan-space/dashboard"
                  style={{ background: W, borderRadius: '10px', boxShadow: NEU_SMALL, display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', fontSize: '13px', color: T1, textDecoration: 'none', cursor: 'pointer', ...syne, fontWeight: 600, transition: 'box-shadow 0.2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = NEU_SHADOW}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = NEU_SMALL}>
                  <Wrench size={13} style={{ color: '#E85D26' }} /> Espace artisan
                </Link>
                <Link href="/entreprise-space/register"
                  style={{ background: W, borderRadius: '10px', boxShadow: NEU_SMALL, display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', fontSize: '13px', color: T1, textDecoration: 'none', cursor: 'pointer', ...syne, fontWeight: 600, transition: 'box-shadow 0.2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = NEU_SHADOW}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = NEU_SMALL}>
                  <Building2 size={13} style={{ color: '#C9A84C' }} /> Espace entreprise
                </Link>
              </div>
            </div>
          </div>

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
