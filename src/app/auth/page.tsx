'use client'
export const dynamic = 'force-dynamic'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Zap, ArrowRight, ArrowLeft, Shield, Eye, EyeOff,
  CheckCircle, MapPin, User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

/* ─── Video ───────────────────────────────────────────────────────────────── */
const AUTH_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4'

/* ─── Data ────────────────────────────────────────────────────────────────── */
type Step =
  | 'choice' | 'login' | 'register' | 'verify' | 'forgot' | 'forgot_sent'
  | 'artisan_phone' | 'artisan_profile' | 'artisan_metier' | 'artisan_done'

const METIERS = [
  { id: 'Plomberie',     label: 'Plomberie',     icon: '🔧' },
  { id: 'Électricité',   label: 'Électricité',   icon: '⚡' },
  { id: 'Maçonnerie',    label: 'Maçonnerie',    icon: '🏗️' },
  { id: 'Peinture',      label: 'Peinture',      icon: '🎨' },
  { id: 'Menuiserie',    label: 'Menuiserie',    icon: '🪵' },
  { id: 'Climatisation', label: 'Climatisation', icon: '❄️' },
  { id: 'Serrurerie',    label: 'Serrurerie',    icon: '🔑' },
  { id: 'Carrelage',     label: 'Carrelage',     icon: '🪟' },
]
const QUARTIERS = ['Cocody','Plateau','Marcory','Treichville','Yopougon','Adjamé','Abobo','Port-Bouët','Koumassi']

/* ─── Design tokens ───────────────────────────────────────────────────────── */
const BG   = '#060604'
const SURF = '#141412'
const T2   = 'rgba(255,255,255,0.55)'
const T3   = 'rgba(255,255,255,0.32)'
const BO   = 'rgba(255,255,255,0.09)'
const syne = { fontFamily: "'Syne', sans-serif" }        as const
const body = { fontFamily: "'Bricolage Grotesque', sans-serif" } as const
const mono = { fontFamily: "'Space Mono', monospace" }   as const

/* ─── Motion variants ─────────────────────────────────────────────────────── */
const leftContainer = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
}
const leftChild = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5 } },
}
const rightFade = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.8, ease: 'easeOut' } },
}

/* ─── StepItem ────────────────────────────────────────────────────────────── */
function StepItem({ number, text, active }: { number: number; text: string; active?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 14px', borderRadius: '12px',
      background: active ? 'white' : '#1A1A1A',
      border:     active ? '1px solid white' : 'none',
    }}>
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: 700, ...mono,
        background: active ? BG : 'rgba(255,255,255,0.1)',
        color:      active ? 'white' : 'rgba(255,255,255,0.4)',
      }}>
        {number}
      </div>
      <span style={{ fontSize: '14px', fontWeight: 600, ...syne, color: active ? '#0F1410' : 'white' }}>
        {text}
      </span>
    </div>
  )
}

/* ─── DarkInput ───────────────────────────────────────────────────────────── */
function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement> & { extraStyle?: React.CSSProperties }) {
  const [focused, setFocused] = useState(false)
  const { extraStyle, ...rest } = props
  return (
    <input
      {...rest}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        width: '100%', background: SURF,
        border: `1px solid ${focused ? '#E85D26' : BO}`,
        borderRadius: '12px', padding: '12px 14px',
        fontSize: '15px', ...body, color: 'white', outline: 'none',
        transition: 'border-color 0.15s',
        ...extraStyle,
      }}
    />
  )
}

/* ─── DarkSelect ──────────────────────────────────────────────────────────── */
function DarkSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false)
  return (
    <select
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        width: '100%', background: SURF,
        border: `1px solid ${focused ? '#E85D26' : BO}`,
        borderRadius: '12px', padding: '12px 14px',
        fontSize: '15px', ...body, color: 'white', outline: 'none',
        transition: 'border-color 0.15s', appearance: 'none',
      }}
    />
  )
}

/* ─── DarkTextarea ────────────────────────────────────────────────────────── */
function DarkTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        width: '100%', background: SURF,
        border: `1px solid ${focused ? '#E85D26' : BO}`,
        borderRadius: '12px', padding: '12px 14px',
        fontSize: '15px', ...body, color: 'white', outline: 'none',
        transition: 'border-color 0.15s', resize: 'none', minHeight: '80px',
      }}
    />
  )
}

/* ─── FieldLabel ──────────────────────────────────────────────────────────── */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ ...mono, fontSize: '10px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
      {children}
    </label>
  )
}

/* ─── PrimaryBtn ──────────────────────────────────────────────────────────── */
function PrimaryBtn({ children, loading, disabled, onClick, type = 'button' }: {
  children: React.ReactNode; loading?: boolean; disabled?: boolean;
  onClick?: () => void; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type} disabled={disabled || loading} onClick={onClick}
      className="afrione-gradient"
      style={{
        width: '100%', padding: '14px', borderRadius: '12px',
        opacity: disabled || loading ? 0.45 : 1,
        color: 'white', border: 'none', cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontSize: '15px', fontWeight: 700, ...syne,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        transition: 'opacity 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => { if (!disabled && !loading) (e.currentTarget as HTMLElement).style.opacity = '0.88' }}
      onMouseLeave={e => { if (!disabled && !loading) (e.currentTarget as HTMLElement).style.opacity = '1' }}
    >
      {loading
        ? <><Spinner />Chargement...</>
        : children
      }
    </button>
  )
}

/* ─── GhostBtn ────────────────────────────────────────────────────────────── */
function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        width: '100%', padding: '14px', borderRadius: '12px',
        background: 'transparent', color: 'white',
        border: `1px solid ${BO}`, cursor: 'pointer',
        fontSize: '15px', fontWeight: 600, ...syne,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      {children}
    </button>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
  )
}

/* ─── ErrorBox ────────────────────────────────────────────────────────────── */
function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ background: 'rgba(232,93,38,0.12)', border: '1px solid rgba(232,93,38,0.25)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#FF8A65', ...body }}>
      {msg}
    </div>
  )
}

/* ─── Back button ─────────────────────────────────────────────────────────── */
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} type="button"
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: T2, marginBottom: '24px', padding: 0, ...body, transition: 'color 0.15s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T2}>
      <ArrowLeft size={15} /> Retour
    </button>
  )
}

/* ─── Page inner ──────────────────────────────────────────────────────────── */
function AuthPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect') || null

  const [step,       setStep]     = useState<Step>('choice')
  const [email,      setEmail]    = useState('')
  const [password,   setPassword] = useState('')
  const [name,       setName]     = useState('')
  const [role,       setRole]     = useState<'client' | 'artisan'>('client')
  const [showPass,   setShowPass] = useState(false)
  const [loading,    setLoading]  = useState(false)
  const [error,      setError]    = useState('')

  const [artisanStep, setArtisanStep] = useState(0)
  const [artisan, setArtisan] = useState({ phone: '', quartier: '', exp: '', tarif: '', bio: '', metier: '' })
  const updateArtisan = (k: string, v: string) => setArtisan(a => ({ ...a, [k]: v }))

  /* ── Login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou mot de passe incorrect'); setLoading(false); return }
    const { data: userData } = await supabase.from('users').select('role').eq('id', data.user.id).single()
    const userRole = userData?.role ?? data.user.user_metadata?.role ?? 'client'
    const { data: artisanProfile } = await supabase.from('artisan_pros').select('id').eq('user_id', data.user.id).single()
    if (redirectTo)         router.push(redirectTo)
    else if (artisanProfile) router.push('/artisan-space/dashboard')
    else if (userRole === 'admin')   router.push('/admin')
    else if (userRole === 'artisan') router.push('/artisan-space/register')
    else router.push('/dashboard')
  }

  /* ── Register ── */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role } } })
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    if (data.session) {
      if (role === 'artisan') { setArtisanStep(0); setStep('artisan_phone') }
      else { if (redirectTo) router.push(redirectTo); else router.push('/dashboard') }
    } else { setStep('verify') }
  }

  /* ── Finish artisan ── */
  const finishArtisan = async () => {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      await supabase.from('users').upsert({ id: session.user.id, name: name || session.user.user_metadata?.name || '', email: session.user.email || '', quartier: artisan.quartier, phone: artisan.phone || null, role: 'artisan' }, { onConflict: 'id' })
      const { data: artisanData, error: artisanErr } = await supabase.from('artisan_pros').insert({ user_id: session.user.id, metier: artisan.metier, bio: artisan.bio || '', years_experience: parseInt(artisan.exp) || 0, tarif_min: parseInt(artisan.tarif) || 0, quartiers: [artisan.quartier], kyc_status: 'pending', is_available: false, rating_avg: 0, rating_count: 0, mission_count: 0, success_rate: 0, response_time_min: 30 }).select().single()
      if (artisanErr) throw artisanErr
      await supabase.from('wallets').insert({ artisan_id: artisanData.id, balance_available: 0, balance_escrow: 0, total_earned: 0, total_withdrawn: 0 })
      setStep('artisan_done')
    } catch (err: any) { setError(err.message || 'Erreur lors de la création du profil') }
    setLoading(false)
  }

  const isArtisanFlow = step.startsWith('artisan')

  /* ── Left panel steps ── */
  const leftSteps = isArtisanFlow
    ? [
        { text: 'Téléphone Wave',  active: step === 'artisan_phone' },
        { text: 'Votre profil',    active: step === 'artisan_profile' },
        { text: 'Votre métier',    active: step === 'artisan_metier' || step === 'artisan_done' },
      ]
    : [
        { text: 'Votre identité',   active: true  },
        { text: 'Vos services',     active: false },
        { text: 'Première mission', active: false },
      ]

  /* ─────────────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: BG, color: 'white' }}>

      {/* ━━━━ LEFT — video + hero ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="hidden lg:flex"
        style={{ width: '52%', position: 'sticky', top: 0, height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '120px', paddingLeft: '48px', paddingRight: '48px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>

        {/* Video — no overlay */}
        <video
          src={AUTH_VIDEO}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
          autoPlay muted loop playsInline
        />

        {/* Content */}
        <motion.div
          variants={leftContainer} initial="hidden" animate="show"
          style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Logo */}
          <motion.div variants={leftChild} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="afrione-gradient" style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="white" />
            </div>
            <span style={{ ...syne, fontWeight: 700, fontSize: '18px', color: 'white', letterSpacing: '-0.02em' }}>
              AFRI<span className="afrione-gradient-text">ONE</span>
            </span>
          </motion.div>

          {/* Heading */}
          <motion.div variants={leftChild}>
            <h1 style={{ ...syne, fontWeight: 500, fontSize: '36px', letterSpacing: '-0.03em', color: 'white', lineHeight: 1.1, marginBottom: '10px', whiteSpace: 'nowrap' }}>
              {isArtisanFlow ? 'Espace artisan' : 'Rejoignez AfriOne'}
            </h1>
            <p style={{ ...body, fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, paddingLeft: '4px' }}>
              {isArtisanFlow
                ? 'Complétez votre profil pour accéder à vos premières missions.'
                : 'Artisans vérifiés KYC, paiement Wave sécurisé, à Abidjan.'
              }
            </p>
          </motion.div>

          {/* Steps */}
          <motion.div variants={leftChild} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leftSteps.map((s, i) => (
              <StepItem key={i} number={i + 1} text={s.text} active={s.active} />
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ━━━━ RIGHT — form ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', overflowY: 'auto' }}
        className="sm:px-12 lg:px-16 xl:px-24">

        <motion.div variants={rightFade} initial="hidden" animate="show"
          style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Mobile logo */}
          <Link href="/" className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '8px' }}>
            <div className="afrione-gradient" style={{ width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} color="white" />
            </div>
            <span style={{ ...syne, fontWeight: 700, fontSize: '16px', color: 'white' }}>AFRI<span className="afrione-gradient-text">ONE</span></span>
          </Link>

          {/* ── CHOICE ── */}
          {step === 'choice' && (<>
            <div>
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '28px', letterSpacing: '-0.02em', color: 'white', marginBottom: '6px' }}>Bienvenue</h2>
              <p style={{ ...body, fontSize: '13px', color: T2 }}>Connectez-vous ou créez votre compte AfriOne</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <PrimaryBtn onClick={() => setStep('login')}>
                Se connecter <ArrowRight size={15} />
              </PrimaryBtn>
              <GhostBtn onClick={() => setStep('register')}>
                Créer un compte <ArrowRight size={15} />
              </GhostBtn>
            </div>
            <p style={{ ...body, fontSize: '12px', color: T3, textAlign: 'center' }}>
              Vous êtes artisan ?{' '}
              <button onClick={() => { setRole('artisan'); setStep('register') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E85D26', fontWeight: 600, ...body, fontSize: '12px' }}>
                Inscrivez-vous ici
              </button>
            </p>
          </>)}

          {/* ── LOGIN ── */}
          {step === 'login' && (<>
            <div>
              <BackBtn onClick={() => setStep('choice')} />
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '28px', letterSpacing: '-0.02em', color: 'white', marginBottom: '6px' }}>Connexion</h2>
              <p style={{ ...body, fontSize: '13px', color: T2 }}>Accédez à votre espace AfriOne</p>
            </div>
            <ErrorBox msg={error} />
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <FieldLabel>Email</FieldLabel>
                <DarkInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" required />
              </div>
              <div>
                <FieldLabel>Mot de passe</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <DarkInput type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe" extraStyle={{ paddingRight: '44px' }} required />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T2 }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <PrimaryBtn type="submit" loading={loading}>
                Se connecter <ArrowRight size={15} />
              </PrimaryBtn>
            </form>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setStep('forgot')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', ...body, fontSize: '13px', color: T2, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'white'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T2}>
                Mot de passe oublié ?
              </button>
              <p style={{ ...body, fontSize: '13px', color: T2 }}>
                Pas de compte ?{' '}
                <button onClick={() => setStep('register')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E85D26', fontWeight: 600, ...body, fontSize: '13px' }}>
                  S'inscrire
                </button>
              </p>
            </div>
          </>)}

          {/* ── FORGOT ── */}
          {step === 'forgot' && (<>
            <div>
              <BackBtn onClick={() => setStep('login')} />
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '28px', letterSpacing: '-0.02em', color: 'white', marginBottom: '6px' }}>Mot de passe oublié</h2>
              <p style={{ ...body, fontSize: '13px', color: T2 }}>Entrez votre email — nous vous envoyons un lien.</p>
            </div>
            <ErrorBox msg={error} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <DarkInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" required />
              <PrimaryBtn loading={loading} onClick={async () => {
                if (!email.trim()) { setError('Entrez votre email'); return }
                setLoading(true); setError('')
                const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` })
                setLoading(false)
                if (e) setError(e.message); else setStep('forgot_sent')
              }}>
                Envoyer le lien <ArrowRight size={15} />
              </PrimaryBtn>
            </div>
          </>)}

          {/* ── FORGOT SENT ── */}
          {step === 'forgot_sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(43,107,62,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={36} color="#2B6B3E" />
              </div>
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '26px', color: 'white', marginBottom: '10px' }}>Email envoyé !</h2>
              <p style={{ ...body, fontSize: '13px', color: T2, marginBottom: '6px' }}>Un lien de réinitialisation a été envoyé à</p>
              <p style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white', marginBottom: '28px' }}>{email}</p>
              <GhostBtn onClick={() => setStep('login')}>Retour à la connexion</GhostBtn>
            </div>
          )}

          {/* ── REGISTER ── */}
          {step === 'register' && (<>
            <div>
              <BackBtn onClick={() => setStep('choice')} />
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '28px', letterSpacing: '-0.02em', color: 'white', marginBottom: '6px' }}>Créer un compte</h2>
              <p style={{ ...body, fontSize: '13px', color: T2 }}>Rejoignez AfriOne gratuitement</p>
            </div>
            <ErrorBox msg={error} />
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <FieldLabel>Nom complet</FieldLabel>
                <DarkInput type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Aya Konaté" required />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <DarkInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" required />
              </div>
              <div>
                <FieldLabel>Mot de passe</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <DarkInput type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 caractères" extraStyle={{ paddingRight: '44px' }} required minLength={6} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T2 }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel>Vous êtes</FieldLabel>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { id: 'client',  icon: '🏠', label: 'Client', sub: 'Je cherche un artisan' },
                    { id: 'artisan', icon: '🔧', label: 'Artisan', sub: 'Je propose mes services' },
                  ].map(r => (
                    <button key={r.id} type="button" onClick={() => setRole(r.id as any)}
                      style={{
                        flex: 1, padding: '14px 10px', borderRadius: '12px',
                        border: role === r.id ? '1.5px solid #E85D26' : `1.5px solid ${BO}`,
                        background: role === r.id ? 'rgba(232,93,38,0.08)' : SURF,
                        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                        transition: 'all 0.15s',
                      }}>
                      <span style={{ fontSize: '22px' }}>{r.icon}</span>
                      <span style={{ ...syne, fontSize: '12px', fontWeight: 700, color: role === r.id ? '#E85D26' : 'white' }}>{r.label}</span>
                      <span style={{ ...body, fontSize: '11px', color: T2 }}>{r.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              {role === 'artisan' && (
                <div style={{ background: 'rgba(232,93,38,0.07)', border: '1px solid rgba(232,93,38,0.18)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#FF8A65', ...body, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <Zap size={13} style={{ flexShrink: 0, marginTop: '1px', color: '#E85D26' }} />
                  Après création, vous complèterez votre profil artisan en 2 minutes.
                </div>
              )}
              <PrimaryBtn type="submit" loading={loading}>
                Créer mon compte <ArrowRight size={15} />
              </PrimaryBtn>
            </form>
            <p style={{ ...body, fontSize: '13px', color: T2, textAlign: 'center' }}>
              Déjà un compte ?{' '}
              <button onClick={() => setStep('login')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E85D26', fontWeight: 600, ...body, fontSize: '13px' }}>
                Se connecter
              </button>
            </p>
          </>)}

          {/* ── VERIFY ── */}
          {step === 'verify' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(43,107,62,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={36} color="#2B6B3E" />
              </div>
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '26px', color: 'white', marginBottom: '10px' }}>Vérifiez votre email</h2>
              <p style={{ ...body, fontSize: '13px', color: T2, marginBottom: '6px' }}>Un lien de confirmation a été envoyé à</p>
              <p style={{ ...syne, fontWeight: 700, fontSize: '14px', color: 'white', marginBottom: '20px' }}>{email}</p>
              {role === 'artisan' && (
                <div style={{ background: 'rgba(232,93,38,0.07)', border: '1px solid rgba(232,93,38,0.18)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#FF8A65', ...body, textAlign: 'left', marginBottom: '20px' }}>
                  <strong>Artisan :</strong> après confirmation, connectez-vous ici pour compléter votre profil.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <GhostBtn onClick={() => setStep('login')}>Retour à la connexion</GhostBtn>
                <button
                  onClick={async () => { setLoading(true); await supabase.auth.resend({ type: 'signup', email }); setLoading(false) }}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', ...body, fontSize: '12px', color: T3 }}>
                  Renvoyer le lien de confirmation
                </button>
              </div>
            </div>
          )}

          {/* ══ ARTISAN ONBOARDING ══════════════════════════════════════════ */}

          {/* Progress bar */}
          {(step === 'artisan_phone' || step === 'artisan_profile' || step === 'artisan_metier') && (
            <div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ height: '2px', flex: 1, borderRadius: '2px', background: i <= artisanStep ? '#E85D26' : BO, transition: 'background 0.3s' }} />
                ))}
              </div>
              <p style={{ ...mono, fontSize: '10px', color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Étape {artisanStep + 1} / 3
              </p>
            </div>
          )}

          <ErrorBox msg={(step === 'artisan_phone' || step === 'artisan_profile' || step === 'artisan_metier') ? error : ''} />

          {/* ── Artisan Step 0 : Téléphone ── */}
          {step === 'artisan_phone' && (<>
            <div>
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '26px', color: 'white', marginBottom: '6px' }}>Votre numéro Wave</h2>
              <p style={{ ...body, fontSize: '13px', color: T2 }}>Pour recevoir vos paiements directement</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: SURF, border: `1px solid ${BO}`, borderRadius: '12px', padding: '12px 14px', ...mono, fontSize: '13px', color: 'white', flexShrink: 0 }}>
                🇨🇮 +225
              </div>
              <DarkInput type="tel" value={artisan.phone} onChange={e => updateArtisan('phone', e.target.value)} placeholder="07 00 00 00 00" />
            </div>
            <PrimaryBtn disabled={artisan.phone.length < 8} onClick={() => { setArtisanStep(1); setStep('artisan_profile') }}>
              Continuer <ArrowRight size={15} />
            </PrimaryBtn>
            <p style={{ ...body, fontSize: '11px', color: T3, textAlign: 'center' }}>
              En continuant, vous acceptez nos{' '}
              <Link href="/aide" style={{ color: '#E85D26', textDecoration: 'none' }}>CGU</Link>
            </p>
          </>)}

          {/* ── Artisan Step 1 : Profil ── */}
          {step === 'artisan_profile' && (<>
            <div>
              <BackBtn onClick={() => { setArtisanStep(0); setStep('artisan_phone') }} />
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '26px', color: 'white', marginBottom: '6px' }}>Votre profil</h2>
              <p style={{ ...body, fontSize: '13px', color: T2 }}>Ces informations seront visibles par les clients</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <FieldLabel>Nom complet</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: T3 }} />
                  <DarkInput type="text" value={name} readOnly extraStyle={{ paddingLeft: '40px', opacity: 0.6 }} />
                </div>
              </div>
              <div>
                <FieldLabel>Quartier principal</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <MapPin size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: T3, zIndex: 1 }} />
                  <DarkSelect value={artisan.quartier} onChange={e => updateArtisan('quartier', e.target.value)}
                    style={{ paddingLeft: '40px' }}>
                    <option value="" style={{ background: SURF }}>Choisir un quartier</option>
                    {QUARTIERS.map(q => <option key={q} value={q} style={{ background: SURF }}>{q}</option>)}
                  </DarkSelect>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <FieldLabel>Années d'exp.</FieldLabel>
                  <DarkInput type="number" value={artisan.exp} onChange={e => updateArtisan('exp', e.target.value)} placeholder="Ex : 5" />
                </div>
                <div>
                  <FieldLabel>Tarif min (FCFA)</FieldLabel>
                  <DarkInput type="number" value={artisan.tarif} onChange={e => updateArtisan('tarif', e.target.value)} placeholder="Ex : 8000" />
                </div>
              </div>
              <div>
                <FieldLabel>Bio courte</FieldLabel>
                <DarkTextarea value={artisan.bio} onChange={e => updateArtisan('bio', e.target.value)} placeholder="Décrivez votre expertise en quelques mots..." />
              </div>
              <PrimaryBtn disabled={!artisan.quartier} onClick={() => { setArtisanStep(2); setStep('artisan_metier') }}>
                Continuer <ArrowRight size={15} />
              </PrimaryBtn>
            </div>
          </>)}

          {/* ── Artisan Step 2 : Métier ── */}
          {step === 'artisan_metier' && (<>
            <div>
              <BackBtn onClick={() => { setArtisanStep(1); setStep('artisan_profile') }} />
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '26px', color: 'white', marginBottom: '6px' }}>Votre métier</h2>
              <p style={{ ...body, fontSize: '13px', color: T2 }}>Choisissez votre domaine principal</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {METIERS.map(m => (
                <button key={m.id} type="button" onClick={() => updateArtisan('metier', m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '14px',
                    borderRadius: '12px', border: artisan.metier === m.id ? '1.5px solid #E85D26' : `1.5px solid ${BO}`,
                    background: artisan.metier === m.id ? 'rgba(232,93,38,0.08)' : SURF,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: '22px' }}>{m.icon}</span>
                  <span style={{ ...syne, fontSize: '13px', fontWeight: 600, color: artisan.metier === m.id ? '#E85D26' : 'white' }}>{m.label}</span>
                  {artisan.metier === m.id && <CheckCircle size={13} style={{ color: '#E85D26', marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
            <PrimaryBtn disabled={!artisan.metier} loading={loading} onClick={finishArtisan}>
              <CheckCircle size={15} /> Finaliser mon inscription
            </PrimaryBtn>
          </>)}

          {/* ── Artisan Done ── */}
          {step === 'artisan_done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(43,107,62,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={36} color="#2B6B3E" />
              </div>
              <h2 style={{ ...syne, fontWeight: 500, fontSize: '26px', color: 'white', marginBottom: '8px' }}>Compte créé !</h2>
              <p style={{ ...body, fontSize: '13px', color: T2, marginBottom: '6px' }}>Bienvenue sur AfriOne, <strong style={{ color: 'white' }}>{name}</strong>.</p>
              <p style={{ ...body, fontSize: '13px', color: T2, marginBottom: '28px' }}>Il reste à vérifier votre identité pour activer votre profil.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <PrimaryBtn onClick={() => router.push('/artisan-space/kyc')}>
                  <Zap size={15} /> Envoyer mes documents KYC
                </PrimaryBtn>
                <GhostBtn onClick={() => router.push('/artisan-space/dashboard')}>
                  Accéder à mon espace →
                </GhostBtn>
              </div>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthPageInner />
    </Suspense>
  )
}
