'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Clock, CheckCircle, AlertCircle, Star, ArrowRight, Zap, LogOut, Calendar } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setUser(session.user)

      const { data } = await supabase
        .from('missions')
        .select('*, scheduled_at')
        .eq('client_id', session.user.id)
        .order('created_at', { ascending: false })

      setMissions(data || [])
      setLoading(false)
    }
    init()
  }, [])

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Utilisateur'
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
    disputed:    { label: 'Litige', color: '#ef4444' },
    cancelled:   { label: 'Annulée', color: '#7A7A6E' },
  }

  const scheduledMissions = missions.filter(m => m.status === 'scheduled' && m.scheduled_at)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div style={{paddingTop:'96px',paddingBottom:'64px',padding:'96px 16px 64px'}}>
        <div className="page-container" style={{maxWidth:'896px'}}>

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'32px',flexWrap:'wrap',gap:'16px'}}>
            <div>
              <span className="section-label">MON ESPACE CLIENT</span>
              <h1 className="font-display" style={{fontSize:'28px',fontWeight:700,color:'#0F1410',marginTop:'4px'}}>
                Bonjour {userName} 👋
              </h1>
              <p style={{fontSize:'14px',color:'#7A7A6E',marginTop:'4px'}}>{user?.email}</p>
            </div>
            <Link href="/diagnostic" className="btn-primary" style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <Plus size={16} /> Nouvelle mission
            </Link>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'32px'}}>
            {[
              { label: 'Missions totales', value: missions.length, icon: '📋' },
              { label: 'Missions terminées', value: completed.length, icon: '✅' },
              { label: 'Total dépensé', value: totalSpent > 0 ? `${totalSpent.toLocaleString()} FCFA` : '0 FCFA', icon: '💳' },
            ].map(s => (
              <div key={s.label} className="card" style={{textAlign:'center'}}>
                <div style={{fontSize:'24px',marginBottom:'8px'}}>{s.icon}</div>
                <div className="font-display" style={{fontSize:'24px',fontWeight:700,color:'#0F1410'}}>{s.value}</div>
                <div style={{fontSize:'12px',color:'#7A7A6E',marginTop:'4px'}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Agenda — interventions programmées */}
          {scheduledMissions.length > 0 && (
            <div style={{marginBottom:'24px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                <Calendar size={16} color="#C9A84C" />
                <h2 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#0F1410'}}>Prochaines interventions</h2>
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
                    <div key={m.id} style={{
                      background:'white',border:`2px solid ${isToday ? '#E85D26' : 'rgba(201,168,76,0.4)'}`,
                      borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',gap:'16px',
                    }}>
                      <div style={{
                        width:'56px',height:'56px',flexShrink:0,borderRadius:'14px',
                        background: isToday ? 'rgba(232,93,38,0.08)' : 'rgba(201,168,76,0.08)',
                        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                      }}>
                        <span style={{fontSize:'10px',fontWeight:700,color: isToday ? '#E85D26' : '#C9A84C',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                          {d.toLocaleDateString('fr-FR',{month:'short'})}
                        </span>
                        <span style={{fontSize:'24px',fontWeight:800,color:'#0F1410',lineHeight:1}}>
                          {d.getDate()}
                        </span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:'14px',color:'#0F1410'}}>{m.category || 'Intervention'}</div>
                        <div style={{fontSize:'13px',fontWeight:600,color: isToday ? '#E85D26' : '#C9A84C',marginTop:'2px'}}>{dateLabel}</div>
                        {!isToday && diffDays > 0 && (
                          <div style={{fontSize:'12px',color:'#7A7A6E',marginTop:'2px'}}>Dans {diffDays} jour{diffDays > 1 ? 's' : ''}</div>
                        )}
                      </div>
                      <Link href={`/warroom/${m.id}`} style={{
                        padding:'8px 14px',background:'#0F1410',color:'white',borderRadius:'10px',
                        fontSize:'12px',fontWeight:600,textDecoration:'none',flexShrink:0,
                      }}>
                        Voir →
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
              <h2 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#0F1410'}}>Mes missions</h2>
              <Link href="/diagnostic" style={{fontSize:'14px',color:'#E85D26',textDecoration:'none',display:'flex',alignItems:'center',gap:'4px'}}>
                + Nouvelle <ArrowRight size={14} />
              </Link>
            </div>

            {missions.length === 0 ? (
              <div style={{textAlign:'center',padding:'48px 0'}}>
                <div style={{fontSize:'48px',marginBottom:'16px'}}>🔧</div>
                <h3 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#0F1410',marginBottom:'8px'}}>Aucune mission pour l'instant</h3>
                <p style={{color:'#7A7A6E',marginBottom:'24px',fontSize:'14px'}}>Décrivez votre premier problème et trouvez un artisan en quelques minutes</p>
                <Link href="/diagnostic" className="btn-primary" style={{display:'inline-flex',alignItems:'center',gap:'8px'}}>
                  <Zap size={16} /> Décrire mon problème
                </Link>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                {missions.map((m: any) => {
                  const isActive = ['negotiation','en_cours','payment','matching','en_route','scheduled'].includes(m.status)
                  return (
                    <div key={m.id} style={{display:'flex',alignItems:'center',gap:'16px',padding:'16px',background:'#F5F0E8',borderRadius:'12px',border: isActive ? '2px solid rgba(232,93,38,0.3)' : '2px solid transparent'}}>
                      <div style={{width:'48px',height:'48px',background:'white',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}>
                        🔧
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,color:'#0F1410',fontSize:'15px'}}>{m.category || 'Mission'}</div>
                        <div style={{fontSize:'13px',color:'#7A7A6E',marginTop:'2px'}}>
                          {new Date(m.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{
                          padding:'4px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:600,
                          background:`${statusConfig[m.status]?.color}20`,
                          color: statusConfig[m.status]?.color || '#7A7A6E'
                        }}>
                          {statusConfig[m.status]?.label || m.status}
                        </span>
                        {isActive && (
                          <Link href={`/warroom/${m.id}`} style={{
                            padding:'6px 12px',background:'#E85D26',color:'white',borderRadius:'8px',
                            fontSize:'12px',fontWeight:600,textDecoration:'none',whiteSpace:'nowrap'
                          }}>
                            💬 Chat
                          </Link>
                        )}
                        {m.total_price && (
                          <span style={{fontWeight:700,color:'#0F1410',fontSize:'14px'}}>
                            {m.total_price.toLocaleString()} FCFA
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
