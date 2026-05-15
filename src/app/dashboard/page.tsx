'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ArrowRight, Zap, Calendar, User, Phone, MapPin, Save, Droplets, Paintbrush, Hammer, Ruler, Wind, Lock, LayoutGrid, Cpu, Wrench, Navigation, MessageCircle } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/useIsMobile'
import toast from 'react-hot-toast'

const QUARTIERS = ['Cocody','Plateau','Marcory','Treichville','Adjamé','Abobo','Yopougon','Koumassi','Port-Bouët','Attécoubé','Bingerville','Anyama']

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  'Plomberie': Droplets, 'Électricité': Zap, 'Peinture': Paintbrush,
  'Maçonnerie': Hammer, 'Menuiserie': Ruler, 'Climatisation': Wind,
  'Serrurerie': Lock, 'Carrelage': LayoutGrid, 'Diagnostic': Cpu,
}

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

export default function DashboardPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'missions' | 'profil'>('missions')
  const [user, setUser] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Profil éditable
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileQuartier, setProfileQuartier] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    let channel: any = null
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setUser(session.user)

      const [{ data: missionsData }, { data: userData }] = await Promise.all([
        supabase.from('missions').select('*, scheduled_at').eq('client_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('users').select('name, phone, quartier').eq('id', session.user.id).single(),
      ])

      setMissions(missionsData || [])
      if (userData) {
        setProfileName(userData.name || '')
        setProfilePhone(userData.phone || '')
        setProfileQuartier(userData.quartier || '')
      }
      setLoading(false)

      channel = supabase
        .channel(`dashboard-client-${session.user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'missions',
          filter: `client_id=eq.${session.user.id}`,
        }, payload => {
          if (payload.eventType === 'INSERT') setMissions(prev => [payload.new as any, ...prev])
          else if (payload.eventType === 'UPDATE') setMissions(prev => prev.map(m => m.id === (payload.new as any).id ? { ...m, ...payload.new } : m))
        })
        .subscribe()
    }
    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  const saveProfile = async () => {
    if (!profileName.trim()) { toast.error('Le nom est requis'); return }
    setSavingProfile(true)
    const { error } = await supabase.from('users').update({
      name: profileName.trim(),
      phone: profilePhone.trim() || null,
      quartier: profileQuartier || null,
    }).eq('id', user.id)
    setSavingProfile(false)
    if (error) toast.error('Erreur: ' + error.message)
    else toast.success('Profil mis à jour !')
  }

  const userName = profileName || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Utilisateur'
  const completed = missions.filter(m => m.status === 'completed')
  const totalSpent = completed.reduce((s: number, m: any) => s + (m.total_price || 0), 0)

  const statusConfig: Record<string, { label: string; color: string }> = {
    diagnostic:  { label: 'Diagnostic', color: '#C9A84C' },
    matching:    { label: '🔔 Nouvelle demande', color: '#E85D26' },
    negotiation: { label: '💬 En discussion', color: '#C9A84C' },
    scheduled:   { label: '📅 Programmée', color: '#C9A84C' },
    en_route:    { label: '🚗 En route', color: '#E85D26' },
    payment:     { label: '💳 Paiement', color: '#C9A84C' },
    en_cours:    { label: '⚡ En cours', color: '#2B6B3E' },
    completed:   { label: '✅ Terminée', color: '#2B6B3E' },
    disputed:    { label: '⚠️ Litige', color: '#ef4444' },
    cancelled:   { label: 'Annulée', color: '#8B95A5' },
  }

  const scheduledMissions = missions.filter(m => m.status === 'scheduled' && m.scheduled_at)

  if (loading) return (
    <div className="min-h-screen" style={{background:'#F5F7FA',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
    </div>
  )

  return (
    <div className="min-h-screen" style={{background:'#F5F7FA'}}>
      <Navbar />

      {/* ── Hero orange ── */}
      <section className="afrione-gradient" style={{ position: 'relative', overflow: 'hidden', minHeight: '200px', display: 'flex', alignItems: 'center' }}>
        {/* Floating white squares */}
        <div style={{ position: 'absolute', top: '22%', left: '4%',  width: 50, height: 50, border: '2px solid rgba(255,255,255,0.2)',   borderRadius: 12, animation: 'floatSquare 5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '50%', right: '6%',  width: 30, height: 30, background: 'rgba(255,255,255,0.12)', borderRadius: 8,  animation: 'floatSquare 4s ease-in-out infinite 1s' }} />
        <div style={{ position: 'absolute', top: '28%', right: '20%', width: 18, height: 18, background: 'rgba(255,255,255,0.18)', borderRadius: 5,  animation: 'floatSquareSlow 6s ease-in-out infinite 2s' }} />
        <div style={{ position: 'absolute', bottom: '22%', left: '20%', width: 58, height: 58, border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 14, animation: 'floatSquareSlow 7s ease-in-out infinite 0.5s' }} />
        <div style={{ position: 'absolute', top: '42%', left: '42%',  width: 14, height: 14, background: 'rgba(255,255,255,0.2)',  borderRadius: 4,  animation: 'floatSquareDrift 5s ease-in-out infinite 3s' }} />
        <div className="page-container" style={{ position: 'relative', zIndex: 10, padding: '32px', maxWidth: '896px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '20px', padding: '5px 14px', marginBottom: '14px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', letterSpacing: '0.12em', fontFamily: 'Tahoma' }}>MON ESPACE</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'white', margin: '0 0 8px' }}>
                Bonjour {user?.user_metadata?.name?.split(' ')[0] || ''} 👋
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '14px', margin: 0 }}>Suivez vos missions et gérez votre profil</p>
            </div>
            <Link href="/diagnostic" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.32)', borderRadius: '12px', padding: '10px 20px', color: 'white', fontWeight: 700, fontSize: '14px', textDecoration: 'none', flexShrink: 0 }}>
              <Plus size={16} /> Nouvelle mission
            </Link>
          </div>
        </div>
      </section>

      <div style={{padding:isMobile?'24px 12px 48px':'32px 16px 64px'}}>
        <div className="page-container" style={{maxWidth:'896px',position:'relative'}}>

          {/* Floating orange squares — decorative */}
          <div style={{ position: 'absolute', top: '6%',  right: '-18px', width: 54, height: 54, background: 'rgba(232,93,38,0.07)', borderRadius: 12, animation: 'floatSquare 5.5s ease-in-out infinite', transform: 'rotate(15deg)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '45%', left: '-18px',  width: 38, height: 38, border: '2px solid rgba(232,93,38,0.11)', borderRadius: 10, animation: 'floatSquareSlow 6s ease-in-out infinite 1.5s', transform: 'rotate(-8deg)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '12%', right: '1%', width: 22, height: 22, background: 'rgba(232,93,38,0.09)', borderRadius: 6, animation: 'floatSquareDrift 4.5s ease-in-out infinite 2.5s', pointerEvents: 'none' }} />

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:'12px',marginBottom:'24px'}}>
            {[
              { label: 'Missions totales', value: missions.length, icon: '📋' },
              { label: 'Missions terminées', value: completed.length, icon: '✅' },
              { label: 'Total dépensé', value: totalSpent > 0 ? `${totalSpent.toLocaleString()} FCFA` : '0 FCFA', icon: '💳' },
            ].map(s => (
              <div key={s.label} style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px',textAlign:'center'}}>
                <div style={{fontSize:'24px',marginBottom:'8px'}}>{s.icon}</div>
                <div className="font-display" style={{fontSize:'24px',fontWeight:700,color:'#3D4852'}}>{s.value}</div>
                <div style={{fontSize:'12px',color:'#6B7280',marginTop:'4px'}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:'flex',background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'16px',padding:'4px',marginBottom:'20px',gap:'4px'}}>
            {[
              { id: 'missions' as const, label: '📋 Mes missions' },
              { id: 'profil' as const, label: '👤 Mon profil' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex:1,padding:'10px',borderRadius:'12px',border:'none',cursor:'pointer',
                fontSize:'14px',fontWeight:600,transition:'all 0.2s',
                background: tab === t.id ? '#E85D26' : 'transparent',
                color: tab === t.id ? '#FFFFFF' : '#6B7280',
                boxShadow: tab === t.id ? '0 4px 12px rgba(232,93,38,0.3)' : 'none',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── ONGLET MISSIONS ── */}
          {tab === 'missions' && (
            <>
              {/* Agenda */}
              {scheduledMissions.length > 0 && (
                <div style={{marginBottom:'24px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                    <Calendar size={16} color="#C9A84C" />
                    <h2 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#3D4852'}}>Prochaines interventions</h2>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    {scheduledMissions.map((m: any) => {
                      const d = new Date(m.scheduled_at)
                      const now = new Date()
                      const isToday = d.toDateString() === now.toDateString()
                      const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString()
                      const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000)
                      const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      const dateLabel = isToday ? `Aujourd'hui à ${timeStr}`
                        : isTomorrow ? `Demain à ${timeStr}`
                        : `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${timeStr}`
                      return (
                        <div key={m.id} style={{background:'#FFFFFF',border:`2px solid ${isToday?'#E85D26':'rgba(201,168,76,0.4)'}`,borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',gap:'16px',boxShadow:NEU_SMALL}}>
                          <div style={{width:'56px',height:'56px',flexShrink:0,borderRadius:'14px',background:isToday?'rgba(232,93,38,0.08)':'rgba(201,168,76,0.08)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                            <span style={{fontSize:'10px',fontWeight:700,color:isToday?'#E85D26':'#C9A84C',textTransform:'uppercase',letterSpacing:'0.05em'}}>{d.toLocaleDateString('fr-FR',{month:'short'})}</span>
                            <span style={{fontSize:'24px',fontWeight:800,color:'#3D4852',lineHeight:1}}>{d.getDate()}</span>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:'14px',color:'#3D4852'}}>{m.category || 'Intervention'}</div>
                            <div style={{fontSize:'13px',fontWeight:600,color:isToday?'#E85D26':'#C9A84C',marginTop:'2px'}}>{dateLabel}</div>
                            {!isToday && diffDays > 0 && <div style={{fontSize:'12px',color:'#6B7280',marginTop:'2px'}}>Dans {diffDays} jour{diffDays>1?'s':''}</div>}
                          </div>
                          <Link href={`/warroom/${m.id}`} style={{padding:'8px 14px',background:'#E85D26',color:'white',borderRadius:'10px',fontSize:'12px',fontWeight:600,textDecoration:'none',flexShrink:0,boxShadow:'0 4px 12px rgba(232,93,38,0.3)'}}>
                            Voir →
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'24px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
                  <h2 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#3D4852'}}>Mes missions</h2>
                  <Link href="/diagnostic" className="afrione-gradient-text" style={{fontSize:'14px',textDecoration:'none',display:'flex',alignItems:'center',gap:'4px'}}>
                    + Nouvelle <ArrowRight size={14} />
                  </Link>
                </div>

                {missions.length === 0 ? (
                  <div style={{textAlign:'center',padding:'48px 0'}}>
                    <div style={{fontSize:'48px',marginBottom:'16px'}}>🔧</div>
                    <h3 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#3D4852',marginBottom:'8px'}}>Aucune mission pour l'instant</h3>
                    <p style={{color:'#6B7280',marginBottom:'24px',fontSize:'14px'}}>Décrivez votre premier problème et trouvez un artisan en quelques minutes</p>
                    <Link href="/diagnostic" className="btn-primary" style={{display:'inline-flex',alignItems:'center',gap:'8px'}}>
                      <Zap size={16} /> Décrire mon problème
                    </Link>
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    {missions.map((m: any) => {
                      const isActive = ['negotiation','en_cours','payment','matching','en_route','scheduled'].includes(m.status)
                      const sc = statusConfig[m.status]
                      return (
                        <div key={m.id} style={{display:'flex',alignItems:isMobile?'flex-start':'center',gap:'12px',padding:'12px 14px',background:'#F5F7FA',borderRadius:'12px',border:isActive?'2px solid rgba(232,93,38,0.25)':m.status==='disputed'?'2px solid rgba(239,68,68,0.3)':'2px solid #E2E8F0',flexWrap:isMobile?'wrap':'nowrap'}}>
                          <div style={{width:'44px',height:'44px',background:'#FFFFFF',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0,boxShadow:NEU_SMALL}}>
                            {(() => { const I = CATEGORY_ICON_MAP[m.category] || Wrench; return <I size={20} color='#E85D26' /> })()}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,color:'#3D4852',fontSize:'14px'}}>{m.category || 'Mission'}</div>
                            <div style={{fontSize:'12px',color:'#6B7280',marginTop:'2px'}}>{new Date(m.created_at).toLocaleDateString('fr-FR')}</div>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                            <span style={{padding:'4px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:600,background:`${sc?.color}20`,color:sc?.color||'#6B7280'}}>
                              {sc?.label || m.status}
                            </span>
                            {m.status === 'en_route' && (
                              <Link href={`/suivi/${m.id}`} className="btn-primary" style={{padding:'6px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:600,textDecoration:'none',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:'4px'}}>
                                <Navigation size={12} /> Suivi GPS
                              </Link>
                            )}
                            {isActive && m.status !== 'en_route' && (
                              <Link href={`/warroom/${m.id}`} className="btn-primary" style={{padding:'6px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:600,textDecoration:'none',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:'4px'}}>
                                <MessageCircle size={12} /> Chat
                              </Link>
                            )}
                            {m.status === 'completed' && (
                              <Link href={`/warroom/${m.id}`} style={{padding:'6px 12px',background:'rgba(201,168,76,0.15)',color:'#C9A84C',border:'1px solid rgba(201,168,76,0.3)',borderRadius:'8px',fontSize:'12px',fontWeight:600,textDecoration:'none',whiteSpace:'nowrap'}}>
                                ⭐ Avis
                              </Link>
                            )}
                            {m.status === 'disputed' && (
                              <Link href={`/warroom/${m.id}`} style={{padding:'6px 12px',background:'rgba(239,68,68,0.1)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',fontSize:'12px',fontWeight:600,textDecoration:'none'}}>
                                ⚠️ Litige
                              </Link>
                            )}
                            {m.total_price && <span style={{fontWeight:700,color:'#3D4852',fontSize:'13px'}}>{m.total_price.toLocaleString()} FCFA</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── ONGLET PROFIL ── */}
          {tab === 'profil' && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'24px'}}>
                <h2 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#3D4852',marginBottom:'20px'}}>Mes informations</h2>

                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                  <div>
                    <label style={{fontSize:'13px',fontWeight:600,color:'#6B7280',display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'}}>
                      <User size={13}/> NOM COMPLET
                    </label>
                    <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                      placeholder="Votre nom complet" className="input" />
                  </div>

                  <div>
                    <label style={{fontSize:'13px',fontWeight:600,color:'#6B7280',display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'}}>
                      <Phone size={13}/> TÉLÉPHONE
                    </label>
                    <div style={{display:'flex',alignItems:'center',border:'1.5px solid #E2E8F0',borderRadius:'12px',overflow:'hidden',background:'#FFFFFF'}}>
                      <span style={{padding:'14px 12px',borderRight:'1px solid #E2E8F0',fontSize:'14px',color:'#6B7280',flexShrink:0}}>🇨🇮 +225</span>
                      <input type="tel" value={profilePhone} onChange={e => setProfilePhone(e.target.value)}
                        placeholder="07 00 00 00 00" style={{flex:1,padding:'14px 12px',border:'none',outline:'none',fontSize:'15px',color:'#3D4852',background:'transparent'}} />
                    </div>
                  </div>

                  <div>
                    <label style={{fontSize:'13px',fontWeight:600,color:'#6B7280',display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'}}>
                      <MapPin size={13}/> QUARTIER
                    </label>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                      {QUARTIERS.map(q => (
                        <button key={q} onClick={() => setProfileQuartier(q === profileQuartier ? '' : q)} style={{
                          padding:'8px 14px',borderRadius:'20px',fontSize:'13px',fontWeight:500,cursor:'pointer',border:'none',transition:'all 0.15s',
                          background: profileQuartier === q ? '#E85D26' : '#F5F7FA',
                          color: profileQuartier === q ? '#FFFFFF' : '#6B7280',
                          boxShadow: profileQuartier === q ? '0 4px 12px rgba(232,93,38,0.3)' : NEU_SMALL,
                        }}>{q}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{paddingTop:'8px',borderTop:'1px solid #E2E8F0'}}>
                    <div style={{fontSize:'13px',color:'#6B7280',marginBottom:'12px'}}>
                      <strong style={{color:'#3D4852'}}>Email :</strong> {user?.email}
                      <span style={{marginLeft:'12px',fontSize:'11px',color:'#8B95A5',background:'#F5F7FA',padding:'2px 8px',borderRadius:'20px'}}>non modifiable</span>
                    </div>
                  </div>

                  <button onClick={saveProfile} disabled={savingProfile} className={savingProfile ? '' : 'btn-primary'} style={{padding:'14px',background:savingProfile?'#E2E8F0':undefined,color:'white',border:'none',borderRadius:'12px',fontSize:'15px',fontWeight:700,cursor:savingProfile?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                    {savingProfile ? <><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Sauvegarde…</> : <><Save size={16}/> Sauvegarder</>}
                  </button>
                </div>
              </div>

              <div style={{padding:'14px 16px',background:'rgba(232,93,38,0.05)',border:'1px solid rgba(232,93,38,0.15)',borderRadius:'12px',fontSize:'13px',color:'#6B7280',lineHeight:'1.6'}}>
                💡 Ces informations sont partagées avec les artisans lors de vos missions pour faciliter la prise de contact.
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
