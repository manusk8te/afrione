'use client'

import { useRef, useState, type PointerEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import PaperWave from './PaperWave'

type Props = {
  href: string
  label: string
  photo: string
  position: string
  /** Décale la vague d'une carte à l'autre. */
  index: number
}

const KNOB = 36          // diamètre du bouton flèche (px)
const UNLOCK_AT = 0.72   // part de la piste à parcourir pour valider le glisser

/**
 * Carte métier de l'accueil.
 * - La photo se tord doucement comme une feuille (WebGL, net en Retina / 4K).
 *   L'ondulation s'accentue au survol ou à l'appui.
 * - Glisser la flèche de gauche à droite ouvre la liste des artisans,
 *   comme « déverrouiller » un iPhone. Un tap ou Entrée marche aussi.
 * - Aucune transformation 3D sur la carte : texte et flèche restent nets.
 */
export default function TradeCard({ href, label, photo, position, index }: Props) {
  const router = useRouter()
  const bandRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; max: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [x, setX] = useState(0)
  const [max, setMax] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [active, setActive] = useState(false)

  const onKnobDown = (e: PointerEvent<HTMLSpanElement>) => {
    const band = bandRef.current
    if (!band) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const pad = parseFloat(getComputedStyle(band).paddingLeft) || 6
    const m = band.clientWidth - KNOB - pad * 2
    drag.current = { startX: e.clientX - x, max: m, moved: false }
    setMax(m)
    setDragging(true)
    setActive(true)
  }

  const onKnobMove = (e: PointerEvent<HTMLSpanElement>) => {
    const d = drag.current
    if (!d) return
    const next = Math.max(0, Math.min(d.max, e.clientX - d.startX))
    if (next > 4) d.moved = true
    setX(next)
  }

  const onKnobUp = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    setActive(false)
    if (!d) return
    if (d.moved) suppressClick.current = true
    if (x >= d.max * UNLOCK_AT) {
      setX(d.max)
      setTimeout(() => router.push(href), 160)
    } else {
      setX(0)
    }
  }

  const progress = Math.min(1, x / max)

  return (
    <Link
      href={href}
      className="home-trade-card"
      aria-label={`Voir les artisans : ${label}`}
      data-dragging={dragging || undefined}
      onPointerEnter={e => e.pointerType === 'mouse' && setActive(true)}
      onPointerLeave={() => !dragging && setActive(false)}
      onPointerDown={e => e.pointerType !== 'mouse' && setActive(true)}
      onPointerUp={e => e.pointerType !== 'mouse' && setActive(false)}
      onPointerCancel={() => setActive(false)}
      onClick={e => {
        if (suppressClick.current) {
          e.preventDefault()
          suppressClick.current = false
        }
      }}
    >
      <div className="home-trade-card__media">
        <PaperWave src={photo} position={position} index={index} active={active} />
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
          style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : undefined }}
        >
          <ArrowRight size={17} />
        </span>
        <span className="home-trade-card__label" style={{ opacity: 1 - Math.min(1, progress * 1.4) }}>
          {label}
        </span>
      </div>
    </Link>
  )
}
