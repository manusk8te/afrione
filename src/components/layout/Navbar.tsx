'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Zap, LogOut, LayoutDashboard, Wrench, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function Navbar() {
  const isMobile = useIsMobile()
  const { user, userRole, userName, hasArtisanProfile, loading, signOut } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false)
    setMenuOpen(false)
  }, [pathname])

  // Escape key closes menus + lock body scroll when mobile menu open
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); setDropdownOpen(false) } }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isArtisan = hasArtisanProfile || userRole === 'artisan'
  const artisanHref = hasArtisanProfile ? '/artisan-space/dashboard' : '/artisan-space/register'

  const roleBadge = userRole === 'admin'
    ? { label: isArtisan ? 'Admin · Artisan' : 'Admin', color: '#C9A84C' }
    : isArtisan
    ? { label: 'Artisan', color: '#E85D26' }
    : { label: 'Client', color: '#2B6B3E' }

  const links = [
    { href: '/artisans', label: 'Services' },
    { href: '/diagnostic', label: 'Diagnostic IA' },
    ...(!isArtisan ? [{ href: '/artisan-space/register', label: 'Devenir artisan' }] : []),
  ]

  return (
    <nav style={{
      position:'fixed',top:0,left:0,right:0,zIndex:999,
      transition:'all 0.3s',
      background: scrolled ? 'rgba(245,240,232,0.97)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid #D8D2C4' : 'none',
    }}>
      <div className="page-container">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:'64px'}}>

          {/* Logo */}
          <Link href="/" style={{display:'flex',alignItems:'center',gap:'8px',textDecoration:'none'}}>
            <div style={{width:'32px',height:'32px',background:'#E85D26',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Zap size={16} color="white" />
            </div>
            <span className="font-display font-bold text-dark" style={{fontSize:'20px'}}>
              AFRI<span className="text-accent">ONE</span>
            </span>
          </Link>

          {/* Liens centre — masqués sur mobile */}
          {!isMobile && (
            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
              {links.map(l => (
                <Link key={l.href} href={l.href} style={{
                  fontSize:'14px',fontWeight:500,padding:'8px 16px',borderRadius:'8px',
                  textDecoration:'none',transition:'all 0.2s',
                  color: pathname === l.href ? '#E85D26' : '#7A7A6E',
                }}>{l.label}</Link>
              ))}
            </div>
          )}

          {/* Droite */}
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            {!isMobile && (
              loading ? (
                // Skeleton pendant le chargement initial — même taille que les boutons
                <div style={{width:'80px',height:'36px',background:'#EDE8DE',borderRadius:'10px',opacity:0.5}} />
              ) : user ? (
                <>
                  {isArtisan && (
                    <Link href={artisanHref} style={{
                      display:'flex',alignItems:'center',gap:'6px',
                      padding:'8px 16px',borderRadius:'10px',textDecoration:'none',
                      background:'#E85D26',color:'white',fontSize:'14px',fontWeight:600,
                    }}>
                      <Wrench size={14} /> Espace Artisan
                    </Link>
                  )}

                  {userRole === 'admin' && (
                    <Link href="/admin" style={{
                      display:'flex',alignItems:'center',gap:'6px',
                      padding:'8px 14px',borderRadius:'10px',textDecoration:'none',
                      background:'rgba(201,168,76,0.15)',color:'#C9A84C',fontSize:'13px',fontWeight:600,
                      border:'1px solid rgba(201,168,76,0.3)',
                    }}>
                      <ShieldCheck size={14} /> Admin
                    </Link>
                  )}

                  {/* Avatar + dropdown */}
                  <div style={{position:'relative'}}>
                    <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{
                      display:'flex',alignItems:'center',gap:'8px',background:'#0F1410',
                      color:'#FAFAF5',border:'none',borderRadius:'10px',padding:'8px 14px',
                      cursor:'pointer',fontSize:'14px',fontWeight:600,
                    }}>
                      <div style={{width:'26px',height:'26px',background:'#E85D26',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,flexShrink:0}}>
                        {userName ? userName[0].toUpperCase() : '?'}
                      </div>
                      {userName}
                    </button>

                    {dropdownOpen && (
                      <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'white',border:'1px solid #D8D2C4',borderRadius:'12px',padding:'8px',minWidth:'220px',boxShadow:'0 4px 20px rgba(0,0,0,0.1)',zIndex:1000}}>
                        <div style={{padding:'10px 12px',borderBottom:'1px solid #D8D2C4',marginBottom:'8px'}}>
                          <div style={{fontSize:'13px',fontWeight:700,color:'#0F1410'}}>{userName}</div>
                          <div style={{fontSize:'12px',color:'#7A7A6E',marginTop:'1px'}}>{user.email}</div>
                          <span style={{display:'inline-block',marginTop:'6px',fontSize:'11px',fontWeight:600,color:'white',background:roleBadge.color,padding:'2px 8px',borderRadius:'20px'}}>
                            {roleBadge.label}
                          </span>
                        </div>
                        <Link href="/dashboard" onClick={() => setDropdownOpen(false)}
                          style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderRadius:'8px',textDecoration:'none',color:'#0F1410',fontSize:'14px'}}
                          onMouseEnter={e => (e.currentTarget.style.background='#F5F0E8')}
                          onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                          <LayoutDashboard size={14} /> Espace Client
                        </Link>
                        {userRole === 'admin' && (
                          <Link href="/admin" onClick={() => setDropdownOpen(false)}
                            style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderRadius:'8px',textDecoration:'none',color:'#C9A84C',fontSize:'14px'}}
                            onMouseEnter={e => (e.currentTarget.style.background='rgba(201,168,76,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                            <ShieldCheck size={14} /> Panel Admin
                          </Link>
                        )}
                        <button onClick={signOut}
                          style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderRadius:'8px',color:'#E85D26',fontSize:'14px',background:'none',border:'none',cursor:'pointer',width:'100%',textAlign:'left',marginTop:'4px',borderTop:'1px solid #EDE8DE',paddingTop:'12px'}}
                          onMouseEnter={e => (e.currentTarget.style.background='rgba(232,93,38,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background='none')}>
                          <LogOut size={14} /> Se déconnecter
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link href="/auth" style={{border:'2px solid #0F1410',color:'#0F1410',fontWeight:600,padding:'8px 16px',borderRadius:'10px',textDecoration:'none',fontSize:'14px'}}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#0F1410'; (e.currentTarget as HTMLElement).style.color='white' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='#0F1410' }}>
                    Connexion
                  </Link>
                  <Link href="/diagnostic" className="btn-primary" style={{padding:'8px 16px',fontSize:'14px'}}>
                    Décrire mon besoin
                  </Link>
                </>
              )
            )}

            {/* Hamburger — mobile uniquement */}
            {isMobile && (
              <button onClick={() => setMenuOpen(!menuOpen)} style={{background:'none',border:'none',cursor:'pointer',padding:'8px',display:'flex'}}>
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>

        {/* Menu mobile */}
        {menuOpen && (
          <div style={{background:'#FAFAF5',borderTop:'1px solid #D8D2C4',padding:'16px 0'}}>
            {links.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                style={{display:'block',padding:'12px 16px',fontSize:'14px',fontWeight:500,color:'#0F1410',textDecoration:'none',borderRadius:'8px'}}
                onMouseEnter={e => (e.currentTarget.style.background='#EDE8DE')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                {l.label}
              </Link>
            ))}
            <div style={{padding:'8px 16px',marginTop:'8px',borderTop:'1px solid #D8D2C4',paddingTop:'16px',display:'flex',flexDirection:'column',gap:'8px'}}>
              {user ? (
                <>
                  {isArtisan && (
                    <Link href={artisanHref} onClick={() => setMenuOpen(false)}
                      style={{display:'block',padding:'12px',textAlign:'center',background:'#E85D26',color:'white',borderRadius:'10px',textDecoration:'none',fontSize:'14px',fontWeight:700}}>
                      🔧 Espace Artisan
                    </Link>
                  )}
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)}
                    style={{display:'block',padding:'12px',textAlign:'center',background:'#0F1410',color:'white',borderRadius:'10px',textDecoration:'none',fontSize:'14px',fontWeight:600}}>
                    Espace Client
                  </Link>
                  {userRole === 'admin' && (
                    <Link href="/admin" onClick={() => setMenuOpen(false)}
                      style={{display:'block',padding:'12px',textAlign:'center',background:'rgba(201,168,76,0.1)',color:'#C9A84C',borderRadius:'10px',textDecoration:'none',fontSize:'14px',fontWeight:600,border:'1px solid rgba(201,168,76,0.3)'}}>
                      ⚙️ Admin
                    </Link>
                  )}
                  <button onClick={signOut}
                    style={{display:'block',padding:'12px',textAlign:'center',background:'none',border:'2px solid #E85D26',color:'#E85D26',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',width:'100%'}}>
                    Se déconnecter
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth" style={{display:'block',textAlign:'center',border:'2px solid #0F1410',color:'#0F1410',fontWeight:600,padding:'12px',borderRadius:'10px',textDecoration:'none',fontSize:'14px'}}>
                    Connexion
                  </Link>
                  <Link href="/diagnostic" className="btn-primary" style={{display:'block',textAlign:'center',padding:'12px',fontSize:'14px'}}>
                    Décrire mon besoin
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
