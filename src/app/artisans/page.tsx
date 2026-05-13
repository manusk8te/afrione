'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { Search, Star, MapPin, Clock, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/useIsMobile'

const METIERS = ['Tous', 'Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie', 'Climatisation', 'Serrurerie', 'Carrelage']
const METIER_ICONS: Record<string, string> = {
  'Plomberie': '🔧', 'Électricité': '⚡', 'Peinture': '🎨',
  'Maçonnerie': '🏗️', 'Menuiserie': '🪵', 'Climatisation': '❄️',
  'Serrurerie': '🔑', 'Carrelage': '🪟',
}
const METIER_COLORS: Record<string, string> = {
  'Plomberie': '#1A4A6B', 'Électricité': '#4A3A1A', 'Peinture': '#3A1A4A',
  'Maçonnerie': '#2A3A1A', 'Menuiserie': '#4A2A1A', 'Climatisation': '#1A3A4A',
  'Serrurerie': '#3A3A1A', 'Carrelage': '#1A3A3A',
}

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
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div style={{padding:isMobile?'80px 12px 48px':'96px 16px 64px'}}>
        <div className="page-container">
          <div style={{marginBottom:'24px'}}>
            <span className="section-label">ANNUAIRE</span>
            <h1 className="font-display" style={{fontSize:isMobile?'26px':'36px',fontWeight:700,color:'#0F1410',marginTop:'8px'}}>
              Trouver un artisan
            </h1>
            <p style={{color:'#7A7A6E',marginTop:'8px'}}>
              {loading ? 'Chargement...' : `${filtered.length} professionnel${filtered.length > 1 ? 's' : ''} vérifié${filtered.length > 1 ? 's' : ''} à Abidjan`}
            </p>
          </div>

          {/* Recherche */}
          <div style={{background:'white',border:'1px solid #D8D2C4',borderRadius:'16px',padding:'16px',marginBottom:'24px'}}>
            <div style={{position:'relative'}}>
              <Search size={18} style={{position:'absolute',left:'16px',top:'50%',transform:'translateY(-50%)',color:'#7A7A6E'}} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom..." className="input" style={{paddingLeft:'48px'}} />
            </div>
          </div>

          {/* Filtres métier */}
          <div style={{display:'flex',gap:'8px',overflowX:'auto',paddingBottom:'8px',marginBottom:'32px'}}>
            {METIERS.map(m => (
              <button key={m} onClick={() => setMetier(m)} style={{
                flexShrink:0,padding:'8px 16px',borderRadius:'20px',fontSize:'14px',fontWeight:500,
                cursor:'pointer',transition:'all 0.2s',border:'none',
                background: metier === m ? '#0F1410' : 'white',
                color: metier === m ? '#FAFAF5' : '#7A7A6E',
                boxShadow: metier === m ? 'none' : '0 0 0 1px #D8D2C4',
              }}>
                {m !== 'Tous' && METIER_ICONS[m]} {m}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{display:'flex',justifyContent:'center',padding:'80px 0'}}>
              <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'80px 0'}}>
              <p style={{fontSize:'48px',marginBottom:'16px'}}>🔍</p>
              <h3 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#0F1410'}}>Aucun artisan trouvé</h3>
              <p style={{color:'#7A7A6E',marginTop:'8px'}}>Essayez avec d'autres critères</p>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(300px,1fr))',gap:'16px'}}>
              {filtered.map(a => {
                const coverPhoto = a.portfolio?.[0] || null
                const avatarUrl = a.users?.avatar_url || null
                const name = a.users?.name || a.metier || 'Artisan'
                const rating = a.rating_avg || 0
                const stars = Math.round(rating)
                const bgColor = METIER_COLORS[a.metier] || '#1A2A1A'

                return (
                  <Link key={a.id} href={`/artisans/${a.id}`} style={{textDecoration:'none'}}>
                    <div style={{
                      background:'white',borderRadius:'20px',overflow:'hidden',
                      border:'1px solid #E8E2D8',cursor:'pointer',
                      transition:'all 0.25s',
                    }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.transform='translateY(-6px)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow='0 16px 40px rgba(0,0,0,0.12)'
                        ;(e.currentTarget as HTMLElement).style.borderColor='#E85D26'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.transform='translateY(0)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow='none'
                        ;(e.currentTarget as HTMLElement).style.borderColor='#E8E2D8'
                      }}>

                      {/* Cover photo */}
                      <div style={{position:'relative',height:'180px',background: coverPhoto ? '#1A1A1A' : bgColor,overflow:'hidden'}}>
                        {coverPhoto ? (
                          <img src={coverPhoto} alt={a.metier} style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.9}} />
                        ) : (
                          <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <span style={{fontSize:'64px',opacity:0.4}}>{METIER_ICONS[a.metier] || '🔧'}</span>
                          </div>
                        )}
                        {/* Badges */}
                        <div style={{position:'absolute',top:'12px',right:'12px',display:'flex',flexDirection:'column',gap:'6px',alignItems:'flex-end'}}>
                          <span style={{fontSize:'11px',color:'#2B6B3E',background:'rgba(240,255,244,0.95)',border:'1px solid rgba(43,107,62,0.3)',padding:'3px 10px',borderRadius:'20px',fontWeight:600}}>✓ Vérifié</span>
                          {a.is_available && (
                            <span style={{display:'inline-flex',alignItems:'center',gap:'5px',fontSize:'11px',color:'#2B6B3E',background:'rgba(240,255,244,0.95)',border:'1px solid rgba(43,107,62,0.3)',padding:'3px 10px',borderRadius:'20px',fontWeight:600}}>
                              <span style={{width:'6px',height:'6px',background:'#2B6B3E',borderRadius:'50%',display:'inline-block'}} /> Disponible
                            </span>
                          )}
                        </div>

                        {/* Avatar en bas */}
                        <div style={{position:'absolute',bottom:'-24px',left:'20px',width:'56px',height:'56px',borderRadius:'14px',border:'3px solid white',overflow:'hidden',background:'#EDE8DE',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
                          {avatarUrl
                            ? <img src={avatarUrl} alt={name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                            : <span style={{fontSize:'22px',fontWeight:700,color:'#7A7A6E'}}>{name[0]?.toUpperCase()}</span>
                          }
                        </div>
                      </div>

                      {/* Contenu */}
                      <div style={{padding:'16px 20px 20px',paddingTop:'36px'}}>
                        <h3 className="font-display" style={{fontSize:'17px',fontWeight:800,color:'#0F1410',marginBottom:'2px'}}>{name}</h3>
                        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',color:'#7A7A6E',marginBottom:'8px'}}>
                          <span style={{fontWeight:600,color:'#E85D26'}}>{METIER_ICONS[a.metier]} {a.metier}</span>
                          <span>·</span>
                          <MapPin size={11} />
                          <span>{a.users?.quartier || 'Abidjan'}</span>
                        </div>
                        {a.entreprises && (
                          <div style={{marginBottom:'10px'}}>
                            <Link href={`/entreprise-space/dashboard?id=${a.entreprises.id}`} onClick={e => e.stopPropagation()}
                              style={{display:'inline-flex',alignItems:'center',gap:'5px',fontSize:'11px',color:'#60a5fa',background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.2)',padding:'3px 10px',borderRadius:'12px',textDecoration:'none',fontWeight:600}}>
                              <Building2 size={10}/> {a.entreprises.name}
                            </Link>
                          </div>
                        )}

                        {/* Étoiles */}
                        <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'16px'}}>
                          <div style={{display:'flex',gap:'2px'}}>
                            {Array.from({length:5}).map((_,i) => (
                              <Star key={i} size={13} style={{color: i < stars ? '#C9A84C' : '#D8D2C4'}} fill={i < stars ? '#C9A84C' : 'none'} />
                            ))}
                          </div>
                          <span style={{fontWeight:700,fontSize:'14px',color:'#0F1410'}}>{rating > 0 ? rating.toFixed(1) : '—'}</span>
                          <span style={{fontSize:'12px',color:'#7A7A6E'}}>({a.rating_count || 0} avis)</span>
                        </div>

                        {/* Stats */}
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'16px'}}>
                          {[
                            { value: a.mission_count || 0, label: 'Missions' },
                            { value: `${a.years_experience || 0}ans`, label: 'Exp.' },
                            { value: `~${a.response_time_min || 30}min`, label: 'Réponse' },
                          ].map(s => (
                            <div key={s.label} style={{background:'#F5F0E8',borderRadius:'10px',padding:'8px',textAlign:'center'}}>
                              <div style={{fontWeight:700,fontSize:'13px',color:'#0F1410'}}>{s.value}</div>
                              <div style={{fontSize:'11px',color:'#7A7A6E'}}>{s.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Portfolio preview (3 petites photos si dispo) */}
                        {a.portfolio?.length > 1 && (
                          <div style={{display:'flex',gap:'4px',marginBottom:'16px'}}>
                            {a.portfolio.slice(1, 4).map((url: string, i: number) => (
                              <div key={i} style={{flex:1,aspectRatio:'1',borderRadius:'8px',overflow:'hidden',background:'#EDE8DE'}}>
                                <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                              </div>
                            ))}
                            {a.portfolio.length > 4 && (
                              <div style={{flex:1,aspectRatio:'1',borderRadius:'8px',overflow:'hidden',background:'#EDE8DE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,color:'#7A7A6E'}}>
                                +{a.portfolio.length - 4}
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end'}}>
                          <span style={{fontSize:'13px',fontWeight:600,color:'#E85D26'}}>Voir le profil →</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
