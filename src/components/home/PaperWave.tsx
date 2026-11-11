'use client'

import { useEffect, useRef } from 'react'

type Props = {
  src: string
  /** Comme object-position, ex. "62% 78%". */
  position: string
  /** Décale le mouvement d'une carte à l'autre. */
  index: number
  /** Accentue la torsion (survol, appui). */
  active?: boolean
}

/* Photo qui se tord doucement comme une feuille de papier tenue par les coins.
 *
 * La carte est vue comme 4 quarts : les deux quarts d'une diagonale montent
 * ensemble pendant que ceux de l'autre diagonale descendent, puis l'inverse
 * (une selle : hauteur = x · y). Le relief se voit par un léger effet de
 * perspective, un décalage de parallaxe et une ombre/lumière sur la pente.
 *
 * Rendu en WebGL à la résolution réelle de l'écran : un pixel de la photo reste
 * un pixel à l'écran, donc net en Retina / 4K. Sans WebGL ou avec « réduire les
 * animations », la photo reste simplement fixe. */

const VERT = `
attribute vec2 p;
varying vec2 vUv;
void main() {
  vUv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uR;
uniform vec2 uO;
uniform float uTw;
void main() {
  vec2 c = vUv - 0.5;
  float h = uTw * c.x * c.y * 4.0;                       // selle : ±uTw aux coins
  vec2 uv = 0.5 + c * (1.0 - 0.024 * h) + vec2(0.9, 0.7) * 0.012 * h;
  vec3 col = texture2D(uTex, uO + uv * uR).rgb;
  vec2 g = uTw * 4.0 * vec2(c.y, c.x);                   // pente de la surface
  vec3 n = normalize(vec3(-g * 0.12, 1.0));
  vec3 L = normalize(vec3(-0.45, -0.55, 0.72));
  float s = (dot(n, L) - L.z) * 0.5;
  gl_FragColor = vec4(col * (1.0 + s), 1.0);
}`

/** Part de l'image qui reste visible : on zoome de 10 % pour garder de la marge. */
const ZOOM = 1 / 1.1
const PERIOD_MS = 6500
const BASE_TWIST = 0.9
const MAX_TEX = 2048

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'shader')
  return shader
}

export default function PaperWave({ src, position, index, active = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' })
    if (!gl) return // l'image de secours reste affichée

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const [posX, posY] = position.split(' ').map(v => parseFloat(v) / 100)

    let program: WebGLProgram
    try {
      program = gl.createProgram()!
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link')
    } catch {
      return
    }
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uR = gl.getUniformLocation(program, 'uR')
    const uO = gl.getUniformLocation(program, 'uO')
    const uTw = gl.getUniformLocation(program, 'uTw')

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const img = new Image()
    img.decoding = 'async'
    img.src = src

    let raf = 0
    let visible = true
    let ready = false
    let amp = 1

    // Photo mise à l'échelle pour que 1 pixel de texture = 1 pixel d'écran.
    const upload = () => {
      if (!img.complete || !img.naturalWidth) return
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const rect = canvas.getBoundingClientRect()
      const W = Math.max(1, Math.round(rect.width * dpr))
      const H = Math.max(1, Math.round(rect.height * dpr))
      canvas.width = W
      canvas.height = H
      gl.viewport(0, 0, W, H)

      const ia = img.naturalWidth / img.naturalHeight
      const ca = W / H
      const rx = (ia > ca ? ca / ia : 1) * ZOOM
      const ry = (ia > ca ? 1 : ia / ca) * ZOOM
      gl.uniform2f(uR, rx, ry)
      gl.uniform2f(uO, (1 - rx) * posX, (1 - ry) * posY)

      let tw = Math.round(W / rx)
      let th = Math.round(H / ry)
      const k = Math.min(1, MAX_TEX / Math.max(tw, th), img.naturalWidth / tw, img.naturalHeight / th)
      tw = Math.max(1, Math.round(tw * k))
      th = Math.max(1, Math.round(th * k))
      const buf = document.createElement('canvas')
      buf.width = tw
      buf.height = th
      const c2 = buf.getContext('2d')
      if (!c2) return
      c2.imageSmoothingEnabled = true
      c2.imageSmoothingQuality = 'high'
      c2.drawImage(img, 0, 0, tw, th)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, buf)
      ready = true
      canvas.dataset.ready = 'true'
    }

    const draw = (t: number) => {
      if (!ready) return
      amp += ((activeRef.current ? 1.7 : 1) - amp) * 0.06
      const twist = reduce ? 0 : BASE_TWIST * amp * Math.sin((t / PERIOD_MS) * Math.PI * 2 + index * 0.9)
      gl.uniform1f(uTw, twist)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const loop = (t: number) => {
      draw(t)
      if (visible && !reduce) raf = requestAnimationFrame(loop)
    }
    const start = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }

    const ro = new ResizeObserver(() => { upload(); draw(performance.now()) })
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
    const onLost = (e: Event) => { e.preventDefault(); canvas.dataset.ready = '' }
    canvas.addEventListener('webglcontextlost', onLost)

    img.onload = () => { upload(); start() }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [src, position, index])

  const [px, py] = position.split(' ')
  return (
    <>
      {/* Image de secours : visible tout de suite, et si WebGL n'est pas disponible. */}
      <img
        className="paper-wave__fallback"
        src={src}
        alt=""
        decoding="async"
        style={{ objectPosition: position, transformOrigin: `${px} ${py}` }}
      />
      <canvas ref={canvasRef} className="paper-wave" aria-hidden="true" />
    </>
  )
}
