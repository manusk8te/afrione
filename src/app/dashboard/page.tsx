'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Clock, CheckCircle, AlertCircle, Star, ArrowRight, Zap, LogOut } from 'lucide-react'
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
        .select('*')
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
    diagnostic: { label: 'Diagnostic', color: '#C9A84C' },
    matching: { label: 'Recherche artisan', color: '#E85D26' },
    en_route: { label: 'En route', color: '#E85D26' },
    en_cours: { label: 'En cours', color: '#2B6B3E' },
    completed: { label: 'Terminée', color: '#2B6B3E' },
    disputed: { label: 'Litige', color: '#ef4444' },
  }

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
                {missions.map((m: any) => (
                  <div key={m.id} style={{display:'flex',alignItems:'center',gap:'16px',padding:'16px',background:'#F5F0E8',borderRadius:'12px'}}>
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
                      {m.total_price && (
                        <span style={{fontWeight:700,color:'#0F1410',fontSize:'14px'}}>
                          {m.total_price.toLocaleString()} FCFA
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
