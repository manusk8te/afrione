'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { ArrowLeft, Star, CheckCircle, MapPin, Clock, Shield, Phone, MessageCircle, Zap, ThumbsUp, ChevronRight, Camera, Briefcase, X, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useIsMobile } from '@/hooks/useIsMobile'

type Photo = { url: string; category: string; date: string | null; notes?: string }

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

export default function ArtisanProfilePage() {
  const params = useParams()
  const isMobile = useIsMobile()
  const id = params.id as string
  const [artisan, setArtisan] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'avis'|'certifs'>('avis')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [existingMission, setExistingMission] = useState<any>(null)
  const [reserving, setReserving] = useState(false)
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: artisanData } = await supabase
        .from('artisan_pros')
        .select('*, users!artisan_pros_user_id_fkey(id, name, avatar_url, quartier, phone)')
        .eq('id', id)
        .single()
      if (!artisanData) { setLoading(false); return }
      setArtisan(artisanData)
      setUser(artisanData.users)

      const { data: missionsData } = await supabase
        .from('missions')
        .select('*, proof_of_work(photo_before_urls, photo_after_urls, artisan_notes), diagnostics(ai_summary, category_detected)')
        .eq('artisan_id', id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(12)
      setMissions(missionsData || [])

      const { data: reviewsData } = await supabase
        .from('sentiment_logs')
        .select('*, missions(client_id, users!missions_client_id_fkey(name))')
        .eq('artisan_id', id)
        .eq('source', 'review')
        .order('created_at', { ascending: false })
        .limit(20)
      setReviews(reviewsData || [])

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setCurrentUserId(session.user.id)
        const { data: existingM } = await supabase
          .from('missions')
          .select('id, status')
          .eq('client_id', session.user.id)
          .eq('artisan_id', id)
          .in('status', ['negotiation', 'en_cours', 'payment', 'matching'])
          .single()
        if (existingM) setExistingMission(existingM)
      }

      setLoading(false)
    }
    load()
  }, [id])

  const closeLightbox = useCallback(() => setLightbox(null), [])
  const prevPhoto = useCallback(() => setLightbox(l => l && l.index > 0 ? { ...l, index: l.index - 1 } : l), [])
  const nextPhoto = useCallback(() => setLightbox(l => l && l.index < l.photos.length - 1 ? { ...l, index: l.index + 1 } : l), [])

  useEffect(() => {
    if (!lightbox) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') prevPhoto()
      if (e.key === 'ArrowRight') nextPhoto()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox, closeLightbox, prevPhoto, nextPhoto])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid rgba(232,93,38,0.2)', borderTop: '4px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  if (!artisan) return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '48px' }}>404</p>
        <Link href="/artisans" className="afrione-gradient-text">← Retour</Link>
      </div>
    </div>
  )

  const handleReserver = async () => {
    if (!currentUserId) { router.push('/auth'); return }
    if (existingMission) { router.push(`/warroom/${existingMission.id}`); return }
    setReserving(true)
    const { data: mission, error } = await supabase
      .from('missions')
      .insert({
        client_id: currentUserId,
        artisan_id: id,
        status: 'negotiation',
        category: artisan?.metier || 'Intervention',
        quartier: 'Abidjan',
      })
      .select()
      .single()
    if (error) {
      toast.error('Impossible de créer la mission. Veuillez réessayer.')
      setReserving(false)
      return
    }
    if (mission) router.push(`/warroom/${mission.id}`)
    setReserving(false)
  }

  const name = user?.name || 'Artisan'
  const avatarUrl = user?.avatar_url
  const rating = artisan.rating_avg || 0
  const stars = Math.round(rating)

  // Toutes les photos : missions (avant/après) + portfolio manuel
  const missionPhotos: Photo[] = missions.flatMap((m: any) =>
    (m.proof_of_work?.[0]?.photo_after_urls || []).map((url: string) => ({
      url,
      category: m.category || m.diagnostics?.[0]?.category_detected || 'Intervention',
      date: m.completed_at,
      notes: m.proof_of_work?.[0]?.artisan_notes || '',
    }))
  ).filter((p: any) => p.url)

  const portfolioPhotos: Photo[] = (artisan.portfolio || []).map((url: string) => ({
    url, category: artisan.metier || 'Portfolio', date: null,
  }))

  const allPhotos: Photo[] = [...portfolioPhotos, ...missionPhotos].slice(0, 18)

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      <Navbar />

      {/* Lightbox */}
      {lightbox && (
        <div onClick={closeLightbox} style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,14,11,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Bouton fermer */}
          <button onClick={closeLightbox} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
            <X size={20} />
          </button>

          {/* Compteur */}
          <div style={{ position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontFamily: 'Space Mono' }}>
            {lightbox.index + 1} / {lightbox.photos.length}
          </div>

          {/* Prev */}
          {lightbox.index > 0 && (
            <button onClick={e => { e.stopPropagation(); prevPhoto() }} style={{
              position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: 'white',
            }}>
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Next */}
          {lightbox.index < lightbox.photos.length - 1 && (
            <button onClick={e => { e.stopPropagation(); nextPhoto() }} style={{
              position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: 'white',
            }}>
              <ChevronRight size={24} />
            </button>
          )}

          {/* Image */}
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <img
              src={lightbox.photos[lightbox.index].url}
              alt={lightbox.photos[lightbox.index].category}
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '12px' }}
            />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{lightbox.photos[lightbox.index].category}</div>
              {lightbox.photos[lightbox.index].date && (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                  {new Date(lightbox.photos[lightbox.index].date!).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </div>
              )}
              {lightbox.photos[lightbox.index].notes && (
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '8px', maxWidth: '480px', lineHeight: '1.5' }}>
                  {lightbox.photos[lightbox.index].notes}
                </div>
              )}
            </div>
          </div>

          {/* Thumbnails */}
          {lightbox.photos.length > 1 && (
            <div onClick={e => e.stopPropagation()} style={{
              position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '80vw', padding: '4px',
            }}>
              {lightbox.photos.map((p, i) => (
                <div key={i} onClick={() => setLightbox(l => l ? { ...l, index: i } : l)} style={{
                  width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden',
                  flexShrink: 0, cursor: 'pointer',
                  border: i === lightbox.index ? '2px solid #E85D26' : '2px solid transparent',
                  opacity: i === lightbox.index ? 1 : 0.5,
                  transition: 'all 0.15s',
                }}>
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ paddingTop: '80px', paddingBottom: '64px' }}>

        {/* Hero blanc/neumorphique */}
        <div style={{ background: '#FFFFFF', borderBottom: '1.5px solid #E2E8F0', boxShadow: '0 4px 20px rgba(163,177,198,0.3)' }}>
          <div className="page-container" style={{ padding: isMobile ? '16px' : '32px', maxWidth: '896px' }}>
            <Link href="/artisans" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6B7280', textDecoration: 'none', marginBottom: '24px' }}>
              <ArrowLeft size={16} /> Retour aux artisans
            </Link>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? '14px' : '24px' }}>
              <div style={{
                width: '96px', height: '96px', borderRadius: '20px', flexShrink: 0,
                border: '2px solid rgba(232,93,38,0.3)', overflow: 'hidden',
                background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: NEU_SMALL,
              }}>
                {avatarUrl ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '40px' }}>👷</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {artisan.kyc_status === 'approved' && (
                    <span style={{ fontSize: '11px', color: '#2B6B3E', background: 'rgba(43,107,62,0.08)', border: '1px solid rgba(43,107,62,0.25)', padding: '3px 10px', borderRadius: '20px' }}>✓ KYC Vérifié</span>
                  )}
                  {artisan.is_available && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#2B6B3E', background: 'rgba(43,107,62,0.08)', border: '1px solid rgba(43,107,62,0.2)', padding: '3px 10px', borderRadius: '20px' }}>
                      <span style={{ width: '6px', height: '6px', background: '#2B6B3E', borderRadius: '50%' }} /> Disponible
                    </span>
                  )}
                </div>
                <div className="font-display" style={{ fontSize: '32px', fontWeight: 800, color: '#3D4852', lineHeight: 1.1 }}>{artisan.metier}</div>
                <div style={{ fontSize: '15px', color: '#6B7280', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{name}</span><span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {user?.quartier || 'Abidjan'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={16} style={{ color: i < stars ? '#C9A84C' : '#E2E8F0' }} fill={i < stars ? '#C9A84C' : 'none'} />
                    ))}
                  </div>
                  <span className="font-display" style={{ fontSize: '18px', fontWeight: 700, color: '#3D4852' }}>{rating > 0 ? rating.toFixed(1) : '—'}</span>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>({artisan.rating_count || 0} avis)</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '12px', borderTop: '1.5px solid #E2E8F0', paddingTop: '20px', marginTop: '20px' }}>
              {[
                { value: artisan.mission_count || missions.length, label: 'Missions' },
                { value: `${artisan.years_experience || 0}ans`, label: 'Expérience' },
                { value: `${artisan.success_rate || 0}%`, label: 'Satisfaction' },
                { value: `${artisan.response_time_min || 30}min`, label: 'Réponse' },
              ].map(s => (
                <div key={s.label} style={{
                  textAlign: 'center', padding: '12px', background: '#F5F7FA', borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}>
                  <div className="font-display" style={{ fontSize: '22px', fontWeight: 700, color: '#3D4852' }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: '#8B95A5', fontFamily: 'Space Mono' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="page-container" style={{ padding: isMobile ? '16px' : '32px', maxWidth: '896px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '20px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* RÉALISATIONS — section mise en avant */}
              <div style={{ background: '#FFFFFF', borderRadius: '20px', overflow: 'hidden', boxShadow: NEU_SHADOW, border: '1.5px solid #E2E8F0' }}>
                <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #E2E8F0' }}>
                  <h2 className="font-display" style={{ fontSize: '18px', fontWeight: 700, color: '#3D4852', margin: 0 }}>
                    Réalisations
                    {allPhotos.length > 0 && <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 400, color: '#6B7280' }}>({allPhotos.length} photos)</span>}
                  </h2>
                  {allPhotos.length > 0 && (
                    <span style={{ fontSize: '12px', color: '#8B95A5', fontFamily: 'Space Mono' }}>Cliquez pour agrandir</span>
                  )}
                </div>

                {allPhotos.length > 0 ? (
                  <div>
                    {/* Grande première photo */}
                    <div
                      onClick={() => setLightbox({ photos: allPhotos, index: 0 })}
                      style={{ cursor: 'pointer', position: 'relative', height: '280px', background: '#E2E8F0', overflow: 'hidden' }}
                    >
                      <img src={allPhotos[0].url} alt={allPhotos[0].category} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%,rgba(61,72,82,0.5))' }} />
                      <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'white', background: 'rgba(232,93,38,0.85)', padding: '4px 12px', borderRadius: '20px' }}>{allPhotos[0].category}</span>
                          {allPhotos[0].date && (
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '6px' }}>
                              {new Date(allPhotos[0].date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: 'white', background: 'rgba(61,72,82,0.55)', padding: '4px 10px', borderRadius: '20px' }}>Voir en grand →</span>
                      </div>
                    </div>

                    {/* Grille des autres photos */}
                    {allPhotos.length > 1 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '3px', padding: '3px' }}>
                        {allPhotos.slice(1, 7).map((p, i) => {
                          const isLast = i === 5 && allPhotos.length > 7
                          return (
                            <div
                              key={i}
                              onClick={() => setLightbox({ photos: allPhotos, index: i + 1 })}
                              style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: '#F5F7FA', cursor: 'pointer' }}
                            >
                              <img src={p.url} alt={p.category} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                              />
                              {/* Overlay catégorie */}
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(61,72,82,0.6))', padding: '6px 8px' }}>
                                <div style={{ fontSize: '10px', color: 'white', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.category}</div>
                              </div>
                              {/* Overlay "voir plus" sur la dernière */}
                              {isLast && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(61,72,82,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ textAlign: 'center', color: 'white' }}>
                                    <div style={{ fontSize: '22px', fontWeight: 700 }}>+{allPhotos.length - 7}</div>
                                    <div style={{ fontSize: '11px', opacity: 0.8 }}>photos</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : missions.length > 0 ? (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {missions.map((m: any) => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#F5F7FA', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                        <div style={{ width: '40px', height: '40px', background: 'rgba(232,93,38,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Briefcase size={18} style={{ color: '#E85D26' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#3D4852' }}>{m.category || m.diagnostics?.[0]?.category_detected || 'Intervention'}</div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>{m.quartier || 'Abidjan'} · {m.completed_at ? new Date(m.completed_at).toLocaleDateString('fr-FR') : ''}</div>
                        </div>
                        <CheckCircle size={16} style={{ color: '#2B6B3E' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#8B95A5' }}>
                    <Camera size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p style={{ fontSize: '14px' }}>Les réalisations apparaîtront au fil des missions</p>
                  </div>
                )}
              </div>

              {artisan.bio && (
                <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', boxShadow: NEU_SHADOW, border: '1.5px solid #E2E8F0' }}>
                  <h2 className="font-display" style={{ fontSize: '18px', fontWeight: 700, color: '#3D4852', marginBottom: '12px' }}>À propos</h2>
                  <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.7' }}>{artisan.bio}</p>
                </div>
              )}

              {artisan.specialties?.length > 0 && (
                <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', boxShadow: NEU_SHADOW, border: '1.5px solid #E2E8F0' }}>
                  <h2 className="font-display" style={{ fontSize: '18px', fontWeight: 700, color: '#3D4852', marginBottom: '12px' }}>Spécialités</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {artisan.specialties.map((s: string) => (
                      <span key={s} className="afrione-gradient-text" style={{ padding: '6px 14px', background: 'rgba(232,93,38,0.06)', border: '1px solid rgba(232,93,38,0.18)', borderRadius: '20px', fontSize: '13px', fontWeight: 500 }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {artisan.quartiers?.length > 0 && (
                <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', boxShadow: NEU_SHADOW, border: '1.5px solid #E2E8F0' }}>
                  <h2 className="font-display" style={{ fontSize: '18px', fontWeight: 700, color: '#3D4852', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} style={{ color: '#E85D26' }} /> Zones d'intervention
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {artisan.quartiers.map((q: string) => (
                      <span key={q} style={{ padding: '6px 14px', background: '#F5F7FA', border: '1.5px solid #E2E8F0', borderRadius: '20px', fontSize: '13px', color: '#3D4852' }}>{q}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Avis + Certifs */}
              <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', boxShadow: NEU_SHADOW, border: '1.5px solid #E2E8F0' }}>
                <div style={{ display: 'flex', borderBottom: '1.5px solid #E2E8F0', marginBottom: '24px' }}>
                  {[
                    { id: 'avis' as const, label: `Avis (${reviews.length})` },
                    { id: 'certifs' as const, label: 'Certifications' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                      padding: '0 4px', paddingBottom: '12px', marginRight: '24px', fontSize: '14px', fontWeight: 500,
                      border: 'none', background: 'none', cursor: 'pointer',
                      borderBottom: activeTab === t.id ? '2px solid #E85D26' : '2px solid transparent',
                      color: activeTab === t.id ? '#3D4852' : '#6B7280',
                    }}>{t.label}</button>
                  ))}
                </div>

                {activeTab === 'avis' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {reviews.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px 0', color: '#8B95A5' }}>
                        <Star size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <p style={{ fontSize: '14px' }}>Aucun avis pour l'instant</p>
                      </div>
                    ) : reviews.map((r: any, i: number) => (
                      <div key={i} style={{ paddingBottom: '16px', borderBottom: '1.5px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', background: '#F5F7FA', border: '1.5px solid #E2E8F0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: '#3D4852' }}>
                              {(r.missions?.users?.name || 'C')[0]}
                            </div>
                            <span style={{ fontWeight: 500, fontSize: '14px', color: '#3D4852' }}>{r.missions?.users?.name || 'Client'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {Array.from({ length: 5 }).map((_, j) => (
                              <Star key={j} size={12} style={{ color: r.sentiment_score && j < Math.round(r.sentiment_score * 5) ? '#C9A84C' : '#E2E8F0' }} fill={r.sentiment_score && j < Math.round(r.sentiment_score * 5) ? '#C9A84C' : 'none'} />
                            ))}
                          </div>
                        </div>
                        <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.6' }}>{r.raw_text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'certifs' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(artisan.certifications || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px 0', color: '#8B95A5' }}>
                        <Shield size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <p style={{ fontSize: '14px' }}>Aucune certification renseignée</p>
                      </div>
                    ) : artisan.certifications.map((c: string) => (
                      <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(43,107,62,0.04)', border: '1px solid rgba(43,107,62,0.18)', borderRadius: '12px' }}>
                        <Shield size={16} style={{ color: '#2B6B3E' }} />
                        <span style={{ fontSize: '14px', color: '#3D4852', fontWeight: 500 }}>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar CTA */}
            <div>
              <div style={{
                background: '#FFFFFF', borderRadius: '20px', padding: '24px',
                boxShadow: NEU_SHADOW, border: '1.5px solid #E2E8F0',
                ...(isMobile ? {} : { position: 'sticky', top: '96px' }),
              }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', overflow: 'hidden', background: '#F5F7FA', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: NEU_SMALL, border: '1.5px solid #E2E8F0' }}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '28px' }}>👷</span>
                    }
                  </div>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: '#3D4852' }}>{name}</p>
                  <p style={{ fontSize: '13px', color: '#6B7280' }}>{artisan.metier}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '6px' }}>
                    <Star size={13} fill='#C9A84C' style={{ color: '#C9A84C' }} />
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#3D4852' }}>{rating > 0 ? rating.toFixed(1) : '—'}</span>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>· {artisan.mission_count || 0} missions</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {[
                    { icon: Clock, text: `Réponse en ${artisan.response_time_min || 30} min` },
                    { icon: ThumbsUp, text: `${artisan.success_rate || 0}% de satisfaction` },
                    { icon: Shield, text: 'Paiement sécurisé via Wave' },
                  ].map(item => (
                    <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280' }}>
                      <item.icon size={14} style={{ color: '#2B6B3E', flexShrink: 0 }} /> {item.text}
                    </div>
                  ))}
                </div>
                <button onClick={handleReserver} disabled={reserving} className={reserving ? '' : 'btn-primary'} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '14px', background: reserving ? '#E2E8F0' : undefined, color: reserving ? '#6B7280' : 'white',
                  border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginBottom: '12px'
                }}>
                  {reserving
                    ? <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> En cours...</>
                    : existingMission
                    ? <><MessageCircle size={16} /> Continuer la conversation</>
                    : <><Zap size={16} /> Réserver cet artisan</>
                  }
                </button>
                {!existingMission && (
                  <Link href={`/diagnostic?artisan=${id}`} className="btn-outline" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}>
                    Faire un diagnostic d'abord <ChevronRight size={14} />
                  </Link>
                )}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1.5px solid #E2E8F0', display: 'flex', gap: '8px' }}>
                  <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', color: '#6B7280', background: '#F5F7FA', border: '1.5px solid #E2E8F0', cursor: 'pointer', padding: '8px', borderRadius: '8px', boxShadow: NEU_SMALL }}>
                    <Phone size={14} /> Appeler
                  </button>
                  <button onClick={() => existingMission ? router.push(`/warroom/${existingMission.id}`) : handleReserver()}
                    className={existingMission ? 'afrione-gradient-text' : ''}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', color: existingMission ? undefined : '#6B7280', background: '#F5F7FA', border: '1.5px solid #E2E8F0', cursor: 'pointer', padding: '8px', borderRadius: '8px', fontWeight: existingMission ? 600 : 400, boxShadow: NEU_SMALL }}>
                    <MessageCircle size={14} /> {existingMission ? 'Ouvrir le chat' : 'Message'}
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
