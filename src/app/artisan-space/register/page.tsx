'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, CheckCircle, Zap, MapPin, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

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

      router.push('/artisan-space/kyc')
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du compte')
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', background: '#FFFFFF', border: '1.5px solid #E2E8F0',
    borderRadius: '12px', padding: '12px 16px', color: '#3D4852', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex' }}>
      {/* Left panel */}
      <div className="lg:flex lg:w-5/12 lg:flex-col lg:justify-between lg:p-12 lg:sticky lg:top-0 lg:h-screen"
        style={{ display: 'none', background: '#FFFFFF', boxShadow: '4px 0 24px rgba(163,177,198,0.25)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <div className="afrione-gradient" style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '20px', color: '#3D4852' }}>AFRI<span className="afrione-gradient-text">ONE</span></span>
        </Link>
        <div>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>ESPACE ARTISAN</span>
          <h1 style={{ fontWeight: 700, fontSize: '36px', color: '#3D4852', marginTop: '12px', marginBottom: '16px', lineHeight: 1.2 }}>
            Rejoignez<br /><span className="afrione-gradient-text">500+</span><br />artisans.
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {['Missions qualifiées près de chez vous','Paiement Wave sous 24h','Construisez votre réputation','Assurance SAV incluse'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6B7280' }}>
                <CheckCircle size={14} color="#E85D26" style={{ flexShrink: 0 }} /> {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: i < step ? '#E85D26' : i === step ? '#3D4852' : '#8B95A5' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0,
                background: i < step ? '#E85D26' : 'transparent',
                border: `1.5px solid ${i < step ? '#E85D26' : i === step ? '#3D4852' : '#E2E8F0'}`,
                color: i < step ? 'white' : i === step ? '#3D4852' : '#8B95A5',
              }}>
                {i < step ? <CheckCircle size={12} /> : i + 1}
              </div>
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 32px', maxWidth: '520px', margin: '0 auto', width: '100%' }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
          {STEPS.map((_, i) => (
            <div key={i} className={i <= step ? 'afrione-gradient' : ''} style={{
              height: '4px', flex: 1, borderRadius: '4px', transition: 'all 0.5s',
              background: i <= step ? undefined : '#E2E8F0',
            }} />
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {/* Step 0 — Phone */}
        {step === 0 && (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '28px', color: '#3D4852', marginBottom: '8px' }}>Votre numéro</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '32px' }}>Votre numéro Wave pour recevoir vos paiements</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', fontFamily: 'monospace', flexShrink: 0 }}>
                  🇨🇮 +225
                </div>
                <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                  placeholder="07 00 00 00 00" style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} />
              </div>
              <button onClick={next} disabled={form.phone.length < 8}
                className="btn-primary" style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: form.phone.length < 8 ? 0.4 : 1 }}>
                Continuer <ArrowRight size={16} />
              </button>
              <p style={{ fontSize: '12px', textAlign: 'center', color: '#8B95A5' }}>
                En continuant, vous acceptez nos <Link href="/aide" className="afrione-gradient-text">CGU</Link>
              </p>
            </div>
          </div>
        )}

        {/* Step 1 — Profil */}
        {step === 1 && (
          <div>
            <button onClick={() => setStep(0)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>
              <ArrowLeft size={16} /> Retour
            </button>
            <h2 style={{ fontWeight: 700, fontSize: '28px', color: '#3D4852', marginBottom: '8px' }}>Votre profil</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '32px' }}>Ces informations seront visibles par les clients</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Nom complet</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#8B95A5" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                    placeholder="Kouadio Brou Emmanuel" style={{ ...inputStyle, paddingLeft: '44px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Quartier principal</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} color="#8B95A5" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                  <select value={form.quartier} onChange={e => update('quartier', e.target.value)} style={{ ...inputStyle, paddingLeft: '44px', appearance: 'none' }}>
                    <option value="">Choisir un quartier</option>
                    {QUARTIERS.map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Années d'exp.</label>
                  <input type="number" value={form.exp} onChange={e => update('exp', e.target.value)}
                    placeholder="Ex : 5" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Tarif min (FCFA)</label>
                  <input type="number" value={form.tarif} onChange={e => update('tarif', e.target.value)}
                    placeholder="Ex : 8000" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Bio courte</label>
                <textarea value={form.bio} onChange={e => update('bio', e.target.value)}
                  placeholder="Décrivez votre expertise en quelques mots..."
                  style={{ ...inputStyle, resize: 'none', minHeight: '80px' }} />
              </div>
              <button onClick={next} disabled={!form.name || !form.quartier}
                className="btn-primary" style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (!form.name || !form.quartier) ? 0.4 : 1 }}>
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Métier */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>
              <ArrowLeft size={16} /> Retour
            </button>
            <h2 style={{ fontWeight: 700, fontSize: '28px', color: '#3D4852', marginBottom: '8px' }}>Votre métier</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '32px' }}>Choisissez votre domaine principal</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {METIERS.map(m => (
                <button key={m.id} onClick={() => update('metier', m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                    background: '#FFFFFF',
                    boxShadow: form.metier === m.id ? 'none' : NEU_SMALL,
                    border: `2px solid ${form.metier === m.id ? '#E85D26' : '#E2E8F0'}`,
                  }}>
                  <span style={{ fontSize: '22px' }}>{m.icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: form.metier === m.id ? '#E85D26' : '#3D4852', flex: 1 }}>{m.label}</span>
                  {form.metier === m.id && <CheckCircle size={14} color="#E85D26" />}
                </button>
              ))}
            </div>
            <button onClick={finish} disabled={!form.metier || loading}
              className="btn-primary" style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (!form.metier || loading) ? 0.4 : 1 }}>
              {loading
                ? <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Création en cours...</>
                : <><CheckCircle size={16} /> Créer mon compte</>
              }
            </button>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', background: 'rgba(232,93,38,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle size={40} color="#E85D26" />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '28px', color: '#3D4852', marginBottom: '12px' }}>Compte créé ! 🎉</h2>
            <p style={{ color: '#6B7280', marginBottom: '32px' }}>Il ne reste plus qu'à vérifier votre identité pour activer votre profil</p>
            <Link href="/artisan-space/kyc" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', width: '100%' }}>
              <Zap size={16} /> Envoyer mes documents KYC
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
