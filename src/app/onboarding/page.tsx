'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, MapPin, User, CheckCircle, Zap } from 'lucide-react'

const QUARTIERS = ['Cocody', 'Plateau', 'Marcory', 'Treichville', 'Yopougon', 'Adjamé', 'Abobo', 'Port-Bouët', 'Koumassi', 'Attécoubé']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', quartier: '', adresse: '', role: '' })
  const [loading, setLoading] = useState(false)

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const finish = () => {
    setLoading(true)
    setTimeout(() => {
      if (form.role === 'artisan') router.push('/artisan-space/dashboard')
      else router.push('/diagnostic')
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-10 justify-center">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl text-dark">AFRI<span className="text-accent">ONE</span></span>
        </Link>

        {/* Progress */}
        <div className="flex gap-2 mb-10">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-accent' : 'bg-border'}`} />
          ))}
        </div>

        {/* Step 1 — Identité */}
        {step === 1 && (
          <div className="animate-fade-up">
            <h1 className="font-display text-3xl font-bold text-dark mb-2">Bienvenue !</h1>
            <p className="text-muted text-sm mb-8">Dites-nous comment vous appeler</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Votre prénom et nom</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="Ex : Aya Konaté"
                    className="input pl-11"
                  />
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={form.name.length < 2}
                className="btn-primary w-full flex items-center justify-center gap-2 py-4 disabled:opacity-40"
              >
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Localisation */}
        {step === 2 && (
          <div className="animate-fade-up">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-6 transition-colors">
              <ArrowLeft size={16} /> Retour
            </button>
            <h1 className="font-display text-3xl font-bold text-dark mb-2">Où êtes-vous ?</h1>
            <p className="text-muted text-sm mb-8">Pour trouver les artisans les plus proches</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Quartier</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <select
                    value={form.quartier}
                    onChange={e => update('quartier', e.target.value)}
                    className="input pl-11 appearance-none"
                  >
                    <option value="">Choisir un quartier</option>
                    {QUARTIERS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Adresse précise (optionnel)</label>
                <input
                  type="text"
                  value={form.adresse}
                  onChange={e => update('adresse', e.target.value)}
                  placeholder="Rue, immeuble, repère..."
                  className="input"
                />
              </div>
              <button
                onClick={() => setStep(3)}
                disabled={!form.quartier}
                className="btn-primary w-full flex items-center justify-center gap-2 py-4 disabled:opacity-40"
              >
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Rôle */}
        {step === 3 && (
          <div className="animate-fade-up">
            <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-6 transition-colors">
              <ArrowLeft size={16} /> Retour
            </button>
            <h1 className="font-display text-3xl font-bold text-dark mb-2">Vous êtes...</h1>
            <p className="text-muted text-sm mb-8">Votre expérience sera adaptée à votre profil</p>
            <div className="space-y-4">
              {[
                { id: 'client', icon: '🏠', title: 'Un client', desc: 'Je cherche un artisan pour mes besoins' },
                { id: 'artisan', icon: '🔧', title: 'Un artisan', desc: 'Je propose mes services aux clients' },
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => update('role', r.id)}
                  className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                    form.role === r.id
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-white hover:border-dark'
                  }`}
                >
                  <span className="text-3xl">{r.icon}</span>
                  <div>
                    <div className="font-display font-bold text-dark">{r.title}</div>
                    <div className="text-sm text-muted">{r.desc}</div>
                  </div>
                  {form.role === r.id && <CheckCircle size={20} className="text-accent ml-auto flex-shrink-0" />}
                </button>
              ))}
              <button
                onClick={finish}
                disabled={!form.role || loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-4 mt-2 disabled:opacity-40"
              >
                {loading ? 'Configuration...' : <><CheckCircle size={16} /> Commencer</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
