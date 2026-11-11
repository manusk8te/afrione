'use client'

import { useEffect, useRef } from 'react'

type Props = {
  src: string
  /** Comme object-position, ex. "62% 78%". */
  position: string
  /** Filtre CSS de teinte appliqué à la photo (sans flou). */
  tone?: string
  /** Index de la carte, pour décaler la vague d'une carte à l'autre. */
  index: number
  /** Accentue l'ondulation (survol, appui). */
  active?: boolean
}

/**
 * Photo qui ondule comme une feuille de papier.
 *
 * Dessinée dans un canvas à la résolution réelle de l'écran (devicePixelRatio),
 * donc nette sur iPhone. La photo est découpée en fines colonnes ; chaque
 * colonne monte, descend et s'étire légèrement selon une vague qui traverse
 * la carte, avec une ombre et une lumière qui suivent la pente.
 * Animée seulement quand la carte est visible ; figée si l'utilisateur
 * demande moins d'animations.
 */
export default function PaperWave({ src, position, tone, index, active = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const img = new Image()
    img.decoding = 'async'
    img.src = src

    const [posX, posY] = position.split(' ').map(v => parseFloat(v) / 100)
    let raf = 0
    let visible = true
    let amp = 1 // multiplicateur lissé (1 au repos, 1.8 actif)
    let W = 0, H = 0, dpr = 1

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 3)
      W = Math.round(r.width * dpr)
      H = Math.round(r.height * dpr)
      canvas.width = W
      canvas.height = H
    }

    // Photo recadrée (cover) et teintée une seule fois, à la taille du canvas.
    let src2: HTMLCanvasElement | null = null
    let ox = 0, oy = 0
    const prepare = () => {
      if (!img.complete || !img.naturalWidth || !W) return
      const iw = img.naturalWidth, ih = img.naturalHeight
      const margin = 1.14 // marge pour que la vague ne découvre jamais les bords
      const scale = Math.max(W / iw, H / ih) * margin
      const dw = Math.round(iw * scale), dh = Math.round(ih * scale)
      ox = (W - dw) * posX
      oy = (H - dh) * posY
      src2 = document.createElement('canvas')
      src2.width = dw
      src2.height = dh
      const c2 = src2.getContext('2d')
      if (!c2) return
      c2.imageSmoothingQuality = 'high'
      if (tone) c2.filter = tone
      c2.drawImage(img, 0, 0, dw, dh)
    }

    const draw = (t: number) => {
      if (!src2 || !W) return
      const dh = src2.height

      const target = activeRef.current ? 1.7 : 1
      amp += (target - amp) * 0.08

      const light = 0.075 * amp            // ombre / lumière
      const k = (Math.PI * 2 * 0.85) / W   // ~0.85 vague sur la largeur
      const w = t * 0.0034 + index * 0.9   // vitesse + décalage par carte
      const step = Math.max(2, Math.round(dpr)) // colonnes de ~1px CSS
      const left = Math.round(ox)
      const top = Math.round(oy)
      // Amplitude limitée à la marge disponible en haut et en bas : la photo ne
      // découvre jamais le fond de la carte.
      const slack = Math.max(0, Math.min(-top, dh + top - H))
      const A = Math.min(3.4 * dpr * amp, slack)

      // Chaque colonne est recopiée telle quelle (1 pixel source = 1 pixel écran),
      // seulement décalée verticalement de façon entière : aucun rééchantillonnage,
      // donc aucune perte de netteté.
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, W, H)
      for (let x = 0; x < W; x += step) {
        const y = top + Math.round(A * Math.sin(x * k - w))
        ctx.drawImage(src2, x - left, 0, step, dh, x, y, step, dh)
      }
      for (let x = 0; x < W; x += step) {
        const a = light * Math.cos(x * k - w)
        ctx.fillStyle = a > 0 ? `rgba(255,255,255,${a.toFixed(3)})` : `rgba(10,14,20,${(-a).toFixed(3)})`
        ctx.fillRect(x, 0, step, H)
      }
    }

    const loop = (t: number) => {
      draw(t)
      if (visible && !reduce) raf = requestAnimationFrame(loop)
    }
    const start = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }

    const ro = new ResizeObserver(() => { resize(); prepare(); draw(performance.now()) })
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && document.visibilityState === 'visible'
      if (visible) start()
    }, { rootMargin: '80px' })
    io.observe(canvas)
    const onVis = () => {
      visible = document.visibilityState === 'visible'
      if (visible) start()
    }
    document.addEventListener('visibilitychange', onVis)

    img.onload = () => { resize(); prepare(); start() }
    resize()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [src, position, tone, index])

  return <canvas ref={canvasRef} className="paper-wave" aria-hidden="true" />
}
