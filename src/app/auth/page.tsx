'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, ArrowRight, ArrowLeft, Shield, Mail, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Step = 'choice' | 'login' | 'register' | 'verify'

export default function AuthPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('choice')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'client' | 'artisan'>('client')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou mot de passe incorrect'); setLoading(false); return }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const userRole = userData?.role ?? data.user.user_metadata?.role ?? 'client'
    if (userRole === 'artisan') router.push('/artisan-space/dashboard')
    else if (userRole === 'admin') router.push('/admin')
    else router.push('/dashboard')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, role } }
    })
    if (error) { setError(error.message); setLoading(false); return }

    // Si Supabase auto-confirme (pas d'email de vérification), rediriger directement
    if (data.session) {
      if (role === 'artisan') router.push('/artisan-space/register')
      else router.push('/dashboard')
      return
    }

    setStep('verify')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg flex">
      <div className="hidden lg:flex lg:w-1/2 bg-dark flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl text-cream">AFRI<span className="text-accent">ONE</span></span>
        </Link>
        <div>
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
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Shield size={14} className="text-accent2" />
          <span>Connexion sécurisée</span>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

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
              <p className="text-sm text-center mt-4 text-muted">
                Pas de compte ? <button onClick={() => setStep('register')} className="text-accent font-medium" style={{background:'none',border:'none',cursor:'pointer'}}>S'inscrire</button>
              </p>
            </div>
          )}

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
                    {[{id:'client',icon:'🏠',label:'Client'},{id:'artisan',icon:'🔧',label:'Artisan'}].map(r => (
                      <button key={r.id} type="button" onClick={() => setRole(r.id as any)}
                        style={{flex:1,padding:'16px',borderRadius:'12px',border:role===r.id?'2px solid #E85D26':'2px solid #D8D2C4',background:role===r.id?'rgba(232,93,38,0.05)':'white',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
                        <span style={{fontSize:'24px'}}>{r.icon}</span>
                        <span style={{fontSize:'13px',fontWeight:600,color:role===r.id?'#E85D26':'#0F1410'}}>{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-4" style={{opacity:loading?0.6:1}}>
                  {loading ? 'Création...' : <>Créer mon compte <ArrowRight size={16} /></>}
                </button>
              </form>
              <p className="text-sm text-center mt-4 text-muted">
                Déjà un compte ? <button onClick={() => setStep('login')} className="text-accent font-medium" style={{background:'none',border:'none',cursor:'pointer'}}>Se connecter</button>
              </p>
            </div>
          )}

          {step === 'verify' && (
            <div className="animate-fade-up text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{background:'rgba(43,107,62,0.1)'}}>
                <CheckCircle size={40} color="#2B6B3E" />
              </div>
              <h1 className="font-display text-3xl font-bold text-dark mb-3">Vérifiez votre email</h1>
              <p className="text-muted mb-2">Un lien de confirmation envoyé à</p>
              <p className="font-bold text-dark mb-8">{email}</p>
              <p className="text-sm text-muted mb-6">Cliquez sur le lien pour activer votre compte.</p>
              <button onClick={() => setStep('login')} className="btn-outline w-full flex items-center justify-center gap-2">
                Retour à la connexion
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
