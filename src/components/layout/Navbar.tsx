'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, Zap, LogOut, LayoutDashboard } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('client')
  const [userName, setUserName] = useState<string>('')
  const [hasArtisanProfile, setHasArtisanProfile] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const loadUser = async (session: any) => {
      if (!session) {
        setUser(null); setUserRole('client'); setUserName(''); setHasArtisanProfile(false); return
      }
      setUser(session.user)
      const { data } = await supabase
        .from('users')
        .select('role, name')
        .eq('id', session.user.id)
        .single()
      if (data) {
        setUserRole(data.role || 'client')
        setUserName(data.name || session.user.email?.split('@')[0] || 'Mon compte')
      } else {
        setUserName(session.user.email?.split('@')[0] || 'Mon compte')
      }
      // Vérifie si l'utilisateur a un profil artisan (peu importe son rôle)
      const { data: artisanData } = await supabase
        .from('artisan_pros')
        .select('id')
        .eq('user_id', session.user.id)
        .single()
      setHasArtisanProfile(!!artisanData)
    }

    supabase.auth.getSession().then(({ data: { session } }) => loadUser(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => loadUser(session))
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRole('client')
    setUserName('')
    setDropdownOpen(false)
    setMenuOpen(false)
    router.refresh()
    router.push('/')
  }

  const dashboardLink = userRole === 'admin' ? '/admin' : '/dashboard'

  const links = [
    { href: '/artisans', label: 'Services' },
    { href: '/diagnostic', label: 'Diagnostic IA' },
    { href: '/artisan-space/register', label: 'Devenir artisan' },
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

          <Link href="/" style={{display:'flex',alignItems:'center',gap:'8px',textDecoration:'none'}}>
            <div style={{width:'32px',height:'32px',background:'#E85D26',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Zap size={16} color="white" />
            </div>
            <span className="font-display font-bold text-dark" style={{fontSize:'20px'}}>
              AFRI<span className="text-accent">ONE</span>
            </span>
          </Link>

          {/* Links desktop */}
          <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
            {links.map(l => (
              <Link key={l.href} href={l.href} style={{
                fontSize:'14px',fontWeight:500,padding:'8px 16px',borderRadius:'8px',
                textDecoration:'none',transition:'all 0.2s',
                color: pathname === l.href ? '#E85D26' : '#7A7A6E',
              }}>{l.label}</Link>
            ))}
          </div>

          {/* Right side */}
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            {!mounted ? (
              <div style={{width:'80px',height:'36px',background:'#EDE8DE',borderRadius:'10px'}} />
            ) : user ? (
              <div style={{position:'relative'}}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{
                  display:'flex',alignItems:'center',gap:'8px',background:'#0F1410',
                  color:'#FAFAF5',border:'none',borderRadius:'10px',padding:'8px 16px',
                  cursor:'pointer',fontSize:'14px',fontWeight:600
                }}>
                  <div style={{width:'28px',height:'28px',background:'#E85D26',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700}}>
                    {userName ? userName[0].toUpperCase() : '?'}
                  </div>
                  {userName}
                </button>

                {dropdownOpen && (
                  <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'white',border:'1px solid #D8D2C4',borderRadius:'12px',padding:'8px',minWidth:'220px',boxShadow:'0 4px 20px rgba(0,0,0,0.1)',zIndex:1000}}>
                    <div style={{padding:'8px 12px',borderBottom:'1px solid #D8D2C4',marginBottom:'8px'}}>
                      <div style={{fontSize:'13px',fontWeight:600,color:'#0F1410'}}>{userName}</div>
                      <div style={{fontSize:'12px',color:'#7A7A6E'}}>{user.email}</div>
                      <div style={{fontSize:'11px',color:'#E85D26',marginTop:'2px',textTransform:'capitalize'}}>{userRole}</div>
                    </div>
                    {/* Espace client — accessible à tous */}
                    <Link href="/dashboard" onClick={() => setDropdownOpen(false)}
                      style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderRadius:'8px',textDecoration:'none',color:'#0F1410',fontSize:'14px'}}
                      onMouseEnter={e => (e.currentTarget.style.background='#F5F0E8')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                      <LayoutDashboard size={14} /> Espace Client
                    </Link>
                    {/* Espace artisan — si profil artisan_pros existe */}
                    {hasArtisanProfile && (
                      <Link href="/artisan-space/dashboard" onClick={() => setDropdownOpen(false)}
                        style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderRadius:'8px',textDecoration:'none',color:'#E85D26',fontSize:'14px',fontWeight:600}}
                        onMouseEnter={e => (e.currentTarget.style.background='rgba(232,93,38,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                        🔧 Espace Artisan
                      </Link>
                    )}
                    <Link href="/diagnostic" onClick={() => setDropdownOpen(false)}
                      style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderRadius:'8px',textDecoration:'none',color:'#0F1410',fontSize:'14px'}}
                      onMouseEnter={e => (e.currentTarget.style.background='#F5F0E8')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                      <Zap size={14} /> Nouvelle mission
                    </Link>
                    {userRole === 'admin' && (
                      <Link href="/admin" onClick={() => setDropdownOpen(false)}
                        style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderRadius:'8px',textDecoration:'none',color:'#7A7A6E',fontSize:'14px'}}
                        onMouseEnter={e => (e.currentTarget.style.background='#F5F0E8')}
                        onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                        ⚙️ Admin
                      </Link>
                    )}
                    <button onClick={handleLogout}
                      style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderRadius:'8px',color:'#E85D26',fontSize:'14px',background:'none',border:'none',cursor:'pointer',width:'100%',textAlign:'left',marginTop:'4px',borderTop:'1px solid #D8D2C4',paddingTop:'12px'}}
                      onMouseEnter={e => (e.currentTarget.style.background='rgba(232,93,38,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background='none')}>
                      <LogOut size={14} /> Se déconnecter
                    </button>
                  </div>
                )}
              </div>
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
            )}

            <button onClick={() => setMenuOpen(!menuOpen)} style={{background:'none',border:'none',cursor:'pointer',padding:'8px',display:'flex'}}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
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
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)}
                    style={{display:'block',padding:'10px',textAlign:'center',background:'#0F1410',color:'white',borderRadius:'10px',textDecoration:'none',fontSize:'14px',fontWeight:600}}>
                    Espace Client
                  </Link>
                  {hasArtisanProfile && (
                    <Link href="/artisan-space/dashboard" onClick={() => setMenuOpen(false)}
                      style={{display:'block',padding:'10px',textAlign:'center',background:'rgba(232,93,38,0.1)',color:'#E85D26',borderRadius:'10px',textDecoration:'none',fontSize:'14px',fontWeight:600}}>
                      🔧 Espace Artisan
                    </Link>
                  )}
                  {userRole === 'admin' && (
                    <Link href="/admin" onClick={() => setMenuOpen(false)}
                      style={{display:'block',padding:'10px',textAlign:'center',background:'rgba(201,168,76,0.1)',color:'#C9A84C',borderRadius:'10px',textDecoration:'none',fontSize:'14px',fontWeight:600}}>
                      ⚙️ Admin
                    </Link>
                  )}
                  <button onClick={handleLogout}
                    style={{display:'block',padding:'10px',textAlign:'center',background:'none',border:'2px solid #E85D26',color:'#E85D26',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',width:'100%'}}>
                    Se déconnecter
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth" style={{display:'block',textAlign:'center',border:'2px solid #0F1410',color:'#0F1410',fontWeight:600,padding:'10px',borderRadius:'10px',textDecoration:'none',fontSize:'14px'}}>
                    Connexion
                  </Link>
                  <Link href="/diagnostic" className="btn-primary" style={{display:'block',textAlign:'center',padding:'10px',fontSize:'14px'}}>
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
