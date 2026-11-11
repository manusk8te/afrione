'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, ChevronRight, Siren, X } from 'lucide-react'

export type NotifItem = {
  id: string
  kind: 'request' | 'urgent'
  title: string
  subtitle: string
  href?: string
  onSelect?: () => void
}

/**
 * Cloche de notifications : un seul bouton avec un compteur. La liste complète
 * s'ouvre dans un panneau, elle ne prend plus la place du tableau de bord.
 */
export default function NotificationBell({
  items, pushStatus, onEnablePush, enabling,
}: {
  items: NotifItem[]
  pushStatus: string
  onEnablePush: () => void
  enabling: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const pushNeeded = pushStatus === 'default' || pushStatus === 'denied'
  const count = items.length

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="notif" ref={root}>
      <button
        type="button"
        className="notif__btn"
        aria-label={count ? `Notifications : ${count} en attente` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <Bell size={20} aria-hidden="true" />
        {count > 0 && <span className="notif__count">{count > 99 ? '99+' : count}</span>}
        {count === 0 && pushNeeded && <span className="notif__dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="notif__panel" role="dialog" aria-label="Notifications">
          <div className="notif__head">
            <strong>Notifications{count ? ` (${count})` : ''}</strong>
            <button type="button" className="notif__close" aria-label="Fermer" onClick={() => setOpen(false)}><X size={16} /></button>
          </div>

          {pushNeeded && (
            <div className="notif__push">
              <p>
                {pushStatus === 'denied'
                  ? 'Les notifications sont bloquées par le navigateur. Autorisez-les dans les réglages du site pour recevoir les missions urgentes.'
                  : 'Activez les notifications pour recevoir les missions urgentes, même application fermée.'}
              </p>
              {pushStatus === 'default' && (
                <button type="button" onClick={onEnablePush} disabled={enabling}>{enabling ? 'Activation…' : 'Activer'}</button>
              )}
            </div>
          )}

          {count === 0 ? (
            <p className="notif__empty">Rien de nouveau pour le moment.</p>
          ) : (
            <ul className="notif__list">
              {items.map(item => {
                const inner = (
                  <>
                    <span className="notif__icon" data-kind={item.kind} aria-hidden="true">
                      {item.kind === 'urgent' ? <Siren size={16} /> : <Bell size={16} />}
                    </span>
                    <span className="notif__text">
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </>
                )
                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link href={item.href} className="notif__row" onClick={() => setOpen(false)}>{inner}</Link>
                    ) : (
                      <button type="button" className="notif__row" onClick={() => { item.onSelect?.(); setOpen(false) }}>{inner}</button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
