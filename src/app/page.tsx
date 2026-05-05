'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { ArrowRight, Shield, Zap, Star, CheckCircle, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const SERVICES = [
  { icon: '🔧', label: 'Plomberie',     metier: 'Plomberie'     },
  { icon: '⚡', label: 'Électricité',   metier: 'Électricité'   },
  { icon: '🏗️', label: 'Maçonnerie',   metier: 'Maçonnerie'    },
  { icon: '🎨', label: 'Peinture',      metier: 'Peinture'      },
  { icon: '🪵', label: 'Menuiserie',    metier: 'Menuiserie'    },
  { icon: '❄️', label: 'Climatisation', metier: 'Climatisation' },
  { icon: '🔑', label: 'Serrurerie',    metier: 'Serrurerie'    },
  { icon: '🪟', label: 'Carrelage',     metier: 'Carrelage'     },
]

const METIER_ICONS: Record<string, string> = {
  'Plomberie': '🔧', 'Électricité': '⚡', 'Maçonnerie': '🏗️',
  'Peinture': '🎨', 'Menuiserie': '🪵', 'Climatisation': '❄️',
  'Serrurerie': '🔑', 'Carrelage': '🪟',
}

const STEPS = [
  { num: '01', title: 'Décrivez votre besoin',   desc: "L'IA analyse votre problème et estime le prix en quelques secondes", icon: '🧠' },
  { num: '02', title: 'Choisissez un artisan',   desc: 'Parmi les profils sélectionnés selon votre zone et votre budget', icon: '👤' },
  { num: '03', title: 'Confirmez & payez',        desc: "Paiement sécurisé via Wave, les fonds sont bloqués jusqu'à la fin", icon: '💳' },
  { num: '04', title: 'Mission réalisée',         desc: "Validez la photo de fin de chantier et notez l'artisan", icon: '✅' },
]

export default function HomePage() {
  const [stats, setStats] = useState({ artisans: 500, missions: 2400, rating: 4.8, satisfaction: 98 })
  const [topArtisans, setTopArtisans] = useState<any[]>([])
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({})
  const [loadingArtisans, setLoadingArtisans] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: artisanCount }, { count: missionCount }, { data: ratingsData }, { data: allArtisans }] = await Promise.all([
        supabase.from('artisan_pros').select('id', { count: 'exact', head: true }).eq('kyc_status', 'approved'),
        supabase.from('missions').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('artisan_pros').select('rating_avg').eq('kyc_status', 'approved').not('rating_avg', 'is', null),
        supabase.from('artisan_pros').select('metier').eq('kyc_status', 'approved'),
      ])

      const ratings = ratingsData?.map((a: any) => a.rating_avg).filter(Boolean) || []
      const avgRating = ratings.length
        ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
        : 4.8

      // Compter par métier
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
      const { data } = await supabase
        .from('artisan_pros')
        .select('id, metier, tarif_min, rating_avg, rating_count, mission_count, users!artisan_pros_user_id_fkey(name, quartier, avatar_url)')
        .eq('kyc_status', 'approved')
        .order('rating_avg', { ascending: false })
        .limit(3)
      setTopArtisans(data || [])
      setLoadingArtisans(false)
    }

    fetchStats()
    fetchArtisans()
  }, [])

  const STATS_DISPLAY = [
    { value: stats.artisans >= 500 ? `${stats.artisans}+` : `${stats.artisans}`, label: 'Artisans vérifiés' },
    { value: `${stats.rating}★`, label: 'Note moyenne' },
    { value: stats.missions >= 2400 ? `${stats.missions.toLocaleString()}+` : `${stats.missions.toLocaleString()}`, label: 'Missions réalisées' },
    { value: `${stats.satisfaction}%`, label: 'Clients satisfaits' },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      {/* HERO */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-accent2/5 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(#1A1A1A 1px, transparent 1px), linear-gradient(90deg, #1A1A1A 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          />
        </div>

        <div className="page-container relative">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse-soft" />
              <span className="font-mono text-xs text-accent tracking-wider">PLATEFORME #1 À ABIDJAN</span>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-dark leading-[0.95] mb-6">
              Trouver le bon<br />
              <span className="text-accent">artisan</span>,<br />
              au bon prix.
            </h1>

            <p className="text-lg text-muted max-w-2xl mb-10 leading-relaxed font-body">
              AfriOne met en relation les clients avec des artisans qualifiés et vérifiés à Abidjan.
              Rapide, sécurisé, transparent. Paiement via Wave.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/diagnostic" className="btn-primary flex items-center gap-2 text-base py-4 px-8">
                Décrire mon problème <ArrowRight size={18} />
              </Link>
              <Link href="/artisans" className="btn-outline flex items-center gap-2 text-base py-4 px-8">
                Voir les artisans
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 mt-10">
              <div className="flex items-center gap-2 text-sm text-muted">
                <Shield size={16} className="text-accent2" /><span>Artisans vérifiés KYC</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Zap size={16} className="text-accent" /><span>Réponse en moins de 30 min</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle size={16} className="text-accent2" /><span>Paiement sécurisé Wave</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 border-y border-border bg-dark">
        <div className="page-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS_DISPLAY.map(s => (
              <div key={s.label} className="text-center">
                <div className="font-display text-4xl font-bold text-accent mb-1">{s.value}</div>
                <div className="font-mono text-xs text-muted uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-20 px-4">
        <div className="page-container">
          <div className="mb-12">
            <span className="section-label">NOS SERVICES</span>
            <h2 className="font-display text-4xl font-bold text-dark mt-2">Tous vos services,<br />au même endroit.</h2>
            <p className="text-muted mt-3">Des artisans vérifiés dans chaque domaine</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {SERVICES.map(s => (
              <Link key={s.label} href={`/artisans?metier=${encodeURIComponent(s.metier)}`}
                className="card group cursor-pointer hover:border-accent/30 hover:-translate-y-1 transition-all duration-200">
                <div className="text-3xl mb-3">{s.icon}</div>
                <div className="font-display font-bold text-dark group-hover:text-accent transition-colors">{s.label}</div>
                <div className="font-mono text-xs text-muted mt-1">
                  {serviceCounts[s.metier] ? `${serviceCounts[s.metier]} artisan${serviceCounts[s.metier] > 1 ? 's' : ''}` : 'Disponible'}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-4 bg-dark">
        <div className="page-container">
          <div className="mb-12">
            <span className="font-mono text-xs text-muted uppercase tracking-wider">COMMENT ÇA MARCHE</span>
            <h2 className="font-display text-4xl font-bold text-cream mt-2">Simple. Rapide.<br />Sécurisé.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-border z-0" />
                )}
                <div className="bg-dark2 rounded-2xl p-6 border border-border/50 relative z-10">
                  <div className="font-mono text-xs text-accent mb-4">{step.num}</div>
                  <div className="text-3xl mb-4">{step.icon}</div>
                  <h3 className="font-display font-bold text-cream mb-2">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/diagnostic" className="btn-primary inline-flex items-center gap-2">
              Essayer maintenant <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* TOP ARTISANS */}
      <section className="py-20 px-4">
        <div className="page-container">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="section-label">ARTISANS EN VEDETTE</span>
              <h2 className="font-display text-4xl font-bold text-dark mt-2">Les mieux notés</h2>
              <p className="text-muted mt-2">Tous vérifiés, tous fiables</p>
            </div>
            <Link href="/artisans" className="hidden sm:flex items-center gap-1 text-sm font-medium text-accent hover:gap-2 transition-all">
              Voir tous <ChevronRight size={16} />
            </Link>
          </div>

          {loadingArtisans ? (
            <div className="grid sm:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="card animate-pulse">
                  <div className="w-14 h-14 bg-bg2 rounded-2xl mb-4" />
                  <div className="h-4 bg-bg2 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-bg2 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : topArtisans.length > 0 ? (
            <div className="grid sm:grid-cols-3 gap-6">
              {topArtisans.map(a => (
                <div key={a.id} className="card group hover:-translate-y-1 transition-all duration-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-bg2 rounded-2xl flex items-center justify-center text-2xl overflow-hidden">
                      {a.users?.avatar_url
                        ? <img src={a.users.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
                        : METIER_ICONS[a.metier] || '👷'}
                    </div>
                    <span className="badge-green">Vérifié</span>
                  </div>
                  <h3 className="font-display font-bold text-dark">{a.users?.name || 'Artisan'}</h3>
                  <p className="text-sm text-muted mt-1">{a.metier} · {a.users?.quartier || 'Abidjan'}</p>
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-gold fill-gold" />
                      <span className="text-sm font-semibold">{(a.rating_avg || 0).toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <CheckCircle size={12} className="text-accent2" />
                      {a.mission_count || 0} missions
                    </div>
                    <div className="ml-auto text-sm font-bold text-dark">
                      Dès {(a.tarif_min || 0).toLocaleString()} FCFA
                    </div>
                  </div>
                  <Link href={`/artisans/${a.id}`} className="block mt-4 btn-outline text-sm text-center py-2">
                    Voir le profil
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted mb-6">Nos artisans complètent leur inscription — revenez bientôt !</p>
              <Link href="/diagnostic" className="btn-primary inline-flex items-center gap-2">
                Décrire mon besoin <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA ARTISAN */}
      <section className="py-20 px-4 bg-accent">
        <div className="page-container text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">Vous êtes artisan ?</h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Rejoignez AfriOne et accédez à des centaines de clients qualifiés à Abidjan. Inscription gratuite.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/auth" className="btn-secondary">S'inscrire comme artisan</Link>
            <Link href="/aide" className="bg-white/10 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-all">
              En savoir plus
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-dark py-12 px-4">
        <div className="page-container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <Zap size={16} className="text-white fill-white" />
              </div>
              <span className="font-display font-bold text-xl text-cream">AFRI<span className="text-accent">ONE</span></span>
            </div>
            <p className="font-mono text-xs text-muted text-center">© 2025 AFRIONE — Abidjan, Côte d'Ivoire · Tous droits réservés</p>
            <div className="flex gap-6">
              <Link href="/artisans"  className="text-xs text-muted hover:text-cream transition-colors">Artisans</Link>
              <Link href="/diagnostic" className="text-xs text-muted hover:text-cream transition-colors">Services</Link>
              <Link href="/aide"      className="text-xs text-muted hover:text-cream transition-colors">Contact</Link>
              <Link href="/aide"      className="text-xs text-muted hover:text-cream transition-colors">CGU</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
