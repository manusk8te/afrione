import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { missionStatus } from '@/lib/mission-status'

export function StatusChip({ status }: { status: string | null | undefined }) {
  const s = missionStatus(status)
  return <span className="st-chip" data-tone={s.tone}>{s.label}</span>
}

function initials(name: string) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

/**
 * Une ligne = une mission ou une conversation : qui, quoi, où, où on en est,
 * et ce qu'il faut faire maintenant. Toute la ligne est cliquable.
 */
export default function MissionRow({
  href, name, subtitle, status, note, time, unread, action,
}: {
  href: string
  name: string
  subtitle: string
  status: string | null | undefined
  /** Dernier message, montant… une ligne de contexte. */
  note?: string
  time?: string
  unread?: boolean
  /** Libellé de l'action principale (affiché comme un bouton). */
  action?: string
}) {
  return (
    <Link href={href} className="mrow" data-unread={unread || undefined}>
      <span className="mrow__avatar" aria-hidden="true">{initials(name)}</span>
      <span className="mrow__body">
        <span className="mrow__top">
          <strong className="mrow__name">{name}</strong>
          {time && <time className="mrow__time">{time}</time>}
        </span>
        <span className="mrow__sub">{subtitle}</span>
        {note && <span className="mrow__note">{note}</span>}
        <span className="mrow__foot">
          <StatusChip status={status} />
          {action && <span className="mrow__cta">{action}<ChevronRight size={15} aria-hidden="true" /></span>}
        </span>
      </span>
      {unread && <span className="mrow__dot" aria-label="Non lu" />}
    </Link>
  )
}
