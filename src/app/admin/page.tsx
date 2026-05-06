'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TrendingUp, Users, CheckCircle, AlertCircle, DollarSign, Activity, Shield, X, Bell, RotateCcw, MessageSquare, ExternalLink, ShieldCheck, UserX, UserCheck } from 'lucide-react'
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
  const [kycAll, setKycAll]             = useState<any[]>([])
  const [kycFilter, setKycFilter]       = useState<'pending'|'approved'|'rejected'>('pending')
  const [transactions, setTransactions] = useState<any[]>([])

  // Users
  const [users, setUsers] = useState<any[]>([])
  const [usersFilter, setUsersFilter] = useState<'all'|'client'|'artisan'|'admin'>('all')

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
      flash(d.summary || `✓ ${d.updated} prix Jumia mis à jour`)
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

    // Toutes les requêtes admin passent par l'API server-side (supabaseAdmin / service_role)
    // pour bypasser RLS et voir toutes les données (pending, users joints, etc.)
    const [statsRes, missionsRes, kycRes, txRes, litigesRes, usersRes] = await Promise.all([
      fetch('/api/admin/data?type=stats').then(r => r.json()),
      fetch('/api/admin/data?type=missions').then(r => r.json()),
      fetch('/api/admin/data?type=kyc').then(r => r.json()),
      fetch('/api/admin/data?type=transactions').then(r => r.json()),
      fetch('/api/admin/data?type=litiges').then(r => r.json()),
      fetch('/api/admin/data?type=users').then(r => r.json()),
    ])

    setStats({ missions: statsRes.missions || 0, artisans: statsRes.artisans || 0, revenue: statsRes.revenue || 0 })
    setMissions(Array.isArray(missionsRes) ? missionsRes : [])
    setKycAll(Array.isArray(kycRes) ? kycRes : [])
    setArtisans(Array.isArray(kycRes) ? kycRes : [])
    setTransactions(Array.isArray(txRes) ? txRes : [])
    setLitiges(Array.isArray(litigesRes) ? litigesRes : [])
    setUsers(Array.isArray(usersRes) ? usersRes : [])

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
    await adminAction({ action: 'revert_litige', missionId: selectedLitige.id, adminId })
    flash('Mission rétablie en cours ✓')
    setActingLitige(false)
    setSelectedLitige(null)
    loadAll()
  }

  // Clôturer le litige (mission terminée)
  const closeLitige = async (favor: 'client' | 'artisan') => {
    if (!selectedLitige || !adminId) return
    setActingLitige(true)
    await adminAction({ action: 'close_litige', missionId: selectedLitige.id, adminId, favor })
    if (favor === 'artisan' && (selectedLitige.total_price || 0) > 0) {
      supabase.rpc('release_escrow', { p_mission_id: selectedLitige.id })
    }
    flash(`Litige résolu — ${favor === 'client' ? 'remboursement' : 'paiement artisan'} ✓`)
    setActingLitige(false)
    setSelectedLitige(null)
    loadAll()
  }

  const adminAction = async (body: object) =>
    fetch('/api/admin/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const approveKyc = async (artisanId: string, kycId?: string) => {
    await adminAction({ action: 'approve_kyc', artisanId, kycId })
    flash('✓ Artisan approuvé')
    loadAll()
  }

  const rejectKyc = async (artisanId: string, kycId?: string) => {
    await adminAction({ action: 'reject_kyc', artisanId, kycId })
    flash('✗ Artisan rejeté')
    loadAll()
  }

  const revokeKyc = async (artisanId: string) => {
    await adminAction({ action: 'revoke_kyc', artisanId })
    flash('↩ KYC révoqué — artisan repassé en attente')
    loadAll()
  }

  const setRole = async (userId: string, role: 'client'|'artisan'|'admin') => {
    const res = await adminAction({ action: 'set_role', userId, role })
    const data = await res.json()
    if (data.ok) {
      flash(role === 'admin' ? '⭐ Utilisateur promu Admin' : role === 'artisan' ? 'Rôle → Artisan' : 'Rôle → Client')
      loadAll()
    } else {
      flash('Erreur : ' + (data.error || 'inconnue'))
    }
  }

  const toggleArtisan = async (artisanId: string, current: boolean) => {
    await adminAction({ action: 'toggle_artisan', artisanId })
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
                    { label: 'KYC en attente',  value: kycAll.filter(k=>k.kyc_status==='pending').length, icon: Shield, color: '#7A7A6E' },
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
                      <span style={{fontSize:'11px',color:'#E85D26',background:'rgba(232,93,38,0.1)',padding:'3px 10px',borderRadius:'20px'}}>{kycAll.filter(k=>k.kyc_status==='pending').length} en attente</span>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {kycAll.filter(k=>k.kyc_status==='pending').slice(0,5).map(k => (
                        <div key={k.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',background:'rgba(255,255,255,0.04)',borderRadius:'10px'}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:'13px',fontWeight:500,color:'#FAFAF5'}}>{k.users?.name || '—'}</div>
                            <div style={{fontSize:'11px',color:'#7A7A6E'}}>{k.metier} · {new Date(k.created_at).toLocaleDateString('fr-FR')}</div>
                          </div>
                          <div style={{display:'flex',gap:'6px'}}>
                            <button onClick={() => approveKyc(k.id, k.kyc_security?.[0]?.id)} style={{width:'28px',height:'28px',background:'rgba(43,107,62,0.2)',border:'none',borderRadius:'8px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#2B6B3E'}}>
                              <CheckCircle size={14} />
                            </button>
                            <button onClick={() => rejectKyc(k.id, k.kyc_security?.[0]?.id)} style={{width:'28px',height:'28px',background:'rgba(220,38,38,0.2)',border:'none',borderRadius:'8px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#ef4444'}}>
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {kycAll.filter(k=>k.kyc_status==='pending').length === 0 && <p style={{fontSize:'13px',color:'#7A7A6E',textAlign:'center',padding:'24px 0'}}>Aucun KYC en attente 🎉</p>}
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
            {tab === 'kyc' && (() => {
              const pending  = kycAll.filter(k => k.kyc_status === 'pending')
              const approved = kycAll.filter(k => k.kyc_status === 'approved')
              const rejected = kycAll.filter(k => k.kyc_status === 'rejected')
              const shown    = kycFilter === 'pending' ? pending : kycFilter === 'approved' ? approved : rejected

              const FILTERS: { id: 'pending'|'approved'|'rejected'; label: string; count: number; color: string; bg: string }[] = [
                { id: 'pending',  label: 'À valider',  count: pending.length,  color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
                { id: 'approved', label: 'Validés',    count: approved.length, color: '#2B6B3E', bg: 'rgba(43,107,62,0.12)'  },
                { id: 'rejected', label: 'Rejetés',    count: rejected.length, color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
              ]

              return (
                <div>
                  {/* Header + compteurs */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px',marginBottom:'24px'}}>
                    <h2 style={{fontSize:'20px',fontWeight:700,color:'#FAFAF5',margin:0}}>Artisans — KYC</h2>
                    <div style={{display:'flex',gap:'8px'}}>
                      {FILTERS.map(f => (
                        <button key={f.id} onClick={() => setKycFilter(f.id)} style={{
                          display:'flex',alignItems:'center',gap:'6px',
                          padding:'6px 14px',borderRadius:'20px',cursor:'pointer',
                          border: kycFilter === f.id ? `1.5px solid ${f.color}` : '1.5px solid rgba(255,255,255,0.08)',
                          background: kycFilter === f.id ? f.bg : 'transparent',
                          color: kycFilter === f.id ? f.color : '#7A7A6E',
                          fontSize:'12px',fontWeight:600,transition:'all 0.15s',
                        }}>
                          {f.label}
                          <span style={{
                            minWidth:'18px',height:'18px',borderRadius:'9px',padding:'0 4px',
                            background: kycFilter === f.id ? f.color : 'rgba(255,255,255,0.08)',
                            color: kycFilter === f.id ? 'white' : '#7A7A6E',
                            fontSize:'10px',fontWeight:700,
                            display:'inline-flex',alignItems:'center',justifyContent:'center',
                          }}>{f.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Liste */}
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    {shown.length === 0 ? (
                      <div style={{textAlign:'center',padding:'64px',color:'#7A7A6E'}}>
                        <p style={{fontSize:'40px',marginBottom:'12px'}}>
                          {kycFilter === 'pending' ? '🎉' : kycFilter === 'approved' ? '✅' : '📋'}
                        </p>
                        <p style={{fontSize:'15px'}}>
                          {kycFilter === 'pending' ? 'Aucun artisan en attente' : kycFilter === 'approved' ? 'Aucun artisan validé' : 'Aucun artisan rejeté'}
                        </p>
                      </div>
                    ) : shown.map(k => {
                      const kycDoc = k.kyc_security?.[0] || null
                      const hasCni = !!(kycDoc?.cni_front_url || kycDoc?.cni_back_url)
                      const hasDiploma = (kycDoc?.diploma_urls || []).length > 0
                      const statusColor = k.kyc_status === 'approved' ? '#2B6B3E' : k.kyc_status === 'rejected' ? '#ef4444' : '#C9A84C'
                      const statusBg    = k.kyc_status === 'approved' ? 'rgba(43,107,62,0.12)' : k.kyc_status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(201,168,76,0.12)'
                      const statusLabel = k.kyc_status === 'approved' ? '✓ Validé' : k.kyc_status === 'rejected' ? '✗ Rejeté' : hasCni ? 'Docs envoyés' : 'Sans documents'
                      const borderColor = k.kyc_status === 'approved' ? 'rgba(43,107,62,0.3)' : k.kyc_status === 'rejected' ? 'rgba(239,68,68,0.2)' : hasCni ? 'rgba(232,93,38,0.25)' : 'rgba(255,255,255,0.08)'

                      return (
                        <div key={k.id} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${borderColor}`,borderRadius:'16px',padding:'18px 20px'}}>
                          <div style={{display:'flex',alignItems:'flex-start',gap:'14px',flexWrap:'wrap'}}>
                            {/* Avatar */}
                            <div style={{width:'44px',height:'44px',background:'rgba(232,93,38,0.1)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0,overflow:'hidden'}}>
                              {k.users?.avatar_url ? <img src={k.users.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : '🔧'}
                            </div>

                            {/* Info */}
                            <div style={{flex:1,minWidth:'180px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px',flexWrap:'wrap'}}>
                                <span style={{fontSize:'14px',fontWeight:600,color:'#FAFAF5'}}>{k.users?.name || '—'}</span>
                                <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',background:statusBg,color:statusColor,fontWeight:700}}>
                                  {statusLabel}
                                </span>
                              </div>
                              <div style={{fontSize:'12px',color:'#7A7A6E',marginBottom:'8px'}}>
                                {k.metier} · {k.users?.email || '—'} · Inscrit le {new Date(k.created_at).toLocaleDateString('fr-FR')}
                                {kycDoc?.reviewed_at && (
                                  <span style={{marginLeft:'8px',color:'rgba(122,122,110,0.7)'}}>
                                    · Traité le {new Date(kycDoc.reviewed_at).toLocaleDateString('fr-FR')}
                                  </span>
                                )}
                              </div>
                              {/* Documents */}
                              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                                {kycDoc?.cni_front_url && (
                                  <a href={kycDoc.cni_front_url} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#E85D26',textDecoration:'none',background:'rgba(232,93,38,0.08)',border:'1px solid rgba(232,93,38,0.2)',padding:'3px 10px',borderRadius:'20px'}}>
                                    📄 CNI Recto ↗
                                  </a>
                                )}
                                {kycDoc?.cni_back_url && (
                                  <a href={kycDoc.cni_back_url} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#E85D26',textDecoration:'none',background:'rgba(232,93,38,0.08)',border:'1px solid rgba(232,93,38,0.2)',padding:'3px 10px',borderRadius:'20px'}}>
                                    📄 CNI Verso ↗
                                  </a>
                                )}
                                {hasDiploma && (
                                  <a href={kycDoc.diploma_urls[0]} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#C9A84C',textDecoration:'none',background:'rgba(201,168,76,0.08)',border:'1px solid rgba(201,168,76,0.2)',padding:'3px 10px',borderRadius:'20px'}}>
                                    🎓 Diplôme ↗
                                  </a>
                                )}
                                {!hasCni && !hasDiploma && (
                                  <span style={{fontSize:'11px',color:'rgba(122,122,110,0.5)',fontStyle:'italic'}}>Aucun document uploadé</span>
                                )}
                              </div>
                            </div>

                            {/* Actions selon statut */}
                            <div style={{display:'flex',gap:'8px',flexShrink:0,alignSelf:'center',flexWrap:'wrap'}}>
                              {k.kyc_status === 'pending' && (
                                <>
                                  <button onClick={() => approveKyc(k.id, kycDoc?.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'rgba(43,107,62,0.2)',border:'1px solid rgba(43,107,62,0.35)',borderRadius:'10px',cursor:'pointer',fontSize:'12px',fontWeight:600,color:'#2B6B3E'}}>
                                    <CheckCircle size={13} /> Approuver
                                  </button>
                                  <button onClick={() => rejectKyc(k.id, kycDoc?.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:'10px',cursor:'pointer',fontSize:'12px',fontWeight:600,color:'#ef4444'}}>
                                    <X size={13} /> Rejeter
                                  </button>
                                </>
                              )}
                              {k.kyc_status === 'approved' && (
                                <button onClick={() => revokeKyc(k.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'10px',cursor:'pointer',fontSize:'12px',fontWeight:600,color:'#7A7A6E'}}>
                                  <RotateCcw size={13} /> Révoquer
                                </button>
                              )}
                              {k.kyc_status === 'rejected' && (
                                <button onClick={() => approveKyc(k.id, kycDoc?.id)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'rgba(43,107,62,0.15)',border:'1px solid rgba(43,107,62,0.3)',borderRadius:'10px',cursor:'pointer',fontSize:'12px',fontWeight:600,color:'#2B6B3E'}}>
                                  <CheckCircle size={13} /> Réhabiliter
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

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
            {tab === 'transactions' && (() => {
              const totalVolume   = transactions.reduce((s,t) => s + (t.amount || 0), 0)
              const totalFees     = transactions.reduce((s,t) => s + (t.platform_fee || 0), 0)
              const totalArtisan  = transactions.reduce((s,t) => s + (t.artisan_amount || 0), 0)
              const released      = transactions.filter(t => t.status === 'released').length
              const escrow        = transactions.filter(t => t.status === 'escrow').length

              const STATUS_TX: Record<string, {label:string;color:string;bg:string}> = {
                pending:   { label: 'En attente',  color: '#C9A84C', bg: 'rgba(201,168,76,0.12)'  },
                escrow:    { label: 'Escrow',       color: '#3B82F6', bg: 'rgba(59,130,246,0.12)'  },
                released:  { label: 'Libéré',       color: '#2B6B3E', bg: 'rgba(43,107,62,0.12)'   },
                refunded:  { label: 'Remboursé',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
              }

              return (
                <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
                    <h2 style={{fontSize:'20px',fontWeight:700,color:'#FAFAF5',margin:0}}>
                      Transactions <span style={{fontSize:'14px',fontWeight:400,color:'#7A7A6E'}}>({transactions.length})</span>
                    </h2>
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'20px',background:'rgba(43,107,62,0.12)',color:'#2B6B3E',fontWeight:600}}>{released} libérées</span>
                      <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'20px',background:'rgba(59,130,246,0.12)',color:'#3B82F6',fontWeight:600}}>{escrow} en escrow</span>
                    </div>
                  </div>

                  {/* Stats rapides */}
                  {transactions.length > 0 && (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px'}}>
                      {[
                        { label:'Volume total',   value: totalVolume.toLocaleString()  + ' FCFA', color:'#FAFAF5' },
                        { label:'Commissions',    value: totalFees.toLocaleString()    + ' FCFA', color:'#C9A84C' },
                        { label:'Payé artisans',  value: totalArtisan.toLocaleString() + ' FCFA', color:'#2B6B3E' },
                      ].map(s => (
                        <div key={s.label} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'14px',padding:'16px'}}>
                          <div style={{fontSize:'20px',fontWeight:700,color:s.color,fontFamily:'Space Mono'}}>{s.value}</div>
                          <div style={{fontSize:'10px',color:'#7A7A6E',marginTop:'4px',textTransform:'uppercase',letterSpacing:'0.07em'}}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                    {transactions.map(t => {
                      const st = STATUS_TX[t.status] || STATUS_TX.pending
                      return (
                        <div key={t.id} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',padding:'16px 20px',display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap'}}>
                          <div style={{flex:1,minWidth:'180px'}}>
                            <div style={{fontSize:'14px',fontWeight:500,color:'#FAFAF5'}}>
                              {t.missions?.users?.name || 'Client'} · <span style={{color:'#7A7A6E',fontSize:'13px'}}>{t.missions?.category || '—'}</span>
                            </div>
                            <div style={{fontSize:'11px',color:'#7A7A6E',marginTop:'2px'}}>
                              {new Date(t.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
                              {' · '}{t.payment_method || 'Wave'}
                              {t.wave_transaction_id && <span style={{marginLeft:'6px',fontFamily:'Space Mono',fontSize:'10px',color:'rgba(122,122,110,0.6)'}}>{t.wave_transaction_id}</span>}
                            </div>
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontSize:'16px',fontWeight:700,color:'#FAFAF5',fontFamily:'Space Mono'}}>{(t.amount||0).toLocaleString()} F</div>
                            <div style={{fontSize:'11px',color:'#7A7A6E',marginTop:'1px'}}>
                              <span style={{color:'#2B6B3E'}}>{(t.artisan_amount||0).toLocaleString()} F artisan</span>
                              {t.platform_fee > 0 && <span style={{color:'#C9A84C',marginLeft:'6px'}}>+{(t.platform_fee||0).toLocaleString()} F commission</span>}
                            </div>
                          </div>
                          <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'20px',fontWeight:600,background:st.bg,color:st.color,flexShrink:0}}>{st.label}</span>
                        </div>
                      )
                    })}
                    {transactions.length === 0 && (
                      <div style={{textAlign:'center',padding:'64px 20px',color:'#7A7A6E'}}>
                        <p style={{fontSize:'36px',marginBottom:'12px'}}>💳</p>
                        <p style={{fontSize:'15px',color:'#FAFAF5',fontWeight:600,marginBottom:'8px'}}>Aucune transaction</p>
                        <p style={{fontSize:'13px',lineHeight:'1.6'}}>Les transactions apparaissent ici quand un client effectue un paiement Wave/Orange pour une mission.</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ===== UTILISATEURS ===== */}
            {tab === 'utilisateurs' && (() => {
              const ROLE_FILTERS: { id: 'all'|'client'|'artisan'|'admin'; label: string; color: string }[] = [
                { id: 'all',     label: `Tous (${users.length})`,                                                    color: '#FAFAF5' },
                { id: 'client',  label: `Clients (${users.filter(u=>u.role==='client').length})`,                    color: '#2B6B3E' },
                { id: 'artisan', label: `Artisans (${users.filter(u=>u.role==='artisan').length})`,                  color: '#E85D26' },
                { id: 'admin',   label: `Admins (${users.filter(u=>u.role==='admin').length})`,                      color: '#C9A84C' },
              ]

              const ROLE_STYLE: Record<string, {label:string;color:string;bg:string}> = {
                client:  { label: 'Client',  color: '#2B6B3E', bg: 'rgba(43,107,62,0.12)'   },
                artisan: { label: 'Artisan', color: '#E85D26', bg: 'rgba(232,93,38,0.12)'   },
                admin:   { label: 'Admin',   color: '#C9A84C', bg: 'rgba(201,168,76,0.12)'  },
              }

              const shown = usersFilter === 'all' ? users : users.filter(u => u.role === usersFilter)

              return (
                <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
                    <h2 style={{fontSize:'20px',fontWeight:700,color:'#FAFAF5',margin:0}}>Gestion des utilisateurs</h2>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                      {ROLE_FILTERS.map(f => (
                        <button key={f.id} onClick={() => setUsersFilter(f.id)} style={{
                          padding:'6px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'12px',fontWeight:600,
                          border: usersFilter === f.id ? `1.5px solid ${f.color}` : '1.5px solid rgba(255,255,255,0.08)',
                          background: usersFilter === f.id ? `${f.color}18` : 'transparent',
                          color: usersFilter === f.id ? f.color : '#7A7A6E',
                          transition:'all 0.15s',
                        }}>{f.label}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                    {shown.map(u => {
                      const rs = ROLE_STYLE[u.role] || ROLE_STYLE.client
                      const isAdmin   = u.role === 'admin'
                      const isArtisan = u.role === 'artisan'
                      const artisan   = u.artisan_pros?.[0]

                      return (
                        <div key={u.id} style={{
                          background:'rgba(255,255,255,0.04)',
                          border: isAdmin ? '1px solid rgba(201,168,76,0.25)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius:'14px',padding:'16px 20px',
                          display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap',
                        }}>
                          {/* Avatar */}
                          <div style={{width:'42px',height:'42px',borderRadius:'10px',overflow:'hidden',background:`${rs.color}18`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px'}}>
                            {u.avatar_url
                              ? <img src={u.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
                              : isAdmin ? '⭐' : isArtisan ? '🔧' : '👤'}
                          </div>

                          {/* Infos */}
                          <div style={{flex:1,minWidth:'200px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px',flexWrap:'wrap'}}>
                              <span style={{fontSize:'14px',fontWeight:600,color:'#FAFAF5'}}>{u.name}</span>
                              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',fontWeight:700,background:rs.bg,color:rs.color}}>
                                {rs.label}
                              </span>
                              {artisan && (
                                <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',background:'rgba(255,255,255,0.05)',color:'#7A7A6E'}}>
                                  {artisan.metier}
                                </span>
                              )}
                            </div>
                            <div style={{fontSize:'12px',color:'#7A7A6E'}}>
                              {u.email || u.phone || '—'}
                              <span style={{marginLeft:'8px',color:'rgba(122,122,110,0.6)'}}>
                                · Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>

                          {/* Actions de rôle */}
                          <div style={{display:'flex',gap:'6px',flexShrink:0,flexWrap:'wrap'}}>
                            {!isAdmin && (
                              <button
                                onClick={() => {
                                  if (confirm(`Promouvoir ${u.name} en Admin ? Il aura accès au panel admin.`)) setRole(u.id, 'admin')
                                }}
                                style={{display:'flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'10px',cursor:'pointer',fontSize:'12px',fontWeight:600,background:'rgba(201,168,76,0.12)',border:'1px solid rgba(201,168,76,0.3)',color:'#C9A84C'}}
                              >
                                <ShieldCheck size={13} /> Promouvoir Admin
                              </button>
                            )}
                            {isAdmin && u.id !== adminId && (
                              <button
                                onClick={() => {
                                  if (confirm(`Rétrograder ${u.name} ? Il perdra l'accès au panel admin.`)) setRole(u.id, 'client')
                                }}
                                style={{display:'flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'10px',cursor:'pointer',fontSize:'12px',fontWeight:600,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',color:'#ef4444'}}
                              >
                                <UserX size={13} /> Rétrograder
                              </button>
                            )}
                            {isAdmin && u.id === adminId && (
                              <span style={{fontSize:'11px',color:'rgba(201,168,76,0.5)',padding:'7px 14px',fontStyle:'italic'}}>Votre compte</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {shown.length === 0 && (
                      <p style={{textAlign:'center',color:'#7A7A6E',padding:'48px'}}>Aucun utilisateur</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </main>
    </div>
  )
}
