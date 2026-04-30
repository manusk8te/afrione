'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, CheckCircle, Zap, MapPin, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const METIERS = [
  { id: 'Plomberie', label: 'Plomberie', icon: '🔧' },
  { id: 'Électricité', label: 'Électricité', icon: '⚡' },
  { id: 'Maçonnerie', label: 'Maçonnerie', icon: '🏗️' },
  { id: 'Peinture', label: 'Peinture', icon: '🎨' },
  { id: 'Menuiserie', label: 'Menuiserie', icon: '🪵' },
  { id: 'Climatisation', label: 'Climatisation', icon: '❄️' },
  { id: 'Serrurerie', label: 'Serrurerie', icon: '🔑' },
  { id: 'Carrelage', label: 'Carrelage', icon: '🪟' },
]

const QUARTIERS = ['Cocody','Plateau','Marcory','Treichville','Yopougon','Adjamé','Abobo','Port-Bouët','Koumassi']
const STEPS = ['Téléphone', 'Profil', 'Métier', 'Terminé']

export default function ArtisanRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    phone: '', name: '', quartier: '', exp: '', bio: '',
    metier: '', tarif: '', rayon: '10',
  })

  useEffect(() => {
    // Si déjà un profil artisan → redirect dashboard
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('artisan_pros')
        .select('id, kyc_status')
        .eq('user_id', session.user.id)
        .single()
      if (data) {
        router.push(data.kyc_status === 'approved' ? '/artisan-space/dashboard' : '/artisan-space/kyc')
      }
    }
    check()
  }, [])

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const next = () => setStep(s => s + 1)

  const finish = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      // 1. Upsert dans users (crée la ligne si le trigger n'a pas encore tourné)
      await supabase.from('users').upsert({
        id: session.user.id,
        name: form.name,
        email: session.user.email || '',
        quartier: form.quartier,
        phone: form.phone || null,
        role: 'artisan',
      }, { onConflict: 'id' })

      // 2. Créer le profil artisan
      const { data: artisanData, error: artisanErr } = await supabase
        .from('artisan_pros')
        .insert({
          user_id: session.user.id,
          metier: form.metier,
          bio: form.bio || '',
          years_experience: parseInt(form.exp) || 0,
          tarif_min: parseInt(form.tarif) || 0,
          quartiers: [form.quartier],
          kyc_status: 'pending',
          is_available: false,
          rating_avg: 0,
          rating_count: 0,
          mission_count: 0,
          success_rate: 0,
          response_time_min: 30,
        })
        .select()
        .single()

      if (artisanErr) throw artisanErr

      // 3. Créer le wallet
      await supabase.from('wallets').insert({
        artisan_id: artisanData.id,
        balance_available: 0,
        balance_escrow: 0,
        total_earned: 0,
        total_withdrawn: 0,
      })

      setStep(3)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du compte')
    }
    setLoading(false)
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
            {['Missions qualifiées près de chez vous','Paiement Wave sous 24h','Construisez votre réputation','Assurance SAV incluse'].map(t => (
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

        {error && (
          <div style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:'12px',padding:'12px 16px',marginBottom:'16px',fontSize:'13px',color:'#dc2626'}}>
            {error}
          </div>
        )}

        {/* Step 0 — Phone */}
        {step === 0 && (
          <div>
            <h2 className="font-display text-3xl font-bold text-dark mb-2">Votre numéro</h2>
            <p className="text-muted text-sm mb-8">Votre numéro Wave pour recevoir vos paiements</p>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex items-center bg-white border border-border rounded-xl px-4 py-3 text-sm font-mono flex-shrink-0">🇨🇮 +225</div>
                <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                  placeholder="07 00 00 00 00" className="input flex-1 font-mono" />
              </div>
              <button onClick={next} disabled={form.phone.length < 8}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
                Continuer <ArrowRight size={16} />
              </button>
              <p className="text-xs text-center text-muted">
                En continuant, vous acceptez nos <Link href="/aide" className="text-accent">CGU</Link>
              </p>
            </div>
          </div>
        )}

        {/* Step 1 — Profil */}
        {step === 1 && (
          <div>
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
              <button onClick={next} disabled={!form.name || !form.quartier}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40">
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Métier */}
        {step === 2 && (
          <div>
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
              {loading
                ? <><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 1s linear infinite'}} /> Création en cours...</>
                : <><CheckCircle size={16} /> Créer mon compte</>
              }
            </button>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div className="text-center">
            <div className="w-20 h-20 bg-accent2/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-accent2" />
            </div>
            <h2 className="font-display text-3xl font-bold text-dark mb-3">Compte créé ! 🎉</h2>
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
