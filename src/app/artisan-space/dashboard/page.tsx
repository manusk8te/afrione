'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, Star, Clock, CheckCircle, Wallet, Camera, Calendar, AlertCircle } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TABS = [
  { id: 'missions', label: 'Missions', icon: Clock },
  { id: 'wallet', label: 'Portefeuille', icon: Wallet },
  { id: 'profile', label: 'Mon Profil', icon: Star },
  { id: 'planning', label: 'Planning', icon: Calendar },
]

export default function ArtisanDashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState('missions')
  const [user, setUser] = useState<any>(null)
  const [artisan, setArtisan] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [wallet, setWallet] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
        const { data: missionsData } = await supabase
          .from('missions')
          .select('*, users!missions_client_id_fkey(name, quartier)')
          .eq('artisan_id', artisanData.id)
          .order('created_at', { ascending: false })
        setMissions(missionsData || [])

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
  }, [])

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Artisan'

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div style={{background:'#0F1410',color:'#FAFAF5'}}>
        <div className="page-container" style={{padding:'16px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <Link href="/" style={{display:'flex',alignItems:'center',gap:'8px',textDecoration:'none'}}>
            <div style={{width:'28px',height:'28px',background:'#E85D26',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Zap size={14} color="white" />
            </div>
            <span className="font-display" style={{fontWeight:700,fontSize:'18px',color:'#FAFAF5'}}>AFRI<span style={{color:'#E85D26'}}>ONE</span></span>
          </Link>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <span style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#2B6B3E',background:'rgba(43,107,62,0.15)',padding:'4px 12px',borderRadius:'20px'}}>
              <span style={{width:'6px',height:'6px',background:'#2B6B3E',borderRadius:'50%',display:'inline-block'}} />
              Disponible
            </span>
            <div style={{width:'36px',height:'36px',background:'#EDE8DE',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#0F1410',fontWeight:700,fontSize:'14px'}}>
              {userName[0].toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="page-container" style={{padding:'32px',maxWidth:'896px'}}>
        <div className="card" style={{marginBottom:'24px',display:'flex',alignItems:'center',gap:'16px'}}>
          <div style={{width:'64px',height:'64px',background:'#EDE8DE',borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',flexShrink:0}}>🔧</div>
          <div style={{flex:1}}>
            <h1 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#0F1410'}}>{userName}</h1>
            <p style={{fontSize:'14px',color:'#7A7A6E'}}>{artisan?.metier || 'Artisan'} · {user?.user_metadata?.quartier || 'Abidjan'}</p>
            {artisan && (
              <div style={{display:'flex',alignItems:'center',gap:'16px',marginTop:'8px'}}>
                <span style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',color:'#0F1410'}}>
                  <Star size={14} color="#C9A84C" fill="#C9A84C" /> {artisan.rating_avg?.toFixed(1) || '0.0'}
                </span>
                <span style={{fontSize:'13px',color:'#7A7A6E'}}>{artisan.mission_count || 0} missions</span>
                <span style={{fontSize:'13px',color:'#2B6B3E',background:'rgba(43,107,62,0.1)',padding:'2px 8px',borderRadius:'20px'}}>✓ KYC Vérifié</span>
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

        <div style={{display:'flex',background:'white',border:'1px solid #D8D2C4',borderRadius:'12px',padding:'4px',marginBottom:'24px',gap:'4px'}}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1,padding:'10px',borderRadius:'8px',border:'none',cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',
              fontSize:'13px',fontWeight:500,transition:'all 0.2s',
              background: tab === t.id ? '#0F1410' : 'transparent',
              color: tab === t.id ? '#FAFAF5' : '#7A7A6E',
            }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

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
                    <div style={{fontSize:'13px',color:'#7A7A6E'}}>{m.category} · {m.users?.quartier || m.quartier}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,color:'#0F1410'}}>{m.total_price ? `${m.total_price.toLocaleString()} FCFA` : ''}</div>
                    <div style={{fontSize:'12px',color:'#7A7A6E'}}>{new Date(m.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
                {m.status === 'matching' && (
                  <div style={{display:'flex',gap:'12px'}}>
                    <button className="btn-primary" style={{flex:1,justifyContent:'center'}}>✓ Accepter</button>
                    <button className="btn-outline" style={{flex:1,justifyContent:'center'}}>✗ Refuser</button>
                  </div>
                )}
                {m.status === 'en_cours' && (
                  <button className="btn-primary" style={{width:'100%',justifyContent:'center'}}>Voir la mission en cours →</button>
                )}
                {m.status === 'completed' && (
                  <div style={{display:'flex',alignItems:'center',gap:'6px',color:'#2B6B3E',fontSize:'13px'}}>
                    <CheckCircle size={14} /> Mission terminée
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'wallet' && (
          <div className="card" style={{textAlign:'center',padding:'48px'}}>
            <div className="font-display" style={{fontSize:'48px',fontWeight:700,color:'#0F1410',marginBottom:'8px'}}>
              {(wallet?.balance_available || 0).toLocaleString()}
            </div>
            <div style={{color:'#7A7A6E',marginBottom:'32px',fontFamily:'Space Mono',fontSize:'14px'}}>FCFA disponible</div>
            <button className="btn-primary" style={{display:'inline-flex',alignItems:'center',gap:'8px'}}>
              Retirer vers Wave
            </button>
          </div>
        )}

        {tab === 'profile' && (
          <div className="card">
            <h2 className="font-display" style={{fontSize:'18px',fontWeight:700,color:'#0F1410',marginBottom:'24px'}}>Mon profil</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              {[
                { label: 'Nom', value: userName },
                { label: 'Email', value: user?.email },
                { label: 'Métier', value: artisan?.metier || '—' },
                { label: 'Expérience', value: artisan?.years_experience ? `${artisan.years_experience} ans` : '—' },
                { label: 'Tarif minimum', value: artisan?.tarif_min ? `${artisan.tarif_min.toLocaleString()} FCFA` : '—' },
                { label: 'Statut KYC', value: artisan?.kyc_status === 'approved' ? '✓ Approuvé' : 'En attente' },
              ].map(item => (
                <div key={item.label} style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid #EDE8DE'}}>
                  <span style={{color:'#7A7A6E',fontSize:'14px'}}>{item.label}</span>
                  <span style={{fontWeight:600,color:'#0F1410',fontSize:'14px'}}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'planning' && (
          <div className="card" style={{textAlign:'center',padding:'48px'}}>
            <p style={{fontSize:'48px',marginBottom:'16px'}}>📅</p>
            <h3 className="font-display" style={{fontSize:'20px',fontWeight:700,color:'#0F1410',marginBottom:'8px'}}>Planning</h3>
            <p style={{color:'#7A7A6E',fontSize:'14px'}}>Votre calendrier de disponibilités apparaîtra ici</p>
          </div>
        )}
      </div>
    </div>
  )
}
