'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TrendingUp, Users, CheckCircle, AlertCircle, DollarSign, Activity, Shield, X, Bell, RotateCcw, MessageSquare, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import AdminSidebar from '@/components/admin/AdminSidebar'

const STATUS_COLORS: Record<string, string> = {
  en_cours:    'text-green-400 bg-green-400/10',
  completed:   'text-green-400 bg-green-400/10',
  disputed:    'text-red-400 bg-red-400/10',
  payment:     'text-yellow-400 bg-yellow-400/10',
  matching:    'text-blue-400 bg-blue-400/10',
  diagnostic:  'text-purple-400 bg-purple-400/10',
  cancelled:   'text-gray-400 bg-gray-400/10',
}


export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab]           = useState('overview')
  const [loading, setLoading]   = useState(true)
  const [adminName, setAdminName] = useState('Admin')
  const [adminId, setAdminId]   = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [scraping, setScraping]   = useState(false)

  // Stats
  const [stats, setStats] = useState({ missions: 0, artisans: 0, revenue: 0 })

  // Data
  const [missions, setMissions]         = useState<any[]>([])
  const [artisans, setArtisans]         = useState<any[]>([])
  const [kycPending, setKycPending]     = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])

  // Litiges
  const [litiges, setLitiges]               = useState<any[]>([])
  const [selectedLitige, setSelectedLitige] = useState<any>(null)
  const [litigeMessages, setLitigeMessages] = useState<any[]>([])
  const [litigeNotif, setLitigeNotif]       = useState(false)
  const [actingLitige, setActingLitige]     = useState(false)

  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 4000) }

  const triggerScrape = async () => {
    setScraping(true)
    try {
      const res = await fetch('/api/admin/scrape-prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const d = await res.json()
      flash(`✓ ${d.updated} prix Jumia mis à jour`)
    } catch { flash('Erreur scraping Jumia') }
    setScraping(false)
  }

  const loadAll = useCallback(async () => {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setAdminId(session.user.id)
      const { data: u } = await supabase.from('users').select('name').eq('id', session.user.id).single()
      if (u?.name) setAdminName(u.name)
    }

    const { count: missionCount } = await supabase.from('missions').select('*', { count: 'exact', head: true })
    const { count: artisanCount } = await supabase.from('artisan_pros').select('*', { count: 'exact', head: true }).eq('kyc_status', 'approved')
    const { data: txData } = await supabase.from('transactions').select('amount').eq('status', 'released')
    const totalRevenue = (txData || []).reduce((s: number, t: any) => s + (t.amount || 0), 0)
    setStats({ missions: missionCount || 0, artisans: artisanCount || 0, revenue: totalRevenue })

    const { data: missionsData } = await supabase
      .from('missions')
      .select('*, users!missions_client_id_fkey(name), artisan_pros(id, metier, users!artisan_pros_user_id_fkey(name))')
      .order('created_at', { ascending: false })
      .limit(20)
    setMissions(missionsData || [])

    const { data: kycData } = await supabase
      .from('kyc_security')
      .select('*, artisan_pros(id, metier, user_id, kyc_status, users!artisan_pros_user_id_fkey(name, email, avatar_url))')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setKycPending(kycData || [])

    const { data: artisansData } = await supabase
      .from('artisan_pros')
      .select('*, users!artisan_pros_user_id_fkey(name, email, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(30)
    setArtisans(artisansData || [])

    const { data: txAll } = await supabase
      .from('transactions')
      .select('*, missions(category, users!missions_client_id_fkey(name))')
      .order('created_at', { ascending: false })
      .limit(20)
    setTransactions(txAll || [])

    const { data: litigesData } = await supabase
      .from('missions')
      .select('*, users!missions_client_id_fkey(name, avatar_url), artisan_pros(id, metier, users!artisan_pros_user_id_fkey(name))')
      .eq('status', 'disputed')
      .order('updated_at', { ascending: false })
    setLitiges(litigesData || [])

    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Auto-sélectionne le premier litige quand on ouvre l'onglet
  useEffect(() => {
    if (tab === 'litiges' && litiges.length > 0 && !selectedLitige) {
      selectLitige(litiges[0])
    }
  }, [tab, litiges])

  // Realtime — nouveaux litiges
  useEffect(() => {
    const channel = supabase
      .channel('admin-litiges-rt')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'missions' },
        payload => {
          if (payload.new?.status === 'disputed') {
            setLitigeNotif(true)
            toast('⚠️ Nouveau litige ouvert !', {
              duration: 6000,
              style: { background: '#1A1F1B', color: '#FAFAF5', border: '1px solid rgba(239,68,68,0.4)' },
            })
            loadAll()
          }
          if (payload.new?.status !== 'disputed' && payload.old?.status === 'disputed') {
            loadAll()
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadAll])

  // Charge les messages du litige sélectionné
  const selectLitige = async (litige: any) => {
    setSelectedLitige(litige)
    setLitigeMessages([])
    const { data: msgs } = await supabase
      .from('chat_history')
      .select('text, type, created_at, sender_role')
      .eq('mission_id', litige.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setLitigeMessages((msgs || []).reverse())
  }

  // Revenir en arrière — remet la mission en_cours
  const revertLitige = async () => {
    if (!selectedLitige || !adminId) return
    setActingLitige(true)
    await supabase.from('missions').update({ status: 'en_cours' }).eq('id', selectedLitige.id)
    await supabase.from('chat_history').insert({
      mission_id: selectedLitige.id,
      sender_id: adminId,
      sender_role: 'admin',
      text: "⚖️ L'administrateur AfriOne a examiné le litige et décidé de poursuivre la mission. Le litige est clôturé.",
      type: 'system',
    })
    flash('Mission rétablie en cours ✓')
    setActingLitige(false)
    setSelectedLitige(null)
    loadAll()
  }

  // Clôturer le litige (mission terminée)
  const closeLitige = async (favor: 'client' | 'artisan') => {
    if (!selectedLitige || !adminId) return
    setActingLitige(true)
    await supabase.from('missions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', selectedLitige.id)
    const msg = favor === 'client'
      ? "⚖️ Litige résolu par l'admin — décision en faveur du client. Remboursement en cours."
      : "⚖️ Litige résolu par l'admin — décision en faveur de l'artisan. Paiement validé."
    await supabase.from('chat_history').insert({
      mission_id: selectedLitige.id, sender_id: adminId, sender_role: 'admin',
      text: msg, type: 'system',
    })
    if (favor === 'artisan' && (selectedLitige.total_price || 0) > 0) {
      supabase.rpc('release_escrow', { p_mission_id: selectedLitige.id })
    }
    flash(`Litige résolu — ${favor === 'client' ? 'remboursement' : 'paiement artisan'} ✓`)
    setActingLitige(false)
    setSelectedLitige(null)
    loadAll()
  }

  const approveKyc = async (kycId: string, artisanId: string) => {
    await supabase.from('kyc_security').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', kycId)
    await supabase.from('artisan_pros').update({ kyc_status: 'approved', is_available: true }).eq('id', artisanId)
    flash('✓ Artisan approuvé')
    loadAll()
  }

  const rejectKyc = async (kycId: string, artisanId: string) => {
    await supabase.from('kyc_security').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', kycId)
    await supabase.from('artisan_pros').update({ kyc_status: 'rejected' }).eq('id', artisanId)
    flash('✗ Artisan rejeté')
    loadAll()
  }

  const toggleArtisan = async (artisanId: string, current: boolean) => {
    await supabase.from('artisan_pros').update({ is_available: !current }).eq('id', artisanId)
    flash(current ? 'Artisan désactivé' : 'Artisan activé')
    loadAll()
  }

  const litigeReason = (msgs: any[]) => {
    const m = msgs.find(m => m.type === 'system' && m.text?.startsWith('⚠️ Litige'))
    return m?.text?.replace('⚠️ Litige signalé : ', '') || null
  }

  return (
    <div className="min-h-screen bg-dark text-cream flex flex-col lg:flex-row">

      <AdminSidebar
        activeId={tab}
        onTabChange={id => { setTab(id); if (id === 'litiges') setLitigeNotif(false) }}
        litigeCount={litiges.length}
        litigeNotif={litigeNotif}
        adminName={adminName}
      />

      {/* Main */}
      <main style={{flex:1,padding:'24px 32px',maxWidth:'1200px',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'32px'}}>
          <div>
            <h1 style={{fontFamily:'var(--font-display)',fontSize:'28px',fontWeight:700,color:'#FAFAF5'}}>Dashboard Admin</h1>
            <p style={{fontSize:'13px',color:'#7A7A6E',marginTop:'4px'}}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            {actionMsg && <span style={{fontSize:'12px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',padding:'6px 14px',borderRadius:'20px'}}>{actionMsg}</span>}
            {litigeNotif && (
              <button onClick={() => { setTab('litiges'); setLitigeNotif(false) }} style={{
                display:'flex',alignItems:'center',gap:'8px',
                background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.35)',
                padding:'6px 14px',borderRadius:'20px',cursor:'pointer',
              }}>
                <Bell size={13} color="#ef4444" />
                <span style={{fontSize:'11px',fontWeight:700,color:'#ef4444'}}>Nouveau litige</span>
              </button>
            )}
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

                {/* Alerte litiges */}
                {litiges.length > 0 && (
                  <button onClick={() => { setTab('litiges'); setLitigeNotif(false) }} style={{
                    display:'flex',alignItems:'center',gap:'12px',padding:'14px 20px',
                    background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',
                    borderRadius:'16px',cursor:'pointer',textAlign:'left',width:'100%',
                  }}>
                    <AlertCircle size={20} color="#ef4444" style={{flexShrink:0}} />
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:'14px',color:'#ef4444'}}>
                        {litiges.length} litige{litiges.length > 1 ? 's' : ''} ouvert{litiges.length > 1 ? 's' : ''} — intervention requise
                      </div>
                      <div style={{fontSize:'12px',color:'rgba(239,68,68,0.7)',marginTop:'2px'}}>
                        Cliquez pour examiner et arbitrer
                      </div>
                    </div>
                    <span style={{fontSize:'13px',color:'#ef4444',fontWeight:600}}>Voir →</span>
                  </button>
                )}

                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px'}}>
                  {[
                    { label: 'Total missions',  value: stats.missions,                icon: Activity,   color: '#E85D26' },
                    { label: 'Artisans actifs', value: stats.artisans,                icon: Users,      color: '#2B6B3E' },
                    { label: 'CA total (FCFA)', value: stats.revenue.toLocaleString(), icon: DollarSign, color: '#C9A84C' },
                    { label: 'KYC en attente',  value: kycPending.length,             icon: Shield,     color: '#7A7A6E' },
                  ].map(k => (
                    <div key={k.label} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',padding:'20px'}}>
                      <k.icon size={20} style={{color:k.color,marginBottom:'12px'}} />
                      <div style={{fontSize:'28px',fontWeight:700,color:'#FAFAF5',fontFamily:'var(--font-display)'}}>{k.value}</div>
                      <div style={{fontSize:'11px',color:'#7A7A6E',marginTop:'4px',fontFamily:'Space Mono',textTransform:'uppercase'}}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Bouton Sync Jumia */}
                <button onClick={triggerScrape} disabled={scraping} style={{
                  display:'flex',alignItems:'center',gap:'10px',padding:'14px 20px',width:'100%',
                  background:'rgba(232,93,38,0.07)',border:'1.5px dashed rgba(232,93,38,0.35)',
                  borderRadius:'16px',cursor: scraping ? 'default' : 'pointer',textAlign:'left',
                  opacity: scraping ? 0.7 : 1, transition:'all 0.15s',
                }}>
                  <span style={{fontSize:'20px'}}>{scraping ? '⏳' : '🛒'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:'14px',color:'#E85D26'}}>
                      {scraping ? 'Synchronisation Jumia CI en cours…' : 'Synchroniser les prix Jumia CI'}
                    </div>
                    <div style={{fontSize:'11px',color:'rgba(232,93,38,0.55)',marginTop:'2px'}}>
                      Met à jour les prix + photos depuis Jumia CI pour tous les matériaux
                    </div>
                  </div>
                  {!scraping && <span style={{fontSize:'12px',color:'#E85D26',fontWeight:600}}>Lancer →</span>}
                </button>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px'}}>
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
                            <div style={{fontSize:'11px',color:'#7A7A6E'}}>{k.artisan_pros?.metier || '—'} · {new Date(k.created_at).toLocaleDateString('fr-FR')}</div>
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

            {/* ===== LITIGES ===== */}
            {tab === 'litiges' && (
              <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <h2 style={{fontSize:'20px',fontWeight:700,color:'#FAFAF5',margin:0}}>Litiges & Arbitrage</h2>
                  <span style={{
                    fontSize:'12px',padding:'4px 12px',borderRadius:'20px',fontWeight:700,
                    background: litiges.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(43,107,62,0.15)',
                    color: litiges.length > 0 ? '#ef4444' : '#2B6B3E',
                  }}>
                    {litiges.length > 0 ? `${litiges.length} ouvert${litiges.length > 1 ? 's' : ''}` : '✓ Aucun litige'}
                  </span>
                </div>

                {litiges.length === 0 ? (
                  <div style={{textAlign:'center',padding:'80px 0',color:'#7A7A6E'}}>
                    <p style={{fontSize:'48px',marginBottom:'16px'}}>⚖️</p>
                    <p style={{fontSize:'16px',color:'#FAFAF5',fontWeight:600,marginBottom:'8px'}}>Aucun litige en cours</p>
                    <p style={{fontSize:'13px'}}>Tous les litiges ont été résolus.</p>
                  </div>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:'16px',minHeight:'600px'}}>

                    {/* ── Colonne gauche : liste ── */}
                    <div style={{display:'flex',flexDirection:'column',gap:'8px',overflowY:'auto'}}>
                      {litiges.map(l => {
                        const active = selectedLitige?.id === l.id
                        return (
                          <button key={l.id} onClick={() => selectLitige(l)} style={{
                            width:'100%',textAlign:'left',padding:'14px 16px',borderRadius:'14px',cursor:'pointer',
                            background: active ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                            border: `1.5px solid ${active ? '#ef4444' : 'rgba(255,255,255,0.07)'}`,
                            transition:'all 0.12s',
                          }}>
                            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px'}}>
                              <div style={{
                                width:'8px',height:'8px',borderRadius:'50%',flexShrink:0,
                                background:'#ef4444',
                                boxShadow: active ? '0 0 8px rgba(239,68,68,0.8)' : '0 0 4px rgba(239,68,68,0.4)',
                              }} />
                              <span style={{fontSize:'13px',fontWeight:600,color:'#FAFAF5',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                {l.users?.name || 'Client'}
                              </span>
                            </div>
                            <div style={{fontSize:'11px',color:'#7A7A6E',marginBottom:'6px',paddingLeft:'18px'}}>
                              vs {l.artisan_pros?.users?.name || '—'} · {l.artisan_pros?.metier || l.category || '—'}
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingLeft:'18px'}}>
                              <span style={{fontSize:'10px',color:'rgba(239,68,68,0.6)'}}>
                                {l.updated_at ? new Date(l.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '—'}
                              </span>
                              {l.total_price > 0 && (
                                <span style={{fontSize:'11px',fontWeight:700,color:'#FAFAF5',fontFamily:'Space Mono'}}>
                                  {l.total_price.toLocaleString()} F
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* ── Colonne droite : détail ── */}
                    {selectedLitige && (
                      <div style={{
                        background:'rgba(255,255,255,0.03)',border:'1.5px solid rgba(255,255,255,0.08)',
                        borderRadius:'20px',padding:'28px',overflowY:'auto',
                        display:'flex',flexDirection:'column',gap:'20px',
                      }}>

                        {/* En-tête */}
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                          <div>
                            <div style={{
                              display:'inline-flex',alignItems:'center',gap:'6px',
                              background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',
                              padding:'3px 10px',borderRadius:'20px',marginBottom:'10px',
                            }}>
                              <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#ef4444',display:'inline-block'}} />
                              <span style={{fontSize:'10px',fontWeight:700,color:'#ef4444',letterSpacing:'0.08em'}}>LITIGE OUVERT</span>
                            </div>
                            <div style={{fontSize:'19px',fontWeight:700,color:'#FAFAF5',marginBottom:'4px'}}>
                              {selectedLitige.users?.name || 'Client'}
                              <span style={{color:'#7A7A6E',fontWeight:400,margin:'0 8px'}}>vs</span>
                              {selectedLitige.artisan_pros?.users?.name || 'Artisan'}
                            </div>
                            <div style={{fontSize:'12px',color:'#7A7A6E'}}>
                              {selectedLitige.category || selectedLitige.artisan_pros?.metier || '—'} · {selectedLitige.quartier || 'Abidjan'}
                            </div>
                          </div>
                          {selectedLitige.total_price > 0 && (
                            <div style={{
                              textAlign:'right',flexShrink:0,padding:'12px 16px',
                              background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.15)',
                              borderRadius:'14px',
                            }}>
                              <div style={{fontSize:'24px',fontWeight:700,color:'#FAFAF5',fontFamily:'Space Mono',lineHeight:1}}>
                                {selectedLitige.total_price.toLocaleString()}
                              </div>
                              <div style={{fontSize:'10px',color:'#ef4444',marginTop:'4px',fontWeight:600}}>FCFA EN LITIGE</div>
                            </div>
                          )}
                        </div>

                        {/* Raison du litige */}
                        <div style={{background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'14px',padding:'16px'}}>
                          <div style={{fontSize:'10px',fontWeight:700,color:'#ef4444',letterSpacing:'0.1em',marginBottom:'10px',display:'flex',alignItems:'center',gap:'5px'}}>
                            <AlertCircle size={11} /> RAISON DU LITIGE
                          </div>
                          {litigeMessages.length === 0 ? (
                            <div style={{display:'flex',alignItems:'center',gap:'8px',color:'#7A7A6E',fontSize:'13px'}}>
                              <div style={{width:'14px',height:'14px',border:'2px solid rgba(239,68,68,0.2)',borderTop:'2px solid #ef4444',borderRadius:'50%',animation:'spin 1s linear infinite',flexShrink:0}} />
                              Chargement…
                            </div>
                          ) : (
                            <p style={{fontSize:'14px',color:'#FAFAF5',lineHeight:'1.6',margin:0}}>
                              {litigeReason(litigeMessages) || 'Raison non spécifiée dans le chat.'}
                            </p>
                          )}
                        </div>

                        {/* Conversation */}
                        {litigeMessages.length > 0 && (
                          <div>
                            <div style={{fontSize:'10px',fontWeight:700,color:'#7A7A6E',letterSpacing:'0.1em',marginBottom:'10px'}}>CONVERSATION</div>
                            <div style={{display:'flex',flexDirection:'column',gap:'6px',maxHeight:'220px',overflowY:'auto',paddingRight:'4px'}}>
                              {litigeMessages.slice(-8).map((msg: any, i: number) => {
                                const isArtisan = msg.sender_role === 'artisan'
                                const isSystem  = msg.type === 'system'
                                const isLitigeMsg = msg.text?.startsWith('⚠️ Litige')
                                if (isSystem && !isLitigeMsg) return null
                                return (
                                  <div key={i} style={{
                                    padding:'10px 12px',borderRadius:'10px',
                                    background: isLitigeMsg
                                      ? 'rgba(239,68,68,0.07)'
                                      : isArtisan
                                        ? 'rgba(232,93,38,0.06)'
                                        : 'rgba(43,107,62,0.06)',
                                    border: `1px solid ${isLitigeMsg ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                  }}>
                                    <div style={{fontSize:'10px',fontWeight:700,marginBottom:'4px',
                                      color: isLitigeMsg ? '#ef4444' : isArtisan ? '#E85D26' : '#2B6B3E',
                                    }}>
                                      {isArtisan ? '🔧 ARTISAN' : '👤 CLIENT'}
                                    </div>
                                    <div style={{fontSize:'13px',color:'#FAFAF5',lineHeight:'1.4'}}>
                                      {msg.text?.replace('⚠️ Litige signalé : ', '')}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            <Link href={`/warroom/${selectedLitige.id}`} target="_blank" style={{
                              display:'flex',alignItems:'center',gap:'6px',marginTop:'10px',
                              color:'#7A7A6E',textDecoration:'none',fontSize:'12px',
                            }}>
                              <ExternalLink size={12} /> Voir toute la conversation ↗
                            </Link>
                          </div>
                        )}

                        {/* ── DÉCISION ── */}
                        <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:'20px',display:'flex',flexDirection:'column',gap:'10px'}}>
                          <div style={{fontSize:'11px',fontWeight:700,color:'#7A7A6E',letterSpacing:'0.1em',marginBottom:'2px'}}>DÉCISION DE L'ARBITRE</div>

                          {/* Revenir en arrière */}
                          <button
                            onClick={revertLitige}
                            disabled={actingLitige}
                            style={{
                              display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',
                              width:'100%',padding:'16px',borderRadius:'14px',cursor:'pointer',
                              background:'#C9A84C',color:'#0F1410',
                              border:'none',fontWeight:800,fontSize:'15px',
                              opacity: actingLitige ? 0.5 : 1,
                              boxShadow:'0 4px 20px rgba(201,168,76,0.3)',
                              transition:'all 0.15s',
                            }}
                          >
                            <RotateCcw size={17} />
                            {actingLitige ? 'Traitement…' : '↩ Revenir en arrière — reprendre la mission'}
                          </button>

                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                            <button
                              onClick={() => closeLitige('client')}
                              disabled={actingLitige}
                              style={{
                                display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
                                padding:'13px',borderRadius:'12px',cursor:'pointer',
                                background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',
                                color:'#ef4444',fontWeight:700,fontSize:'13px',
                                opacity: actingLitige ? 0.5 : 1,
                              }}
                            >
                              <DollarSign size={14} /> Rembourser le client
                            </button>
                            <button
                              onClick={() => closeLitige('artisan')}
                              disabled={actingLitige}
                              style={{
                                display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
                                padding:'13px',borderRadius:'12px',cursor:'pointer',
                                background:'rgba(43,107,62,0.12)',border:'1px solid rgba(43,107,62,0.3)',
                                color:'#2B6B3E',fontWeight:700,fontSize:'13px',
                                opacity: actingLitige ? 0.5 : 1,
                              }}
                            >
                              <CheckCircle size={14} /> Payer l'artisan
                            </button>
                          </div>

                          <div style={{
                            display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'6px',
                            padding:'12px',background:'rgba(255,255,255,0.02)',borderRadius:'12px',
                            border:'1px solid rgba(255,255,255,0.05)',
                          }}>
                            {[
                              { label:'↩ Revenir', desc:'Mission reprend, litige clos' },
                              { label:'Rembourser', desc:'Escrow → client, mission terminée' },
                              { label:'Payer artisan', desc:'Escrow → artisan, mission terminée' },
                            ].map(h => (
                              <div key={h.label} style={{textAlign:'center'}}>
                                <div style={{fontSize:'10px',fontWeight:700,color:'#7A7A6E',marginBottom:'2px'}}>{h.label}</div>
                                <div style={{fontSize:'9px',color:'rgba(122,122,110,0.7)',lineHeight:'1.4'}}>{h.desc}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                  ) : kycPending.map(k => {
                    const artisan = k.artisan_pros || {}
                    const user = artisan.users || {}
                    const hasCni = !!(k.cni_front_url || k.cni_back_url)
                    const hasDiploma = (k.diploma_urls || []).length > 0
                    return (
                      <div key={k.id} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${hasCni ? 'rgba(232,93,38,0.25)' : 'rgba(255,255,255,0.08)'}`,borderRadius:'16px',padding:'20px'}}>
                        <div style={{display:'flex',alignItems:'flex-start',gap:'16px',flexWrap:'wrap'}}>
                          {/* Avatar */}
                          <div style={{width:'48px',height:'48px',background:'rgba(232,93,38,0.1)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0,overflow:'hidden'}}>
                            {user.avatar_url ? <img src={user.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : '🔧'}
                          </div>
                          {/* Info */}
                          <div style={{flex:1,minWidth:'200px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px',flexWrap:'wrap'}}>
                              <span style={{fontSize:'15px',fontWeight:600,color:'#FAFAF5'}}>{user.name || '—'}</span>
                              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',
                                background: hasCni ? 'rgba(232,93,38,0.12)' : 'rgba(201,168,76,0.12)',
                                color: hasCni ? '#E85D26' : '#C9A84C',
                                fontWeight:600,
                              }}>
                                {hasCni ? 'Documents envoyés' : 'En attente de documents'}
                              </span>
                            </div>
                            <div style={{fontSize:'12px',color:'#7A7A6E',marginBottom:'10px'}}>
                              {artisan.metier || '—'} · {user.email || '—'} · Soumis le {new Date(k.created_at).toLocaleDateString('fr-FR')}
                            </div>
                            {/* Document links */}
                            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                              {k.cni_front_url && (
                                <a href={k.cni_front_url} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#E85D26',textDecoration:'none',background:'rgba(232,93,38,0.1)',padding:'4px 12px',borderRadius:'20px',display:'flex',alignItems:'center',gap:'4px'}}>
                                  📄 CNI Recto ↗
                                </a>
                              )}
                              {k.cni_back_url && (
                                <a href={k.cni_back_url} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#E85D26',textDecoration:'none',background:'rgba(232,93,38,0.1)',padding:'4px 12px',borderRadius:'20px',display:'flex',alignItems:'center',gap:'4px'}}>
                                  📄 CNI Verso ↗
                                </a>
                              )}
                              {hasDiploma && (
                                <a href={k.diploma_urls[0]} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#C9A84C',textDecoration:'none',background:'rgba(201,168,76,0.1)',padding:'4px 12px',borderRadius:'20px',display:'flex',alignItems:'center',gap:'4px'}}>
                                  🎓 Diplôme ↗
                                </a>
                              )}
                              {!hasCni && !hasDiploma && (
                                <span style={{fontSize:'11px',color:'rgba(122,122,110,0.6)',fontStyle:'italic'}}>Aucun document uploadé</span>
                              )}
                            </div>
                          </div>
                          {/* Actions */}
                          <div style={{display:'flex',gap:'8px',flexShrink:0,alignSelf:'center'}}>
                            <button onClick={() => approveKyc(k.id, artisan.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'rgba(43,107,62,0.2)',border:'1px solid rgba(43,107,62,0.3)',borderRadius:'10px',cursor:'pointer',fontSize:'13px',fontWeight:600,color:'#2B6B3E'}}>
                              <CheckCircle size={14} /> Approuver
                            </button>
                            <button onClick={() => rejectKyc(k.id, artisan.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'rgba(220,38,38,0.2)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:'10px',cursor:'pointer',fontSize:'13px',fontWeight:600,color:'#ef4444'}}>
                              <X size={14} /> Rejeter
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
