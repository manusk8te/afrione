'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

const syne = { fontFamily: "'Syne', sans-serif" }
const BALL_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4'

export default function Bientot() {
  const [visible, setVisible] = useState(false)
  const [dots, setDots]       = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120)
    timerRef.current = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 600)
    return () => {
      clearTimeout(t)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0a0704' }}>

      {/* ── Vidéo boule AfriOne — fond plein écran ──────────────────── */}
      <video
        autoPlay muted loop playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '120%', top: '-20%', objectFit: 'cover', objectPosition: 'center center', opacity: 0.9 }}
      >
        <source src={BALL_VIDEO} type="video/mp4" />
      </video>

      {/* ── Fallback image ───────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: -1 }}>
        <Image src="/services-hero.jpg" alt="" fill style={{ objectFit: 'cover' }} />
      </div>

      {/* ── Gradient AfriOne animé par-dessus ───────────────────────── */}
      <div
        className="afrione-gradient"
        style={{ position: 'absolute', inset: 0, opacity: 0.35, mixBlendMode: 'color' }}
      />

      {/* ── Voile sombre bas → haut ──────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(8,4,2,0.95) 0%, rgba(8,4,2,0.5) 40%, rgba(8,4,2,0.1) 100%)',
      }} />

      {/* ── Grain texture ───────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        backgroundSize: '180px',
      }} />

      {/* ── Contenu ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingBottom: '0',
        paddingLeft: '24px', paddingRight: '24px',
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transition: 'opacity 1.1s cubic-bezier(.16,1,.3,1), transform 1.1s cubic-bezier(.16,1,.3,1)',
      }}>

        {/* Headline */}
        <h1 style={{
          ...syne,
          fontSize: 'clamp(56px, 13vw, 130px)',
          fontWeight: 800,
          lineHeight: 0.9,
          letterSpacing: '-0.04em',
          color: 'white',
          margin: '0 0 16px',
          textShadow: '0 4px 40px rgba(0,0,0,0.4)',
        }}>
          AfriOne
        </h1>

        <h2 style={{
          ...syne,
          fontSize: 'clamp(42px, 10vw, 100px)',
          fontWeight: 700,
          lineHeight: 0.9,
          letterSpacing: '-0.04em',
          color: '#E85D26',
          margin: '0 0 32px',
          textShadow: '0 4px 40px rgba(232,93,38,0.35)',
        }}>
          Arrive{dots}
        </h2>

        <p style={{
          fontSize: 'clamp(14px, 2.2vw, 18px)',
          color: 'rgba(255,255,255,0.65)',
          maxWidth: '42ch',
          lineHeight: 1.65,
          margin: '0 0 8px',
          fontWeight: 400,
        }}>
          Plateforme de mise en relation entre clients et artisans vérifiés à Abidjan. Nos agents IA propriétaires assistent les prestataires sur le pricing, la rédaction des devis et la gestion des missions.
        </p>
        <p style={{
          ...syne,
          fontSize: '12px',
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          Abidjan · Côte d&apos;Ivoire
        </p>

      </div>

<style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
