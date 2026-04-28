'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, CheckCircle, Zap, MapPin, User } from 'lucide-react'

const METIERS = [
  { id: 'plomberie', label: 'Plomberie', icon: '🔧' },
  { id: 'electricite', label: 'Électricité', icon: '⚡' },
  { id: 'maconnerie', label: 'Maçonnerie', icon: '🏗️' },
  { id: 'peinture', label: 'Peinture', icon: '🎨' },
  { id: 'menuiserie', label: 'Menuiserie', icon: '🪵' },
  { id: 'climatisation', label: 'Climatisation', icon: '❄️' },
  { id: 'serrurerie', label: 'Serrurerie', icon: '🔑' },
  { id: 'carrelage', label: 'Carrelage', icon: '🪟' },
]

const QUARTIERS = ['Cocody', 'Plateau', 'Marcory', 'Treichville', 'Yopougon', 'Adjamé', 'Abobo', 'Port-Bouët', 'Koumassi']

const STEPS = ['Téléphone', 'Profil', 'Métier', 'Terminé']

export default function ArtisanRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    phone: '', name: '', quartier: '', exp: '', bio: '',
    metier: '', tarif: '', rayon: '10',
  })

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const next = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setStep(s => s + 1) }, 600)
  }

  const finish = () => {
    setLoading(true)
    setTimeout(() => router.push('/artisan-space/kyc'), 1000)
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left */}
      <div className="hidden lg:flex lg:w-5/12 bg-dark flex-col justify-between p-12 sticky top-0 h-screen">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl text-cream">AFRI<span className="text-accent">ONE</span></span>
        </Link>
        <div>
          <span className="font-mono text-xs text-muted uppercase tracking-wider">ESPACE ARTISAN</span>
          <h1 className="font-display text-4xl font-bold text-cream mt-3 mb-4">
            Rejoignez<br /><span className="text-accent">500+</span><br />artisans.
          </h1>
          <div className="space-y-3">
            {['Missions qualifiées près de chez vous', 'Paiement Wave sous 24h', 'Construisez votre réputation', 'Assurance SAV incluse'].map(t => (
              <div key={t} className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle size={14} className="text-accent2 flex-shrink-0" /> {t}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex items-center gap-3 text-sm ${i < step ? 'text-accent2' : i === step ? 'text-cream' : 'text-muted'}`}>
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs flex-shrink-0 ${
                i < step ? 'bg-accent2 border-accent2 text-white' : i === step ? 'border-cream' : 'border-muted/30'
              }`}>
                {i < step ? <CheckCircle size={12} /> : i + 1}
              </div>
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-lg mx-auto w-full">
        <div className="flex gap-2 mb-10">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-accent' : 'bg-border'}`} />
          ))}
        </div>

        {/* Step 0 — Phone */}
        {step === 0 && (
          <div className="animate-fade-up">
            <h2 className="font-display text-3xl font-bold text-dark mb-2">Votre numéro</h2>
            <p className="text-muted text-sm mb-8">Nous vous enverrons un SMS de vérification</p>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex items-center bg-white border border-border rounded-xl px-4 py-3 text-sm font-mono flex-shrink-0">🇨🇮 +225</div>
                <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                  placeholder="07 00 00 00 00" className="input flex-1 font-mono" />
              </div>
              <button onClick={next} disabled={form.phone.length < 8 || loading}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
                {loading ? 'Envoi...' : <> Continuer <ArrowRight size={16} /></>}
              </button>
              <p className="text-xs text-center text-muted">
                En continuant, vous acceptez nos <Link href="/aide" className="text-accent">CGU</Link>
              </p>
            </div>
          </div>
        )}

        {/* Step 1 — Profil */}
        {step === 1 && (
          <div className="animate-fade-up">
            <button onClick={() => setStep(0)} className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-6 transition-colors">
              <ArrowLeft size={16} /> Retour
            </button>
            <h2 className="font-display text-3xl font-bold text-dark mb-2">Votre profil</h2>
            <p className="text-muted text-sm mb-8">Ces informations seront visibles par les clients</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Nom complet</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                    placeholder="Kouadio Brou Emmanuel" className="input pl-11" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Quartier principal</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <select value={form.quartier} onChange={e => update('quartier', e.target.value)} className="input pl-11 appearance-none">
                    <option value="">Choisir un quartier</option>
                    {QUARTIERS.map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Années d'exp.</label>
                  <input type="number" value={form.exp} onChange={e => update('exp', e.target.value)}
                    placeholder="Ex : 5" className="input" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Tarif min (FCFA)</label>
                  <input type="number" value={form.tarif} onChange={e => update('tarif', e.target.value)}
                    placeholder="Ex : 8000" className="input" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-2">Bio courte</label>
                <textarea value={form.bio} onChange={e => update('bio', e.target.value)}
                  placeholder="Décrivez votre expertise en quelques mots..." className="input resize-none min-h-20" />
              </div>
              <button onClick={next} disabled={!form.name || !form.quartier || loading}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
                {loading ? 'Enregistrement...' : <>Continuer <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Métier */}
        {step === 2 && (
          <div className="animate-fade-up">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 text-sm text-muted hover:text-dark mb-6 transition-colors">
              <ArrowLeft size={16} /> Retour
            </button>
            <h2 className="font-display text-3xl font-bold text-dark mb-2">Votre métier</h2>
            <p className="text-muted text-sm mb-8">Choisissez votre domaine principal</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {METIERS.map(m => (
                <button key={m.id} onClick={() => update('metier', m.id)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                    form.metier === m.id ? 'border-accent bg-accent/5' : 'border-border bg-white hover:border-dark/30'
                  }`}>
                  <span className="text-2xl">{m.icon}</span>
                  <span className={`text-sm font-semibold ${form.metier === m.id ? 'text-accent' : 'text-dark'}`}>{m.label}</span>
                  {form.metier === m.id && <CheckCircle size={14} className="text-accent ml-auto" />}
                </button>
              ))}
            </div>
            <button onClick={finish} disabled={!form.metier || loading}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
              {loading ? 'Création du compte...' : <><CheckCircle size={16} /> Créer mon compte</>}
            </button>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div className="animate-fade-up text-center">
            <div className="w-20 h-20 bg-accent2/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-accent2" />
            </div>
            <h2 className="font-display text-3xl font-bold text-dark mb-3">Compte créé !</h2>
            <p className="text-muted mb-8">Il ne reste plus qu'à vérifier votre identité pour activer votre profil</p>
            <Link href="/artisan-space/kyc" className="btn-primary w-full flex items-center justify-center gap-2 py-4">
              <Zap size={16} /> Envoyer mes documents KYC
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
