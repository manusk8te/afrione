'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Circle, Chrome, Github, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ORANGE = '#E85D26'
const BRAND_GRAY = '#1A1A1A'

const HERO_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4'

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function StepItem({ number, text, active }: { number: number; text: string; active?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px', borderRadius: 999,
      background: active ? ORANGE : BRAND_GRAY,
      border: active ? `1px solid ${ORANGE}` : 'none',
      transition: 'all 0.3s',
    }}>
      <span style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
        background: active ? '#000' : 'rgba(255,255,255,0.1)',
        color: active ? ORANGE : 'rgba(255,255,255,0.4)',
      }}>
        {number}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 500,
        color: active ? '#fff' : 'rgba(255,255,255,0.5)',
      }}>
        {text}
      </span>
    </div>
  )
}

function SocialButton({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '11px 16px', borderRadius: 12, cursor: 'pointer',
      background: '#000', border: '1px solid rgba(255,255,255,0.1)',
      color: '#fff', fontSize: 13, fontWeight: 500,
      transition: 'background 0.2s',
      width: '100%',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={e => (e.currentTarget.style.background = '#000')}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

function InputGroup({
  label, placeholder, type = 'text', value, onChange, rightEl,
}: {
  label: string; placeholder: string; type?: string
  value: string; onChange: (v: string) => void; rightEl?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          style={{
            width: '100%', height: 44, padding: '0 44px 0 16px',
            borderRadius: 12, border: 'none', outline: 'none',
            background: BRAND_GRAY, color: '#fff', fontSize: 14,
            boxSizing: 'border-box',
          }}
          onFocus={e => (e.currentTarget.style.boxShadow = `0 0 0 2px ${ORANGE}55`)}
          onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
        />
        {rightEl && (
          <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
            {rightEl}
          </div>
        )}
      </div>
    </div>
  )
}

function AuthContent() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirect') || '/'

  const [tab, setTab]           = useState<'login' | 'signup'>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(redirectTo)
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : error.message)
    } else {
      toast.success('Connexion réussie')
      router.replace(redirectTo)
    }
    setLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: `${firstName} ${lastName}`.trim() } },
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Compte créé ! Vérifiez votre email.')
      setTab('login')
    }
    setLoading(false)
  }

  return (
    <main style={{
      display: 'flex', minHeight: '100vh', width: '100%',
      background: '#000', padding: 8, boxSizing: 'border-box',
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    }}>

      {/* ── Left column : hero video ─────────────────────────────────── */}
      <div style={{
        display: 'none',
        position: 'relative', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-end', paddingBottom: 128, paddingLeft: 48, paddingRight: 48,
        borderRadius: 24, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
        width: '52%', flexShrink: 0,
      }}
        className="lg-hero"
      >
        {/* Fond noir de base */}
        <div style={{ position: 'absolute', inset: 0, background: '#0a0704' }} />
        {/* Gradient orange animé du site */}
        <div className="afrione-gradient" style={{ position: 'absolute', inset: 0 }} />
        {/* Voile sombre pour lisibilité du texte */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(5,2,1,0.85) 0%, rgba(5,2,1,0.3) 60%, rgba(5,2,1,0.1) 100%)',
        }} />

        <motion.div
          variants={stagger} initial="hidden" animate="show"
          style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 32 }}
        >
          {/* Logo */}
          <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Circle size={20} fill={ORANGE} color={ORANGE} />
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#fff' }}>
              AfriOne
            </span>
          </motion.div>

          {/* Heading */}
          <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.03em', color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
              Rejoindre AfriOne
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, paddingLeft: 4, margin: 0 }}>
              3 étapes rapides pour activer votre espace.
            </p>
          </motion.div>

          {/* Steps */}
          <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StepItem number={1} text="Créez votre identité" active />
            <StepItem number={2} text="Configurez votre profil" />
            <StepItem number={3} text="Lancez votre première mission" />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Right column : form ─────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px', overflowY: 'auto',
      }}>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 32 }}
        >
          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="mobile-logo">
            <Circle size={18} fill={ORANGE} color={ORANGE} />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>AfriOne</span>
          </div>

          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>
              {tab === 'login' ? 'Bon retour 👋' : 'Créer un profil'}
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              {tab === 'login'
                ? 'Connectez-vous pour accéder à votre espace.'
                : 'Entrez vos informations pour commencer.'}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
            background: BRAND_GRAY, padding: 4, borderRadius: 12,
          }}>
            {(['login', 'signup'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
                background: tab === t ? ORANGE : 'transparent',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
                boxShadow: tab === t ? `0 3px 12px ${ORANGE}55` : 'none',
                fontFamily: 'inherit',
              }}>
                {t === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          {/* Social buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SocialButton icon={Chrome} label="Google" />
            <SocialButton icon={Github} label="Github" />
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{
              padding: '0 16px', fontSize: 11, fontWeight: 500,
              color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase',
              background: '#000',
            }}>
              Ou
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Form */}
          <form onSubmit={tab === 'login' ? handleLogin : handleSignup}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {tab === 'signup' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InputGroup label="Prénom" placeholder="Kouassi" value={firstName} onChange={setFirstName} />
                <InputGroup label="Nom" placeholder="Aya" value={lastName} onChange={setLastName} />
              </div>
            )}

            <InputGroup label="Adresse email" placeholder="vous@exemple.com" type="email" value={email} onChange={setEmail} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <InputGroup
                label="Mot de passe"
                placeholder="••••••••"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                rightEl={
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              {tab === 'signup' && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', paddingLeft: 4 }}>
                  Minimum 8 caractères requis.
                </span>
              )}
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                marginTop: 8, width: '100%', height: 52, borderRadius: 12, border: 'none',
                background: loading ? 'rgba(255,255,255,0.2)' : ORANGE,
                color: '#fff', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : `0 4px 20px ${ORANGE}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {tab === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            {tab === 'login' ? (
              <>Pas encore de compte ?{' '}
                <button onClick={() => setTab('signup')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: ORANGE, fontWeight: 600, fontSize: 13, padding: 0, fontFamily: 'inherit',
                }}>
                  S&apos;inscrire
                </button>
              </>
            ) : (
              <>Déjà membre ?{' '}
                <button onClick={() => setTab('login')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: ORANGE, fontWeight: 600, fontSize: 13, padding: 0, fontFamily: 'inherit',
                }}>
                  Se connecter
                </button>
              </>
            )}
          </p>
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
        .lg-hero { display: none; }
        .mobile-logo { display: flex; }
        @media (min-width: 1024px) {
          .lg-hero { display: flex !important; }
          .mobile-logo { display: none !important; }
          main { padding: 16px !important; height: 100vh; overflow: hidden; }
        }
      `}</style>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  )
}
