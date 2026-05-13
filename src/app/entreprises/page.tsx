'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { Search, Building2, Users, ChevronRight, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/useIsMobile'

const SECTEURS_OPTS = [
  'Tous', 'Plomberie', 'Électricité', 'Maçonnerie', 'Peinture', 'Menuiserie',
  'Climatisation', 'Sécurité', 'Nettoyage', 'Carrelage', 'Toiture', 'Soudure',
]

export default function EntreprisesPage() {
  const isMobile = useIsMobile()
  const [entreprises, setEntreprises] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [secteur, setSecteur] = useState('Tous')

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('entreprises')
        .select('id, name, description, banner_url, logo_url, secteurs, quartiers, created_at, artisan_pros(id)')
        .eq('kyc_status', 'approved')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setEntreprises(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = entreprises.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.description || '').toLowerCase().includes(search.toLowerCase())
    const matchSecteur = secteur === 'Tous' || (e.secteurs || []).includes(secteur)
    return matchSearch && matchSecteur
  })

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div style={{ padding: isMobile ? '80px 12px 48px' : '96px 16px 64px' }}>
        <div className="page-container">

          {/* Header */}
          <div style={{ marginBottom: '28px' }}>
            <span className="section-label">STRUCTURES PROFESSIONNELLES</span>
            <h1 className="font-display" style={{ fontSize: isMobile ? '26px' : '36px', fontWeight: 700, color: '#0F1410', marginTop: '8px' }}>
              Entreprises partenaires
            </h1>
            <p style={{ color: '#7A7A6E', marginTop: '8px' }}>
              {loading ? 'Chargement...' : `${filtered.length} structure${filtered.length > 1 ? 's' : ''} vérifiée${filtered.length > 1 ? 's' : ''} à Abidjan`}
            </p>
          </div>

          {/* Recherche */}
          <div style={{ background: 'white', border: '1px solid #D8D2C4', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#7A7A6E' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une entreprise..."
                style={{ width: '100%', paddingLeft: '48px', padding: '12px 12px 12px 48px', border: '1px solid #D8D2C4', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Filtres secteur */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '32px' }}>
            {SECTEURS_OPTS.map(s => (
              <button key={s} onClick={() => setSecteur(s)} style={{
                flexShrink: 0, padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', border: 'none',
                background: secteur === s ? '#0F1410' : 'white',
                color: secteur === s ? '#FAFAF5' : '#7A7A6E',
                boxShadow: secteur === s ? 'none' : '0 0 0 1px #D8D2C4',
              }}>{s}</button>
            ))}
          </div>

          {/* Liste */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid rgba(232,93,38,0.2)', borderTop: '4px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</p>
              <h3 className="font-display" style={{ fontSize: '20px', fontWeight: 700, color: '#0F1410' }}>Aucune entreprise trouvée</h3>
              <p style={{ color: '#7A7A6E', marginTop: '8px', marginBottom: '24px' }}>
                {secteur !== 'Tous' ? `Aucune structure en ${secteur} pour l'instant` : 'Aucune structure disponible'}
              </p>
              <Link href="/entreprise-space/register" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#E85D26', borderRadius: '12px', color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
                <Building2 size={16} /> Créer mon espace entreprise
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {filtered.map(e => {
                const nbArtisans = (e.artisan_pros || []).length
                return (
                  <Link key={e.id} href={`/entreprise-space/dashboard?id=${e.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'white', borderRadius: '20px', overflow: 'hidden',
                      border: '1px solid #E8E2D8', cursor: 'pointer', transition: 'all 0.25s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = '#60a5fa' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = '#E8E2D8' }}>

                      {/* Banner */}
                      <div style={{ height: '140px', background: e.banner_url ? '#1A1A1A' : 'linear-gradient(135deg, #1A2F1E, #0F1410)', overflow: 'hidden', position: 'relative' }}>
                        {e.banner_url
                          ? <img src={e.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                              <Building2 size={48} color="rgba(255,255,255,0.12)" />
                            </div>
                        }
                        <span style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '11px', color: '#2B6B3E', background: 'rgba(240,255,244,0.95)', border: '1px solid rgba(43,107,62,0.3)', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>✓ Vérifié</span>
                      </div>

                      {/* Contenu */}
                      <div style={{ padding: '20px' }}>
                        <h3 className="font-display" style={{ fontSize: '17px', fontWeight: 800, color: '#0F1410', marginBottom: '6px' }}>{e.name}</h3>

                        {e.description && (
                          <p style={{ fontSize: '13px', color: '#7A7A6E', marginBottom: '12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{e.description}</p>
                        )}

                        {/* Secteurs */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
                          {(e.secteurs || []).slice(0, 4).map((s: string) => (
                            <span key={s} style={{ fontSize: '11px', background: '#F5F3EE', border: '1px solid #D8D2C4', padding: '3px 9px', borderRadius: '10px', color: '#7A7A6E' }}>{s}</span>
                          ))}
                          {(e.secteurs || []).length > 4 && (
                            <span style={{ fontSize: '11px', color: '#7A7A6E' }}>+{e.secteurs.length - 4}</span>
                          )}
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #E8E2D8' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#7A7A6E' }}>
                            <Users size={13} />
                            <span>{nbArtisans} artisan{nbArtisans !== 1 ? 's' : ''}</span>
                          </div>
                          {(e.quartiers || []).length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#7A7A6E' }}>
                              <MapPin size={11} />
                              <span>{e.quartiers.slice(0, 2).join(', ')}{e.quartiers.length > 2 ? '…' : ''}</span>
                            </div>
                          )}
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#E85D26', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            Voir <ChevronRight size={13} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* CTA créer */}
          <div style={{ marginTop: '48px', textAlign: 'center', padding: '40px 24px', background: 'linear-gradient(135deg, #0F1E14, #1A2F1E)', borderRadius: '20px' }}>
            <Building2 size={28} color="#60a5fa" style={{ marginBottom: '12px' }} />
            <h3 className="font-display" style={{ fontSize: '20px', fontWeight: 700, color: '#FAFAF5', marginBottom: '8px' }}>Vous dirigez une équipe d'artisans ?</h3>
            <p style={{ fontSize: '13px', color: 'rgba(250,250,245,0.6)', marginBottom: '20px', lineHeight: 1.6 }}>
              Rejoignez AfriOne et gérez vos artisans, missions et clients depuis un espace dédié.
            </p>
            <Link href="/entreprise-space/register" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 28px', background: '#60a5fa', borderRadius: '12px', color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>
              Créer mon espace entreprise <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
