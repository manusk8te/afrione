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
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 16px' }}>
      <div style={{ width: '100%', maxWidth: '448px' }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px', justifyContent: 'center', textDecoration: 'none' }}>
          <div className="w-8 h-8 afrione-gradient rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '20px', color: '#3D4852' }}>
            AFRI<span className="afrione-gradient-text">ONE</span>
          </span>
        </Link>

        {/* Progress */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: '4px', flex: 1, borderRadius: '99px', transition: 'all 0.5s',
              background: i <= step ? '#E85D26' : '#E2E8F0',
            }} />
          ))}
        </div>

        {/* Step 1 — Identité */}
        {step === 1 && (
          <div className="animate-fade-up">
            <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontSize: '28px', fontWeight: 700, color: '#3D4852', marginBottom: '8px' }}>
              Bienvenue !
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '32px' }}>Dites-nous comment vous appeler</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: "'Tahoma', sans-serif", color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Votre prénom et nom
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#8B95A5' }} />
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="Ex : Aya Konaté"
                    style={{
                      width: '100%', paddingLeft: '44px', padding: '12px 14px 12px 44px',
                      background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '12px',
                      fontSize: '15px', color: '#3D4852', outline: 'none',
                      fontFamily: "'Inter', sans-serif",
                      boxShadow: '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)',
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={form.name.length < 2}
                className="btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
              >
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Localisation */}
        {step === 2 && (
          <div className="animate-fade-up">
            <button onClick={() => setStep(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>
              <ArrowLeft size={16} /> Retour
            </button>
            <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontSize: '28px', fontWeight: 700, color: '#3D4852', marginBottom: '8px' }}>
              Où êtes-vous ?
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '32px' }}>Pour trouver les artisans les plus proches</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: "'Tahoma', sans-serif", color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Quartier
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#8B95A5', zIndex: 1 }} />
                  <select
                    value={form.quartier}
                    onChange={e => update('quartier', e.target.value)}
                    style={{
                      width: '100%', paddingLeft: '44px', padding: '12px 14px 12px 44px',
                      background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '12px',
                      fontSize: '15px', color: '#3D4852', outline: 'none', appearance: 'none',
                      fontFamily: "'Inter', sans-serif",
                      boxShadow: '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)',
                    }}
                  >
                    <option value="">Choisir un quartier</option>
                    {QUARTIERS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: "'Tahoma', sans-serif", color: '#8B95A5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Adresse précise (optionnel)
                </label>
                <input
                  type="text"
                  value={form.adresse}
                  onChange={e => update('adresse', e.target.value)}
                  placeholder="Rue, immeuble, repère..."
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '12px',
                    fontSize: '15px', color: '#3D4852', outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    boxShadow: '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)',
                  }}
                />
              </div>
              <button
                onClick={() => setStep(3)}
                disabled={!form.quartier}
                className="btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
              >
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Rôle */}
        {step === 3 && (
          <div className="animate-fade-up">
            <button onClick={() => setStep(2)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>
              <ArrowLeft size={16} /> Retour
            </button>
            <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontSize: '28px', fontWeight: 700, color: '#3D4852', marginBottom: '8px' }}>
              Vous êtes...
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '32px' }}>Votre expérience sera adaptée à votre profil</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { id: 'client', icon: '🏠', title: 'Un client', desc: 'Je cherche un artisan pour mes besoins' },
                { id: 'artisan', icon: '🔧', title: 'Un artisan', desc: 'Je propose mes services aux clients' },
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => update('role', r.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                    borderRadius: '16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    border: form.role === r.id ? '2px solid #E85D26' : '2px solid #E2E8F0',
                    background: form.role === r.id ? 'rgba(232,93,38,0.05)' : '#FFFFFF',
                    boxShadow: form.role === r.id
                      ? 'none'
                      : '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)',
                  }}
                >
                  <span style={{ fontSize: '28px' }}>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, color: '#3D4852', fontSize: '15px' }}>{r.title}</div>
                    <div style={{ fontSize: '13px', color: '#6B7280' }}>{r.desc}</div>
                  </div>
                  {form.role === r.id && <CheckCircle size={20} className="afrione-gradient-text" style={{ flexShrink: 0 }} />}
                </button>
              ))}
              <button
                onClick={finish}
                disabled={!form.role || loading}
                className="btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', marginTop: '8px' }}
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
