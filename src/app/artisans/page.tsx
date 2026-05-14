'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { Search, Star, MapPin, Clock, Building2, Droplets, Zap, Paintbrush, Hammer, Ruler, Wind, Lock, LayoutGrid, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/useIsMobile'

const METIERS = ['Tous', 'Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie', 'Climatisation', 'Serrurerie', 'Carrelage']
const METIER_ICON_MAP: Record<string, React.ElementType> = {
  'Plomberie': Droplets, 'Électricité': Zap, 'Peinture': Paintbrush,
  'Maçonnerie': Hammer, 'Menuiserie': Ruler, 'Climatisation': Wind,
  'Serrurerie': Lock, 'Carrelage': LayoutGrid,
}

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_HOVER  = '10px 10px 22px rgba(163,177,198,0.65), -6px -6px 16px rgba(255,255,255,1)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

export default function ArtisansPage() {
  const isMobile = useIsMobile()
  const [artisans, setArtisans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [metier, setMetier] = useState('Tous')

  useEffect(() => {
    const fetchArtisans = async () => {
      const { data, error } = await supabase
        .from('artisan_pros')
        .select(`*, users!artisan_pros_user_id_fkey(name, quartier, avatar_url), entreprises(id, name)`)
        .eq('kyc_status', 'approved')
        .order('rating_avg', { ascending: false })

      if (!error) setArtisans(data || [])
      setLoading(false)
    }
    fetchArtisans()
  }, [])

  const filtered = artisans.filter(a => {
    const name = a.users?.name?.toLowerCase() || ''
    const matchSearch = !search || name.includes(search.toLowerCase())
    const matchMetier = metier === 'Tous' || a.metier === metier
    return matchSearch && matchMetier
  })

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      <Navbar />

      {/* Orange Hero */}
      <section className="afrione-gradient" style={{ position: 'relative', overflow: 'hidden', paddingTop: '64px', minHeight: '220px', display: 'flex', alignItems: 'center' }}>
        {/* Floating white squares */}
        <div style={{ position: 'absolute', top: '20%', left: '5%', width: 48, height: 48, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 10, animation: 'floatSquare 5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '55%', right: '7%', width: 32, height: 32, background: 'rgba(255,255,255,0.12)', borderRadius: 8, animation: 'floatSquare 4s ease-in-out infinite 1s' }} />
        <div style={{ position: 'absolute', top: '30%', right: '22%', width: 20, height: 20, background: 'rgba(255,255,255,0.16)', borderRadius: 5, animation: 'floatSquareSlow 6s ease-in-out infinite 2s' }} />
        <div style={{ position: 'absolute', bottom: '20%', left: '18%', width: 60, height: 60, border: '1.5px solid rgba(255,255,255,0.13)', borderRadius: 14, animation: 'floatSquareSlow 7s ease-in-out infinite 0.5s' }} />
        <div style={{ position: 'absolute', top: '45%', left: '38%', width: 14, height: 14, background: 'rgba(255,255,255,0.22)', borderRadius: 4, animation: 'floatSquareDrift 5s ease-in-out infinite 3s' }} />
        {/* Content */}
        <div className="page-container" style={{ position: 'relative', zIndex: 10, padding: '32px 32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '20px', padding: '5px 14px', marginBottom: '14px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', letterSpacing: '0.12em', fontFamily: 'Space Mono' }}>ANNUAIRE</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: 'white', margin: '0 0 10px', textShadow: '0 2px 20px rgba(0,0,0,0.1)' }}>Trouvez votre artisan</h1>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '15px', margin: 0 }}>
            {loading ? 'Chargement...' : `${filtered.length} professionnel${filtered.length > 1 ? 's' : ''} vérifié${filtered.length > 1 ? 's' : ''} à Abidjan`}
          </p>
        </div>
      </section>

      <div style={{ padding: isMobile ? '24px 12px 48px' : '32px 16px 64px' }}>
        <div className="page-container">

          {/* Recherche */}
          <div style={{
            background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '16px', marginBottom: '24px',
            boxShadow: NEU_SMALL,
          }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#8B95A5' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom..."
                style={{
                  width: '100%', paddingLeft: '48px', padding: '10px 14px 10px 48px',
                  background: '#F5F7FA', border: '1.5px solid #E2E8F0', borderRadius: '10px',
                  fontSize: '15px', color: '#3D4852', outline: 'none',
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                }}
              />
            </div>
          </div>

          {/* Filtres métier */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '32px' }}>
            {METIERS.map(m => (
              <button key={m} onClick={() => setMetier(m)} style={{
                flexShrink: 0, padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.2s', border: 'none',
                background: metier === m ? '#E85D26' : '#FFFFFF',
                color: metier === m ? '#FFFFFF' : '#6B7280',
                boxShadow: metier === m ? '0 4px 12px rgba(232,93,38,0.3)' : NEU_SMALL,
              }}>
                {(() => { const I = METIER_ICON_MAP[m]; return m !== 'Tous' && I ? <I size={13} style={{marginRight:2}} /> : null })()}{m}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid rgba(232,93,38,0.2)', borderTop: '4px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</p>
              <h3 className="font-display" style={{ fontSize: '20px', fontWeight: 700, color: '#3D4852' }}>Aucun artisan trouvé</h3>
              <p style={{ color: '#6B7280', marginTop: '8px' }}>Essayez avec d'autres critères</p>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Orange decorative squares */}
              <div style={{ position: 'absolute', top: '8%', right: '-16px', width: 56, height: 56, background: 'rgba(232,93,38,0.07)', borderRadius: 12, animation: 'floatSquare 5.5s ease-in-out infinite', transform: 'rotate(15deg)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '40%', left: '-20px', width: 40, height: 40, border: '2px solid rgba(232,93,38,0.12)', borderRadius: 10, animation: 'floatSquareSlow 6s ease-in-out infinite 1.5s', transform: 'rotate(-8deg)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '15%', right: '2%', width: 24, height: 24, background: 'rgba(232,93,38,0.1)', borderRadius: 6, animation: 'floatSquareDrift 4.5s ease-in-out infinite 2.5s', pointerEvents: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))', gap: '16px' }}>
              {filtered.map(a => {
                const coverPhoto = a.portfolio?.[0] || null
                const avatarUrl = a.users?.avatar_url || null
                const name = a.users?.name || a.metier || 'Artisan'
                const rating = a.rating_avg || 0
                const stars = Math.round(rating)

                return (
                  <Link key={a.id} href={`/artisans/${a.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: '#FFFFFF', borderRadius: '20px', overflow: 'hidden',
                      border: '1.5px solid #E2E8F0', cursor: 'pointer',
                      boxShadow: NEU_SHADOW,
                      transition: 'all 0.25s',
                    }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow = NEU_HOVER
                        ;(e.currentTarget as HTMLElement).style.borderColor = '#E85D26'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow = NEU_SHADOW
                        ;(e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'
                      }}>

                      {/* Cover photo */}
                      <div style={{ position: 'relative', height: '180px', background: coverPhoto ? '#E2E8F0' : '#F5F7FA', overflow: 'hidden' }}>
                        {coverPhoto ? (
                          <img src={coverPhoto} alt={a.metier} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(() => { const I = METIER_ICON_MAP[a.metier] || Wrench; return <I size={56} color='rgba(232,93,38,0.25)' /> })()}
                          </div>
                        )}
                        {/* Badges */}
                        <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '11px', color: '#2B6B3E', background: 'rgba(240,255,244,0.95)', border: '1px solid rgba(43,107,62,0.3)', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>✓ Vérifié</span>
                          {a.is_available && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#2B6B3E', background: 'rgba(240,255,244,0.95)', border: '1px solid rgba(43,107,62,0.3)', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>
                              <span style={{ width: '6px', height: '6px', background: '#2B6B3E', borderRadius: '50%', display: 'inline-block' }} /> Disponible
                            </span>
                          )}
                        </div>

                        {/* Avatar en bas */}
                        <div style={{ position: 'absolute', bottom: '-24px', left: '20px', width: '56px', height: '56px', borderRadius: '14px', border: '3px solid white', overflow: 'hidden', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: NEU_SMALL }}>
                          {avatarUrl
                            ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: '22px', fontWeight: 700, color: '#6B7280' }}>{name[0]?.toUpperCase()}</span>
                          }
                        </div>
                      </div>

                      {/* Contenu */}
                      <div style={{ padding: '16px 20px 20px', paddingTop: '36px' }}>
                        <h3 className="font-display" style={{ fontSize: '17px', fontWeight: 800, color: '#3D4852', marginBottom: '2px' }}>{name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>
                          <span className="afrione-gradient-text" style={{ fontWeight: 600 }}>{(() => { const I = METIER_ICON_MAP[a.metier]; return I ? <I size={13} style={{display:'inline',verticalAlign:'middle',marginRight:3}} /> : null })()}{a.metier}</span>
                          <span>·</span>
                          <MapPin size={11} />
                          <span>{a.users?.quartier || 'Abidjan'}</span>
                        </div>
                        {a.entreprises && (
                          <div style={{ marginBottom: '10px' }}>
                            <Link href={`/entreprise-space/dashboard?id=${a.entreprises.id}`} onClick={e => e.stopPropagation()}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', padding: '3px 10px', borderRadius: '12px', textDecoration: 'none', fontWeight: 600 }}>
                              <Building2 size={10} /> {a.entreprises.name}
                            </Link>
                          </div>
                        )}

                        {/* Étoiles */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} size={13} style={{ color: i < stars ? '#C9A84C' : '#E2E8F0' }} fill={i < stars ? '#C9A84C' : 'none'} />
                            ))}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#3D4852' }}>{rating > 0 ? rating.toFixed(1) : '—'}</span>
                          <span style={{ fontSize: '12px', color: '#6B7280' }}>({a.rating_count || 0} avis)</span>
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '16px' }}>
                          {[
                            { value: a.mission_count || 0, label: 'Missions' },
                            { value: `${a.years_experience || 0}ans`, label: 'Exp.' },
                            { value: `~${a.response_time_min || 30}min`, label: 'Réponse' },
                          ].map(s => (
                            <div key={s.label} style={{
                              background: '#F5F7FA', borderRadius: '10px', padding: '8px', textAlign: 'center',
                              border: '1px solid #E2E8F0',
                            }}>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: '#3D4852' }}>{s.value}</div>
                              <div style={{ fontSize: '11px', color: '#6B7280' }}>{s.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Portfolio preview (3 petites photos si dispo) */}
                        {a.portfolio?.length > 1 && (
                          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                            {a.portfolio.slice(1, 4).map((url: string, i: number) => (
                              <div key={i} style={{ flex: 1, aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#F5F7FA' }}>
                                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ))}
                            {a.portfolio.length > 4 && (
                              <div style={{ flex: 1, aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>
                                +{a.portfolio.length - 4}
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span className="afrione-gradient-text" style={{ fontSize: '13px', fontWeight: 600 }}>Voir le profil →</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
