'use client'
import Brand from '@/components/brand/Brand'
import { useState, useEffect, useId, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Circle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { safeAuthRedirect } from '@/lib/auth-recovery'

const ORANGE = '#E85D26'
const HERO_PILL = '#1A1A1A'   // pastilles d'étapes sur le panneau orange
const ACTION = '#c2410c'      // boutons et liens : texte blanc dessus ≥ 5:1
const INK = '#1f1611'
const MUTED = '#65564b'
const FIELD_LINE = '#d6cbc1'

function authEmailUrl(path: '/auth' | '/auth/reset') {
  const origin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? window.location.origin
    : 'https://www.afrioneapp.com'
  return new URL(path, origin).href
}

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
      background: active ? ORANGE : HERO_PILL,
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

function InputGroup({
  label, placeholder, type = 'text', value, onChange, rightEl,
}: {
  label: string; placeholder: string; type?: string
  value: string; onChange: (v: string) => void; rightEl?: React.ReactNode
}) {
  const inputId = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 600, color: INK }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input className="afrione-field"
          id={inputId}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          style={{
            width: '100%', height: 48, padding: '0 44px 0 16px',
            borderRadius: 12, border: `1px solid ${FIELD_LINE}`, outline: 'none',
            background: '#fff', color: INK, fontSize: 16,
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 3px rgba(194,65,12,0.28)`; e.currentTarget.style.borderColor = ACTION }}
          onBlur={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = FIELD_LINE }}
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
  const redirectTo = safeAuthRedirect(params.get('redirect'))

  const [tab, setTab]           = useState<'login' | 'signup'>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [authError, setAuthError] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)
  const [confirmationNotice, setConfirmationNotice] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(redirectTo)
    })
  }, [])

  function showAuthError(error: unknown) {
    const message = error instanceof Error ? error.message : ''
    const code = error instanceof Error && 'code' in error ? error.code : undefined
    const translated = code === 'email_address_not_authorized'
      ? 'Le service d’envoi n’autorise pas cette adresse. Contactez le support AfriOne.'
      : code === 'over_email_send_rate_limit' || /email rate limit/i.test(message)
      ? 'La limite d’envoi d’e-mails est atteinte. Attendez avant de réessayer.'
      : message === 'Invalid login credentials'
      ? 'Email ou mot de passe incorrect.'
      : code === 'email_not_confirmed' || message === 'Email not confirmed'
      ? 'Confirmez votre adresse e-mail avant de vous connecter. Vous pouvez redemander le lien ci-dessous.'
      : /fetch|network/i.test(message)
      ? 'Le service de connexion est inaccessible. Vérifiez votre connexion et réessayez.'
      : message || 'La connexion a échoué. Réessayez.'
    setAuthError(translated)
    toast.error(translated)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      toast.success('Connexion réussie')
      router.replace(redirectTo)
    } catch (error) {
      showAuthError(error)
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordRecovery() {
    setAuthError('')
    setConfirmationNotice('')
    if (!email.trim()) {
      setAuthError('Saisissez votre adresse email avant de demander un lien de récupération.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authEmailUrl('/auth/reset'),
      })
      if (error) throw error
      setRecoverySent(true)
      toast.success('Si cette adresse correspond à un compte, un code de récupération a été envoyé. Vérifiez aussi les indésirables.', { duration: 10000 })
    } catch (error) {
      showAuthError(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setConfirmationNotice('')
    setRecoverySent(false)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: `${firstName} ${lastName}`.trim() },
          emailRedirectTo: authEmailUrl('/auth'),
        },
      })
      if (error) throw error
      if (data.session) {
        router.replace(redirectTo)
        return
      }
      setPassword('')
      setTab('login')
      setConfirmationNotice('Si cette adresse doit être confirmée, vérifiez votre boîte de réception et les indésirables. Si votre compte est déjà actif, vous pouvez vous connecter.')
    } catch (error) {
      showAuthError(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleResendConfirmation() {
    setAuthError('')
    setConfirmationNotice('')
    setRecoverySent(false)
    if (!email.trim()) {
      setAuthError('Saisissez votre adresse e-mail pour demander un lien de confirmation.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: authEmailUrl('/auth') },
      })
      if (error) throw error
      setConfirmationNotice('Demande traitée. Si cette adresse attend une confirmation, vérifiez votre boîte de réception et les indésirables.')
    } catch (error) {
      showAuthError(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      display: 'flex', minHeight: '100vh', width: '100%',
      background: '#faf8f5', padding: 8, boxSizing: 'border-box',
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    }}>

      {/* ── Left column : hero video ─────────────────────────────────── */}
      <div style={{
        display: 'none',
        position: 'relative', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-end', paddingBottom: 128, paddingLeft: 48, paddingRight: 48,
        borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 50px rgba(60,35,20,0.18)',
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
            <Brand inverse />
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
          <div className="mobile-logo afrione-gradient" style={{ alignItems: 'center', padding: '22px 22px', borderRadius: 22 }}>
            <Brand inverse />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: INK, margin: 0 }}>
              {tab === 'login' ? 'Bon retour ' : 'Créer un profil'}
            </h2>
            <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>
              {tab === 'login'
                ? 'Connectez-vous pour accéder à votre espace.'
                : 'Entrez vos informations pour commencer.'}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
            background: '#efe9e2', padding: 4, borderRadius: 14,
          }}>
            {(['login', 'signup'] as const).map(t => (
              <button className="afrione-action" key={t} onClick={() => setTab(t)} style={{
                padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
                background: tab === t ? ACTION : 'transparent',
                color: tab === t ? '#fff' : MUTED,
                boxShadow: tab === t ? '0 3px 12px rgba(194,65,12,0.28)' : 'none',
                fontFamily: 'inherit',
              }}>
                {t === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          {authError && (
            <p role="alert" style={{ color: '#b42318', fontSize: 14, fontWeight: 550, margin: 0 }}>
              {authError}
            </p>
          )}

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

            {recoverySent && (
              <div role="status" style={{ padding: 14, border: '1px solid rgba(194,65,12,0.35)', background: '#fff1e8', borderRadius: 12, color: INK, fontSize: 13, lineHeight: 1.6 }}>
                Si cette adresse correspond à un compte, un email « AfriOne — Code de récupération » a été envoyé. Vérifiez les spams et utilisez uniquement le dernier email reçu.
                <a href="/auth/reset" style={{ display: 'block', color: '#9a3412', fontWeight: 600, marginTop: 8 }}>J’ai reçu un code : le saisir ici</a>
              </div>
            )}
            {tab === 'login' && confirmationNotice && (
              <p role="status" style={{ padding: 14, border: '1px solid rgba(194,65,12,0.35)', background: '#fff1e8', borderRadius: 12, color: INK, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                {confirmationNotice}
              </p>
            )}
            <InputGroup label="Adresse email" placeholder="vous@exemple.com" type="email" value={email}
              onChange={value => { setEmail(value); setConfirmationNotice(''); setRecoverySent(false); setAuthError('') }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <InputGroup
                label="Mot de passe"
                placeholder="••••••••"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                rightEl={
                  <button className="afrione-action" type="button" onClick={() => setShowPw(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 0, display: 'flex' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              {tab === 'login' && (
                <button className="afrione-action" type="button" disabled={loading} onClick={handleResendConfirmation}
                  style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: ACTION, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Renvoyer le lien de confirmation
                </button>
              )}
              {tab === 'login' && (
                <button className="afrione-action" type="button" disabled={loading} onClick={handlePasswordRecovery}
                  style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: ACTION, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Mot de passe oublié ?
                </button>
              )}
              {tab === 'signup' && (
                <span style={{ fontSize: 12, color: MUTED, paddingLeft: 4 }}>
                  Minimum 8 caractères requis.
                </span>
              )}
            </div>

            <button className="afrione-action"
              type="submit" disabled={loading}
              style={{
                marginTop: 8, width: '100%', height: 52, borderRadius: 999, border: 'none',
                background: loading ? '#d6cbc1' : ACTION,
                color: '#fff', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 6px 18px rgba(194,65,12,0.28)',
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
          <p style={{ textAlign: 'center', fontSize: 14, color: MUTED, margin: 0 }}>
            {tab === 'login' ? (
              <>Pas encore de compte ?{' '}
                <button className="afrione-action" onClick={() => setTab('signup')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: ACTION, fontWeight: 700, fontSize: 14, padding: 0, fontFamily: 'inherit',
                }}>
                  S&apos;inscrire
                </button>
              </>
            ) : (
              <>Déjà membre ?{' '}
                <button className="afrione-action" onClick={() => setTab('login')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: ACTION, fontWeight: 700, fontSize: 14, padding: 0, fontFamily: 'inherit',
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
        input::placeholder { color: #7d6d61 !important; }
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
