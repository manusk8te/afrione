'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import {
  ArrowLeft, Star, CheckCircle, MapPin, Clock, Shield,
  Phone, MessageCircle, Zap, Award, ThumbsUp, Calendar,
  ChevronRight
} from 'lucide-react'

// Mock data — remplacer par requête Supabase : select from artisan_pros join users where id = params.id
const MOCK_ARTISANS: Record<string, {
  id: string; name: string; metier: string; quartier: string; rating: number;
  missions: number; tarif: number; exp: number; badge: string; icon: string;
  available: boolean; response_time: number; bio: string; specialties: string[];
  certifications: string[]; quartiers: string[]; success_rate: number;
  reviews: { author: string; note: number; date: string; text: string }[];
}> = {
  '1': {
    id: '1', name: 'Kouadio Brou Emmanuel', metier: 'Plomberie', quartier: 'Cocody',
    rating: 4.9, missions: 184, tarif: 8000, exp: 12, badge: 'Vérifié',
    icon: '🔧', available: true, response_time: 10, success_rate: 98,
    bio: 'Plombier professionnel avec 12 ans d\'expérience à Abidjan. Spécialisé dans les installations sanitaires, réparations de fuites et pose de carrelage. Travail soigné, rapide et au bon prix.',
    specialties: ['Fuite d\'eau', 'Pose sanitaire', 'Siphon', 'Chauffe-eau', 'WC bouché'],
    certifications: ['CAP Plomberie', 'Habilitation Travaux sous pression'],
    quartiers: ['Cocody', 'Plateau', 'Marcory', 'Treichville'],
    reviews: [
      { author: 'Aya K.', note: 5, date: '05 Mar 2025', text: 'Excellent travail ! Très rapide et propre. Je recommande vivement.' },
      { author: 'Jean M.', note: 5, date: '28 Fév 2025', text: 'Arrivé en 15 minutes, fuite réparée en une heure. Parfait !' },
      { author: 'Fatou D.', note: 4, date: '12 Fév 2025', text: 'Bon travail, prix correct. Reviendra si besoin.' },
    ],
  },
  '2': {
    id: '2', name: 'Diallo Mamadou', metier: 'Électricité', quartier: 'Plateau',
    rating: 4.8, missions: 132, tarif: 12000, exp: 8, badge: 'Top 10',
    icon: '⚡', available: true, response_time: 15, success_rate: 97,
    bio: 'Électricien certifié, 8 ans d\'expérience en installation et dépannage électrique à Abidjan. Maison, bureau, commerce. Devis gratuit sur place.',
    specialties: ['Tableau électrique', 'Câblage', 'Prises & interrupteurs', 'Éclairage', 'Climatiseur'],
    certifications: ['Habilitation Électrique B2V', 'CAP Électricité'],
    quartiers: ['Plateau', 'Cocody', 'Adjamé', 'Abobo'],
    reviews: [
      { author: 'Moussa T.', note: 5, date: '03 Mar 2025', text: 'Très professionnel, a résolu mon problème de disjoncteur en 30 min.' },
      { author: 'Inès B.', note: 5, date: '20 Fév 2025', text: 'Ponctuel, honnête sur le prix. Rien à redire.' },
    ],
  },
}

export default function ArtisanProfilePage() {
  const params = useParams()
  const id = params.id as string
  const artisan = MOCK_ARTISANS[id] ?? MOCK_ARTISANS['1']
  const [activeTab, setActiveTab] = useState<'avis' | 'infos'>('avis')

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="pt-20 pb-16">

        {/* Hero card */}
        <div className="bg-dark text-cream">
          <div className="page-container py-8 max-w-4xl">
            <Link href="/artisans" className="inline-flex items-center gap-2 text-sm text-muted hover:text-cream mb-6 transition-colors">
              <ArrowLeft size={16} /> Retour aux artisans
            </Link>

            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-20 h-20 bg-dark2 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 border border-border">
                {artisan.icon}
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  {artisan.badge === 'Top 10' && (
                    <span className="badge bg-gold/20 text-yellow-400 border border-gold/30">🏆 Top 10</span>
                  )}
                  {artisan.badge === 'Vérifié' && (
                    <span className="badge bg-accent2/20 text-green-400 border border-accent2/30">✓ KYC Vérifié</span>
                  )}
                  {artisan.available
                    ? <span className="flex items-center gap-1 text-xs text-accent2 bg-accent2/10 border border-accent2/20 px-3 py-1 rounded-full"><span className="w-1.5 h-1.5 bg-accent2 rounded-full animate-pulse-soft" />Disponible</span>
                    : <span className="flex items-center gap-1 text-xs text-muted bg-muted/10 px-3 py-1 rounded-full"><span className="w-1.5 h-1.5 bg-muted rounded-full" />Occupé</span>
                  }
                </div>

                <h1 className="font-display text-3xl font-bold text-cream">{artisan.name}</h1>
                <p className="text-muted mt-1 flex items-center gap-1">
                  <MapPin size={14} /> {artisan.metier} · {artisan.quartier}
                </p>

                <div className="grid grid-cols-4 gap-4 mt-6">
                  {[
                    { value: artisan.rating, label: 'Note', icon: Star },
                    { value: artisan.missions, label: 'Missions', icon: CheckCircle },
                    { value: `${artisan.exp}ans`, label: 'Expérience', icon: Award },
                    { value: `${artisan.response_time}min`, label: 'Réponse', icon: Clock },
                  ].map(stat => (
                    <div key={stat.label} className="text-center">
                      <div className="font-display text-xl font-bold text-cream">{stat.value}</div>
                      <div className="text-xs text-muted font-mono mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="page-container max-w-4xl py-8">
          <div className="grid lg:grid-cols-3 gap-6">

            {/* Left col — info */}
            <div className="lg:col-span-2 space-y-6">

              {/* Bio */}
              <div className="card">
                <h2 className="font-display text-lg font-bold text-dark mb-3">À propos</h2>
                <p className="text-muted leading-relaxed text-sm">{artisan.bio}</p>
              </div>

              {/* Spécialités */}
              <div className="card">
                <h2 className="font-display text-lg font-bold text-dark mb-3">Spécialités</h2>
                <div className="flex flex-wrap gap-2">
                  {artisan.specialties.map(s => (
                    <span key={s} className="badge-orange">{s}</span>
                  ))}
                </div>
              </div>

              {/* Zones */}
              <div className="card">
                <h2 className="font-display text-lg font-bold text-dark mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-accent" /> Zones d'intervention
                </h2>
                <div className="flex flex-wrap gap-2">
                  {artisan.quartiers.map(q => (
                    <span key={q} className="badge bg-bg2 text-dark border border-border">{q}</span>
                  ))}
                </div>
              </div>

              {/* Tabs avis / certifs */}
              <div className="card">
                <div className="flex border-b border-border mb-6">
                  {[
                    { id: 'avis' as const, label: `Avis (${artisan.reviews.length})` },
                    { id: 'infos' as const, label: 'Certifications' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`pb-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-accent text-dark'
                          : 'border-transparent text-muted hover:text-dark'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'avis' && (
                  <div className="space-y-4">
                    {artisan.reviews.map((r, i) => (
                      <div key={i} className="pb-4 border-b border-border last:border-0 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-bg2 rounded-full flex items-center justify-center font-bold text-sm text-dark">
                              {r.author[0]}
                            </div>
                            <span className="font-medium text-sm text-dark">{r.author}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, j) => (
                                <Star key={j} size={12} className={j < r.note ? 'text-gold fill-gold' : 'text-border'} />
                              ))}
                            </div>
                            <span className="text-xs text-muted font-mono">{r.date}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted">{r.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'infos' && (
                  <div className="space-y-3">
                    {artisan.certifications.map(c => (
                      <div key={c} className="flex items-center gap-3 p-3 bg-accent2/5 border border-accent2/20 rounded-xl">
                        <Shield size={16} className="text-accent2 flex-shrink-0" />
                        <span className="text-sm text-dark font-medium">{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right col — sticky CTA */}
            <div className="space-y-4">
              <div className="card sticky top-24">
                <div className="text-center mb-6">
                  <p className="font-mono text-xs text-muted uppercase tracking-wider mb-1">Tarif minimum</p>
                  <p className="font-display text-4xl font-bold text-dark">{artisan.tarif.toLocaleString()}</p>
                  <p className="text-sm text-muted">FCFA / intervention</p>
                </div>

                <div className="space-y-3 mb-6">
                  {[
                    { icon: Clock, text: `Réponse en ${artisan.response_time} min en moyenne` },
                    { icon: ThumbsUp, text: `${artisan.success_rate}% de taux de satisfaction` },
                    { icon: Shield, text: 'Paiement 100% sécurisé via Wave' },
                  ].map(item => (
                    <div key={item.text} className="flex items-center gap-2 text-sm text-muted">
                      <item.icon size={14} className="text-accent2 flex-shrink-0" />
                      {item.text}
                    </div>
                  ))}
                </div>

                <Link
                  href={`/matching?artisan=${artisan.id}`}
                  className="btn-primary w-full flex items-center justify-center gap-2 mb-3"
                >
                  <Zap size={16} />
                  Réserver cet artisan
                </Link>

                <Link
                  href="/diagnostic"
                  className="btn-outline w-full flex items-center justify-center gap-2 text-sm"
                >
                  Faire un diagnostic d'abord
                  <ChevronRight size={14} />
                </Link>

                <div className="mt-4 pt-4 border-t border-border flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-1 text-xs text-muted hover:text-dark transition-colors py-2 rounded-lg hover:bg-bg2">
                    <Phone size={14} /> Appeler
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 text-xs text-muted hover:text-dark transition-colors py-2 rounded-lg hover:bg-bg2">
                    <MessageCircle size={14} /> Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
