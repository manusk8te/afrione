'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Zap, Phone, ArrowRight, ArrowLeft, Shield } from 'lucide-react'

type Step = 'phone' | 'otp' | 'role'

export default function AuthPage() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)

  const handlePhone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phone.length < 8) return
    setLoading(true)
    // TODO: appel API Twilio OTP
    setTimeout(() => { setLoading(false); setStep('otp') }, 1500)
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
  }

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) return
    setLoading(true)
    // TODO: vérifier OTP via Supabase
    setTimeout(() => { setLoading(false); setStep('role') }, 1500)
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-dark flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl text-cream">
            AFRI<span className="text-accent">ONE</span>
          </span>
        </Link>

        <div>
          <blockquote className="font-display text-3xl font-bold text-cream leading-tight mb-6">
            "Trouver le bon artisan,<br />
            au bon prix,<br />
            <span className="text-accent">au bon moment."</span>
          </blockquote>
          <div className="flex gap-8">
            {[['500+', 'Artisans'], ['4.8★', 'Note moy.'], ['2400+', 'Missions']].map(([v, l]) => (
              <div key={l}>
                <div className="font-display text-2xl font-bold text-accent">{v}</div>
                <div className="font-mono text-xs text-muted">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted">
          <Shield size={14} className="text-accent2" />
          <span>Connexion sécurisée par OTP SMS</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-xl text-dark">
              AFRI<span className="text-accent">ONE</span>
            </span>
          </Link>

          {/* Step: Phone */}
          {step === 'phone' && (
            <div className="animate-fade-up">
              <h1 className="font-display text-3xl font-bold text-dark mb-2">Connexion</h1>
              <p className="text-muted mb-8">Entrez votre numéro pour recevoir un code SMS</p>
              <form onSubmit={handlePhone} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-2">Numéro de téléphone</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-mono text-sm">🇨🇮 +225</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="07 00 00 00 00"
                      className="input pl-24"
                      maxLength={10}
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading || phone.length < 8} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? (
                    <span className="animate-pulse-soft">Envoi du code...</span>
                  ) : (
                    <>Recevoir mon code <ArrowRight size={16} /></>
                  )}
                </button>
              </form>
              <p className="text-xs text-muted mt-6 text-center">
                En continuant, vous acceptez nos{' '}
                <Link href="/cgu" className="text-accent hover:underline">CGU</Link>
              </p>
            </div>
          )}

          {/* Step: OTP */}
          {step === 'otp' && (
            <div className="animate-fade-up">
              <button onClick={() => setStep('phone')} className="flex items-center gap-2 text-sm text-muted mb-8 hover:text-dark transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <h1 className="font-display text-3xl font-bold text-dark mb-2">Code de vérification</h1>
              <p className="text-muted mb-8">
                Entrez le code à 6 chiffres envoyé au <strong className="text-dark">+225 {phone}</strong>
              </p>
              <form onSubmit={handleOtp} className="space-y-6">
                <div className="flex gap-3 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      className="w-12 h-14 text-center text-xl font-bold border-2 border-border rounded-xl focus:border-accent focus:outline-none bg-white transition-colors"
                    />
                  ))}
                </div>
                <button type="submit" disabled={loading || otp.join('').length < 6} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <span className="animate-pulse-soft">Vérification...</span> : <>Vérifier <ArrowRight size={16} /></>}
                </button>
              </form>
              <p className="text-xs text-muted mt-4 text-center">
                Pas reçu ?{' '}
                <button className="text-accent hover:underline">Renvoyer le code</button>
              </p>
            </div>
          )}

          {/* Step: Role */}
          {step === 'role' && (
            <div className="animate-fade-up">
              <h1 className="font-display text-3xl font-bold text-dark mb-2">Vous êtes ?</h1>
              <p className="text-muted mb-8">Choisissez votre profil pour continuer</p>
              <div className="space-y-4">
                <Link href="/dashboard" className="card flex items-center gap-4 hover:border-accent/30 hover:-translate-y-1 group cursor-pointer transition-all">
                  <div className="text-3xl">👤</div>
                  <div className="flex-1">
                    <div className="font-display font-bold text-dark group-hover:text-accent transition-colors">Je suis client</div>
                    <div className="text-sm text-muted">Je cherche un artisan pour une mission</div>
                  </div>
                  <ArrowRight size={16} className="text-muted group-hover:text-accent transition-colors" />
                </Link>
                <Link href="/artisan-space/dashboard" className="card flex items-center gap-4 hover:border-accent2/30 hover:-translate-y-1 group cursor-pointer transition-all">
                  <div className="text-3xl">🔧</div>
                  <div className="flex-1">
                    <div className="font-display font-bold text-dark group-hover:text-accent2 transition-colors">Je suis artisan</div>
                    <div className="text-sm text-muted">Je propose mes services sur AfriOne</div>
                  </div>
                  <ArrowRight size={16} className="text-muted group-hover:text-accent2 transition-colors" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
