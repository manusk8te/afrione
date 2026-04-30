'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { Search, Star, CheckCircle, MapPin, Clock, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const METIERS = ['Tous', 'Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie', 'Climatisation', 'Serrurerie', 'Carrelage']
const METIER_ICONS: Record<string, string> = {
  'Plomberie': '🔧', 'Électricité': '⚡', 'Peinture': '🎨',
  'Maçonnerie': '🏗️', 'Menuiserie': '🪵', 'Climatisation': '❄️',
  'Serrurerie': '🔑', 'Carrelage': '🪟',
}

export default function ArtisansPage() {
  const [artisans, setArtisans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [metier, setMetier] = useState('Tous')

  useEffect(() => {
    const fetchArtisans = async () => {
      const { data, error } = await supabase
        .from('artisan_pros')
        .select(`*, users(name, quartier, email)`)
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
      <div style={{paddingTop:'96px',paddingBottom:'64px',padding:'96px 16px 64px'}}>
        <div className="page-container">
          <div style={{marginBottom:'32px'}}>
            <span className="section-label">ANNUAIRE</span>
            <h1 className="font-display" style={{fontSize:'36px',fontWeight:700,color:'#0F1410',marginTop:'8px'}}>
              Trouver un artisan
            </h1>
            <p style={{color:'#7A7A6E',marginTop:'8px'}}>
              {loading ? 'Chargement...' : `${filtered.length} professionnel${filtered.length > 1 ? 's' : ''} vérifié${filtered.length > 1 ? 's' : ''} à Abidjan`}
            </p>
          </div>

          {/* Search */}
          <div style={{background:'white',border:'1px solid #D8D2C4',borderRadius:'16px',padding:'16px',marginBottom:'24px'}}>
            <div style={{position:'relative',marginBottom:'12px'}}>
              <Search size={18} style={{position:'absolute',left:'16px',top:'50%',transform:'translateY(-50%)',color:'#7A7A6E'}} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom..." className="input" style={{paddingLeft:'48px'}} />
            </div>
          </div>

          {/* Metier tabs */}
          <div style={{display:'flex',gap:'8px',overflowX:'auto',paddingBottom:'8px',marginBottom:'24px'}}>
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
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'20px'}}>
              {filtered.map(a => (
                <Link key={a.id} href={`/artisans/${a.id}`} style={{textDecoration:'none'}}>
                  <div className="card" style={{cursor:'pointer',transition:'all 0.2s',height:'100%'}}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 8px 24px rgba(0,0,0,0.1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow='0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'16px'}}>
                      <div style={{width:'48px',height:'48px',background:'#EDE8DE',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px'}}>
                        {METIER_ICONS[a.metier] || '🔧'}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'4px'}}>
                        <span className="badge-green">✓ Vérifié</span>
                        <span style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'12px',color:'#2B6B3E'}}>
                          <span style={{width:'6px',height:'6px',background:'#2B6B3E',borderRadius:'50%',display:'inline-block'}} />
                          Disponible
                        </span>
                      </div>
                    </div>

                    <h3 className="font-display" style={{fontSize:'16px',fontWeight:700,color:'#0F1410',marginBottom:'4px'}}>
                      {a.users?.name}
                    </h3>
                    <div style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'13px',color:'#7A7A6E',marginBottom:'16px'}}>
                      <MapPin size={12} /> {a.metier} · {a.users?.quartier}
                    </div>

                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'16px'}}>
                      {[
                        { value: a.rating_avg?.toFixed(1), label: 'Note' },
                        { value: a.mission_count, label: 'Missions' },
                        { value: `${a.years_experience}ans`, label: 'Exp.' },
                      ].map(s => (
                        <div key={s.label} style={{background:'#F5F0E8',borderRadius:'8px',padding:'8px',textAlign:'center'}}>
                          <div style={{fontWeight:700,fontSize:'14px',color:'#0F1410'}}>{s.value}</div>
                          <div style={{fontSize:'11px',color:'#7A7A6E'}}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'16px',borderTop:'1px solid #D8D2C4'}}>
                      <div>
                        <span style={{fontWeight:700,color:'#0F1410'}}>{a.tarif_min?.toLocaleString()}</span>
                        <span style={{fontSize:'12px',color:'#7A7A6E'}}> FCFA min</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'12px',color:'#7A7A6E'}}>
                        <Clock size={12} /> ~{a.response_time_min} min
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
