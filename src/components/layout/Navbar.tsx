'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut, LayoutDashboard, Wrench, ShieldCheck, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useIsMobile'

const NEU_SM = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'
const NEU_MD = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'

export default function Navbar() {
  const isMobile = useIsMobile()
  const { user, userRole, userName, hasArtisanProfile, loading, signOut } = useAuth()
  const [scrolled,     setScrolled]     = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setDropdownOpen(false); setMenuOpen(false) }, [pathname])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); setDropdownOpen(false) } }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isHome = pathname === '/'
  /* Hero is orange — white text when not scrolled on homepage */
  const onOrange = isHome && !scrolled

  const isArtisan        = hasArtisanProfile || userRole === 'artisan'
  const isEntrepriseAdmin = userRole === 'entreprise_admin'
  const artisanHref       = hasArtisanProfile ? '/artisan-space/dashboard' : '/artisan-space/register'

  const roleBadge = userRole === 'admin'
    ? { label: isArtisan ? 'Admin · Artisan' : 'Admin', color: '#C9A84C' }
    : isEntrepriseAdmin
    ? { label: 'Entreprise', color: '#E85D26' }
    : isArtisan
    ? { label: 'Artisan',    color: '#E85D26' }
    : { label: 'Client',     color: '#2B6B3E' }

  const links = [
    { href: '/artisans',  label: 'Services'       },
    { href: '/diagnostic', label: 'Diagnostic IA' },
    ...(!isArtisan ? [{ href: '/artisan-space/register', label: 'Devenir artisan' }] : []),
  ]

  /* shared pill button — white neumorphic on scrolled, glass on orange */
  const pillStyle = (active?: boolean): React.CSSProperties => scrolled
    ? { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? '#FFF3EE' : '#FFFFFF', boxShadow: NEU_SM, color: active ? '#E85D26' : '#3D4852', transition: 'box-shadow 0.2s' }
    : { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', color: 'white', transition: 'background 0.2s' }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
      transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
      background:    scrolled ? 'rgba(255,255,255,0.97)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom:  scrolled ? '1px solid #E2E8F0' : 'none',
    }}>
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="AfriOne logo" width={32} height={40} style={{ objectFit: 'contain' }} />
            <span className="font-display font-bold" style={{ fontSize: '20px', color: onOrange ? 'white' : '#3D4852', transition: 'color 0.3s' }}>
              AFRI<span className="afrione-gradient-text">ONE</span>
            </span>
          </Link>

          {/* Nav links */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {links.map(l => (
                <Link key={l.href} href={l.href} style={{
                  fontSize: '14px', fontWeight: 500, padding: '8px 16px', borderRadius: '8px',
                  textDecoration: 'none', transition: 'color 0.2s',
                  color: pathname === l.href
                    ? '#E85D26'
                    : onOrange ? 'rgba(255,255,255,0.82)' : '#6B7280',
                }}>
                  {l.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isMobile && (
              loading ? (
                <div style={{ width: '80px', height: '36px', background: '#F5F7FA', borderRadius: '10px', opacity: 0.5 }} />
              ) : user ? (
                <>
                  {isEntrepriseAdmin && (
                    <Link href="/entreprise-space/dashboard" style={pillStyle()}>
                      <Building2 size={14} /> Espace Entreprise
                    </Link>
                  )}

                  {isArtisan && (
                    <Link href={artisanHref} style={{ ...pillStyle(true), color: 'white', background: '#E85D26', boxShadow: '0 4px 16px rgba(232,93,38,0.35)', border: 'none' }}>
                      <Wrench size={14} /> Espace Artisan
                    </Link>
                  )}

                  {userRole === 'admin' && (
                    <Link href="/admin" style={{ ...pillStyle(), color: '#C9A84C' }}>
                      <ShieldCheck size={14} /> Admin
                    </Link>
                  )}

                  {/* Avatar + dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: scrolled ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                      backdropFilter: !scrolled ? 'blur(10px)' : 'none',
                      color: onOrange ? 'white' : '#3D4852',
                      border: scrolled ? 'none' : '1px solid rgba(255,255,255,0.3)',
                      boxShadow: scrolled ? NEU_SM : 'none',
                      borderRadius: '10px', padding: '8px 14px',
                      cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0, background: scrolled ? '#FFF3EE' : 'rgba(255,255,255,0.25)', color: scrolled ? '#E85D26' : 'white' }}>
                        {userName ? userName[0].toUpperCase() : '?'}
                      </div>
                      {userName}
                    </button>

                    {dropdownOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '8px', minWidth: '220px', boxShadow: NEU_MD, zIndex: 1000 }}>
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0', marginBottom: '8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#3D4852' }}>{userName}</div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '1px' }}>{user.email}</div>
                          <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', fontWeight: 600, color: 'white', background: roleBadge.color, padding: '2px 8px', borderRadius: '20px' }}>
                            {roleBadge.label}
                          </span>
                        </div>
                        {[
                          { href: '/dashboard',                  label: 'Espace Client',    show: true,             color: '#3D4852' },
                          { href: '/entreprise-space/dashboard',  label: 'Espace Entreprise', show: isEntrepriseAdmin, color: '#E85D26' },
                          { href: '/admin',                       label: 'Panel Admin',      show: userRole==='admin', color: '#C9A84C' },
                        ].filter(i => i.show).map(item => (
                          <Link key={item.href} href={item.href} onClick={() => setDropdownOpen(false)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', textDecoration: 'none', color: item.color, fontSize: '14px', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F5F7FA')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            {item.label === 'Espace Client'    && <LayoutDashboard size={14} />}
                            {item.label === 'Espace Entreprise' && <Building2 size={14} />}
                            {item.label === 'Panel Admin'       && <ShieldCheck size={14} />}
                            {item.label}
                          </Link>
                        ))}
                        <button onClick={signOut}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', color: '#E85D26', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', marginTop: '4px', borderTop: '1px solid #F5F7FA', paddingTop: '12px', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#FFF3EE')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <LogOut size={14} /> Se déconnecter
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link href="/auth" style={pillStyle()}>
                    Connexion
                  </Link>
                  <Link href="/diagnostic" className="btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }}>
                    Décrire mon besoin
                  </Link>
                </>
              )
            )}

            {/* Hamburger */}
            {isMobile && (
              <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', color: onOrange ? 'white' : '#3D4852', transition: 'color 0.3s' }}>
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: '#FFFFFF', borderTop: '1px solid #E2E8F0', padding: '16px 0', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
            {links.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: pathname === l.href ? '#E85D26' : '#3D4852', textDecoration: 'none', borderRadius: '8px', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F7FA')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {l.label}
              </Link>
            ))}
            <div style={{ padding: '8px 16px', marginTop: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {user ? (
                <>
                  {isEntrepriseAdmin && (
                    <Link href="/entreprise-space/dashboard" onClick={() => setMenuOpen(false)}
                      style={{ display: 'block', padding: '12px', textAlign: 'center', background: '#FFF3EE', color: '#E85D26', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', fontWeight: 700, boxShadow: NEU_SM }}>
                      Espace Entreprise
                    </Link>
                  )}
                  {isArtisan && (
                    <Link href={artisanHref} onClick={() => setMenuOpen(false)}
                      style={{ display: 'block', padding: '12px', textAlign: 'center', background: '#E85D26', color: 'white', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 16px rgba(232,93,38,0.3)' }}>
                      Espace Artisan
                    </Link>
                  )}
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)}
                    style={{ display: 'block', padding: '12px', textAlign: 'center', background: '#FFFFFF', color: '#3D4852', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, boxShadow: NEU_SM }}>
                    Espace Client
                  </Link>
                  {userRole === 'admin' && (
                    <Link href="/admin" onClick={() => setMenuOpen(false)}
                      style={{ display: 'block', padding: '12px', textAlign: 'center', background: '#FFFFFF', color: '#C9A84C', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, boxShadow: NEU_SM }}>
                      Panel Admin
                    </Link>
                  )}
                  <button onClick={signOut}
                    style={{ display: 'block', padding: '12px', textAlign: 'center', background: 'none', border: '2px solid #E2E8F0', color: '#E85D26', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                    Se déconnecter
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth"
                    style={{ display: 'block', textAlign: 'center', background: '#FFFFFF', color: '#3D4852', fontWeight: 600, padding: '12px', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', boxShadow: NEU_SM }}>
                    Connexion
                  </Link>
                  <Link href="/diagnostic" className="btn-primary" style={{ display: 'block', textAlign: 'center', padding: '12px', fontSize: '14px' }}>
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
