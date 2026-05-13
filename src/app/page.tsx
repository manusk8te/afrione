'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import {
  ArrowRight, Shield, Zap, Star, CheckCircle, ChevronRight, Building2,
  Droplets, Hammer, Paintbrush, Ruler, Wind, Lock, LayoutGrid,
  Cpu, Users, CreditCard, Camera, Wrench,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
  'Plomberie':     Droplets,
  'Électricité':   Zap,
  'Maçonnerie':    Hammer,
  'Peinture':      Paintbrush,
  'Menuiserie':    Ruler,
  'Climatisation': Wind,
  'Serrurerie':    Lock,
  'Carrelage':     LayoutGrid,
}

const STEPS = [
  { num: '01', title: 'Décrivez votre besoin',  desc: "L'IA analyse votre problème et estime le prix en quelques secondes", Icon: Cpu        },
  { num: '02', title: 'Choisissez un artisan',  desc: 'Parmi les profils sélectionnés selon votre zone et votre budget',    Icon: Users      },
  { num: '03', title: 'Confirmez & payez',       desc: "Paiement sécurisé via Wave, les fonds sont bloqués jusqu'à la fin",  Icon: CreditCard },
  { num: '04', title: 'Mission réalisée',        desc: "Validez la photo de fin de chantier et notez l'artisan",            Icon: Camera     },
]

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } },
}

export default function HomePage() {
  const [stats, setStats]               = useState({ artisans: 500, missions: 2400, rating: 4.8, satisfaction: 98 })
  const [topArtisans, setTopArtisans]   = useState<any[]>([])
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
          .select('id, metier, tarif_min, rating_avg, rating_count, mission_count, users!artisan_pros_user_id_fkey(name, quartier, avatar_url)')
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
    { value: stats.artisans >= 500 ? `${stats.artisans}+` : `${stats.artisans}`,
      label: 'Artisans vérifiés' },
    { value: `${stats.rating}★`,
      label: 'Note moyenne' },
    { value: stats.missions >= 2400
        ? `${stats.missions.toLocaleString()}+`
        : `${stats.missions.toLocaleString()}`,
      label: 'Missions réalisées' },
    { value: `${stats.satisfaction}%`,
      label: 'Clients satisfaits' },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      {/* ── HERO ────────────────────────────────── */}
      <section className="min-h-[100dvh] flex items-start md:items-center pt-24 pb-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-16 right-[4%] w-[520px] h-[520px] bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-16 left-6 w-[320px] h-[320px] bg-accent2/5 rounded-full blur-3xl" />
        </div>

        <div className="page-container relative w-full">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] gap-12 items-center">

            {/* Left: content */}
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              <motion.div variants={fadeUp}
                className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-2 mb-8">
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse-soft" />
                <span className="font-mono text-xs text-accent tracking-wider">PLATEFORME #1 À ABIDJAN</span>
              </motion.div>

              <motion.h1 variants={fadeUp}
                className="font-display text-5xl sm:text-6xl lg:text-[72px] font-bold text-dark leading-[0.93] tracking-tight mb-6">
                Trouver le bon<br />
                <span className="text-accent">artisan</span>,<br />
                au bon prix.
              </motion.h1>

              <motion.p variants={fadeUp}
                className="text-lg text-muted max-w-[52ch] mb-10 leading-relaxed font-body">
                AfriOne met en relation les clients avec des artisans qualifiés et vérifiés à Abidjan.
                Rapide, sécurisé, transparent. Paiement via Wave.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-4 mb-10">
                <Link href="/diagnostic"
                  className="btn-primary flex items-center gap-2 text-base py-4 px-8 active:scale-[0.98] transition-transform">
                  Décrire mon problème <ArrowRight size={18} />
                </Link>
                <Link href="/artisans"
                  className="btn-outline flex items-center gap-2 text-base py-4 px-8 active:scale-[0.98] transition-transform">
                  Voir les artisans
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Shield size={15} className="text-accent2" /><span>Artisans vérifiés KYC</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Zap size={15} className="text-accent" /><span>Réponse en moins de 30 min</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <CheckCircle size={15} className="text-accent2" /><span>Paiement sécurisé Wave</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right: stats panel (desktop only) */}
            <motion.div
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.35 }}
              className="hidden md:block"
            >
              <div className="bg-dark rounded-3xl p-7 border border-border/50 relative overflow-hidden
                              shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-accent/6 rounded-full blur-2xl" />
                <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-5 relative">
                  Activité en direct
                </p>
                <div className="grid grid-cols-2 gap-px bg-border/20 rounded-2xl overflow-hidden mb-5 relative">
                  {STATS_DISPLAY.map(s => (
                    <div key={s.label} className="bg-dark2 p-5">
                      <div className="font-display text-3xl font-bold text-accent mb-1">{s.value}</div>
                      <div className="font-mono text-[10px] text-muted uppercase tracking-wider">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-border/20 relative">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                  <span className="font-mono text-[10px] text-muted">Plateforme opérationnelle · Abidjan</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Mobile stats strip */}
          <div className="md:hidden grid grid-cols-2 gap-3 mt-10">
            {STATS_DISPLAY.map(s => (
              <div key={s.label} className="bg-dark rounded-2xl p-4 border border-border/50">
                <div className="font-display text-2xl font-bold text-accent">{s.value}</div>
                <div className="font-mono text-[10px] text-muted uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="page-container">
          <div className="mb-10">
            <span className="section-label">NOS SERVICES</span>
            <h2 className="font-display text-4xl font-bold text-dark mt-2 tracking-tight">
              Tous vos services,<br />au même endroit.
            </h2>
            <p className="text-muted mt-3 max-w-[52ch]">Des artisans vérifiés dans chaque domaine</p>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {SERVICES.map((s, i) => {
              const { Icon } = s
              const isFeatured = i === 0
              return (
                <motion.div key={s.label} variants={fadeUp}
                  className={isFeatured ? 'col-span-2 sm:col-span-2' : ''}>
                  <Link href={`/artisans?metier=${encodeURIComponent(s.metier)}`}
                    className={`card group cursor-pointer hover:border-accent/30 hover:-translate-y-1
                      active:scale-[0.98] transition-all duration-200 block
                      ${isFeatured ? 'flex items-center gap-5 py-6' : ''}`}>
                    <div className={`flex items-center justify-center rounded-xl bg-bg2
                      group-hover:bg-accent/10 transition-colors flex-shrink-0
                      ${isFeatured ? 'w-14 h-14' : 'w-10 h-10 mb-3'}`}>
                      <Icon size={isFeatured ? 22 : 17} className="text-accent" />
                    </div>
                    <div>
                      <div className="font-display font-bold text-dark group-hover:text-accent transition-colors">
                        {s.label}
                      </div>
                      <div className="font-mono text-xs text-muted mt-1">
                        {serviceCounts[s.metier]
                          ? `${serviceCounts[s.metier]} artisan${serviceCounts[s.metier] > 1 ? 's' : ''}`
                          : 'Disponible'}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────── */}
      <section className="py-20 px-4 bg-dark">
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.7fr] gap-16 items-start">

            {/* Left: heading */}
            <div className="md:sticky md:top-24">
              <span className="font-mono text-xs text-muted uppercase tracking-wider">COMMENT ÇA MARCHE</span>
              <h2 className="font-display text-4xl font-bold text-cream mt-3 mb-5 tracking-tight leading-tight">
                Simple.<br />Rapide.<br />Sécurisé.
              </h2>
              <p className="text-muted text-sm leading-relaxed max-w-[38ch]">
                De la description du problème à la validation finale, tout se passe sur AfriOne.
              </p>
              <Link href="/diagnostic" className="btn-primary inline-flex items-center gap-2 mt-8 active:scale-[0.98] transition-transform">
                Essayer maintenant <ArrowRight size={16} />
              </Link>
            </div>

            {/* Right: steps */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              className="flex flex-col"
            >
              {STEPS.map((step, i) => {
                const { Icon } = step
                const isLast = i === STEPS.length - 1
                return (
                  <motion.div key={step.num} variants={fadeUp}
                    className={`flex gap-5 ${!isLast ? 'pb-8 mb-8 border-b border-border/15' : ''}`}>
                    <div className="flex-shrink-0 flex flex-col items-center gap-2 pt-1">
                      <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/20
                                      flex items-center justify-center">
                        <Icon size={19} className="text-accent" />
                      </div>
                      <span className="font-mono text-[9px] text-accent/40 tracking-wider">{step.num}</span>
                    </div>
                    <div className="pt-1">
                      <h3 className="font-display font-bold text-cream text-lg mb-2">{step.title}</h3>
                      <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TOP ARTISANS ────────────────────────── */}
      <section className="py-20 px-4">
        <div className="page-container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="section-label">ARTISANS EN VEDETTE</span>
              <h2 className="font-display text-4xl font-bold text-dark mt-2 tracking-tight">Les mieux notés</h2>
              <p className="text-muted mt-2">Tous vérifiés, tous fiables</p>
            </div>
            <Link href="/artisans"
              className="hidden sm:flex items-center gap-1 text-sm font-medium text-accent hover:gap-2 transition-all">
              Voir tous <ChevronRight size={16} />
            </Link>
          </div>

          {loadingArtisans ? (
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
              <div className="card animate-pulse">
                <div className="w-16 h-16 bg-bg2 rounded-2xl mb-6" />
                <div className="h-5 bg-bg2 rounded w-2/3 mb-3" />
                <div className="h-4 bg-bg2 rounded w-1/2 mb-8" />
                <div className="h-px bg-bg2 mb-6" />
                <div className="h-10 bg-bg2 rounded-xl" />
              </div>
              <div className="flex flex-col gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="card animate-pulse flex gap-4">
                    <div className="w-12 h-12 bg-bg2 rounded-2xl flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 bg-bg2 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-bg2 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : topArtisans.length > 0 ? (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6"
            >
              {/* Featured first artisan */}
              {topArtisans[0] && (() => {
                const a = topArtisans[0]
                const MetierIcon = METIER_ICON_MAP[a.metier] || Wrench
                return (
                  <motion.div variants={fadeUp}
                    className="card group hover:-translate-y-1 transition-all duration-200">
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-16 h-16 bg-bg2 rounded-2xl overflow-hidden flex items-center justify-center">
                        {a.users?.avatar_url
                          ? <img src={a.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : <MetierIcon size={26} className="text-accent" />
                        }
                      </div>
                      <span className="badge-green">Vérifié</span>
                    </div>
                    <h3 className="font-display font-bold text-dark text-xl mb-1">
                      {a.users?.name || a.metier || 'Artisan'}
                    </h3>
                    <p className="text-sm text-muted mb-6">
                      {a.metier} · {a.users?.quartier || 'Abidjan'}
                    </p>
                    <div className="flex items-center gap-6 pt-4 border-t border-border mb-6">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-gold fill-gold" />
                        <span className="font-semibold text-sm">{(a.rating_avg || 0).toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted">
                        <CheckCircle size={13} className="text-accent2" />
                        {a.mission_count || 0} missions
                      </div>
                      <div className="ml-auto font-bold text-sm text-dark">
                        Dès {(a.tarif_min || 0).toLocaleString()} FCFA
                      </div>
                    </div>
                    <Link href={`/artisans/${a.id}`}
                      className="block btn-primary text-sm text-center py-3 active:scale-[0.98] transition-transform">
                      Voir le profil <ArrowRight size={14} className="inline ml-1" />
                    </Link>
                  </motion.div>
                )
              })()}

              {/* Two smaller artisans stacked */}
              <div className="flex flex-col gap-4">
                {topArtisans.slice(1, 3).map(a => {
                  const MetierIcon = METIER_ICON_MAP[a.metier] || Wrench
                  return (
                    <motion.div key={a.id} variants={fadeUp}
                      className="card group hover:-translate-y-1 transition-all duration-200">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-bg2 rounded-2xl flex-shrink-0 overflow-hidden
                                        flex items-center justify-center">
                          {a.users?.avatar_url
                            ? <img src={a.users.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            : <MetierIcon size={19} className="text-accent" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-bold text-dark text-sm truncate">
                            {a.users?.name || a.metier || 'Artisan'}
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            {a.metier} · {a.users?.quartier || 'Abidjan'}
                          </div>
                        </div>
                        <span className="badge-green flex-shrink-0">Vérifié</span>
                      </div>
                      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-gold fill-gold" />
                          <span className="text-sm font-semibold">{(a.rating_avg || 0).toFixed(1)}</span>
                        </div>
                        <span className="text-xs text-muted">{a.mission_count || 0} missions</span>
                        <Link href={`/artisans/${a.id}`}
                          className="ml-auto text-xs font-semibold text-accent flex items-center gap-1 hover:gap-2 transition-all">
                          Voir <ChevronRight size={12} />
                        </Link>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <Wrench size={30} className="text-muted mx-auto mb-4" />
              <p className="text-muted mb-6">Nos artisans complètent leur inscription — revenez bientôt !</p>
              <Link href="/diagnostic" className="btn-primary inline-flex items-center gap-2">
                Décrire mon besoin <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── ENTREPRISES PARTENAIRES ─────────────── */}
      {topEntreprises.length > 0 && (
        <section className="py-20 px-4 bg-dark">
          <div className="page-container">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="font-mono text-xs text-muted uppercase tracking-wider">STRUCTURES PARTENAIRES</span>
                <h2 className="font-display text-4xl font-bold text-cream mt-2 tracking-tight">
                  Entreprises multi-corps
                </h2>
                <p className="text-muted mt-2">Des équipes complètes pour vos grands travaux</p>
              </div>
              <Link href="/entreprises"
                className="hidden sm:flex items-center gap-1 text-sm font-medium text-accent hover:gap-2 transition-all">
                Voir tout <ChevronRight size={16} />
              </Link>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              {/* Top 2: side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                {topEntreprises.slice(0, 2).map(e => (
                  <motion.div key={e.id} variants={fadeUp}>
                    <Link href={`/entreprise-space/dashboard?id=${e.id}`} style={{ textDecoration: 'none' }}>
                      <div className="card hover:-translate-y-1 transition-all duration-200 overflow-hidden group"
                        style={{ padding: 0 }}>
                        <div style={{
                          height: '120px',
                          background: e.banner_url ? '#1A1A1A' : 'linear-gradient(135deg,#1A2F1E,#0F1410)',
                          overflow: 'hidden', position: 'relative',
                        }}>
                          {e.banner_url
                            ? <img src={e.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Building2 size={40} color="rgba(255,255,255,0.12)" />
                              </div>
                          }
                        </div>
                        <div style={{ padding: '16px 20px 20px' }}>
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-display font-bold text-dark group-hover:text-accent transition-colors"
                              style={{ fontSize: '15px' }}>{e.name}</h3>
                            <span className="badge-green" style={{ flexShrink: 0, marginLeft: '8px' }}>Vérifié</span>
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
                            {(e.secteurs || []).length > 3 && (
                              <span style={{ fontSize: '11px', color: '#7A7A6E' }}>+{e.secteurs.length - 3}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-border">
                            <span style={{ fontSize: '12px', color: '#7A7A6E' }}>
                              {(e.artisan_pros || []).length} artisan{(e.artisan_pros || []).length !== 1 ? 's' : ''}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#E85D26' }}>
                              Voir l'équipe →
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Third: full-width horizontal compact card */}
              {topEntreprises[2] && (
                <motion.div variants={fadeUp}>
                  <Link href={`/entreprise-space/dashboard?id=${topEntreprises[2].id}`} style={{ textDecoration: 'none' }}>
                    <div className="card hover:-translate-y-1 transition-all duration-200 group flex items-center gap-5"
                      style={{ padding: '14px 20px' }}>
                      <div style={{
                        width: '56px', height: '56px', flexShrink: 0, borderRadius: '14px',
                        background: topEntreprises[2].banner_url ? '#1A1A1A' : 'linear-gradient(135deg,#1A2F1E,#0F1410)',
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {topEntreprises[2].banner_url
                          ? <img src={topEntreprises[2].banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                          : <Building2 size={22} color="rgba(255,255,255,0.18)" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-dark group-hover:text-accent transition-colors">
                          {topEntreprises[2].name}
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                          {(topEntreprises[2].artisan_pros || []).length} artisans
                          {(topEntreprises[2].secteurs || []).length > 0 && ` · ${(topEntreprises[2].secteurs || []).slice(0, 2).join(', ')}`}
                        </p>
                      </div>
                      <span className="badge-green flex-shrink-0">Vérifié</span>
                      <ChevronRight size={15} className="text-muted group-hover:text-accent transition-colors flex-shrink-0" />
                    </div>
                  </Link>
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ── CTA ENTREPRISE ──────────────────────── */}
      <section className="py-16 px-4">
        <div className="page-container">
          <div style={{
            background: 'linear-gradient(135deg, #0F1E14 0%, #1A2F1E 100%)',
            border: '1px solid rgba(96,165,250,0.15)',
            borderRadius: '24px',
            padding: '40px 48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '32px',
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  width: '36px', height: '36px',
                  background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.22)',
                  borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={17} color="#60a5fa" />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Structures professionnelles
                </span>
              </div>
              <h2 className="font-display" style={{ fontSize: '28px', fontWeight: 700, color: '#FAFAF5', marginBottom: '10px', lineHeight: 1.2 }}>
                Vous gérez une équipe<br />d'artisans ?
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(250,250,245,0.55)', lineHeight: 1.7 }}>
                Créez un espace entreprise sur AfriOne. Gérez vos artisans, suivez vos missions
                et accédez à des clients professionnels à Abidjan.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
              <Link href="/entreprise-space/register" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '14px 28px', background: '#60a5fa',
                borderRadius: '12px', color: 'white', fontSize: '15px', fontWeight: 700,
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                <Building2 size={16} /> Créer mon espace entreprise
              </Link>
              <p style={{ fontSize: '11px', color: 'rgba(250,250,245,0.3)', textAlign: 'center' }}>
                Validation sous 24h · Gratuit
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ARTISAN ─────────────────────────── */}
      <section className="py-20 px-4 bg-accent">
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-center">
            <div>
              <h2 className="font-display text-4xl font-bold text-white mb-4 tracking-tight">
                Vous êtes artisan ?
              </h2>
              <p className="text-white/80 text-lg max-w-[52ch] leading-relaxed">
                Rejoignez AfriOne et accédez à des centaines de clients qualifiés à Abidjan. Inscription gratuite.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/auth" className="btn-secondary active:scale-[0.98] transition-transform">
                S'inscrire comme artisan
              </Link>
              <Link href="/aide"
                className="bg-white/10 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl
                           hover:bg-white/20 active:scale-[0.98] transition-all">
                En savoir plus
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────── */}
      <footer className="bg-dark py-12 px-4">
        <div className="page-container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <Zap size={16} className="text-white fill-white" />
              </div>
              <span className="font-display font-bold text-xl text-cream">AFRI<span className="text-accent">ONE</span></span>
            </div>
            <p className="font-mono text-xs text-muted text-center">
              © 2025 AFRIONE — Abidjan, Côte d'Ivoire · Tous droits réservés
            </p>
            <div className="flex gap-6">
              <Link href="/artisans"   className="text-xs text-muted hover:text-cream transition-colors">Artisans</Link>
              <Link href="/diagnostic" className="text-xs text-muted hover:text-cream transition-colors">Services</Link>
              <Link href="/aide"       className="text-xs text-muted hover:text-cream transition-colors">Contact</Link>
              <Link href="/aide"       className="text-xs text-muted hover:text-cream transition-colors">CGU</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
