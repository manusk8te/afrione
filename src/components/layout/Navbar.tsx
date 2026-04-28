'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Zap } from 'lucide-react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '/artisans', label: 'Services' },
    { href: '/comment-ca-marche', label: 'Comment ça marche' },
    { href: '/artisan-space/register', label: 'Devenir artisan' },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-cream/95 backdrop-blur-md shadow-sm border-b border-border' : 'bg-transparent'
    }`}>
      <div className="page-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white fill-white" />
            </div>
            <span className="font-display font-bold text-xl text-dark">
              AFRI<span className="text-accent">ONE</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-colors hover:text-accent ${
                  pathname === l.href ? 'text-accent' : 'text-muted'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth" className="btn-outline text-sm py-2 px-4">
              Connexion
            </Link>
            <Link href="/diagnostic" className="btn-primary text-sm py-2 px-4">
              Décrire mon besoin
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-bg2 transition-colors"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-cream border-t border-border py-4 space-y-2">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-dark hover:bg-bg2 rounded-xl"
              >
                {l.label}
              </Link>
            ))}
            <div className="px-4 pt-2 space-y-2">
              <Link href="/auth" className="block btn-outline text-sm text-center">Connexion</Link>
              <Link href="/diagnostic" className="block btn-primary text-sm text-center">Décrire mon besoin</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
