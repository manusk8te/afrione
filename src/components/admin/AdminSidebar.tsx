'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap } from 'lucide-react'

export const ADMIN_NAV = [
  { id: 'overview',     label: "Vue d'ensemble", short: 'Vue',          icon: '📊' },
  { id: 'litiges',      label: 'Litiges',         short: 'Litiges',      icon: '⚖️' },
  { id: 'kyc',          label: 'Validations KYC', short: 'KYC',          icon: '🪪' },
  { id: 'missions',     label: 'Missions',         short: 'Missions',     icon: '📋' },
  { id: 'artisans',     label: 'Artisans',         short: 'Artisans',     icon: '🔧' },
  { id: 'transactions', label: 'Transactions',     short: 'Transactions', icon: '💳' },
  { id: 'utilisateurs', label: 'Utilisateurs',     short: 'Users',        icon: '👥' },
  { id: 'prix',         label: 'Prix matériaux',   short: 'Prix',         icon: '💰', href: '/admin/prix' },
  { id: 'sources',      label: 'Sources de prix',  short: 'Sources',      icon: '🏪', href: '/admin/sources' },
]

interface Props {
  activeId: string
  onTabChange?: (id: string) => void
  litigeCount?: number
  litigeNotif?: boolean
  adminName?: string
}

export default function AdminSidebar({
  activeId,
  onTabChange,
  litigeCount = 0,
  litigeNotif = false,
  adminName = 'Admin',
}: Props) {
  const pathname = usePathname()
  const isPrixPage = pathname === '/admin/prix'

  const getHref = (item: typeof ADMIN_NAV[0]) => {
    if (item.href) return item.href
    if (isPrixPage || pathname === '/admin/sources') return '/admin'
    return undefined
  }

  const renderItem = (item: typeof ADMIN_NAV[0], compact = false) => {
    const isActive = item.id === activeId
    const href = getHref(item)

    const badge = item.id === 'litiges' && litigeCount > 0 ? (
      <span style={{
        marginLeft: 'auto', minWidth: '18px', height: '18px', borderRadius: '9px',
        background: litigeNotif ? '#ef4444' : 'rgba(239,68,68,0.4)',
        color: 'white', fontSize: '10px', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
        flexShrink: 0,
      }}>
        {litigeCount}
      </span>
    ) : null

    const sharedStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: compact ? '0' : '10px',
      flexDirection: compact ? 'column' : 'row',
      padding: compact ? '8px 10px' : '10px 14px',
      borderRadius: '10px',
      fontSize: compact ? '10px' : '13px',
      fontWeight: isActive ? 600 : 400,
      color: isActive ? '#E85D26' : '#7A7A6E',
      background: isActive ? 'rgba(232,93,38,0.12)' : 'transparent',
      border: 'none',
      cursor: 'pointer',
      textDecoration: 'none',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
      textAlign: compact ? 'center' : 'left',
      width: compact ? 'auto' : '100%',
      flexShrink: 0,
      position: 'relative',
    }

    const content = (
      <>
        <span style={{ fontSize: compact ? '18px' : '15px', lineHeight: 1 }}>{item.icon}</span>
        <span>{compact ? item.short : item.label}</span>
        {!compact && badge}
        {compact && litigeCount > 0 && item.id === 'litiges' && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            width: '8px', height: '8px', borderRadius: '50%',
            background: litigeNotif ? '#ef4444' : 'rgba(239,68,68,0.6)',
          }} />
        )}
      </>
    )

    if (href) {
      return <Link key={item.id} href={href} style={sharedStyle}>{content}</Link>
    }

    return (
      <button key={item.id} onClick={() => onTabChange?.(item.id)} style={sharedStyle}>
        {content}
      </button>
    )
  }

  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────── */}
      <aside style={{
        flexDirection: 'column',
        width: '220px',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.25)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        minHeight: '100vh',
        padding: '24px 12px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }} className="hidden lg:flex">
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px', textDecoration: 'none', padding: '0 4px' }}>
          <div style={{ width: '30px', height: '30px', background: '#E85D26', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={14} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', color: '#FAFAF5' }}>
            AFRI<span style={{ color: '#E85D26' }}>ONE</span>
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {ADMIN_NAV.map(item => renderItem(item, false))}
        </nav>

        {/* Admin info */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
          <div style={{ width: '30px', height: '30px', background: '#E85D26', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: 'white', flexShrink: 0 }}>
            {adminName[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#FAFAF5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminName}</div>
            <div style={{ fontSize: '10px', color: '#7A7A6E' }}>Admin AfriOne</div>
          </div>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ──────────────────────────────────────── */}
      <header style={{
        alignItems: 'center',
        gap: '4px',
        padding: '8px 12px',
        background: '#0F1410',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        overflowX: 'auto',
        flexShrink: 0,
      }} className="flex lg:hidden">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#E85D26', borderRadius: '8px', marginRight: '8px', flexShrink: 0 }}>
          <Zap size={14} color="white" />
        </Link>
        {ADMIN_NAV.map(item => renderItem(item, true))}
      </header>
    </>
  )
}
