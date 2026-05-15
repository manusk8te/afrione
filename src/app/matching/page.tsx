'use client'
import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { ArrowLeft, Star, MapPin, Clock, CheckCircle, Zap, Shield, ChevronRight, Building2, Droplets, Paintbrush, Hammer, Ruler, Wind, Lock, LayoutGrid, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function MatchingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const missionId = searchParams.get('mission')
  const category = searchParams.get('category') || 'Plomberie'

  const [artisans, setArtisans] = useState<any[]>([])
  const [entreprises, setEntreprises] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setUserId(session.user.id)

      const catWord = category.split(' ')[0]

      // Artisans + entreprises en parallèle
      const [artisanRes, entrepriseRes] = await Promise.all([
        supabase
          .from('artisan_pros')
          .select('*, users!artisan_pros_user_id_fkey(name, avatar_url, quartier)')
          .eq('kyc_status', 'approved')
          .eq('is_available', true)
          .ilike('metier', `%${catWord}%`)
          .order('rating_avg', { ascending: false })
          .limit(5),
        supabase
          .from('entreprises')
          .select('id, name, description, banner_url, logo_url, secteurs, quartiers, artisan_pros(id)')
          .eq('kyc_status', 'approved')
          .eq('is_active', true)
          .contains('secteurs', [category]),
      ])

      // Entreprises qui couvrent ce secteur
      setEntreprises(entrepriseRes.data || [])

      // Fallback artisans
      if (!artisanRes.data || artisanRes.data.length === 0) {
        const { data: fallback } = await supabase
          .from('artisan_pros')
          .select('*, users!artisan_pros_user_id_fkey(name, avatar_url, quartier)')
          .eq('kyc_status', 'approved')
          .eq('is_available', true)
          .order('rating_avg', { ascending: false })
          .limit(5)
        setArtisans(fallback || [])
      } else {
        setArtisans(artisanRes.data)
      }
      setLoading(false)
    }
    load()
  }, [category])

  const confirm = async () => {
    if (!selected) return
    setConfirming(true)

    try {
      const artisan = artisans.find(a => a.id === selected)
      let targetMissionId = missionId

      if (missionId) {
        await supabase
          .from('missions')
          .update({ artisan_id: selected, status: 'negotiation' })
          .eq('id', missionId)
      } else {
        const { data: mission } = await supabase
          .from('missions')
          .insert({
            client_id: userId,
            artisan_id: selected,
            status: 'negotiation',
            category,
            quartier: 'Abidjan',
          })
          .select()
          .single()
        if (mission) targetMissionId = mission.id
      }

      // Notifier l'artisan par push
      if (artisan?.user_id) {
        fetch('/api/push-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: artisan.user_id,
            title: 'AfriOne — Nouvelle mission !',
            body: `Un client vous a sélectionné pour : ${category}`,
            url: `https://afrione-sepia.vercel.app/warroom/${targetMissionId}`,
          }),
        }).catch(() => {})
      }

      if (targetMissionId) router.push(`/warroom/${targetMissionId}`)
    } catch {
      setConfirming(false)
    }
  }

  const METIER_ICON_MAP: Record<string, React.ElementType> = {
    'Plomberie': Droplets, 'Électricité': Zap, 'Maçonnerie': Hammer,
    'Peinture': Paintbrush, 'Menuiserie': Ruler, 'Climatisation': Wind,
    'Serrurerie': Lock, 'Carrelage': LayoutGrid,
  }

  return (
    <div className="min-h-screen bg-bg">
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
          <Link href="/diagnostic" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginBottom: '14px', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Retour
          </Link>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '20px', padding: '5px 14px', marginBottom: '14px', marginLeft: '12px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', letterSpacing: '0.12em', fontFamily: 'Tahoma' }}>MATCHING IA</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: 'white', margin: '0 0 10px', textShadow: '0 2px 20px rgba(0,0,0,0.1)' }}>Artisans disponibles</h1>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '15px', margin: 0 }}>Sélectionnés selon votre quartier et votre besoin</p>
        </div>
      </section>

      <div className="pb-16 px-4" style={{ paddingTop: '32px' }}>
        <div className="page-container max-w-3xl" style={{ position: 'relative' }}>
          {/* Orange decorative squares */}
          <div style={{ position: 'absolute', top: '8%', right: '-16px', width: 56, height: 56, background: 'rgba(232,93,38,0.07)', borderRadius: 12, animation: 'floatSquare 5.5s ease-in-out infinite', transform: 'rotate(15deg)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '40%', left: '-20px', width: 40, height: 40, border: '2px solid rgba(232,93,38,0.12)', borderRadius: 10, animation: 'floatSquareSlow 6s ease-in-out infinite 1.5s', transform: 'rotate(-8deg)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '15%', right: '2%', width: 24, height: 24, background: 'rgba(232,93,38,0.1)', borderRadius: 6, animation: 'floatSquareDrift 4.5s ease-in-out infinite 2.5s', pointerEvents: 'none' }} />

          {/* Structures entreprises — si la mission peut nécessiter plusieurs corps */}
          {!loading && entreprises.length > 0 && (
            <div style={{marginBottom:'32px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                <Building2 size={16} style={{color:'#60a5fa'}} />
                <span style={{fontSize:'13px',fontWeight:700,color:'#3D4852'}}>Structures professionnelles</span>
                <span style={{fontSize:'11px',color:'#7A7A6E',background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.2)',padding:'2px 8px',borderRadius:'10px'}}>multi-corps d'état</span>
              </div>
              <div className="space-y-3">
                {entreprises.map(e => (
                  <Link key={e.id} href={`/entreprise-space/dashboard?id=${e.id}`} style={{textDecoration:'none',display:'block'}}>
                    <div style={{borderRadius:'16px',padding:'0',border:'2px solid rgba(96,165,250,0.25)',background:'rgba(96,165,250,0.03)',overflow:'hidden',transition:'all 0.2s'}}
                      onMouseEnter={el => { (el.currentTarget as HTMLElement).style.borderColor='#60a5fa'; (el.currentTarget as HTMLElement).style.background='rgba(96,165,250,0.06)' }}
                      onMouseLeave={el => { (el.currentTarget as HTMLElement).style.borderColor='rgba(96,165,250,0.25)'; (el.currentTarget as HTMLElement).style.background='rgba(96,165,250,0.03)' }}>
                      {e.banner_url && (
                        <div style={{height:'80px',overflow:'hidden',background:'#1A1A1A'}}>
                          <img src={e.banner_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.7}} />
                        </div>
                      )}
                      <div style={{padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                            <Building2 size={14} style={{color:'#60a5fa',flexShrink:0}} />
                            <span style={{fontWeight:700,fontSize:'15px',color:'#3D4852'}}>{e.name}</span>
                          </div>
                          {e.description && (
                            <p style={{fontSize:'12px',color:'#7A7A6E',margin:'0 0 8px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.description}</p>
                          )}
                          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                            {(e.secteurs||[]).slice(0,4).map((s: string) => (
                              <span key={s} style={{fontSize:'11px',background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.2)',padding:'2px 8px',borderRadius:'10px',color:'#60a5fa',fontWeight:500}}>{s}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:'13px',fontWeight:700,color:'#3D4852'}}>{(e.artisan_pros||[]).length} artisan{(e.artisan_pros||[]).length !== 1 ? 's' : ''}</div>
                          <div style={{fontSize:'11px',color:'#7A7A6E',marginTop:'2px'}}>dans l'équipe</div>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',marginTop:'8px',fontSize:'12px',color:'#60a5fa',fontWeight:600}}>
                            Voir l'espace <ChevronRight size={12} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div style={{height:'1px',background:'#D8D2C4',margin:'24px 0'}} />
              <p style={{fontSize:'12px',color:'#7A7A6E',marginBottom:'16px'}}>Ou choisissez un artisan indépendant :</p>
            </div>
          )}

          {loading ? (
            <div style={{textAlign:'center',padding:'64px 0'}}>
              <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 16px'}} />
              <p style={{color:'#7A7A6E',fontSize:'14px'}}>Recherche des meilleurs artisans...</p>
            </div>
          ) : artisans.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:'48px'}}>
              <p style={{fontSize:'48px',marginBottom:'16px'}}>😔</p>
              <h3 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#3D4852',marginBottom:'8px'}}>Aucun artisan disponible</h3>
              <p style={{color:'#7A7A6E',fontSize:'14px',marginBottom:'24px'}}>Tous nos artisans {category} sont actuellement occupés.</p>
              <Link href="/artisans" className="btn-primary" style={{display:'inline-flex',alignItems:'center',gap:'8px'}}>
                Voir tous les artisans
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-8">
                {artisans.map((a, idx) => (
                  <button key={a.id} onClick={() => setSelected(a.id)}
                    style={{
                      width:'100%',textAlign:'left',borderRadius:'16px',padding:'24px',cursor:'pointer',transition:'all 0.2s',
                      border: selected === a.id ? '2px solid #E85D26' : '2px solid #D8D2C4',
                      background: selected === a.id ? 'rgba(232,93,38,0.03)' : 'white',
                    }}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:'16px'}}>
                      {/* Rang */}
                      <div style={{
                        width:'28px',height:'28px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:'12px',fontWeight:700,flexShrink:0,marginTop:'4px',
                        background: idx === 0 ? 'rgba(201,168,76,0.2)' : '#F5F3EE',
                        color: idx === 0 ? '#C9A84C' : '#7A7A6E',
                      }}>{idx + 1}</div>

                      {/* Avatar */}
                      <div style={{width:'56px',height:'56px',borderRadius:'14px',overflow:'hidden',flexShrink:0,background:'#FFF3EE',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {a.users?.avatar_url
                          ? <img src={a.users.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                          : (() => { const I = METIER_ICON_MAP[a.metier] || Wrench; return <I size={24} color='#E85D26' /> })()
                        }
                      </div>

                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'8px',flexWrap:'wrap'}}>
                          <div>
                            <h3 className="font-display" style={{fontWeight:700,color:'#3D4852',fontSize:'16px'}}>{a.users?.name || a.metier || 'Artisan'}</h3>
                            <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',color:'#7A7A6E',marginTop:'2px'}}>
                              <MapPin size={12} /> {a.users?.quartier || 'Abidjan'}
                            </div>
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div className="font-display" style={{fontWeight:700,color:'#3D4852',fontSize:'16px'}}>{(a.tarif_min || 0).toLocaleString()} FCFA</div>
                            <div style={{fontSize:'11px',color:'#7A7A6E'}}>tarif min</div>
                          </div>
                        </div>

                        <div style={{display:'flex',flexWrap:'wrap',gap:'16px',marginTop:'12px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'13px'}}>
                            <Star size={13} style={{color:'#C9A84C',fill:'#C9A84C'}} />
                            <span style={{fontWeight:600,color:'#3D4852'}}>{(a.rating_avg || 0).toFixed(1)}</span>
                            <span style={{color:'#7A7A6E'}}>({a.rating_count || 0})</span>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',color:'#7A7A6E'}}>
                            <CheckCircle size={13} /> {a.mission_count || 0} missions
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',color:'#7A7A6E'}}>
                            <Clock size={13} /> ~{a.response_time_min || 30} min
                          </div>
                        </div>

                        {a.specialties?.length > 0 && (
                          <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginTop:'10px'}}>
                            {a.specialties.slice(0,3).map((s: string) => (
                              <span key={s} style={{fontSize:'11px',background:'#F5F3EE',border:'1px solid #D8D2C4',padding:'3px 10px',borderRadius:'20px',color:'#7A7A6E'}}>{s}</span>
                            ))}
                          </div>
                        )}

                        {idx === 0 && (
                          <div style={{display:'inline-flex',alignItems:'center',gap:'4px',marginTop:'10px',fontSize:'11px',color:'#C9A84C',background:'rgba(201,168,76,0.1)',padding:'3px 10px',borderRadius:'20px',fontWeight:600}}>
                            ⭐ Meilleur match
                          </div>
                        )}
                      </div>
                    </div>

                    {selected === a.id && (
                      <div className="afrione-gradient-text" style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'16px',fontSize:'13px',fontWeight:500}}>
                        <CheckCircle size={14} /> Sélectionné
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div style={{display:'flex',alignItems:'flex-start',gap:'12px',background:'rgba(43,107,62,0.05)',border:'1px solid rgba(43,107,62,0.2)',borderRadius:'12px',padding:'16px',marginBottom:'24px'}}>
                <Shield size={16} style={{color:'#2B6B3E',flexShrink:0,marginTop:'2px'}} />
                <p style={{fontSize:'13px',color:'#7A7A6E'}}>Paiement sécurisé en séquestre Wave jusqu'à la fin des travaux. Remboursement garanti si insatisfait.</p>
              </div>

              <button onClick={confirm} disabled={!selected || confirming} className="btn-primary"
                style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',padding:'16px',fontSize:'15px',opacity: (!selected || confirming) ? 0.4 : 1}}>
                {confirming
                  ? <><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Connexion en cours...</>
                  : <><Zap size={18} /> Contacter cet artisan <ChevronRight size={16} /></>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MatchingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
      </div>
    }>
      <MatchingContent />
    </Suspense>
  )
}
