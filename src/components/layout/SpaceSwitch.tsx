'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserRound, Wrench } from 'lucide-react'

/**
 * Bascule Client | Artisan pour les comptes qui ont les deux rôles.
 * L'espace actuel est surligné : on sait toujours dans quel mode on est,
 * et on change d'un seul geste.
 */
export default function SpaceSwitch({
  artisanHref, onOrange, block, onNavigate,
}: { artisanHref: string; onOrange?: boolean; block?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() || ''
  const inArtisan = pathname.startsWith('/artisan-space')
  return (
    <nav className="space-switch" aria-label="Changer d’espace" data-on-orange={onOrange || undefined} data-block={block || undefined}>
      <Link href="/dashboard" onClick={onNavigate} aria-current={inArtisan ? undefined : 'page'}>
        <UserRound size={14} aria-hidden="true" /> Client
      </Link>
      <Link href={artisanHref} onClick={onNavigate} aria-current={inArtisan ? 'page' : undefined}>
        <Wrench size={14} aria-hidden="true" /> Artisan
      </Link>
    </nav>
  )
}
