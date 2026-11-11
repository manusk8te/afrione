'use client'

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

type Props = {
  href: string
  label: string
  photo: string
  position: string
  tone: string
  /** Décale l'oscillation « feuille » pour que les cartes ne bougent pas en même temps. */
  index: number
}

const KNOB = 36          // diamètre du bouton flèche (px)
const UNLOCK_AT = 0.72   // part de la piste à parcourir pour valider le glisser

/**
 * Carte métier de l'accueil.
 * - Glisser la flèche de gauche à droite (comme « déverrouiller » un iPhone)
 *   ouvre la liste des artisans. Un simple tap ou Entrée marche aussi.
 * - Photo légèrement givrée, qui se dégivre au survol.
 * - Inclinaison 3D légère qui suit la souris + oscillation lente de « feuille ».
 */
export default function TradeCard({ href, label, photo, position, tone, index }: Props) {
  const router = useRouter()
  const bandRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; max: number; moved: boolean } | null>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const suppressClick = useRef(false)

  /* ── Glisser pour ouvrir ─────────────────────────────────────────────── */
  const onKnobDown = (e: PointerEvent<HTMLSpanElement>) => {
    const band = bandRef.current
    if (!band) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const pad = parseFloat(getComputedStyle(band).paddingLeft) || 6
    drag.current = { startX: e.clientX - x, max: band.clientWidth - KNOB - pad * 2, moved: false }
    setDragging(true)
  }

  const onKnobMove = (e: PointerEvent<HTMLSpanElement>) => {
    const d = drag.current
    if (!d) return
    const next = Math.max(0, Math.min(d.max, e.clientX - d.startX))
    if (Math.abs(next) > 4) d.moved = true
    setX(next)
  }

  const onKnobUp = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return
    if (d.moved) suppressClick.current = true
    if (x >= d.max * UNLOCK_AT) {
      setX(d.max)
      setTimeout(() => router.push(href), 160)
    } else {
      setX(0)
    }
  }

  /* ── Inclinaison 3D (souris uniquement) ─────────────────────────────── */
  const onCardMove = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== 'mouse' || dragging) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    setTilt({ rx: (0.5 - py) * 7, ry: (px - 0.5) * 9 })
  }
  const onCardLeave = () => setTilt({ rx: 0, ry: 0 })

  const progress = drag.current?.max ? x / drag.current.max : 0

  return (
    <div className="home-trade-card__leaf" style={{ animationDelay: `${-index * 1.3}s` } as CSSProperties}>
      <Link
        href={href}
        className="home-trade-card"
        aria-label={`Voir les artisans : ${label}`}
        data-dragging={dragging || undefined}
        onPointerMove={onCardMove}
        onPointerLeave={onCardLeave}
        onClick={e => {
          if (suppressClick.current) {
            e.preventDefault()
            suppressClick.current = false
          }
        }}
        style={{ '--rx': `${tilt.rx}deg`, '--ry': `${tilt.ry}deg` } as CSSProperties}
      >
        <div className="home-trade-card__media">
          <img src={photo} alt="" style={{ objectPosition: position, '--tone': tone } as CSSProperties} />
          <div className="home-trade-card__shade" />
        </div>

        <div ref={bandRef} className="home-trade-card__band">
          <span
            className="home-trade-card__knob"
            aria-hidden="true"
            onPointerDown={onKnobDown}
            onPointerMove={onKnobMove}
            onPointerUp={onKnobUp}
            onPointerCancel={onKnobUp}
            style={{
              transform: `translateX(${x}px)`,
              transition: dragging ? 'none' : undefined,
            }}
          >
            <ArrowRight size={17} />
          </span>
          <span className="home-trade-card__label" style={{ opacity: 1 - Math.min(1, progress * 1.4) }}>
            {label}
          </span>
        </div>
      </Link>
    </div>
  )
}
