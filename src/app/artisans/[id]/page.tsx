'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { ArrowLeft, Star, CheckCircle, MapPin, Clock, Shield, Phone, MessageCircle, Zap, Award, ThumbsUp, ChevronRight, Camera, Briefcase } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ArtisanProfilePage() {
  const params = useParams()
  const id = params.id as string
  const [artisan, setArtisan] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'missions'|'avis'|'certifs'>('missions')

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
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
    </div>
  )

  if (!artisan) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <p style={{fontSize:'48px'}}>404</p>
        <Link href="/artisans" style={{color:'#E85D26'}}>← Retour</Link>
      </div>
    </div>
  )

  const name = user?.name || 'Artisan'
  const avatarUrl = user?.avatar_url
  const rating = artisan.rating_avg || 0
  const stars = Math.round(rating)

  const missionPhotos = missions.flatMap((m: any) =>
    (m.proof_of_work?.[0]?.photo_after_urls || []).map((url: string) => ({
      url, category: m.category || m.diagnostics?.[0]?.category_detected || 'Intervention', date: m.completed_at,
    }))
  ).filter((p: any) => p.url).slice(0, 9)

  const manualPhotos = (artisan.portfolio || []).map((url: string) => ({
    url, category: 'Portfolio', date: null,
  }))

  const allPhotos = [...missionPhotos, ...manualPhotos]

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div style={{paddingTop:'80px',paddingBottom:'64px'}}>

        <div style={{background:'#0F1410',color:'#FAFAF5'}}>
          <div className="page-container" style={{padding:'32px',maxWidth:'896px'}}>
            <Link href="/artisans" style={{display:'inline-flex',alignItems:'center',gap:'8px',fontSize:'14px',color:'#7A7A6E',textDecoration:'none',marginBottom:'24px'}}>
              <ArrowLeft size={16} /> Retour aux artisans
            </Link>
            <div style={{display:'flex',alignItems:'flex-start',gap:'24px'}}>
              <div style={{width:'96px',height:'96px',borderRadius:'20px',flexShrink:0,border:'2px solid rgba(232,93,38,0.4)',overflow:'hidden',background:'#1A1F1B',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {avatarUrl ? <img src={avatarUrl} alt={name} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span style={{fontSize:'40px'}}>👷</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'8px'}}>
                  {artisan.kyc_status === 'approved' && (
                    <span style={{fontSize:'11px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',border:'1px solid rgba(43,107,62,0.3)',padding:'3px 10px',borderRadius:'20px'}}>✓ KYC Vérifié</span>
                  )}
                  {artisan.is_available && (
                    <span style={{display:'inline-flex',alignItems:'center',gap:'4px',fontSize:'11px',color:'#2B6B3E',background:'rgba(43,107,62,0.1)',border:'1px solid rgba(43,107,62,0.2)',padding:'3px 10px',borderRadius:'20px'}}>
                      <span style={{width:'6px',height:'6px',background:'#2B6B3E',borderRadius:'50%'}} /> Disponible
                    </span>
                  )}
                </div>
                <div className="font-display" style={{fontSize:'32px',fontWeight:800,color:'#FAFAF5',lineHeight:1.1}}>{artisan.metier}</div>
                <div style={{fontSize:'15px',color:'#7A7A6E',marginTop:'4px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <span>{name}</span><span>·</span>
                  <span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}><MapPin size={12}/> {user?.quartier || 'Abidjan'}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'12px'}}>
                  <div style={{display:'flex',gap:'2px'}}>
                    {Array.from({length:5}).map((_,i) => (
                      <Star key={i} size={16} style={{color: i < stars ? '#C9A84C' : '#3A3A30'}} fill={i < stars ? '#C9A84C' : 'none'} />
                    ))}
                  </div>
                  <span className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#FAFAF5'}}>{rating.toFixed(1)}</span>
                  <span style={{fontSize:'13px',color:'#7A7A6E'}}>({artisan.rating_count || 0} avis)</span>
                </div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:'24px',marginTop:'24px'}}>
              {[
                {value: artisan.mission_count || missions.length, label:'Missions'},
                {value: `${artisan.years_experience||0}ans`, label:'Expérience'},
                {value: `${artisan.success_rate||0}%`, label:'Satisfaction'},
                {value: `${artisan.response_time_min||30}min`, label:'Réponse'},
              ].map(s => (
                <div key={s.label} style={{textAlign:'center'}}>
                  <div className="font-display" style={{fontSize:'22px',fontWeight:700,color:'#FAFAF5'}}>{s.value}</div>
                  <div style={{fontSize:'11px',color:'#7A7A6E',fontFamily:'Space Mono'}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="page-container" style={{padding:'32px',maxWidth:'896px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:'24px',alignItems:'start'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>

              {artisan.bio && (
                <div className="card">
                  <h2 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#0F1410',marginBottom:'12px'}}>À propos</h2>
                  <p style={{fontSize:'14px',color:'#7A7A6E',lineHeight:'1.7'}}>{artisan.bio}</p>
                </div>
              )}

              {artisan.specialties?.length > 0 && (
                <div className="card">
                  <h2 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#0F1410',marginBottom:'12px'}}>Spécialités</h2>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                    {artisan.specialties.map((s: string) => (
                      <span key={s} style={{padding:'6px 14px',background:'rgba(232,93,38,0.08)',border:'1px solid rgba(232,93,38,0.2)',borderRadius:'20px',fontSize:'13px',color:'#E85D26',fontWeight:500}}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {artisan.quartiers?.length > 0 && (
                <div className="card">
                  <h2 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#0F1410',marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
                    <MapPin size={16} style={{color:'#E85D26'}}/> Zones d'intervention
                  </h2>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                    {artisan.quartiers.map((q: string) => (
                      <span key={q} style={{padding:'6px 14px',background:'#F5F3EE',border:'1px solid #D8D2C4',borderRadius:'20px',fontSize:'13px',color:'#0F1410'}}>{q}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="card">
                <div style={{display:'flex',borderBottom:'1px solid #EDE8DE',marginBottom:'24px'}}>
                  {[
                    {id:'missions' as const, label:`Réalisations (${allPhotos.length || missions.length})`},
                    {id:'avis' as const, label:`Avis (${reviews.length})`},
                    {id:'certifs' as const, label:'Certifications'},
                  ].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                      padding:'0 4px',paddingBottom:'12px',marginRight:'24px',fontSize:'14px',fontWeight:500,
                      border:'none',background:'none',cursor:'pointer',
                      borderBottom: activeTab===t.id ? '2px solid #E85D26' : '2px solid transparent',
                      color: activeTab===t.id ? '#0F1410' : '#7A7A6E',
                    }}>{t.label}</button>
                  ))}
                </div>

                {activeTab === 'missions' && (
                  <div>
                    {allPhotos.length > 0 ? (
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                        {allPhotos.map((p: any, i: number) => (
                          <div key={i} style={{position:'relative',aspectRatio:'1',borderRadius:'12px',overflow:'hidden',background:'#EDE8DE'}}>
                            <img src={p.url} alt={p.category} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                            <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(15,20,16,0.8))',padding:'8px'}}>
                              <div style={{fontSize:'11px',color:'#FAFAF5',fontWeight:600}}>{p.category}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : missions.length > 0 ? (
                      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                        {missions.map((m: any) => (
                          <div key={m.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'#F5F3EE',borderRadius:'12px'}}>
                            <div style={{width:'40px',height:'40px',background:'rgba(232,93,38,0.1)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              <Briefcase size={18} style={{color:'#E85D26'}} />
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:600,fontSize:'14px',color:'#0F1410'}}>{m.category || m.diagnostics?.[0]?.category_detected || 'Intervention'}</div>
                              <div style={{fontSize:'12px',color:'#7A7A6E'}}>{m.quartier||'Abidjan'} · {m.completed_at ? new Date(m.completed_at).toLocaleDateString('fr-FR') : ''}</div>
                            </div>
                            <CheckCircle size={16} style={{color:'#2B6B3E'}} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{textAlign:'center',padding:'48px 0',color:'#7A7A6E'}}>
                        <Camera size={32} style={{margin:'0 auto 12px',opacity:0.3}} />
                        <p style={{fontSize:'14px'}}>Les réalisations apparaîtront au fil des missions</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'avis' && (
                  <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                    {reviews.length === 0 ? (
                      <div style={{textAlign:'center',padding:'48px 0',color:'#7A7A6E'}}>
                        <Star size={32} style={{margin:'0 auto 12px',opacity:0.3}} />
                        <p style={{fontSize:'14px'}}>Aucun avis pour l'instant</p>
                      </div>
                    ) : reviews.map((r: any, i: number) => (
                      <div key={i} style={{paddingBottom:'16px',borderBottom:'1px solid #EDE8DE'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <div style={{width:'32px',height:'32px',background:'#EDE8DE',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'13px'}}>
                              {(r.missions?.users?.name||'C')[0]}
                            </div>
                            <span style={{fontWeight:500,fontSize:'14px',color:'#0F1410'}}>{r.missions?.users?.name||'Client'}</span>
                          </div>
                          <div style={{display:'flex',gap:'2px'}}>
                            {Array.from({length:5}).map((_,j) => (
                              <Star key={j} size={12} style={{color: r.sentiment_score && j < Math.round(r.sentiment_score*5) ? '#C9A84C' : '#D8D2C4'}} fill={r.sentiment_score && j < Math.round(r.sentiment_score*5) ? '#C9A84C' : 'none'} />
                            ))}
                          </div>
                        </div>
                        <p style={{fontSize:'14px',color:'#7A7A6E',lineHeight:'1.6'}}>{r.raw_text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'certifs' && (
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    {(artisan.certifications||[]).length === 0 ? (
                      <div style={{textAlign:'center',padding:'48px 0',color:'#7A7A6E'}}>
                        <Shield size={32} style={{margin:'0 auto 12px',opacity:0.3}} />
                        <p style={{fontSize:'14px'}}>Aucune certification renseignée</p>
                      </div>
                    ) : artisan.certifications.map((c: string) => (
                      <div key={c} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',background:'rgba(43,107,62,0.05)',border:'1px solid rgba(43,107,62,0.2)',borderRadius:'12px'}}>
                        <Shield size={16} style={{color:'#2B6B3E'}} />
                        <span style={{fontSize:'14px',color:'#0F1410',fontWeight:500}}>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="card" style={{position:'sticky',top:'96px'}}>
                <div style={{textAlign:'center',marginBottom:'24px'}}>
                  <p style={{fontFamily:'Space Mono',fontSize:'11px',color:'#7A7A6E',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'4px'}}>Tarif minimum</p>
                  <p className="font-display" style={{fontSize:'40px',fontWeight:700,color:'#0F1410'}}>{(artisan.tarif_min||0).toLocaleString()}</p>
                  <p style={{fontSize:'13px',color:'#7A7A6E'}}>FCFA / intervention</p>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'24px'}}>
                  {[
                    {icon:Clock, text:`Réponse en ${artisan.response_time_min||30} min`},
                    {icon:ThumbsUp, text:`${artisan.success_rate||0}% de satisfaction`},
                    {icon:Shield, text:'Paiement sécurisé via Wave'},
                  ].map(item => (
                    <div key={item.text} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'#7A7A6E'}}>
                      <item.icon size={14} style={{color:'#2B6B3E',flexShrink:0}} /> {item.text}
                    </div>
                  ))}
                </div>
                <Link href={`/matching?artisan=${id}`} className="btn-primary" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginBottom:'12px'}}>
                  <Zap size={16}/> Réserver cet artisan
                </Link>
                <Link href="/diagnostic" className="btn-outline" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',fontSize:'13px'}}>
                  Diagnostic d'abord <ChevronRight size={14}/>
                </Link>
                <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid #EDE8DE',display:'flex',gap:'8px'}}>
                  <button style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'4px',fontSize:'12px',color:'#7A7A6E',background:'none',border:'none',cursor:'pointer',padding:'8px',borderRadius:'8px'}}>
                    <Phone size={14}/> Appeler
                  </button>
                  <button style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'4px',fontSize:'12px',color:'#7A7A6E',background:'none',border:'none',cursor:'pointer',padding:'8px',borderRadius:'8px'}}>
                    <MessageCircle size={14}/> Message
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
