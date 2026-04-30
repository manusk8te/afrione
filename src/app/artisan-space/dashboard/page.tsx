'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Zap, Star, Clock, CheckCircle, Wallet, Camera, Calendar,
  Edit3, Save, X, Plus, Trash2, MapPin, Briefcase, Upload,
  Image as ImageIcon, MessageCircle, Bell
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'missions', label: 'Missions', icon: Clock },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'profile', label: 'Mon Profil', icon: Edit3 },
  { id: 'portfolio', label: 'Portfolio', icon: ImageIcon },
  { id: 'wallet', label: 'Portefeuille', icon: Wallet },
]

const QUARTIERS_ABJ = [
  'Cocody','Plateau','Marcory','Treichville','Adjamé','Abobo',
  'Yopougon','Koumassi','Port-Bouët','Attécoubé','Bingerville','Anyama'
]

export default function ArtisanDashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState('missions')
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

      const { data: artisanData } = await supabase
        .from('artisan_pros')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (artisanData) {
        setArtisan(artisanData)
        setBio(artisanData.bio || '')
        setSpecialties(artisanData.specialties || [])
        setQuartiers(artisanData.quartiers || [])
        setTarifMin(artisanData.tarif_min || 0)
        setYearsExp(artisanData.years_experience || 0)
        setCertifications(artisanData.certifications || [])
        setPortfolioUrls(artisanData.portfolio || [])

        const { data: allMissions } = await supabase
          .from('missions')
          .select('*, users!missions_client_id_fkey(name, quartier), proof_of_work(photo_after_urls, artisan_notes), diagnostics(ai_summary, category_detected)')
          .eq('artisan_id', artisanData.id)
          .order('created_at', { ascending: false })
        setMissions(allMissions || [])
        setCompletedMissions((allMissions || []).filter((m: any) => m.status === 'completed'))

        // Charger conversations avec dernier message
        const activeMissions = (allMissions || []).filter((m: any) => 
          ['negotiation','en_cours','payment','matching'].includes(m.status)
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

        // Abonnement temps réel — nouveaux messages sur toutes les missions actives
        if (activeMissionIds.length) {
          realtimeChannel = supabase
            .channel(`artisan-msgs-${artisanData.id}`)
            .on('postgres_changes', {
              event: 'INSERT', schema: 'public', table: 'chat_history',
              filter: `mission_id=in.(${activeMissionIds.join(',')})`,
            }, async (payload: any) => {
              // Mettre à jour la conversation concernée
              setConversations(prev => prev.map(c =>
                c.id === payload.new.mission_id
                  ? { ...c, lastMessage: payload.new }
                  : c
              ))
              // Incrémenter le badge si c'est pas nous qui avons envoyé
              if (payload.new.sender_id !== artisanData.user_id) {
                setUnreadCount(n => n + 1)
              }
            })
            .subscribe()
        }

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

  // Supprimer photo portfolio
  const removePortfolioPhoto = async (url: string) => {
    const updated = portfolioUrls.filter(u => u !== url)
    await supabase.from('artisan_pros').update({ portfolio: updated }).eq('id', artisan.id)
    setPortfolioUrls(updated)
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
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
    </div>
  )

  return (
    <div className="min-h-screen bg-bg">
      {/* Navbar */}
      <div style={{background:'#0F1410',color:'#FAFAF5',position:'sticky',top:0,zIndex:50}}>
        <div className="page-container" style={{padding:'16px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <Link href="/" style={{display:'flex',alignItems:'center',gap:'8px',textDecoration:'none'}}>
            <div style={{width:'28px',height:'28px',background:'#E85D26',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Zap size={14} color="white" />
            </div>
            <span className="font-display" style={{fontWeight:700,fontSize:'18px',color:'#FAFAF5'}}>AFRI<span style={{color:'#E85D26'}}>ONE</span></span>
          </Link>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            {saveMsg && <span style={{fontSize:'12px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',padding:'4px 12px',borderRadius:'20px'}}>{saveMsg}</span>}
            <span style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',padding:'4px 12px',borderRadius:'20px'}}>
              <span style={{width:'6px',height:'6px',background:'#2B6B3E',borderRadius:'50%',display:'inline-block'}} />
              Disponible
            </span>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{width:'36px',height:'36px',borderRadius:'50%',overflow:'hidden',cursor:'pointer',border:'2px solid #E85D26',flexShrink:0,background:'#EDE8DE',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}
              title="Changer la photo"
            >
              {uploadingAvatar
                ? <div style={{width:'16px',height:'16px',border:'2px solid rgba(232,93,38,0.3)',borderTop:'2px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
                : avatarUrl
                  ? <img src={avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  : <span style={{fontWeight:700,fontSize:'14px',color:'#0F1410'}}>{userName[0].toUpperCase()}</span>
              }
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarUpload} />
          </div>
        </div>
      </div>

      <div className="page-container" style={{padding:'32px',maxWidth:'896px'}}>
        {/* Header card */}
        <div className="card" style={{marginBottom:'24px',display:'flex',alignItems:'center',gap:'16px'}}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{width:'72px',height:'72px',borderRadius:'16px',overflow:'hidden',cursor:'pointer',border:'2px dashed #D8D2C4',flexShrink:0,background:'#F5F3EE',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}
            title="Changer la photo"
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
              : <Camera size={24} style={{color:'#7A7A6E'}} />
            }
            <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.2s'}}
              onMouseEnter={e => (e.currentTarget.style.opacity='1')}
              onMouseLeave={e => (e.currentTarget.style.opacity='0')}
            >
              <Camera size={20} color="white" />
            </div>
          </div>
          <div style={{flex:1}}>
            <h1 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#0F1410'}}>{userName}</h1>
            <p style={{fontSize:'14px',color:'#7A7A6E'}}>{artisan?.metier || 'Artisan'} · {user?.user_metadata?.quartier || 'Abidjan'}</p>
            {artisan && (
              <div style={{display:'flex',alignItems:'center',gap:'16px',marginTop:'8px'}}>
                <span style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',color:'#0F1410'}}>
                  <Star size={14} color="#C9A84C" fill="#C9A84C" /> {artisan.rating_avg?.toFixed(1) || '0.0'}
                  <span style={{color:'#7A7A6E',fontSize:'12px'}}>({artisan.rating_count || 0})</span>
                </span>
                <span style={{fontSize:'13px',color:'#7A7A6E'}}>{artisan.mission_count || completedMissions.length} missions</span>
                {artisan.kyc_status === 'approved' && (
                  <span style={{fontSize:'13px',color:'#2B6B3E',background:'rgba(43,107,62,0.1)',padding:'2px 8px',borderRadius:'20px'}}>✓ KYC Vérifié</span>
                )}
              </div>
            )}
          </div>
          <div style={{textAlign:'right'}}>
            <div className="font-display" style={{fontSize:'28px',fontWeight:700,color:'#E85D26'}}>
              {(wallet?.balance_available || 0).toLocaleString()}
            </div>
            <div style={{fontSize:'12px',color:'#7A7A6E'}}>FCFA disponible</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',background:'white',border:'1px solid #D8D2C4',borderRadius:'12px',padding:'4px',marginBottom:'24px',gap:'4px'}}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1,padding:'10px',borderRadius:'8px',border:'none',cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
              fontSize:'13px',fontWeight:500,transition:'all 0.2s',position:'relative',
              background: tab === t.id ? '#0F1410' : 'transparent',
              color: tab === t.id ? '#FAFAF5' : '#7A7A6E',
            }}>
              <t.icon size={14} /> {t.label}
              {t.id === 'messages' && unreadCount > 0 && (
                <span style={{position:'absolute',top:'6px',right:'6px',width:'16px',height:'16px',background:'#E85D26',borderRadius:'50%',fontSize:'10px',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== ONGLET MISSIONS ===== */}
        {tab === 'missions' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {missions.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'48px'}}>
                <p style={{fontSize:'48px',marginBottom:'16px'}}>📋</p>
                <h3 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#0F1410',marginBottom:'8px'}}>Aucune mission pour l'instant</h3>
                <p style={{color:'#7A7A6E',fontSize:'14px'}}>Les nouvelles missions apparaîtront ici</p>
              </div>
            ) : missions.map(m => (
              <div key={m.id} className="card">
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'12px'}}>
                  <div>
                    <div style={{fontWeight:600,color:'#0F1410',fontSize:'15px'}}>{m.users?.name || 'Client'}</div>
                    <div style={{fontSize:'13px',color:'#7A7A6E'}}>{m.category || m.diagnostics?.[0]?.category_detected || '—'} · {m.users?.quartier || m.quartier || 'Abidjan'}</div>
                  </div>
                  <span style={{
                    fontSize:'11px',padding:'3px 10px',borderRadius:'20px',fontWeight:500,
                    background: m.status === 'completed' ? 'rgba(43,107,62,0.1)' : m.status === 'en_cours' ? 'rgba(232,93,38,0.1)' : 'rgba(201,168,76,0.1)',
                    color: m.status === 'completed' ? '#2B6B3E' : m.status === 'en_cours' ? '#E85D26' : '#C9A84C',
                  }}>
                    {m.status === 'completed' ? '✓ Terminée' : m.status === 'en_cours' ? '⚡ En cours' : m.status === 'matching' ? '🔔 Nouvelle' : m.status}
                  </span>
                </div>
                {m.status === 'matching' && (
                  <div style={{display:'flex',gap:'12px'}}>
                    <button className="btn-primary" style={{flex:1,justifyContent:'center'}}>✓ Accepter</button>
                    <button className="btn-outline" style={{flex:1,justifyContent:'center'}}>✗ Refuser</button>
                  </div>
                )}
                {m.status === 'en_cours' && (
                  <Link href={`/warroom/${m.id}`} className="btn-primary" style={{width:'100%',justifyContent:'center',display:'flex'}}>Voir la mission en cours →</Link>
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

        {/* ===== ONGLET PROFIL ===== */}
        {tab === 'messages' && (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {conversations.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'48px'}}>
                <MessageCircle size={40} style={{margin:'0 auto 16px',color:'#D8D2C4'}} />
                <h3 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#0F1410',marginBottom:'8px'}}>Aucune conversation</h3>
                <p style={{color:'#7A7A6E',fontSize:'14px'}}>Les messages de vos clients apparaîtront ici</p>
              </div>
            ) : conversations.map(c => {
              const hasUnread = c.lastMessage && !c.lastMessage.read_at && c.lastMessage.sender_id !== artisan?.user_id
              return (
                <Link key={c.id} href={`/warroom/${c.id}`} style={{textDecoration:'none'}}>
                  <div className="card" style={{display:'flex',alignItems:'center',gap:'16px',cursor:'pointer',border: hasUnread ? '2px solid #E85D26' : '1px solid #D8D2C4',transition:'all 0.2s'}}>
                    <div style={{width:'48px',height:'48px',background:'rgba(232,93,38,0.1)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}>
                      💬
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px'}}>
                        <span style={{fontWeight:700,fontSize:'14px',color:'#0F1410'}}>{c.users?.name || 'Client'}</span>
                        <span style={{fontSize:'11px',color:'#7A7A6E',fontFamily:'Space Mono'}}>
                          {c.lastMessage ? new Date(c.lastMessage.created_at).toLocaleDateString('fr-FR') : ''}
                        </span>
                      </div>
                      <div style={{fontSize:'13px',color:'#7A7A6E',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {c.lastMessage?.text || 'Nouvelle mission — ' + (c.category || '')}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'6px'}}>
                        <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:'rgba(232,93,38,0.1)',color:'#E85D26'}}>{c.status}</span>
                        <span style={{fontSize:'11px',color:'#7A7A6E'}}>{c.category || ''}</span>
                      </div>
                    </div>
                    {hasUnread && <div style={{width:'10px',height:'10px',background:'#E85D26',borderRadius:'50%',flexShrink:0}} />}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {tab === 'profile' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>

            {/* Bio */}
            <div className="card">
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#0F1410',marginBottom:'12px'}}>Description / Bio</h3>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Décrivez votre expertise, vos années d'expérience, votre façon de travailler..."
                rows={4}
                style={{width:'100%',padding:'12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'14px',color:'#0F1410',resize:'vertical',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
              />
              <div style={{fontSize:'12px',color:'#7A7A6E',marginTop:'4px',textAlign:'right'}}>{bio.length}/500 caractères</div>
            </div>

            {/* Infos de base */}
            <div className="card">
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#0F1410',marginBottom:'16px'}}>Informations</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                <div>
                  <label style={{fontSize:'13px',color:'#7A7A6E',display:'block',marginBottom:'6px'}}>Tarif minimum (FCFA)</label>
                  <input
                    type="number"
                    value={tariMin}
                    onChange={e => setTarifMin(Number(e.target.value))}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'14px',color:'#0F1410',outline:'none',boxSizing:'border-box'}}
                  />
                </div>
                <div>
                  <label style={{fontSize:'13px',color:'#7A7A6E',display:'block',marginBottom:'6px'}}>Années d'expérience</label>
                  <input
                    type="number"
                    value={yearsExp}
                    onChange={e => setYearsExp(Number(e.target.value))}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'14px',color:'#0F1410',outline:'none',boxSizing:'border-box'}}
                  />
                </div>
              </div>
            </div>

            {/* Spécialités */}
            <div className="card">
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#0F1410',marginBottom:'12px'}}>Spécialités</h3>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
                {specialties.map(s => (
                  <span key={s} style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'6px 12px',background:'rgba(232,93,38,0.08)',border:'1px solid rgba(232,93,38,0.2)',borderRadius:'20px',fontSize:'13px',color:'#E85D26'}}>
                    {s}
                    <button onClick={() => setSpecialties(prev => prev.filter(x => x !== s))} style={{background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',color:'#E85D26'}}>
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
                  style={{flex:1,padding:'10px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'14px',color:'#0F1410',outline:'none'}}
                />
                <button
                  onClick={() => { if (newSpecialty.trim()) { setSpecialties(p => [...p, newSpecialty.trim()]); setNewSpecialty('') }}}
                  style={{padding:'10px 16px',background:'#E85D26',color:'white',border:'none',borderRadius:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',fontWeight:600}}
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            </div>

            {/* Zones d'intervention */}
            <div className="card">
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#0F1410',marginBottom:'12px'}}>
                <MapPin size={16} style={{display:'inline',marginRight:'6px',color:'#E85D26'}} />
                Zones d'intervention (Abidjan)
              </h3>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                {QUARTIERS_ABJ.map(q => (
                  <button key={q} onClick={() => toggleQuartier(q)} style={{
                    padding:'8px 16px',borderRadius:'20px',fontSize:'13px',fontWeight:500,cursor:'pointer',transition:'all 0.15s',border:'none',
                    background: quartiers.includes(q) ? '#0F1410' : '#F5F3EE',
                    color: quartiers.includes(q) ? '#FAFAF5' : '#7A7A6E',
                  }}>{q}</button>
                ))}
              </div>
            </div>

            {/* Certifications */}
            <div className="card">
              <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#0F1410',marginBottom:'12px'}}>Certifications & Diplômes</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'12px'}}>
                {certifications.map((c, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'rgba(43,107,62,0.05)',border:'1px solid rgba(43,107,62,0.2)',borderRadius:'10px'}}>
                    <span style={{fontSize:'14px',color:'#0F1410'}}>{c}</span>
                    <button onClick={() => setCertifications(prev => prev.filter((_, j) => j !== i))} style={{background:'none',border:'none',cursor:'pointer',color:'#7A7A6E',display:'flex'}}>
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
                  style={{flex:1,padding:'10px 12px',border:'1px solid #D8D2C4',borderRadius:'10px',fontSize:'14px',color:'#0F1410',outline:'none'}}
                />
                <button
                  onClick={() => { if (newCertif.trim()) { setCertifications(p => [...p, newCertif.trim()]); setNewCertif('') }}}
                  style={{padding:'10px 16px',background:'#2B6B3E',color:'white',border:'none',borderRadius:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',fontWeight:600}}
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            </div>

            {/* Bouton save */}
            <button
              onClick={saveProfile}
              disabled={saving}
              style={{padding:'14px',background: saving ? '#D8D2C4' : '#E85D26',color:'white',border:'none',borderRadius:'12px',fontSize:'15px',fontWeight:700,cursor: saving ? 'not-allowed' : 'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}
            >
              {saving ? (
                <><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Sauvegarde...</>
              ) : (
                <><Save size={16} /> Sauvegarder le profil</>
              )}
            </button>
          </div>
        )}

        {/* ===== ONGLET PORTFOLIO ===== */}
        {tab === 'portfolio' && (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
            <div className="card">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                <div>
                  <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#0F1410'}}>Galerie de réalisations</h3>
                  <p style={{fontSize:'13px',color:'#7A7A6E',marginTop:'4px'}}>
                    {missionPhotos.length} photos automatiques (missions terminées) · {manualPhotos.length} ajoutées manuellement
                  </p>
                </div>
                <button
                  onClick={() => portfolioInputRef.current?.click()}
                  disabled={saving}
                  style={{padding:'10px 16px',background:'#E85D26',color:'white',border:'none',borderRadius:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',fontWeight:600,flexShrink:0}}
                >
                  <Upload size={14} /> Ajouter des photos
                </button>
                <input ref={portfolioInputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handlePortfolioUpload} />
              </div>

              {allPhotos.length === 0 ? (
                <div
                  onClick={() => portfolioInputRef.current?.click()}
                  style={{border:'2px dashed #D8D2C4',borderRadius:'16px',padding:'64px',textAlign:'center',cursor:'pointer',background:'#F5F3EE'}}
                >
                  <Camera size={40} style={{margin:'0 auto 16px',color:'#D8D2C4'}} />
                  <p style={{fontWeight:600,color:'#0F1410',fontSize:'15px',marginBottom:'8px'}}>Aucune photo pour l'instant</p>
                  <p style={{color:'#7A7A6E',fontSize:'13px'}}>Les photos de vos missions terminées apparaîtront ici automatiquement.<br/>Vous pouvez aussi en ajouter manuellement pour illustrer votre travail.</p>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                  {allPhotos.map((p, i) => (
                    <div key={i} style={{position:'relative',aspectRatio:'1',borderRadius:'12px',overflow:'hidden',background:'#EDE8DE',cursor:'pointer'}}>
                      <img src={p.url} alt={p.category} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                      <div style={{position:'absolute',inset:0,background:'linear-gradient(transparent 40%,rgba(15,20,16,0.85))',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'8px'}}>
                        {p.source === 'manual' && (
                          <button
                            onClick={() => removePortfolioPhoto(p.url)}
                            style={{alignSelf:'flex-end',width:'24px',height:'24px',background:'rgba(0,0,0,0.6)',border:'none',borderRadius:'50%',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'white'}}
                          >
                            <X size={12} />
                          </button>
                        )}
                        {p.source === 'auto' && (
                          <span style={{alignSelf:'flex-end',fontSize:'9px',color:'rgba(255,255,255,0.6)',background:'rgba(43,107,62,0.6)',padding:'2px 6px',borderRadius:'4px'}}>AUTO</span>
                        )}
                        <div>
                          <div style={{fontSize:'11px',color:'#FAFAF5',fontWeight:600}}>{p.category}</div>
                          {p.date && <div style={{fontSize:'10px',color:'rgba(255,255,255,0.6)'}}>{new Date(p.date).toLocaleDateString('fr-FR')}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Zone d'ajout rapide */}
                  <div
                    onClick={() => portfolioInputRef.current?.click()}
                    style={{aspectRatio:'1',borderRadius:'12px',border:'2px dashed #D8D2C4',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',cursor:'pointer',background:'#F5F3EE',transition:'all 0.2s'}}
                  >
                    <Plus size={24} style={{color:'#D8D2C4'}} />
                    <span style={{fontSize:'12px',color:'#7A7A6E'}}>Ajouter</span>
                  </div>
                </div>
              )}
            </div>

            {/* Info box */}
            <div style={{padding:'16px',background:'rgba(232,93,38,0.05)',border:'1px solid rgba(232,93,38,0.15)',borderRadius:'12px',fontSize:'13px',color:'#7A7A6E',lineHeight:'1.6'}}>
              💡 <strong style={{color:'#0F1410'}}>Comment fonctionne votre portfolio ?</strong><br/>
              Les photos "AVANT / APRÈS" que vous prenez à la fin de chaque mission sont automatiquement ajoutées ici.<br/>
              Vous pouvez aussi uploader des photos de missions passées pour enrichir votre profil dès aujourd'hui.
            </div>
          </div>
        )}

        {/* ===== ONGLET WALLET ===== */}
        {tab === 'wallet' && (
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            <div className="card" style={{textAlign:'center',padding:'40px'}}>
              <div style={{fontSize:'13px',color:'#7A7A6E',fontFamily:'Space Mono',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.1em'}}>Solde disponible</div>
              <div className="font-display" style={{fontSize:'52px',fontWeight:700,color:'#0F1410',marginBottom:'4px'}}>
                {(wallet?.balance_available || 0).toLocaleString()}
              </div>
              <div style={{color:'#7A7A6E',marginBottom:'32px',fontFamily:'Space Mono',fontSize:'14px'}}>FCFA</div>
              <button className="btn-primary" style={{display:'inline-flex',alignItems:'center',gap:'8px'}}>
                Retirer vers Wave
              </button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
              {[
                { label: 'En escrow', value: wallet?.balance_escrow || 0 },
                { label: 'Total gagné', value: wallet?.total_earned || 0 },
              ].map(item => (
                <div key={item.label} className="card" style={{textAlign:'center'}}>
                  <div style={{fontSize:'12px',color:'#7A7A6E',marginBottom:'4px'}}>{item.label}</div>
                  <div className="font-display" style={{fontSize:'24px',fontWeight:700,color:'#0F1410'}}>{item.value.toLocaleString()}</div>
                  <div style={{fontSize:'11px',color:'#7A7A6E'}}>FCFA</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
