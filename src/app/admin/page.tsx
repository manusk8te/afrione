'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, TrendingUp, Users, CheckCircle, AlertCircle, DollarSign, Activity, Clock, Shield, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_COLORS: Record<string, string> = {
  en_cours: 'text-green-400 bg-green-400/10',
  completed: 'text-green-400 bg-green-400/10',
  disputed: 'text-red-400 bg-red-400/10',
  payment: 'text-yellow-400 bg-yellow-400/10',
  matching: 'text-blue-400 bg-blue-400/10',
  diagnostic: 'text-purple-400 bg-purple-400/10',
  cancelled: 'text-gray-400 bg-gray-400/10',
}

const NAV_ITEMS = [
  { id: 'overview', label: "Vue d'ensemble", icon: '📊' },
  { id: 'kyc', label: 'Validations KYC', icon: '🪪' },
  { id: 'missions', label: 'Missions', icon: '📋' },
  { id: 'artisans', label: 'Artisans', icon: '🔧' },
  { id: 'transactions', label: 'Transactions', icon: '💳' },
]

export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('Admin')

  // Stats
  const [stats, setStats] = useState({ missions: 0, artisans: 0, revenue: 0, satisfaction: 0 })

  // Data
  const [missions, setMissions] = useState<any[]>([])
  const [artisans, setArtisans] = useState<any[]>([])
  const [kycPending, setKycPending] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [actionMsg, setActionMsg] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data: u } = await supabase.from('users').select('name').eq('id', session.user.id).single()
      if (u?.name) setAdminName(u.name)
    }

    // Stats
    const { count: missionCount } = await supabase.from('missions').select('*', { count: 'exact', head: true })
    const { count: artisanCount } = await supabase.from('artisan_pros').select('*', { count: 'exact', head: true }).eq('kyc_status', 'approved')
    const { data: txData } = await supabase.from('transactions').select('amount').eq('status', 'released')
    const totalRevenue = (txData || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    const { data: ratingData } = await supabase.from('artisan_pros').select('rating_avg').eq('kyc_status', 'approved')
    const avgRating = ratingData?.length ? (ratingData.reduce((s: number, a: any) => s + (a.rating_avg || 0), 0) / ratingData.length) : 0

    setStats({
      missions: missionCount || 0,
      artisans: artisanCount || 0,
      revenue: totalRevenue,
      satisfaction: Math.round(avgRating * 20),
    })

    // Missions récentes
    const { data: missionsData } = await supabase
      .from('missions')
      .select('*, users!missions_client_id_fkey(name), artisan_pros(metier, users!artisan_pros_user_id_fkey(name))')
      .order('created_at', { ascending: false })
      .limit(20)
    setMissions(missionsData || [])

    // KYC en attente
    const { data: kycData } = await supabase
      .from('kyc_security')
      .select('*, artisan_pros(id, metier, users!artisan_pros_user_id_fkey(name, email))')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setKycPending(kycData || [])

    // Artisans
    const { data: artisansData } = await supabase
      .from('artisan_pros')
      .select('*, users!artisan_pros_user_id_fkey(name, email, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(30)
    setArtisans(artisansData || [])

    // Transactions
    const { data: txAll } = await supabase
      .from('transactions')
      .select('*, missions(category, users!missions_client_id_fkey(name))')
      .order('created_at', { ascending: false })
      .limit(20)
    setTransactions(txAll || [])

    setLoading(false)
  }

  const approveKyc = async (kycId: string, artisanId: string) => {
    await supabase.from('kyc_security').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', kycId)
    await supabase.from('artisan_pros').update({ kyc_status: 'approved', is_available: true }).eq('id', artisanId)
    setActionMsg('✓ Artisan approuvé')
    setTimeout(() => setActionMsg(''), 3000)
    loadAll()
  }

  const rejectKyc = async (kycId: string, artisanId: string) => {
    await supabase.from('kyc_security').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', kycId)
    await supabase.from('artisan_pros').update({ kyc_status: 'rejected' }).eq('id', artisanId)
    setActionMsg('✗ Artisan rejeté')
    setTimeout(() => setActionMsg(''), 3000)
    loadAll()
  }

  const toggleArtisan = async (artisanId: string, current: boolean) => {
    await supabase.from('artisan_pros').update({ is_available: !current }).eq('id', artisanId)
    setActionMsg(current ? 'Artisan désactivé' : 'Artisan activé')
    setTimeout(() => setActionMsg(''), 3000)
    loadAll()
  }

  return (
    <div className="min-h-screen bg-dark text-cream flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-dark border-r border-white/10 min-h-screen p-6 sticky top-0 h-screen">
        <Link href="/" style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'40px',textDecoration:'none'}}>
          <div style={{width:'32px',height:'32px',background:'#E85D26',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Zap size={16} color="white" />
          </div>
          <span style={{fontWeight:700,fontSize:'18px',color:'#FAFAF5'}}>AFRI<span style={{color:'#E85D26'}}>ONE</span></span>
        </Link>

        <nav style={{display:'flex',flexDirection:'column',gap:'4px',flex:1}}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',borderRadius:'12px',
              border:'none',cursor:'pointer',textAlign:'left',fontSize:'14px',fontWeight:500,transition:'all 0.15s',
              background: tab === item.id ? 'rgba(232,93,38,0.15)' : 'transparent',
              color: tab === item.id ? '#E85D26' : '#7A7A6E',
            }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>

        <div style={{paddingTop:'24px',borderTop:'1px solid rgba(255,255,255,0.1)',display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:'32px',height:'32px',background:'#E85D26',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'13px',color:'white'}}>
            {adminName[0]}
          </div>
          <div>
            <div style={{fontSize:'13px',fontWeight:500,color:'#FAFAF5'}}>{adminName}</div>
            <div style={{fontSize:'11px',color:'#7A7A6E'}}>Admin AfriOne</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1,padding:'32px',maxWidth:'1200px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'32px'}}>
          <div>
            <h1 style={{fontFamily:'var(--font-display)',fontSize:'28px',fontWeight:700,color:'#FAFAF5'}}>Dashboard Admin</h1>
            <p style={{fontSize:'13px',color:'#7A7A6E',marginTop:'4px'}}>{new Date().toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            {actionMsg && <span style={{fontSize:'12px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',padding:'6px 14px',borderRadius:'20px'}}>{actionMsg}</span>}
            <div style={{display:'flex',alignItems:'center',gap:'8px',background:'rgba(43,107,62,0.1)',border:'1px solid rgba(43,107,62,0.2)',padding:'6px 14px',borderRadius:'20px'}}>
              <span style={{width:'8px',height:'8px',background:'#2B6B3E',borderRadius:'50%',display:'inline-block'}} />
              <span style={{fontSize:'11px',fontFamily:'Space Mono',color:'#2B6B3E'}}>SYSTÈME OPÉRATIONNEL</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'200px'}}>
            <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
          </div>
        ) : (
          <>
            {/* ===== OVERVIEW ===== */}
            {tab === 'overview' && (
              <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px'}}>
                  {[
                    { label: 'Total missions', value: stats.missions, icon: Activity, color: '#E85D26' },
                    { label: 'Artisans actifs', value: stats.artisans, icon: Users, color: '#2B6B3E' },
                    { label: 'CA total (FCFA)', value: stats.revenue.toLocaleString(), icon: DollarSign, color: '#C9A84C' },
                    { label: 'KYC en attente', value: kycPending.length, icon: Shield, color: '#7A7A6E' },
                  ].map(k => (
                    <div key={k.label} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',padding:'20px'}}>
                      <k.icon size={20} style={{color:k.color,marginBottom:'12px'}} />
                      <div style={{fontSize:'28px',fontWeight:700,color:'#FAFAF5',fontFamily:'var(--font-display)'}}>{k.value}</div>
                      <div style={{fontSize:'11px',color:'#7A7A6E',marginTop:'4px',fontFamily:'Space Mono',textTransform:'uppercase'}}>{k.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px'}}>
                  {/* Missions récentes */}
                  <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',padding:'24px'}}>
                    <h2 style={{fontSize:'16px',fontWeight:700,color:'#FAFAF5',marginBottom:'16px'}}>Missions récentes</h2>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {missions.slice(0,5).map(m => (
                        <div key={m.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',background:'rgba(255,255,255,0.04)',borderRadius:'10px'}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:'13px',fontWeight:500,color:'#FAFAF5'}}>{m.users?.name || 'Client'} → {m.artisan_pros?.users?.name || '—'}</div>
                            <div style={{fontSize:'11px',color:'#7A7A6E'}}>{m.category || '—'} · {m.quartier || 'Abidjan'}</div>
                          </div>
                          <span style={{fontSize:'10px',padding:'3px 8px',borderRadius:'20px',fontWeight:500,background:'rgba(232,93,38,0.1)',color:'#E85D26'}}>{m.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* KYC rapide */}
                  <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',padding:'24px'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                      <h2 style={{fontSize:'16px',fontWeight:700,color:'#FAFAF5'}}>KYC en attente</h2>
                      <span style={{fontSize:'11px',color:'#E85D26',background:'rgba(232,93,38,0.1)',padding:'3px 10px',borderRadius:'20px'}}>{kycPending.length} en attente</span>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {kycPending.slice(0,5).map(k => (
                        <div key={k.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',background:'rgba(255,255,255,0.04)',borderRadius:'10px'}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:'13px',fontWeight:500,color:'#FAFAF5'}}>{k.artisan_pros?.users?.name || '—'}</div>
                            <div style={{fontSize:'11px',color:'#7A7A6E'}}>{k.artisan_pros?.metier} · {new Date(k.created_at).toLocaleDateString('fr-FR')}</div>
                          </div>
                          <div style={{display:'flex',gap:'6px'}}>
                            <button onClick={() => approveKyc(k.id, k.artisan_pros?.id)} style={{width:'28px',height:'28px',background:'rgba(43,107,62,0.2)',border:'none',borderRadius:'8px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#2B6B3E'}}>
                              <CheckCircle size={14} />
                            </button>
                            <button onClick={() => rejectKyc(k.id, k.artisan_pros?.id)} style={{width:'28px',height:'28px',background:'rgba(220,38,38,0.2)',border:'none',borderRadius:'8px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#ef4444'}}>
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {kycPending.length === 0 && <p style={{fontSize:'13px',color:'#7A7A6E',textAlign:'center',padding:'24px 0'}}>Aucun KYC en attente 🎉</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== KYC ===== */}
            {tab === 'kyc' && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:700,color:'#FAFAF5',marginBottom:'20px'}}>Validations KYC ({kycPending.length} en attente)</h2>
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  {kycPending.length === 0 ? (
                    <div style={{textAlign:'center',padding:'64px',color:'#7A7A6E'}}>
                      <p style={{fontSize:'48px',marginBottom:'16px'}}>🎉</p>
                      <p style={{fontSize:'16px'}}>Aucun KYC en attente</p>
                    </div>
                  ) : kycPending.map(k => (
                    <div key={k.id} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',padding:'20px',display:'flex',alignItems:'center',gap:'16px'}}>
                      <div style={{width:'48px',height:'48px',background:'rgba(232,93,38,0.1)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}>🔧</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'15px',fontWeight:600,color:'#FAFAF5'}}>{k.artisan_pros?.users?.name || '—'}</div>
                        <div style={{fontSize:'13px',color:'#7A7A6E'}}>{k.artisan_pros?.metier} · {k.artisan_pros?.users?.email}</div>
                        <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                          {k.cni_front_url && <a href={k.cni_front_url} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#E85D26',textDecoration:'none',background:'rgba(232,93,38,0.1)',padding:'3px 10px',borderRadius:'20px'}}>CNI Recto ↗</a>}
                          {k.cni_back_url && <a href={k.cni_back_url} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#E85D26',textDecoration:'none',background:'rgba(232,93,38,0.1)',padding:'3px 10px',borderRadius:'20px'}}>CNI Verso ↗</a>}
                          {(k.diploma_urls||[]).length > 0 && <a href={k.diploma_urls[0]} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#C9A84C',textDecoration:'none',background:'rgba(201,168,76,0.1)',padding:'3px 10px',borderRadius:'20px'}}>Diplôme ↗</a>}
                        </div>
                      </div>
                      <div style={{fontSize:'12px',color:'#7A7A6E',textAlign:'right',marginRight:'16px'}}>
                        {new Date(k.created_at).toLocaleDateString('fr-FR')}
                      </div>
                      <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                        <button onClick={() => approveKyc(k.id, k.artisan_pros?.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'rgba(43,107,62,0.2)',border:'1px solid rgba(43,107,62,0.3)',borderRadius:'10px',cursor:'pointer',fontSize:'13px',fontWeight:600,color:'#2B6B3E'}}>
                          <CheckCircle size={14} /> Approuver
                        </button>
                        <button onClick={() => rejectKyc(k.id, k.artisan_pros?.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'rgba(220,38,38,0.2)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:'10px',cursor:'pointer',fontSize:'13px',fontWeight:600,color:'#ef4444'}}>
                          <X size={14} /> Rejeter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== MISSIONS ===== */}
            {tab === 'missions' && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:700,color:'#FAFAF5',marginBottom:'20px'}}>Toutes les missions ({missions.length})</h2>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {missions.map(m => (
                    <div key={m.id} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',padding:'16px',display:'flex',alignItems:'center',gap:'16px'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'14px',fontWeight:500,color:'#FAFAF5'}}>{m.users?.name || 'Client'} → {m.artisan_pros?.users?.name || 'Non assigné'}</div>
                        <div style={{fontSize:'12px',color:'#7A7A6E'}}>{m.category || '—'} · {m.quartier || 'Abidjan'} · {new Date(m.created_at).toLocaleDateString('fr-FR')}</div>
                      </div>
                      <span style={{fontSize:'11px',padding:'4px 10px',borderRadius:'20px',fontWeight:500,background:'rgba(232,93,38,0.1)',color:'#E85D26'}}>{m.status}</span>
                    </div>
                  ))}
                  {missions.length === 0 && <p style={{textAlign:'center',color:'#7A7A6E',padding:'48px'}}>Aucune mission</p>}
                </div>
              </div>
            )}

            {/* ===== ARTISANS ===== */}
            {tab === 'artisans' && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:700,color:'#FAFAF5',marginBottom:'20px'}}>Tous les artisans ({artisans.length})</h2>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {artisans.map(a => (
                    <div key={a.id} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',padding:'16px',display:'flex',alignItems:'center',gap:'16px'}}>
                      <div style={{width:'40px',height:'40px',borderRadius:'10px',overflow:'hidden',background:'rgba(232,93,38,0.1)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {a.users?.avatar_url ? <img src={a.users.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span>👷</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'14px',fontWeight:500,color:'#FAFAF5'}}>{a.users?.name || '—'}</div>
                        <div style={{fontSize:'12px',color:'#7A7A6E'}}>{a.metier} · {a.rating_avg?.toFixed(1) || '0.0'}⭐ · {a.mission_count || 0} missions</div>
                      </div>
                      <span style={{
                        fontSize:'11px',padding:'3px 10px',borderRadius:'20px',
                        background: a.kyc_status === 'approved' ? 'rgba(43,107,62,0.15)' : 'rgba(201,168,76,0.15)',
                        color: a.kyc_status === 'approved' ? '#2B6B3E' : '#C9A84C',
                      }}>{a.kyc_status}</span>
                      <button onClick={() => toggleArtisan(a.id, a.is_available)} style={{
                        padding:'6px 14px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'12px',fontWeight:500,
                        background: a.is_available ? 'rgba(43,107,62,0.2)' : 'rgba(220,38,38,0.2)',
                        color: a.is_available ? '#2B6B3E' : '#ef4444',
                      }}>
                        {a.is_available ? '● Actif' : '● Inactif'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== TRANSACTIONS ===== */}
            {tab === 'transactions' && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:700,color:'#FAFAF5',marginBottom:'20px'}}>Transactions ({transactions.length})</h2>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {transactions.map(t => (
                    <div key={t.id} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',padding:'16px',display:'flex',alignItems:'center',gap:'16px'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'14px',fontWeight:500,color:'#FAFAF5'}}>{t.missions?.users?.name || 'Client'} · {t.missions?.category || '—'}</div>
                        <div style={{fontSize:'12px',color:'#7A7A6E'}}>{new Date(t.created_at).toLocaleDateString('fr-FR')} · {t.payment_method}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:'15px',fontWeight:700,color:'#FAFAF5'}}>{t.amount?.toLocaleString()} FCFA</div>
                        <div style={{fontSize:'11px',color:'#7A7A6E'}}>Artisan: {t.artisan_amount?.toLocaleString()} FCFA</div>
                      </div>
                      <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'20px',background:'rgba(201,168,76,0.1)',color:'#C9A84C'}}>{t.status}</span>
                    </div>
                  ))}
                  {transactions.length === 0 && <p style={{textAlign:'center',color:'#7A7A6E',padding:'48px'}}>Aucune transaction</p>}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
