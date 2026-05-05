'use client'
export const dynamic = 'force-dynamic'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Zap, ArrowRight, ArrowLeft, Shield, Eye, EyeOff, CheckCircle, MapPin, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Step =
  | 'choice' | 'login' | 'register' | 'verify' | 'forgot' | 'forgot_sent'
  | 'artisan_phone' | 'artisan_profile' | 'artisan_metier' | 'artisan_done'

const METIERS = [
  { id: 'Plomberie',    label: 'Plomberie',    icon: '🔧' },
  { id: 'Électricité',  label: 'Électricité',  icon: '⚡' },
  { id: 'Maçonnerie',   label: 'Maçonnerie',   icon: '🏗️' },
  { id: 'Peinture',     label: 'Peinture',     icon: '🎨' },
  { id: 'Menuiserie',   label: 'Menuiserie',   icon: '🪵' },
  { id: 'Climatisation',label: 'Climatisation',icon: '❄️' },
  { id: 'Serrurerie',   label: 'Serrurerie',   icon: '🔑' },
  { id: 'Carrelage',    label: 'Carrelage',    icon: '🪟' },
]
const QUARTIERS = ['Cocody','Plateau','Marcory','Treichville','Yopougon','Adjamé','Abobo','Port-Bouët','Koumassi']

const ARTISAN_STEPS = ['Téléphone', 'Profil', 'Métier']

function AuthPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect') || null

  const [step, setStep]       = useState<Step>('choice')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]       = useState('')
  const [role, setRole]       = useState<'client' | 'artisan'>('client')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Artisan onboarding form (steps after account creation)
  const [artisanStep, setArtisanStep] = useState(0) // 0=phone, 1=profile, 2=metier
  const [artisan, setArtisan] = useState({
    phone: '', quartier: '', exp: '', tarif: '', bio: '', metier: '',
  })
  const updateArtisan = (k: string, v: string) => setArtisan(a => ({ ...a, [k]: v }))

  // ── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou mot de passe incorrect'); setLoading(false); return }

    const { data: userData } = await supabase
      .from('users').select('role').eq('id', data.user.id).single()
    const userRole = userData?.role ?? data.user.user_metadata?.role ?? 'client'

    const { data: artisanProfile } = await supabase
      .from('artisan_pros').select('id').eq('user_id', data.user.id).single()

    if (redirectTo)       router.push(redirectTo)
    else if (artisanProfile) router.push('/artisan-space/dashboard')
    else if (userRole === 'admin')   router.push('/admin')
    else if (userRole === 'artisan') router.push('/artisan-space/register')
    else router.push('/dashboard')
  }

  // ── Signup ───────────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, role } },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)

    if (data.session) {
      // Auto-confirm activé — on peut enchaîner directement
      if (role === 'artisan') {
        setArtisanStep(0)
        setStep('artisan_phone')
      } else {
        if (redirectTo) router.push(redirectTo)
        else router.push('/dashboard')
      }
    } else {
      // Confirmation email requise
      setStep('verify')
    }
  }

  // ── Finalise le profil artisan ───────────────────────────────────────────────
  const finishArtisan = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      // Crée / met à jour la ligne users
      await supabase.from('users').upsert({
        id:       session.user.id,
        name:     name || session.user.user_metadata?.name || '',
        email:    session.user.email || '',
        quartier: artisan.quartier,
        phone:    artisan.phone || null,
        role:     'artisan',
      }, { onConflict: 'id' })

      // Crée le profil artisan_pros
      const { data: artisanData, error: artisanErr } = await supabase
        .from('artisan_pros')
        .insert({
          user_id:          session.user.id,
          metier:           artisan.metier,
          bio:              artisan.bio || '',
          years_experience: parseInt(artisan.exp) || 0,
          tarif_min:        parseInt(artisan.tarif) || 0,
          quartiers:        [artisan.quartier],
          kyc_status:       'pending',
          is_available:     false,
          rating_avg:       0,
          rating_count:     0,
          mission_count:    0,
          success_rate:     0,
          response_time_min:30,
        })
        .select()
        .single()

      if (artisanErr) throw artisanErr

      // Crée le wallet
      await supabase.from('wallets').insert({
        artisan_id:        artisanData.id,
        balance_available: 0,
        balance_escrow:    0,
        total_earned:      0,
        total_withdrawn:   0,
      })

      setStep('artisan_done')
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du profil')
    }
    setLoading(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const artisanStepIndex = artisanStep

  return (
    <div className="min-h-screen bg-bg flex">

      {/* Panel gauche */}
      <div className="hidden lg:flex lg:w-1/2 bg-dark flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center"><Zap size={16} className="text-white" /></div>
          <span className="font-display font-bold text-xl text-cream">AFRI<span className="text-accent">ONE</span></span>
        </Link>
        <div>
          {step.startsWith('artisan') ? (
            <>
              <span className="font-mono text-xs text-muted uppercase tracking-wider">ESPACE ARTISAN</span>
              <h1 className="font-display text-4xl font-bold text-cream mt-3 mb-4">
                Rejoignez<br /><span className="text-accent">500+</span><br />artisans.
              </h1>
              <div className="space-y-3">
                {['Missions qualifiées près de chez vous','Paiement Wave sous 24h','Construisez votre réputation','Assurance SAV incluse'].map(t => (
                  <div key={t} className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle size={14} className="text-accent2 flex-shrink-0" /> {t}
                  </div>
                ))}
              </div>
              {/* Progress steps */}
              <div className="space-y-2 mt-8">
                {ARTISAN_STEPS.map((s, i) => (
                  <div key={s} className={`flex items-center gap-3 text-sm ${i < artisanStepIndex ? 'text-accent2' : i === artisanStepIndex ? 'text-cream' : 'text-muted'}`}>
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs flex-shrink-0 ${
                      i < artisanStepIndex ? 'bg-accent2 border-accent2 text-white' : i === artisanStepIndex ? 'border-cream' : 'border-muted/30'
                    }`}>
                      {i < artisanStepIndex ? <CheckCircle size={12} /> : i + 1}
                    </div>
                    {s}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <blockquote className="font-display text-3xl font-bold text-cream leading-tight mb-6">
                "Trouver le bon artisan,<br />au bon prix,<br /><span className="text-accent">au bon moment."</span>
              </blockquote>
              <div className="flex gap-8">
                {[['500+','Artisans'],['4.8★','Note moy.'],['2400+','Missions']].map(([v,l]) => (
                  <div key={l}>
                    <div className="font-display text-2xl font-bold text-accent">{v}</div>
                    <div className="font-mono text-xs text-muted">{l}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Shield size={14} className="text-accent2" />
          <span>Connexion sécurisée · AfriOne CI</span>
        </div>
      </div>

      {/* Panel droit */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* ── Choix ── */}
          {step === 'choice' && (
            <div className="animate-fade-up">
              <Link href="/" className="flex items-center gap-2 mb-10 lg:hidden">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center"><Zap size={16} className="text-white" /></div>
                <span className="font-display font-bold text-xl text-dark">AFRI<span className="text-accent">ONE</span></span>
              </Link>
              <h1 className="font-display text-3xl font-bold text-dark mb-2">Bienvenue</h1>
              <p className="text-muted mb-8">Connectez-vous ou créez votre compte</p>
              <div className="space-y-3">
                <button onClick={() => setStep('login')} className="btn-primary w-full flex items-center justify-center gap-2 py-4">
                  Se connecter <ArrowRight size={16} />
                </button>
                <button onClick={() => setStep('register')} className="btn-outline w-full flex items-center justify-center gap-2 py-4">
                  Créer un compte <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Connexion ── */}
          {step === 'login' && (
            <div className="animate-fade-up">
              <button onClick={() => setStep('choice')} className="flex items-center gap-2 text-sm text-muted mb-8 hover:text-dark transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <h1 className="font-display text-3xl font-bold text-dark mb-2">Connexion</h1>
              <p className="text-muted mb-8">Accédez à votre espace AfriOne</p>
              {error && <div className="mb-4 p-4 rounded-xl text-sm" style={{background:'rgba(232,93,38,0.1)',color:'#E85D26'}}>{error}</div>}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="section-label block mb-2">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" className="input" required />
                </div>
                <div>
                  <label className="section-label block mb-2">Mot de passe</label>
                  <div style={{position:'relative'}}>
                    <input type={showPass?'text':'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe" className="input" style={{paddingRight:'44px'}} required />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{position:'absolute',right:'16px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#7A7A6E'}}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-4" style={{opacity:loading?0.6:1}}>
                  {loading ? 'Connexion...' : <>Se connecter <ArrowRight size={16} /></>}
                </button>
              </form>
              <button onClick={() => setStep('forgot')} style={{background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'#7A7A6E',display:'block',textAlign:'center',width:'100%',marginTop:'12px'}}>
                Mot de passe oublié ?
              </button>
              <p className="text-sm text-center mt-3 text-muted">
                Pas de compte ?{' '}
                <button onClick={() => setStep('register')} className="text-accent font-medium" style={{background:'none',border:'none',cursor:'pointer'}}>
                  S'inscrire
                </button>
              </p>
            </div>
          )}

          {/* ── Mot de passe oublié ── */}
          {step === 'forgot' && (
            <div className="animate-fade-up">
              <button onClick={() => setStep('login')} className="flex items-center gap-2 text-sm text-muted mb-8 hover:text-dark transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <h1 className="font-display text-3xl font-bold text-dark mb-2">Mot de passe oublié</h1>
              <p className="text-muted mb-8 text-sm">Entrez votre email — nous vous envoyons un lien de réinitialisation.</p>
              {error && <div className="mb-4 p-4 rounded-xl text-sm" style={{background:'rgba(232,93,38,0.1)',color:'#E85D26'}}>{error}</div>}
              <div className="space-y-4">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" className="input" required />
                <button
                  onClick={async () => {
                    if (!email.trim()) { setError('Entrez votre email'); return }
                    setLoading(true); setError('')
                    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/auth/reset`,
                    })
                    setLoading(false)
                    if (e) setError(e.message)
                    else setStep('forgot_sent')
                  }}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-4" style={{opacity:loading?0.6:1}}>
                  {loading ? 'Envoi…' : 'Envoyer le lien →'}
                </button>
              </div>
            </div>
          )}

          {step === 'forgot_sent' && (
            <div className="animate-fade-up text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{background:'rgba(43,107,62,0.1)'}}>
                <CheckCircle size={40} color="#2B6B3E" />
              </div>
              <h1 className="font-display text-3xl font-bold text-dark mb-3">Email envoyé !</h1>
              <p className="text-muted mb-2">Un lien de réinitialisation a été envoyé à</p>
              <p className="font-bold text-dark mb-8">{email}</p>
              <button onClick={() => setStep('login')} className="btn-outline w-full flex items-center justify-center gap-2">
                Retour à la connexion
              </button>
            </div>
          )}

          {/* ── Inscription ── */}
          {step === 'register' && (
            <div className="animate-fade-up">
              <button onClick={() => setStep('choice')} className="flex items-center gap-2 text-sm text-muted mb-8 hover:text-dark transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <h1 className="font-display text-3xl font-bold text-dark mb-2">Créer un compte</h1>
              <p className="text-muted mb-8">Rejoignez AfriOne gratuitement</p>
              {error && <div className="mb-4 p-4 rounded-xl text-sm" style={{background:'rgba(232,93,38,0.1)',color:'#E85D26'}}>{error}</div>}
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="section-label block mb-2">Nom complet</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Aya Konaté" className="input" required />
                </div>
                <div>
                  <label className="section-label block mb-2">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" className="input" required />
                </div>
                <div>
                  <label className="section-label block mb-2">Mot de passe</label>
                  <div style={{position:'relative'}}>
                    <input type={showPass?'text':'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 caractères" className="input" style={{paddingRight:'44px'}} required minLength={6} />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{position:'absolute',right:'16px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#7A7A6E'}}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="section-label block mb-2">Vous êtes</label>
                  <div style={{display:'flex',gap:'12px'}}>
                    {[{id:'client',icon:'🏠',label:'Client — je cherche un artisan'},{id:'artisan',icon:'🔧',label:'Artisan — je propose mes services'}].map(r => (
                      <button key={r.id} type="button" onClick={() => setRole(r.id as any)}
                        style={{flex:1,padding:'14px 10px',borderRadius:'12px',border:role===r.id?'2px solid #E85D26':'2px solid #D8D2C4',background:role===r.id?'rgba(232,93,38,0.05)':'white',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'6px',textAlign:'center'}}>
                        <span style={{fontSize:'22px'}}>{r.icon}</span>
                        <span style={{fontSize:'12px',fontWeight:600,color:role===r.id?'#E85D26':'#0F1410',lineHeight:'1.3'}}>{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {role === 'artisan' && (
                  <div style={{background:'rgba(232,93,38,0.05)',border:'1px solid rgba(232,93,38,0.2)',borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:'#E85D26',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                    <Zap size={14} style={{flexShrink:0,marginTop:'1px'}} />
                    Après création, vous complèterez votre profil artisan en 2 minutes.
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-4" style={{opacity:loading?0.6:1}}>
                  {loading
                    ? <><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Création...</>
                    : <>Créer mon compte <ArrowRight size={16} /></>
                  }
                </button>
              </form>
              <p className="text-sm text-center mt-4 text-muted">
                Déjà un compte ?{' '}
                <button onClick={() => setStep('login')} className="text-accent font-medium" style={{background:'none',border:'none',cursor:'pointer'}}>
                  Se connecter
                </button>
              </p>
            </div>
          )}

          {/* ── Vérification email ── */}
          {step === 'verify' && (
            <div className="animate-fade-up text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{background:'rgba(43,107,62,0.1)'}}>
                <CheckCircle size={40} color="#2B6B3E" />
              </div>
              <h1 className="font-display text-3xl font-bold text-dark mb-3">Vérifiez votre email</h1>
              <p className="text-muted mb-2">Un lien de confirmation a été envoyé à</p>
              <p className="font-bold text-dark mb-6">{email}</p>
              {role === 'artisan' && (
                <div style={{background:'rgba(232,93,38,0.05)',border:'1px solid rgba(232,93,38,0.15)',borderRadius:'12px',padding:'12px 14px',fontSize:'13px',color:'#E85D26',marginBottom:'20px',textAlign:'left'}}>
                  <strong>Artisan :</strong> après avoir confirmé votre email, connectez-vous ici — vous complèterez votre profil artisan directement.
                </div>
              )}
              <button onClick={() => setStep('login')} className="btn-outline w-full flex items-center justify-center gap-2">
                Retour à la connexion
              </button>
            </div>
          )}

          {/* ══ ONBOARDING ARTISAN ══════════════════════════════════════════════ */}

          {/* Barre de progression artisan */}
          {(step === 'artisan_phone' || step === 'artisan_profile' || step === 'artisan_metier') && (
            <div style={{marginBottom:'32px'}}>
              <div style={{display:'flex',gap:'6px',marginBottom:'12px'}}>
                {ARTISAN_STEPS.map((_, i) => (
                  <div key={i} style={{height:'3px',flex:1,borderRadius:'2px',background: i <= artisanStepIndex ? '#E85D26' : '#D8D2C4',transition:'background 0.3s'}} />
                ))}
              </div>
              <div style={{fontSize:'10px',fontFamily:'Space Mono',color:'#7A7A6E',letterSpacing:'0.1em'}}>
                ÉTAPE {artisanStepIndex + 1} / {ARTISAN_STEPS.length} — {ARTISAN_STEPS[artisanStepIndex].toUpperCase()}
              </div>
            </div>
          )}

          {error && (step === 'artisan_phone' || step === 'artisan_profile' || step === 'artisan_metier') && (
            <div style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:'12px',padding:'12px 16px',marginBottom:'16px',fontSize:'13px',color:'#dc2626'}}>
              {error}
            </div>
          )}

          {/* ── Artisan Step 0 : Téléphone ── */}
          {step === 'artisan_phone' && (
            <div className="animate-fade-up">
              <h2 className="font-display text-3xl font-bold text-dark mb-2">Votre numéro Wave</h2>
              <p className="text-muted text-sm mb-8">Pour recevoir vos paiements directement</p>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex items-center bg-white border border-border rounded-xl px-4 py-3 text-sm font-mono flex-shrink-0">🇨🇮 +225</div>
                  <input type="tel" value={artisan.phone} onChange={e => updateArtisan('phone', e.target.value)}
                    placeholder="07 00 00 00 00" className="input flex-1 font-mono" />
                </div>
                <button onClick={() => { setArtisanStep(1); setStep('artisan_profile') }}
                  disabled={artisan.phone.length < 8}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
                  Continuer <ArrowRight size={16} />
                </button>
                <p className="text-xs text-center text-muted">
                  En continuant, vous acceptez nos <Link href="/aide" className="text-accent">CGU</Link>
                </p>
              </div>
            </div>
          )}

          {/* ── Artisan Step 1 : Profil ── */}
          {step === 'artisan_profile' && (
            <div className="animate-fade-up">
              <button onClick={() => { setArtisanStep(0); setStep('artisan_phone') }}
                className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-6 transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <h2 className="font-display text-3xl font-bold text-dark mb-2">Votre profil</h2>
              <p className="text-muted text-sm mb-8">Ces informations seront visibles par les clients</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Nom complet</label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="text" value={artisan.bio ? name : name} readOnly
                      style={{background:'rgba(0,0,0,0.03)'}}
                      className="input pl-11 text-muted" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Quartier principal</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                    <select value={artisan.quartier} onChange={e => updateArtisan('quartier', e.target.value)} className="input pl-11 appearance-none">
                      <option value="">Choisir un quartier</option>
                      {QUARTIERS.map(q => <option key={q}>{q}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Années d'exp.</label>
                    <input type="number" value={artisan.exp} onChange={e => updateArtisan('exp', e.target.value)}
                      placeholder="Ex : 5" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Tarif min (FCFA)</label>
                    <input type="number" value={artisan.tarif} onChange={e => updateArtisan('tarif', e.target.value)}
                      placeholder="Ex : 8000" className="input" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Bio courte</label>
                  <textarea value={artisan.bio} onChange={e => updateArtisan('bio', e.target.value)}
                    placeholder="Décrivez votre expertise en quelques mots..." className="input resize-none min-h-20" />
                </div>
                <button onClick={() => { setArtisanStep(2); setStep('artisan_metier') }}
                  disabled={!artisan.quartier}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
                  Continuer <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Artisan Step 2 : Métier ── */}
          {step === 'artisan_metier' && (
            <div className="animate-fade-up">
              <button onClick={() => { setArtisanStep(1); setStep('artisan_profile') }}
                className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-6 transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <h2 className="font-display text-3xl font-bold text-dark mb-2">Votre métier</h2>
              <p className="text-muted text-sm mb-6">Choisissez votre domaine principal</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {METIERS.map(m => (
                  <button key={m.id} onClick={() => updateArtisan('metier', m.id)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                      artisan.metier === m.id ? 'border-accent bg-accent/5' : 'border-border bg-white hover:border-dark/30'
                    }`}>
                    <span className="text-2xl">{m.icon}</span>
                    <span className={`text-sm font-semibold ${artisan.metier === m.id ? 'text-accent' : 'text-dark'}`}>{m.label}</span>
                    {artisan.metier === m.id && <CheckCircle size={14} className="text-accent ml-auto" />}
                  </button>
                ))}
              </div>
              <button onClick={finishArtisan} disabled={!artisan.metier || loading}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
                {loading
                  ? <><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Création en cours...</>
                  : <><CheckCircle size={16} /> Finaliser mon inscription</>
                }
              </button>
            </div>
          )}

          {/* ── Artisan Done ── */}
          {step === 'artisan_done' && (
            <div className="animate-fade-up text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{background:'rgba(43,107,62,0.1)'}}>
                <CheckCircle size={40} color="#2B6B3E" />
              </div>
              <h2 className="font-display text-3xl font-bold text-dark mb-3">Compte créé ! 🎉</h2>
              <p className="text-muted mb-2">Bienvenue sur AfriOne, <strong>{name}</strong>.</p>
              <p className="text-muted text-sm mb-8">Il reste à vérifier votre identité pour activer votre profil.</p>
              <Link href="/artisan-space/kyc" className="btn-primary w-full flex items-center justify-center gap-2 py-4">
                <Zap size={16} /> Envoyer mes documents KYC
              </Link>
              <Link href="/artisan-space/dashboard" className="btn-outline w-full flex items-center justify-center gap-2 mt-3 py-3" style={{fontSize:'13px'}}>
                Accéder à mon espace →
              </Link>
            </div>
          )}

        </div>
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
