'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, ArrowRight, ArrowLeft, CheckCircle, Building2, Phone, Users, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

const SECTEURS_OPTS = [
  'Plomberie', 'Électricité', 'Maçonnerie', 'Peinture', 'Menuiserie',
  'Climatisation', 'Sécurité', 'Nettoyage', 'Jardinage', 'Informatique',
  'Carrelage', 'Toiture', 'Soudure', 'Vitrage', 'Déménagement',
]

const QUARTIERS_ABJ = [
  'Cocody', 'Plateau', 'Marcory', 'Treichville', 'Adjamé', 'Abobo',
  'Yopougon', 'Koumassi', 'Port-Bouët', 'Attécoubé', 'Bingerville', 'Anyama',
]

const NB_ARTISANS_OPTS = ['1–2', '3–5', '6–10', '11–20', '20+']

const STEPS = ['Votre structure', 'Activité', 'Confirmation']

export default function EntrepriseRegisterPage() {
  const router = useRouter()
  const [step, setStep]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // Étape 1
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [website, setWebsite]   = useState('')
  const [nbArtisans, setNbArtisans] = useState('')

  // Étape 2
  const [secteurs, setSecteurs]   = useState<string[]>([])
  const [quartiers, setQuartiers] = useState<string[]>([])

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return // pas connecté → on laisse accéder quand même, on demandera à la soumission

      const { data } = await supabase
        .from('entreprises')
        .select('id')
        .eq('owner_id', session.user.id)
        .single()
      if (data) router.push('/entreprise-space/dashboard')
    }
    check()
  }, [router])

  const submit = async () => {
    if (!name.trim())  { setError("Le nom de l'entreprise est requis"); return }
    if (!phone.trim()) { setError('Le numéro de téléphone est requis — nous vous appellerons pour valider'); return }
    if (secteurs.length === 0) { setError('Choisissez au moins un secteur d\'activité'); return }

    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push(`/auth?redirect=/entreprise-space/register`); return }

    const { error: entErr } = await supabase
      .from('entreprises')
      .insert({
        name:        name.trim(),
        description: desc.trim() || null,
        phone:       phone.trim(),
        email:       email.trim() || null,
        website:     website.trim() || null,
        secteurs,
        quartiers,
        owner_id:    session.user.id,
        kyc_status:  'pending',
        is_active:   false,
      })

    if (entErr) {
      setError('Erreur lors de la soumission. Réessayez.')
      setLoading(false)
      return
    }

    setLoading(false)
    setStep(2)
  }

  const toggleSecteur  = (s: string) => setSecteurs(p  => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  const toggleQuartier = (q: string) => setQuartiers(p => p.includes(q) ? p.filter(x => x !== q) : [...p, q])

  const field = (label: string, required = false) => (
    <div style={{ fontSize: '11px', fontWeight: 600, color: '#8B95A5', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
      {label}{required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
    </div>
  )

  const inputStyle = {
    width: '100%', background: '#FFFFFF', border: '1.5px solid #E2E8F0',
    borderRadius: '10px', padding: '12px 14px', color: '#3D4852', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', color: '#3D4852', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px 80px' }}>

      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '36px' }}>
        <div className="afrione-gradient" style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={18} color="white" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '18px', color: '#3D4852' }}>
          AFRI<span className="afrione-gradient-text">ONE</span>
        </span>
      </Link>

      <div style={{ width: '100%', maxWidth: '540px' }}>

        {step < 2 && (
          <>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Building2 size={22} color="#E85D26" />
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#3D4852', margin: 0 }}>Créer un espace entreprise</h1>
              </div>
              <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
                Remplissez ce formulaire. Notre équipe vous contactera par téléphone pour valider votre dossier.
              </p>
            </div>

            {/* Étapes */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
              {STEPS.slice(0, 2).map((s, i) => (
                <div key={s} style={{ flex: 1 }}>
                  <div style={{ height: '3px', borderRadius: '2px', background: i <= step ? '#E85D26' : '#E2E8F0', marginBottom: '5px', transition: 'background 0.3s' }} />
                  <span style={{ fontSize: '10px', color: i <= step ? '#E85D26' : '#8B95A5' }}>{s}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ background: '#FFFFFF', boxShadow: NEU_SHADOW, borderRadius: '20px', padding: '28px 24px' }}>

          {/* ── STEP 0 : infos structure ─────────────────────────────── */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                {field("Nom de l'entreprise", true)}
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : BTP Solutions Abidjan" style={inputStyle} />
              </div>

              <div>
                {field('Téléphone de contact', true)}
                <div style={{ position: 'relative' }}>
                  <Phone size={14} color="#E85D26" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+225 07 00 00 00" style={{ ...inputStyle, paddingLeft: '40px' }} />
                </div>
                <p style={{ fontSize: '11px', color: '#8B95A5', marginTop: '5px' }}>Nous vous appellerons sur ce numéro pour valider votre dossier</p>
              </div>

              <div>
                {field('Email')}
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@entreprise.ci" style={inputStyle} />
              </div>

              <div>
                {field("Nombre d'artisans dans votre structure")}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {NB_ARTISANS_OPTS.map(n => (
                    <button key={n} onClick={() => setNbArtisans(n)} style={{
                      padding: '8px 16px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '13px',
                      background: nbArtisans === n ? 'rgba(232,93,38,0.08)' : '#FFFFFF',
                      borderColor: nbArtisans === n ? 'rgba(232,93,38,0.4)' : '#E2E8F0',
                      color: nbArtisans === n ? '#E85D26' : '#6B7280',
                      boxShadow: nbArtisans === n ? 'none' : NEU_SMALL,
                    }}>
                      <Users size={11} style={{ display: 'inline', marginRight: '4px' }} />{n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {field('Description (optionnel)')}
                <textarea value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Décrivez votre structure en quelques phrases…" rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div>
                {field('Site web (optionnel)')}
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://www.entreprise.ci" style={inputStyle} />
              </div>

              {error && <p style={{ fontSize: '12px', color: '#ef4444', margin: 0 }}>{error}</p>}

              <button onClick={() => {
                if (!name.trim()) { setError("Le nom est requis"); return }
                if (!phone.trim()) { setError("Le téléphone est requis"); return }
                setError(''); setStep(1)
              }} className="btn-primary" style={{ width: '100%', padding: '14px', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }}>
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── STEP 1 : secteurs & zones ──────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#3D4852', marginBottom: '4px' }}>Secteurs d'activité <span style={{ color: '#ef4444' }}>*</span></div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Quels types de travaux votre équipe réalise-t-elle ?</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SECTEURS_OPTS.map(s => (
                    <button key={s} onClick={() => toggleSecteur(s)} style={{
                      padding: '7px 14px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '12px',
                      background: secteurs.includes(s) ? 'rgba(232,93,38,0.08)' : '#FFFFFF',
                      borderColor: secteurs.includes(s) ? 'rgba(232,93,38,0.4)' : '#E2E8F0',
                      color: secteurs.includes(s) ? '#E85D26' : '#6B7280',
                      boxShadow: secteurs.includes(s) ? 'none' : NEU_SMALL,
                    }}>{s}</button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#3D4852', marginBottom: '4px' }}>Zones d'intervention</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Dans quels quartiers d'Abidjan intervenez-vous ?</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {QUARTIERS_ABJ.map(q => (
                    <button key={q} onClick={() => toggleQuartier(q)} style={{
                      padding: '7px 14px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '12px',
                      background: quartiers.includes(q) ? 'rgba(96,165,250,0.08)' : '#FFFFFF',
                      borderColor: quartiers.includes(q) ? 'rgba(96,165,250,0.35)' : '#E2E8F0',
                      color: quartiers.includes(q) ? '#60a5fa' : '#6B7280',
                      boxShadow: quartiers.includes(q) ? 'none' : NEU_SMALL,
                    }}>{q}</button>
                  ))}
                </div>
              </div>

              {error && <p style={{ fontSize: '12px', color: '#ef4444', margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setStep(0)} style={{ flex: 1, padding: '13px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#6B7280', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: NEU_SMALL }}>
                  <ArrowLeft size={14} /> Retour
                </button>
                <button onClick={submit} disabled={loading} className="btn-primary" style={{ flex: 2, padding: '13px', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {loading ? 'Envoi en cours…' : <><CheckCircle size={15} /> Soumettre ma demande</>}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2 : confirmation ─────────────────────────────── */}
          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ width: '64px', height: '64px', background: 'rgba(232,93,38,0.08)', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={28} color="#E85D26" />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#3D4852', marginBottom: '12px' }}>Demande envoyée !</h2>
              <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.8, marginBottom: '8px' }}>
                Votre dossier pour <strong style={{ color: '#3D4852' }}>{name}</strong> a bien été reçu.
              </p>
              <div style={{ background: 'rgba(232,93,38,0.05)', border: '1px solid rgba(232,93,38,0.15)', borderRadius: '12px', padding: '16px 20px', margin: '20px 0', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Phone size={14} color="#E85D26" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#E85D26' }}>Prochaine étape</span>
                </div>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                  Notre équipe va vous appeler au <strong style={{ color: '#3D4852' }}>{phone}</strong> dans les <strong style={{ color: '#3D4852' }}>24 à 48h</strong> pour vérifier votre dossier.
                  Si tout est en ordre, votre espace sera activé.
                </p>
              </div>
              <Link href="/" className="btn-primary" style={{ display: 'block', padding: '13px', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
                Retour à l'accueil
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
