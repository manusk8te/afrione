'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Zap, Star, Clock, CheckCircle, Wallet, Camera, Calendar,
  Edit3, Save, X, Plus, Trash2, MapPin, Briefcase, Upload,
  Image as ImageIcon, MessageCircle, Bell, Building2, Search, LogOut
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useIsMobile } from '@/hooks/useIsMobile'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

const TABS = [
  { id: 'missions',   label: 'Missions',    icon: Clock },
  { id: 'messages',   label: 'Messages',    icon: MessageCircle },
  { id: 'profile',    label: 'Mon Profil',  icon: Edit3 },
  { id: 'portfolio',  label: 'Portfolio',   icon: ImageIcon },
  { id: 'wallet',     label: 'Portefeuille',icon: Wallet },
  { id: 'materiaux',  label: 'Matériaux',   icon: Briefcase, href: '/artisan-space/materiaux' },
]

const QUARTIERS_ABJ = [
  'Cocody','Plateau','Marcory','Treichville','Adjamé','Abobo',
  'Yopougon','Koumassi','Port-Bouët','Attécoubé','Bingerville','Anyama'
]

export default function ArtisanDashboardPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('missions')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  usePushNotifications(currentUserId)
  const [user, setUser] = useState<any>(null)
  const [artisan, setArtisan] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [completedMissions, setCompletedMissions] = useState<any[]>([])
  const [wallet, setWallet] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const portfolioInputRef = useRef<HTMLInputElement>(null)

  // Champs éditables
  const [bio, setBio] = useState('')
  const [specialties, setSpecialties] = useState<string[]>([])
  const [newSpecialty, setNewSpecialty] = useState('')
  const [quartiers, setQuartiers] = useState<string[]>([])
  const [tariMin, setTarifMin] = useState(0)
  const [yearsExp, setYearsExp] = useState(0)
  const [certifications, setCertifications] = useState<string[]>([])
  const [newCertif, setNewCertif] = useState('')
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([])
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<string | null>(null)

  // Entreprise
  const [artisanEntreprise, setArtisanEntreprise] = useState<any>(null)
  const [pendingRequest, setPendingRequest] = useState<any>(null)
  const [entrepriseSearch, setEntrepriseSearch] = useState('')
  const [entrepriseResults, setEntrepriseResults] = useState<any[]>([])
  const [joiningEntreprise, setJoiningEntreprise] = useState(false)

  // Recalcule le nombre de messages non lus en temps réel
  const refreshUnread = async (artisanId: string, artisanUserId: string, missionIds: string[]) => {
    if (!missionIds.length) return
    const { count } = await supabase
      .from('chat_history')
      .select('*', { count: 'exact', head: true })
      .in('mission_id', missionIds)
      .is('read_at', null)
      .neq('sender_id', artisanUserId)
    setUnreadCount(count || 0)
  }

  useEffect(() => {
    let realtimeChannel: any = null

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setUser(session.user)
      setCurrentUserId(session.user.id)

      const { data: artisanData } = await supabase
        .from('artisan_pros')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (artisanData) {
        setArtisan(artisanData)

        if (artisanData.entreprise_id) {
          const { data: ent } = await supabase
            .from('entreprises')
            .select('id, name, banner_url, secteurs')
            .eq('id', artisanData.entreprise_id)
            .single()
          if (ent) setArtisanEntreprise(ent)
        } else {
          // Chercher une demande en attente
          const { data: req } = await supabase
            .from('entreprise_requests')
            .select('id, status, entreprises(id, name, secteurs)')
            .eq('artisan_id', artisanData.id)
            .eq('status', 'pending')
            .maybeSingle()
          if (req) setPendingRequest(req)
        }

        setBio(artisanData.bio || '')
        setSpecialties(artisanData.specialties || [])
        setQuartiers(artisanData.quartiers || [])
        setTarifMin(artisanData.tarif_min || 0)
        setYearsExp(artisanData.years_experience || 0)
        setCertifications(artisanData.certifications || [])
        setPortfolioUrls(artisanData.portfolio || [])

        const { data: allMissions } = await supabase
          .from('missions')
          .select('*, scheduled_at, users!missions_client_id_fkey(name, quartier), proof_of_work(photo_after_urls, artisan_notes), diagnostics(ai_summary, category_detected)')
          .eq('artisan_id', artisanData.id)
          .order('created_at', { ascending: false })
        setMissions(allMissions || [])
        setCompletedMissions((allMissions || []).filter((m: any) => m.status === 'completed'))

        // Charger conversations avec dernier message
        const activeMissions = (allMissions || []).filter((m: any) =>
          ['negotiation','en_cours','payment','matching','scheduled','en_route'].includes(m.status)
        )
        const convos = await Promise.all(activeMissions.map(async (m: any) => {
          const { data: lastMsg } = await supabase
            .from('chat_history')
            .select('text, created_at, sender_id, read_at')
            .eq('mission_id', m.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          return { ...m, lastMessage: lastMsg }
        }))
        setConversations(convos)

        const activeMissionIds = activeMissions.map((m: any) => m.id)

        // Compter messages non lus
        await refreshUnread(artisanData.id, artisanData.user_id, activeMissionIds)

        // Abonnement temps réel — nouvelles missions ET nouveaux messages
        realtimeChannel = supabase
          .channel(`artisan-realtime-${artisanData.id}`)
          // Nouvelles missions assignées à cet artisan
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'missions',
            filter: `artisan_id=eq.${artisanData.id}`,
          }, async (payload: any) => {
            const newM = payload.new
            setMissions(prev => [newM, ...prev])
            // Ajouter à conversations si statut actif
            if (['negotiation','en_cours','payment','matching'].includes(newM.status)) {
              setConversations(prev => [{ ...newM, lastMessage: null }, ...prev])
            }
            toast('🔔 Nouvelle mission reçue !', {
              style: { background: '#FFFFFF', color: '#3D4852', fontWeight: 600, boxShadow: NEU_SMALL },
              duration: 5000,
            })
          })
          // Nouveaux messages sur les missions actives
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'chat_history',
          }, async (payload: any) => {
            if (!activeMissionIds.includes(payload.new.mission_id)) return
            setConversations(prev => prev.map(c =>
              c.id === payload.new.mission_id ? { ...c, lastMessage: payload.new } : c
            ))
            if (payload.new.sender_id !== artisanData.user_id) {
              setUnreadCount(n => n + 1)
            }
          })
          .subscribe()

        const { data: walletData } = await supabase
          .from('wallets')
          .select('*')
          .eq('artisan_id', artisanData.id)
          .single()
        setWallet(walletData)
      }
      setLoading(false)
    }
    init()
    return () => { if (realtimeChannel) supabase.removeChannel(realtimeChannel) }
  }, [])

  // Upload avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
      setUser((u: any) => ({ ...u, user_metadata: { ...u.user_metadata, avatar_url: publicUrl } }))
      setSaveMsg('Photo mise à jour ✓')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err: any) {
      setSaveMsg('Erreur upload: ' + err.message)
    }
    setUploadingAvatar(false)
  }

  // Upload photo portfolio manuelle
  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !artisan) return
    setSaving(true)
    try {
      const newUrls: string[] = []
      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `portfolio/${artisan.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('portfolio')
          .upload(path, file, { upsert: false })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
        newUrls.push(publicUrl)
      }
      const updated = [...portfolioUrls, ...newUrls]
      await supabase.from('artisan_pros').update({ portfolio: updated }).eq('id', artisan.id)
      setPortfolioUrls(updated)
      setSaveMsg(`${newUrls.length} photo(s) ajoutée(s) ✓`)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err: any) {
      setSaveMsg('Erreur upload: ' + err.message)
    }
    setSaving(false)
  }

  // Supprimer photo portfolio (avec confirmation deux étapes)
  const removePortfolioPhoto = async (url: string) => {
    if (confirmDeletePhoto !== url) { setConfirmDeletePhoto(url); return }
    setConfirmDeletePhoto(null)
    const updated = portfolioUrls.filter(u => u !== url)
    await supabase.from('artisan_pros').update({ portfolio: updated }).eq('id', artisan.id)
    setPortfolioUrls(updated)
  }

  // ── Entreprise ─────────────────────────────────────────────────────────
  const searchEntreprises = async (q: string) => {
    setEntrepriseSearch(q)
    if (q.trim().length < 2) { setEntrepriseResults([]); return }
    const { data } = await supabase
      .from('entreprises')
      .select('id, name, secteurs, banner_url')
      .eq('kyc_status', 'approved')
      .ilike('name', `%${q.trim()}%`)
      .limit(5)
    setEntrepriseResults(data || [])
  }

  const requestJoinEntreprise = async (ent: any) => {
    if (!artisan) return
    setJoiningEntreprise(true)
    const { data, error } = await supabase
      .from('entreprise_requests')
      .insert({ artisan_id: artisan.id, entreprise_id: ent.id, status: 'pending' })
      .select('id, status, entreprises(id, name, secteurs)')
      .single()
    if (error) {
      toast.error('Erreur lors de la demande')
    } else {
      setPendingRequest(data)
      setEntrepriseSearch('')
      setEntrepriseResults([])
      toast.success(`Demande envoyée à ${ent.name} ✓`)
    }
    setJoiningEntreprise(false)
  }

  const cancelRequest = async () => {
    if (!pendingRequest) return
    await supabase.from('entreprise_requests').delete().eq('id', pendingRequest.id)
    setPendingRequest(null)
    toast('Demande annulée')
  }

  const leaveEntreprise = async () => {
    if (!artisan || !artisanEntreprise) return
    await supabase.from('artisan_pros').update({ entreprise_id: null }).eq('id', artisan.id)
    const name = artisanEntreprise.name
    setArtisanEntreprise(null)
    toast(`Vous avez quitté ${name}`)
  }

  // Sauvegarder le profil
  const saveProfile = async () => {
    if (!artisan) return
    setSaving(true)
    const { error } = await supabase
      .from('artisan_pros')
      .update({
        bio,
        specialties,
        quartiers,
        tarif_min: tariMin,
        years_experience: yearsExp,
        certifications,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artisan.id)
    setSaving(false)
    if (!error) {
      setSaveMsg('Profil sauvegardé ✓')
      setTimeout(() => setSaveMsg(''), 3000)
    } else {
      setSaveMsg('Erreur: ' + error.message)
    }
  }

  const toggleQuartier = (q: string) => {
    setQuartiers(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q])
  }

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Artisan'
  const avatarUrl = user?.user_metadata?.avatar_url

  // Toutes les photos de missions complétées (auto)
  const missionPhotos = completedMissions.flatMap((m: any) =>
    (m.proof_of_work?.[0]?.photo_after_urls || []).map((url: string) => ({
      url, category: m.category || m.diagnostics?.[0]?.category_detected || 'Intervention',
      date: m.completed_at, source: 'auto' as const,
    }))
  ).filter(p => p.url)

  // Photos manuelles du portfolio
  const manualPhotos = portfolioUrls.map(url => ({ url, category: 'Portfolio', date: null, source: 'manual' as const }))

  // Toutes les photos combinées
  const allPhotos = [...missionPhotos, ...manualPhotos]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#F5F7FA'}}>
      <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
    </div>
  )

  return (
    <div className="min-h-screen" style={{background:'#F5F7FA'}}>
      {/* Navbar */}
      <div style={{background:'#FFFFFF',borderBottom:'1px solid #E2E8F0',position:'sticky',top:0,zIndex:50,boxShadow:NEU_SMALL}}>
        <div className="page-container" style={{padding:isMobile?'12px 16px':'16px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <Link href="/" style={{display:'flex',alignItems:'center',gap:'8px',textDecoration:'none'}}>
            <div className="afrione-gradient" style={{width:'28px',height:'28px',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Zap size={14} color="white" />
            </div>
            <span className="font-display" style={{fontWeight:700,fontSize:'18px',color:'#3D4852'}}>AFRI<span className="afrione-gradient-text">ONE</span></span>
          </Link>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            {saveMsg && <span style={{fontSize:'12px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',padding:'4px 12px',borderRadius:'20px'}}>{saveMsg}</span>}
            <span style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',padding:'4px 12px',borderRadius:'20px'}}>
              <span style={{width:'6px',height:'6px',background:'#2B6B3E',borderRadius:'50%',display:'inline-block'}} />
              Disponible
            </span>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{width:'36px',height:'36px',borderRadius:'50%',overflow:'hidden',cursor:'pointer',border:'2px solid #E85D26',flexShrink:0,background:'#F5F7FA',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}
              title="Changer la photo"
            >
              {uploadingAvatar
                ? <div style={{width:'16px',height:'16px',border:'2px solid rgba(232,93,38,0.3)',borderTop:'2px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
                : avatarUrl
                  ? <img src={avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  : <span style={{fontWeight:700,fontSize:'14px',color:'#3D4852'}}>{userName[0].toUpperCase()}</span>
              }
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarUpload} />
          </div>
        </div>
      </div>

      {/* ── Hero orange ── */}
      <section className="afrione-gradient" style={{ position: 'relative', overflow: 'hidden', minHeight: '190px', display: 'flex', alignItems: 'center' }}>
        {/* Floating white squares */}
        <div style={{ position: 'absolute', top: '22%', left: '4%',  width: 50, height: 50, border: '2px solid rgba(255,255,255,0.2)',   borderRadius: 12, animation: 'floatSquare 5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '50%', right: '6%',  width: 30, height: 30, background: 'rgba(255,255,255,0.12)', borderRadius: 8,  animation: 'floatSquare 4s ease-in-out infinite 1s' }} />
        <div style={{ position: 'absolute', top: '28%', right: '20%', width: 18, height: 18, background: 'rgba(255,255,255,0.18)', borderRadius: 5,  animation: 'floatSquareSlow 6s ease-in-out infinite 2s' }} />
        <div style={{ position: 'absolute', bottom: '22%', left: '20%', width: 58, height: 58, border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 14, animation: 'floatSquareSlow 7s ease-in-out infinite 0.5s' }} />
        <div style={{ position: 'absolute', top: '42%', left: '42%',  width: 14, height: 14, background: 'rgba(255,255,255,0.2)',  borderRadius: 4,  animation: 'floatSquareDrift 5s ease-in-out infinite 3s' }} />
        <div className="page-container" style={{ position: 'relative', zIndex: 10, padding: '32px', maxWidth: '896px', width: '100%' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '20px', padding: '5px 14px', marginBottom: '14px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', letterSpacing: '0.12em', fontFamily: 'Tahoma' }}>ESPACE ARTISAN</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'white', margin: '0 0 8px' }}>Mon tableau de bord</h1>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '14px', margin: 0 }}>Missions, planning et statistiques</p>
        </div>
      </section>

      <div className="page-container" style={{padding:isMobile?'20px 16px 48px':'28px 32px 64px',maxWidth:'896px',position:'relative'}}>
        {/* Floating orange squares — decorative */}
        <div style={{ position: 'absolute', top: '6%',  right: '-18px', width: 54, height: 54, background: 'rgba(232,93,38,0.07)', borderRadius: 12, animation: 'floatSquare 5.5s ease-in-out infinite', transform: 'rotate(15deg)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '45%', left: '-18px',  width: 38, height: 38, border: '2px solid rgba(232,93,38,0.11)', borderRadius: 10, animation: 'floatSquareSlow 6s ease-in-out infinite 1.5s', transform: 'rotate(-8deg)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '12%', right: '1%', width: 22, height: 22, background: 'rgba(232,93,38,0.09)', borderRadius: 6, animation: 'floatSquareDrift 4.5s ease-in-out infinite 2.5s', pointerEvents: 'none' }} />
        {/* Header card */}
        <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px',marginBottom:'20px',display:'flex',alignItems:'center',gap:'14px',flexWrap:isMobile?'wrap':'nowrap'}}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{width:'72px',height:'72px',borderRadius:'16px',overflow:'hidden',cursor:'pointer',border:'2px dashed #E2E8F0',flexShrink:0,background:'#F5F7FA',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}
            title="Changer la photo"
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
              : <Camera size={24} style={{color:'#8B95A5'}} />
            }
            <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.2s'}}
              onMouseEnter={e => (e.currentTarget.style.opacity='1')}
              onMouseLeave={e => (e.currentTarget.style.opacity='0')}
            >
              <Camera size={20} color="white" />
            </div>
          </div>
          <div style={{flex:1}}>
            <h1 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#3D4852'}}>{userName}</h1>
            <p style={{fontSize:'14px',color:'#6B7280'}}>{artisan?.metier || 'Artisan'} · {user?.user_metadata?.quartier || 'Abidjan'}</p>
            {artisan && (
              <div style={{display:'flex',alignItems:'center',gap:'16px',marginTop:'8px'}}>
                <span style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',color:'#3D4852'}}>
                  <Star size={14} color="#C9A84C" fill="#C9A84C" /> {artisan.rating_avg?.toFixed(1) || '0.0'}
                  <span style={{color:'#6B7280',fontSize:'12px'}}>({artisan.rating_count || 0})</span>
                </span>
                <span style={{fontSize:'13px',color:'#6B7280'}}>{artisan.mission_count || completedMissions.length} missions</span>
                {artisan.kyc_status === 'approved' && (
                  <span style={{fontSize:'13px',color:'#2B6B3E',background:'rgba(43,107,62,0.1)',padding:'2px 8px',borderRadius:'20px'}}>✓ KYC Vérifié</span>
                )}
              </div>
            )}
          </div>
          <div style={{textAlign:isMobile?'left':'right',borderTop:isMobile?'1px solid #E2E8F0':'none',paddingTop:isMobile?'12px':'0',width:isMobile?'100%':'auto'}}>
            <div className="font-display afrione-gradient-text" style={{fontSize:'28px',fontWeight:700}}>
              {(wallet?.balance_available || 0).toLocaleString()}
            </div>
            <div style={{fontSize:'12px',color:'#6B7280'}}>FCFA disponible</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',background:'#FFFFFF',border:'1px solid #E2E8F0',borderRadius:'12px',padding:'4px',marginBottom:'20px',gap:'4px',overflowX:'auto',boxShadow:NEU_SMALL}}>
          {TABS.map(t => {
            const isActive = tab === t.id
            const sharedStyle: React.CSSProperties = {
              flexShrink:0,padding:isMobile?'10px 12px':'10px',borderRadius:'8px',border:'none',cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',
              fontSize:isMobile?'12px':'13px',fontWeight:500,transition:'all 0.2s',position:'relative',
              background: isActive ? '#FFFFFF' : 'transparent',
              boxShadow: isActive ? NEU_SMALL : 'none',
              color: isActive ? '#E85D26' : '#6B7280',
              textDecoration:'none',
            }
            const content = (
              <>
                <t.icon size={13} /> {isMobile ? t.label.split(' ')[0] : t.label}
                {t.id === 'messages' && unreadCount > 0 && (
                  <span className="afrione-gradient" style={{position:'absolute',top:'6px',right:'6px',width:'16px',height:'16px',borderRadius:'50%',fontSize:'10px',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </>
            )
            if ((t as any).href) {
              return <Link key={t.id} href={(t as any).href} style={sharedStyle}>{content}</Link>
            }
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={sharedStyle}>{content}</button>
            )
          })}
        </div>

        {/* ===== ONGLET MISSIONS ===== */}
        {tab === 'missions' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>

            {/* Agenda — interventions programmées */}
            {missions.filter(m => m.status === 'scheduled' && m.scheduled_at).length > 0 && (
              <div>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                  <Calendar size={15} color="#C9A84C" />
                  <span className="font-display" style={{fontSize:'15px',fontWeight:700,color:'#3D4852'}}>Prochaines interventions</span>
                </div>
                {missions.filter(m => m.status === 'scheduled' && m.scheduled_at).map(m => {
                  const d = new Date(m.scheduled_at)
                  const now = new Date()
                  const isToday = d.toDateString() === now.toDateString()
                  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString()
                  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000)
                  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  const dateLabel = isToday ? `Aujourd'hui à ${timeStr}`
                    : isTomorrow ? `Demain à ${timeStr}`
                    : `${d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} à ${timeStr}`
                  return (
                    <div key={m.id} style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'16px',display:'flex',alignItems:'center',gap:'14px',border:`2px solid ${isToday?'#E85D26':'rgba(201,168,76,0.4)'}`,marginBottom:'8px'}}>
                      <div style={{
                        width:'52px',height:'52px',flexShrink:0,borderRadius:'12px',
                        background: isToday ? 'rgba(232,93,38,0.08)' : 'rgba(201,168,76,0.08)',
                        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                      }}>
                        <span className={isToday ? 'afrione-gradient-text' : ''} style={{fontSize:'10px',fontWeight:700,color: isToday?undefined:'#C9A84C',textTransform:'uppercase'}}>
                          {d.toLocaleDateString('fr-FR',{month:'short'})}
                        </span>
                        <span style={{fontSize:'22px',fontWeight:800,color:'#3D4852',lineHeight:1}}>{d.getDate()}</span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:'14px',color:'#3D4852'}}>{m.users?.name || 'Client'}</div>
                        <div className={isToday ? 'afrione-gradient-text' : ''} style={{fontSize:'13px',fontWeight:600,color:isToday?undefined:'#C9A84C',marginTop:'2px'}}>{dateLabel}</div>
                        {!isToday && diffDays > 0 && <div style={{fontSize:'12px',color:'#6B7280'}}>Dans {diffDays} jour{diffDays>1?'s':''}</div>}
                      </div>
                      <Link href={`/suivi/${m.id}`} className="afrione-gradient" style={{
                        padding:'8px 14px',color:'white',borderRadius:'10px',
                        fontSize:'12px',fontWeight:700,textDecoration:'none',flexShrink:0,
                      }}>
                        🚗 Démarrer
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}

            {missions.length === 0 ? (
              <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'48px',textAlign:'center'}}>
                <p style={{fontSize:'48px',marginBottom:'16px'}}>📋</p>
                <h3 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#3D4852',marginBottom:'8px'}}>Aucune mission pour l'instant</h3>
                <p style={{color:'#6B7280',fontSize:'14px'}}>Les nouvelles missions apparaîtront ici</p>
              </div>
            ) : missions.map(m => (
              <div key={m.id} style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'16px'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'12px'}}>
                  <div>
                    <div style={{fontWeight:600,color:'#3D4852',fontSize:'15px'}}>{m.users?.name || 'Client'}</div>
                    <div style={{fontSize:'13px',color:'#6B7280'}}>{m.category || m.diagnostics?.[0]?.category_detected || '—'} · {m.users?.quartier || m.quartier || 'Abidjan'}</div>
                  </div>
                  <span className={m.status === 'en_cours' ? 'afrione-gradient-text' : ''} style={{
                    fontSize:'11px',padding:'3px 10px',borderRadius:'20px',fontWeight:600,
                    background: m.status === 'completed' ? 'rgba(43,107,62,0.1)' : m.status === 'en_cours' ? 'rgba(232,93,38,0.1)' : 'rgba(201,168,76,0.1)',
                    color: m.status === 'completed' ? '#2B6B3E' : m.status === 'en_cours' ? undefined : '#C9A84C',
                  }}>
                    {m.status === 'completed' ? '✓ Terminée' : m.status === 'en_cours' ? '⚡ En cours' : m.status === 'matching' ? '🔔 Nouvelle demande' : m.status === 'negotiation' ? '💬 En discussion' : m.status}
                  </span>
                </div>
                {m.status === 'matching' && (
                  <div style={{marginBottom:'8px',padding:'10px',background:'rgba(232,93,38,0.06)',borderRadius:'10px',border:'1px dashed rgba(232,93,38,0.3)'}}>
                    <p style={{fontSize:'13px',color:'#6B7280',margin:0}}>Nouveau client en attente — ouvrez le chat pour discuter et envoyer un devis.</p>
                  </div>
                )}
                {(m.status === 'negotiation' || m.status === 'matching') && (
                  <Link href={`/warroom/${m.id}`} className="btn-primary" style={{width:'100%',justifyContent:'center',display:'flex',gap:'6px'}}>
                    💬 Ouvrir le chat & proposer un devis →
                  </Link>
                )}
                {m.status === 'scheduled' && (
                  <div style={{display:'flex',gap:'8px'}}>
                    <Link href={`/warroom/${m.id}`} style={{
                      flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                      padding:'10px',background:'rgba(201,168,76,0.08)',border:'1px solid rgba(201,168,76,0.3)',
                      borderRadius:'10px',color:'#C9A84C',fontWeight:600,fontSize:'13px',textDecoration:'none',
                    }}>
                      💬 Chat
                    </Link>
                    <Link href={`/suivi/${m.id}`} className="afrione-gradient" style={{
                      flex:2,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                      padding:'10px',borderRadius:'10px',
                      color:'white',fontWeight:700,fontSize:'13px',textDecoration:'none',
                    }}>
                      🚗 Démarrer le suivi →
                    </Link>
                  </div>
                )}
                {m.status === 'en_route' && (
                  <Link href={`/suivi/${m.id}`} className="afrione-gradient" style={{
                    display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                    width:'100%',padding:'10px',borderRadius:'10px',
                    color:'white',fontWeight:700,fontSize:'13px',textDecoration:'none',
                  }}>
                    🚗 Voir le suivi en direct →
                  </Link>
                )}
                {m.status === 'en_cours' && (
                  <Link href={`/warroom/${m.id}`} style={{
                    display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
                    width:'100%',padding:'10px',background:'rgba(43,107,62,0.1)',
                    border:'1px solid rgba(43,107,62,0.3)',borderRadius:'10px',
                    color:'#2B6B3E',fontWeight:700,fontSize:'13px',textDecoration:'none',
                  }}>
                    ⚡ Mission en cours — marquer terminée →
                  </Link>
                )}
                {m.status === 'completed' && (
                  <div style={{display:'flex',alignItems:'center',gap:'6px',color:'#2B6B3E',fontSize:'13px'}}>
                    <CheckCircle size={14} /> Mission terminée · {m.completed_at ? new Date(m.completed_at).toLocaleDateString('fr-FR') : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ===== ONGLET MESSAGES ===== */}
        {tab === 'messages' && (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {conversations.length === 0 ? (
              <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'48px',textAlign:'center'}}>
                <MessageCircle size={40} style={{margin:'0 auto 16px',color:'#E2E8F0'}} />
                <h3 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#3D4852',marginBottom:'8px'}}>Aucune conversation</h3>
                <p style={{color:'#6B7280',fontSize:'14px'}}>Les messages de vos clients apparaîtront ici</p>
              </div>
            ) : conversations.map(c => {
              const hasUnread = c.lastMessage && !c.lastMessage.read_at && c.lastMessage.sender_id !== artisan?.user_id
              return (
                <Link key={c.id} href={`/warroom/${c.id}`} style={{textDecoration:'none'}}>
                  <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'16px',display:'flex',alignItems:'center',gap:'16px',cursor:'pointer',border: hasUnread ? '2px solid #E85D26' : '1px solid #E2E8F0',transition:'all 0.2s'}}>
                    <div style={{width:'48px',height:'48px',background:'rgba(232,93,38,0.1)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}>
                      💬
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px'}}>
                        <span style={{fontWeight:700,fontSize:'14px',color:'#3D4852'}}>{c.users?.name || 'Client'}</span>
                        <span style={{fontSize:'11px',color:'#6B7280',fontFamily:'Tahoma'}}>
                          {c.lastMessage ? new Date(c.lastMessage.created_at).toLocaleDateString('fr-FR') : ''}
                        </span>
                      </div>
                      <div style={{fontSize:'13px',color:'#6B7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {c.lastMessage?.text || 'Nouvelle mission — ' + (c.category || '')}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'6px'}}>
                        <span className="afrione-gradient-text" style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:'rgba(232,93,38,0.1)'}}>{c.status}</span>
                        <span style={{fontSize:'11px',color:'#6B7280'}}>{c.category || ''}</span>
                      </div>
                    </div>
                    {hasUnread && <div className="afrione-gradient" style={{width:'10px',height:'10px',borderRadius:'50%',flexShrink:0}} />}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {tab === 'profile' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>

            {/* Bio */}
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px'}}>
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#3D4852',marginBottom:'12px'}}>Description / Bio</h3>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Décrivez votre expertise, vos années d'expérience, votre façon de travailler..."
                rows={4}
                style={{width:'100%',padding:'12px',border:'1.5px solid #E2E8F0',borderRadius:'10px',fontSize:'14px',color:'#3D4852',resize:'vertical',fontFamily:'inherit',outline:'none',boxSizing:'border-box',background:'#FFFFFF'}}
              />
              <div style={{fontSize:'12px',color:'#6B7280',marginTop:'4px',textAlign:'right'}}>{bio.length}/500 caractères</div>
            </div>

            {/* Infos de base */}
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px'}}>
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#3D4852',marginBottom:'16px'}}>Informations</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#6B7280',display:'block',marginBottom:'6px'}}>Tarif minimum (FCFA)</label>
                  <input
                    type="number"
                    value={tariMin}
                    onChange={e => setTarifMin(Number(e.target.value))}
                    style={{width:'100%',padding:'10px 12px',border:'1.5px solid #E2E8F0',borderRadius:'10px',fontSize:'14px',color:'#3D4852',outline:'none',boxSizing:'border-box',background:'#FFFFFF'}}
                  />
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#6B7280',display:'block',marginBottom:'6px'}}>Années d'expérience</label>
                  <input
                    type="number"
                    value={yearsExp}
                    onChange={e => setYearsExp(Number(e.target.value))}
                    style={{width:'100%',padding:'10px 12px',border:'1.5px solid #E2E8F0',borderRadius:'10px',fontSize:'14px',color:'#3D4852',outline:'none',boxSizing:'border-box',background:'#FFFFFF'}}
                  />
                </div>
              </div>
            </div>

            {/* Spécialités */}
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px'}}>
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#3D4852',marginBottom:'12px'}}>Spécialités</h3>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
                {specialties.map(s => (
                  <span key={s} className="afrione-gradient-text" style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'6px 12px',background:'rgba(232,93,38,0.08)',border:'1px solid rgba(232,93,38,0.2)',borderRadius:'20px',fontSize:'13px'}}>
                    {s}
                    <button onClick={() => setSpecialties(prev => prev.filter(x => x !== s))} className="afrione-gradient-text" style={{background:'none',border:'none',cursor:'pointer',padding:0,display:'flex'}}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <input
                  value={newSpecialty}
                  onChange={e => setNewSpecialty(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newSpecialty.trim()) { setSpecialties(p => [...p, newSpecialty.trim()]); setNewSpecialty('') }}}
                  placeholder="Ajouter une spécialité..."
                  style={{flex:1,padding:'10px 12px',border:'1.5px solid #E2E8F0',borderRadius:'10px',fontSize:'14px',color:'#3D4852',outline:'none',background:'#FFFFFF'}}
                />
                <button
                  onClick={() => { if (newSpecialty.trim()) { setSpecialties(p => [...p, newSpecialty.trim()]); setNewSpecialty('') }}}
                  className="afrione-gradient"
                  style={{padding:'10px 16px',color:'white',border:'none',borderRadius:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',fontWeight:600}}
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            </div>

            {/* Zones d'intervention */}
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px'}}>
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#3D4852',marginBottom:'12px'}}>
                <MapPin size={16} className="afrione-gradient-text" style={{display:'inline',marginRight:'6px'}} />
                Zones d'intervention (Abidjan)
              </h3>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                {QUARTIERS_ABJ.map(q => (
                  <button key={q} onClick={() => toggleQuartier(q)} style={{
                    padding:'8px 16px',borderRadius:'20px',fontSize:'13px',fontWeight:500,cursor:'pointer',transition:'all 0.15s',border:'none',
                    background: quartiers.includes(q) ? '#E85D26' : '#F5F7FA',
                    boxShadow: quartiers.includes(q) ? 'none' : NEU_SMALL,
                    color: quartiers.includes(q) ? '#FFFFFF' : '#6B7280',
                  }}>{q}</button>
                ))}
              </div>
            </div>

            {/* Certifications */}
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px'}}>
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#3D4852',marginBottom:'12px'}}>Certifications & Diplômes</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'12px'}}>
                {certifications.map((c, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'rgba(43,107,62,0.05)',border:'1px solid rgba(43,107,62,0.2)',borderRadius:'10px'}}>
                    <span style={{fontSize:'14px',color:'#3D4852'}}>{c}</span>
                    <button onClick={() => setCertifications(prev => prev.filter((_, j) => j !== i))} style={{background:'none',border:'none',cursor:'pointer',color:'#6B7280',display:'flex'}}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <input
                  value={newCertif}
                  onChange={e => setNewCertif(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newCertif.trim()) { setCertifications(p => [...p, newCertif.trim()]); setNewCertif('') }}}
                  placeholder="Ex: CAP Plomberie, Habilitation électrique..."
                  style={{flex:1,padding:'10px 12px',border:'1.5px solid #E2E8F0',borderRadius:'10px',fontSize:'14px',color:'#3D4852',outline:'none',background:'#FFFFFF'}}
                />
                <button
                  onClick={() => { if (newCertif.trim()) { setCertifications(p => [...p, newCertif.trim()]); setNewCertif('') }}}
                  style={{padding:'10px 16px',background:'#2B6B3E',color:'white',border:'none',borderRadius:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',fontWeight:600}}
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            </div>

            {/* Mon entreprise */}
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px'}}>
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#3D4852',marginBottom:'4px',display:'flex',alignItems:'center',gap:'8px'}}>
                <Building2 size={16} color="#60a5fa" /> Mon entreprise
              </h3>
              <p style={{fontSize:'12px',color:'#6B7280',marginBottom:'16px'}}>Rattachez-vous à une structure pour apparaître dans son catalogue.</p>

              {/* État 1 — affilié */}
              {artisanEntreprise && (
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',padding:'12px 14px',background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:'12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0}}>
                    <div style={{width:'36px',height:'36px',background:'rgba(96,165,250,0.15)',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <Building2 size={16} color="#60a5fa" />
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:'14px',fontWeight:700,color:'#3D4852',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{artisanEntreprise.name}</div>
                      <div style={{fontSize:'11px',color:'#2B6B3E',fontWeight:600}}>✓ Membre actif</div>
                    </div>
                  </div>
                  <button onClick={leaveEntreprise} style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 12px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'8px',color:'#ef4444',fontSize:'12px',cursor:'pointer',flexShrink:0,fontWeight:600}}>
                    <LogOut size={12}/> Quitter
                  </button>
                </div>
              )}

              {/* État 2 — demande en attente */}
              {!artisanEntreprise && pendingRequest && (
                <div style={{padding:'12px 14px',background:'rgba(201,168,76,0.06)',border:'1px solid rgba(201,168,76,0.25)',borderRadius:'12px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0}}>
                      <div style={{width:'36px',height:'36px',background:'rgba(201,168,76,0.15)',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Building2 size={16} color="#C9A84C" />
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:'14px',fontWeight:700,color:'#3D4852',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(pendingRequest.entreprises as any)?.name}</div>
                        <div style={{fontSize:'11px',color:'#C9A84C',fontWeight:600}}>⏳ En attente de validation</div>
                      </div>
                    </div>
                    <button onClick={cancelRequest} style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 12px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'8px',color:'#ef4444',fontSize:'12px',cursor:'pointer',flexShrink:0,fontWeight:600}}>
                      <X size={12}/> Annuler
                    </button>
                  </div>
                  <p style={{fontSize:'11px',color:'#6B7280',marginTop:'8px',marginBottom:0}}>L'administrateur de l'entreprise doit valider votre demande.</p>
                </div>
              )}

              {/* État 3 — libre, recherche */}
              {!artisanEntreprise && !pendingRequest && (
                <div style={{position:'relative'}}>
                  <div style={{position:'relative'}}>
                    <Search size={14} style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'#6B7280'}} />
                    <input
                      value={entrepriseSearch}
                      onChange={e => searchEntreprises(e.target.value)}
                      placeholder="Rechercher une entreprise par nom…"
                      style={{width:'100%',padding:'11px 12px 11px 36px',border:'1.5px solid #E2E8F0',borderRadius:'10px',fontSize:'14px',color:'#3D4852',outline:'none',boxSizing:'border-box',background:'#FFFFFF'}}
                    />
                  </div>
                  {entrepriseResults.length > 0 && (
                    <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#FFFFFF',border:'1px solid #E2E8F0',borderRadius:'12px',overflow:'hidden',zIndex:20,boxShadow:'0 8px 24px rgba(163,177,198,0.35)'}}>
                      {entrepriseResults.map(e => (
                        <button key={e.id} onClick={() => requestJoinEntreprise(e)} disabled={joiningEntreprise}
                          style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'12px 14px',background:'none',border:'none',borderBottom:'1px solid #F5F7FA',cursor:'pointer',textAlign:'left'}}
                          onMouseEnter={el => (el.currentTarget.style.background='#F5F7FA')}
                          onMouseLeave={el => (el.currentTarget.style.background='none')}>
                          <div style={{width:'32px',height:'32px',background:'rgba(96,165,250,0.1)',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <Building2 size={14} color="#60a5fa" />
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:'13px',fontWeight:600,color:'#3D4852'}}>{e.name}</div>
                            <div style={{fontSize:'11px',color:'#6B7280'}}>{(e.secteurs||[]).slice(0,3).join(' · ')}</div>
                          </div>
                          <span style={{fontSize:'12px',color:'#60a5fa',fontWeight:600,flexShrink:0}}>Demander →</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {entrepriseSearch.length >= 2 && entrepriseResults.length === 0 && (
                    <p style={{fontSize:'12px',color:'#6B7280',marginTop:'8px'}}>Aucune entreprise trouvée. <Link href="/entreprise-space/register" className="afrione-gradient-text">Créer la vôtre →</Link></p>
                  )}
                </div>
              )}
            </div>

            {/* Bouton save */}
            <button
              onClick={saveProfile}
              disabled={saving}
              className={saving ? '' : 'afrione-gradient'}
              style={{padding:'14px',background: saving ? '#E2E8F0' : undefined,color: saving ? '#8B95A5' : 'white',border:'none',borderRadius:'12px',fontSize:'15px',fontWeight:700,cursor: saving ? 'not-allowed' : 'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}
            >
              {saving ? (
                <><div style={{width:'16px',height:'16px',border:'2px solid rgba(139,149,165,0.3)',borderTop:'2px solid #8B95A5',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Sauvegarde...</>
              ) : (
                <><Save size={16} /> Sauvegarder le profil</>
              )}
            </button>
          </div>
        )}

        {/* ===== ONGLET PORTFOLIO ===== */}
        {tab === 'portfolio' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'20px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                <div>
                  <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#3D4852'}}>Galerie de réalisations</h3>
                  <p style={{fontSize:'13px',color:'#6B7280',marginTop:'4px'}}>
                    {missionPhotos.length} photos automatiques (missions terminées) · {manualPhotos.length} ajoutées manuellement
                  </p>
                </div>
                <button
                  onClick={() => portfolioInputRef.current?.click()}
                  disabled={saving}
                  className="afrione-gradient"
                  style={{padding:'10px 16px',color:'white',border:'none',borderRadius:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',fontWeight:600,flexShrink:0}}
                >
                  <Upload size={14} /> Ajouter des photos
                </button>
                <input ref={portfolioInputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handlePortfolioUpload} />
              </div>

              {allPhotos.length === 0 ? (
                <div
                  onClick={() => portfolioInputRef.current?.click()}
                  style={{border:'2px dashed #E2E8F0',borderRadius:'16px',padding:'64px',textAlign:'center',cursor:'pointer',background:'#F5F7FA'}}
                >
                  <Camera size={40} style={{margin:'0 auto 16px',color:'#E2E8F0'}} />
                  <p style={{fontWeight:600,color:'#3D4852',fontSize:'15px',marginBottom:'8px'}}>Aucune photo pour l'instant</p>
                  <p style={{color:'#6B7280',fontSize:'13px'}}>Les photos de vos missions terminées apparaîtront ici automatiquement.<br/>Vous pouvez aussi en ajouter manuellement pour illustrer votre travail.</p>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                  {allPhotos.map((p, i) => (
                    <div key={i} style={{position:'relative',aspectRatio:'1',borderRadius:'12px',overflow:'hidden',background:'#F5F7FA',cursor:'pointer'}}
                    onClick={() => { if (confirmDeletePhoto === p.url) setConfirmDeletePhoto(null) }}>
                      <img src={p.url} alt={p.category} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                      {/* Confirmation overlay */}
                      {confirmDeletePhoto === p.url && p.source === 'manual' && (
                        <div style={{position:'absolute',inset:0,background:'rgba(239,68,68,0.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',padding:'12px'}}>
                          <span style={{color:'white',fontSize:'11px',fontWeight:700,textAlign:'center'}}>Supprimer cette photo ?</span>
                          <button onClick={e => { e.stopPropagation(); removePortfolioPhoto(p.url) }}
                            style={{padding:'6px 16px',background:'white',color:'#ef4444',border:'none',borderRadius:'8px',fontWeight:700,fontSize:'12px',cursor:'pointer'}}>
                            Confirmer
                          </button>
                          <button onClick={e => { e.stopPropagation(); setConfirmDeletePhoto(null) }}
                            style={{background:'none',border:'none',color:'rgba(255,255,255,0.8)',fontSize:'11px',cursor:'pointer'}}>
                            Annuler
                          </button>
                        </div>
                      )}
                      <div style={{position:'absolute',inset:0,background:'linear-gradient(transparent 40%,rgba(61,72,82,0.75))',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'8px',pointerEvents: confirmDeletePhoto === p.url ? 'none' : 'auto'}}>
                        {p.source === 'manual' && (
                          <button
                            onClick={e => { e.stopPropagation(); removePortfolioPhoto(p.url) }}
                            style={{alignSelf:'flex-end',width:'24px',height:'24px',background:'rgba(0,0,0,0.4)',border:'none',borderRadius:'50%',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'white'}}
                          >
                            <X size={12} />
                          </button>
                        )}
                        {p.source === 'auto' && (
                          <span style={{alignSelf:'flex-end',fontSize:'10px',color:'white',background:'rgba(43,107,62,0.85)',padding:'2px 8px',borderRadius:'4px',fontWeight:600}}>Mission</span>
                        )}
                        <div>
                          <div style={{fontSize:'11px',color:'#FFFFFF',fontWeight:600}}>{p.category}</div>
                          {p.date && <div style={{fontSize:'10px',color:'rgba(255,255,255,0.75)'}}>{new Date(p.date).toLocaleDateString('fr-FR')}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Zone d'ajout rapide */}
                  <div
                    onClick={() => portfolioInputRef.current?.click()}
                    style={{aspectRatio:'1',borderRadius:'12px',border:'2px dashed #E2E8F0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',cursor:'pointer',background:'#F5F7FA',transition:'all 0.2s'}}
                  >
                    <Plus size={24} style={{color:'#E2E8F0'}} />
                    <span style={{fontSize:'12px',color:'#6B7280'}}>Ajouter</span>
                  </div>
                </div>
              )}
            </div>

            {/* Info box */}
            <div style={{padding:'16px',background:'rgba(232,93,38,0.05)',border:'1px solid rgba(232,93,38,0.15)',borderRadius:'12px',fontSize:'13px',color:'#6B7280',lineHeight:'1.6'}}>
              💡 <strong style={{color:'#3D4852'}}>Comment fonctionne votre portfolio ?</strong><br/>
              Les photos "AVANT / APRÈS" que vous prenez à la fin de chaque mission sont automatiquement ajoutées ici.<br/>
              Vous pouvez aussi uploader des photos de missions passées pour enrichir votre profil dès aujourd'hui.
            </div>
          </div>
        )}

        {/* ===== ONGLET WALLET ===== */}
        {tab === 'wallet' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'32px',textAlign:'center'}}>
              <div style={{fontSize:'13px',color:'#6B7280',fontFamily:'Tahoma',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.1em'}}>Solde disponible</div>
              <div className="font-display" style={{fontSize:'52px',fontWeight:700,color:'#3D4852',marginBottom:'4px'}}>
                {(wallet?.balance_available || 0).toLocaleString()}
              </div>
              <div style={{color:'#6B7280',marginBottom:'24px',fontFamily:'Tahoma',fontSize:'14px'}}>FCFA</div>
              <button className="btn-primary" style={{display:'inline-flex',alignItems:'center',gap:'8px'}}>
                Retirer vers Wave
              </button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
              {[
                { label: 'En escrow', value: wallet?.balance_escrow || 0, color: '#C9A84C' },
                { label: 'Total gagné', value: wallet?.total_earned || 0, color: '#2B6B3E' },
                { label: 'Missions', value: completedMissions.length, color: 'gradient', suffix: '' },
              ].map(item => (
                <div key={item.label} style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',padding:'16px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',color:'#6B7280',marginBottom:'6px'}}>{item.label}</div>
                  <div className={`font-display${item.color === 'gradient' ? ' afrione-gradient-text' : ''}`} style={{fontSize:'20px',fontWeight:700,color:item.color === 'gradient' ? undefined : item.color}}>{item.value.toLocaleString()}</div>
                  {'suffix' in item ? null : <div style={{fontSize:'10px',color:'#6B7280'}}>FCFA</div>}
                </div>
              ))}
            </div>

            {/* Historique des transactions */}
            <div style={{background:'#FFFFFF',boxShadow:NEU_SHADOW,borderRadius:'20px',overflow:'hidden'}}>
              <div style={{padding:'16px 20px',borderBottom:'1px solid #E2E8F0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <h3 style={{fontWeight:700,fontSize:'15px',color:'#3D4852'}}>Historique</h3>
                <span style={{fontSize:'12px',color:'#6B7280'}}>{completedMissions.length} mission{completedMissions.length !== 1 ? 's' : ''}</span>
              </div>
              {completedMissions.length === 0 ? (
                <div style={{textAlign:'center',padding:'32px',color:'#6B7280',fontSize:'13px'}}>
                  Aucune mission terminée pour l'instant
                </div>
              ) : (
                <div>
                  {completedMissions.slice(0, 10).map((m: any, i: number) => (
                    <div key={m.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 20px',borderBottom: i < Math.min(completedMissions.length, 10) - 1 ? '1px solid #F5F7FA' : 'none'}}>
                      <div style={{width:'36px',height:'36px',background:'rgba(43,107,62,0.1)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'16px'}}>✅</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:'13px',color:'#3D4852'}}>{m.category || 'Intervention'}</div>
                        <div style={{fontSize:'11px',color:'#6B7280',marginTop:'2px'}}>
                          {m.completed_at ? new Date(m.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                      </div>
                      {m.total_price > 0 && (
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontWeight:700,fontSize:'14px',color:'#2B6B3E',fontFamily:'Tahoma'}}>+{m.total_price.toLocaleString()}</div>
                          <div style={{fontSize:'10px',color:'#6B7280'}}>FCFA</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
