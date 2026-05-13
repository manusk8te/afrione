'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, ArrowRight, ArrowLeft, CheckCircle, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const SECTEURS_OPTS = [
  'Plomberie', 'Électricité', 'Maçonnerie', 'Peinture', 'Menuiserie',
  'Climatisation', 'Sécurité', 'Nettoyage', 'Jardinage', 'Informatique',
  'Carrelage', 'Toiture', 'Soudure', 'Vitrage', 'Déménagement',
]

const QUARTIERS_ABJ = [
  'Cocody', 'Plateau', 'Marcory', 'Treichville', 'Adjamé', 'Abobo',
  'Yopougon', 'Koumassi', 'Port-Bouët', 'Attécoubé', 'Bingerville', 'Anyama',
]

const STEPS = ['Compte', 'Entreprise', 'Activité', 'Envoyé']

export default function EntrepriseRegisterPage() {
  const router  = useRouter()
  const [step, setStep]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [website, setWebsite]   = useState('')
  const [secteurs, setSecteurs] = useState<string[]>([])
  const [quartiers, setQuartiers] = useState<string[]>([])

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      // Si l'entreprise existe déjà → dashboard
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
    if (!name.trim()) { setError("Le nom de l'entreprise est requis"); return }
    if (secteurs.length === 0) { setError('Choisissez au moins un secteur'); return }

    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth'); return }

    // Créer l'entreprise
    const { data: ent, error: entErr } = await supabase
      .from('entreprises')
      .insert({
        name: name.trim(),
        description: desc.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        secteurs,
        quartiers,
        owner_id: session.user.id,
        kyc_status: 'pending',
        is_active: false,
      })
      .select('id')
      .single()

    if (entErr || !ent) {
      setError("Erreur lors de la création. Réessayez.")
      setLoading(false)
      return
    }

    // Mettre le rôle en entreprise_admin
    await supabase.from('users').update({ role: 'entreprise_admin' }).eq('id', session.user.id)

    setLoading(false)
    setStep(3)
  }

  const toggleSecteur = (s: string) =>
    setSecteurs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const toggleQuartier = (q: string) =>
    setQuartiers(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q])

  return (
    <div style={{ minHeight: '100vh', background: '#0F1410', color: '#FAFAF5', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>

      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '32px' }}>
        <div style={{ width: '36px', height: '36px', background: '#E85D26', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={18} color="white" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '18px', color: '#FAFAF5' }}>
          AFRI<span style={{ color: '#E85D26' }}>ONE</span>
        </span>
      </Link>

      <div style={{ width: '100%', maxWidth: '520px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '32px 28px' }}>

        {/* Étapes */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: i <= step ? '#E85D26' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
              <span style={{ fontSize: '10px', color: i <= step ? '#E85D26' : '#7A7A6E' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* STEP 0 — Compte requis */}
        {step === 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Building2 size={24} color="#E85D26" />
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FAFAF5' }}>Créer un espace entreprise</div>
                <div style={{ fontSize: '12px', color: '#7A7A6E' }}>Pour les structures multi-artisans</div>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: '#7A7A6E', lineHeight: 1.7, marginBottom: '24px' }}>
              Un espace entreprise vous permet de gérer plusieurs artisans sous une même structure, de suivre les missions collectives et d'afficher un profil professionnel sur AfriOne.
            </p>
            <div style={{ background: 'rgba(232,93,38,0.08)', border: '1px solid rgba(232,93,38,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '24px', fontSize: '12px', color: '#C9A84C', lineHeight: 1.6 }}>
              Vous devez être connecté avec un compte AfriOne existant pour créer un espace entreprise. Votre compte deviendra l'administrateur de l'espace.
            </div>
            <button onClick={() => setStep(1)} style={{ width: '100%', padding: '14px', background: '#E85D26', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Commencer <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* STEP 1 — Infos entreprise */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#FAFAF5', marginBottom: '20px' }}>Informations de l'entreprise</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#7A7A6E', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nom de l'entreprise *</label>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ex : BTP Solutions Abidjan"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '12px 14px', color: '#FAFAF5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#7A7A6E', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                <textarea
                  value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Décrivez votre entreprise en quelques phrases…"
                  rows={3}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '12px 14px', color: '#FAFAF5', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#7A7A6E', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Téléphone</label>
                  <input
                    value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+225 07 00 00 00"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '12px 14px', color: '#FAFAF5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#7A7A6E', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
                  <input
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="contact@entreprise.ci"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '12px 14px', color: '#FAFAF5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#7A7A6E', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Site web</label>
                <input
                  value={website} onChange={e => setWebsite(e.target.value)}
                  placeholder="https://www.entreprise.ci"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '12px 14px', color: '#FAFAF5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {error && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '12px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setStep(0)} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#7A7A6E', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <ArrowLeft size={14} /> Retour
              </button>
              <button onClick={() => { if (!name.trim()) { setError('Le nom est requis'); return }; setError(''); setStep(2) }} style={{ flex: 2, padding: '12px', background: '#E85D26', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                Suivant <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Secteurs & zones */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#FAFAF5', marginBottom: '6px' }}>Secteurs & zones</div>
            <div style={{ fontSize: '12px', color: '#7A7A6E', marginBottom: '20px' }}>Choisissez les domaines et zones d'intervention de votre entreprise.</div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#7A7A6E', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Secteurs d'activité *</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SECTEURS_OPTS.map(s => (
                  <button key={s} onClick={() => toggleSecteur(s)} style={{
                    padding: '6px 14px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '12px',
                    background: secteurs.includes(s) ? 'rgba(232,93,38,0.15)' : 'rgba(255,255,255,0.04)',
                    borderColor: secteurs.includes(s) ? 'rgba(232,93,38,0.5)' : 'rgba(255,255,255,0.1)',
                    color: secteurs.includes(s) ? '#E85D26' : '#7A7A6E',
                  }}>{s}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#7A7A6E', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zones d'intervention (Abidjan)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {QUARTIERS_ABJ.map(q => (
                  <button key={q} onClick={() => toggleQuartier(q)} style={{
                    padding: '6px 14px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '12px',
                    background: quartiers.includes(q) ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                    borderColor: quartiers.includes(q) ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)',
                    color: quartiers.includes(q) ? '#60a5fa' : '#7A7A6E',
                  }}>{q}</button>
                ))}
              </div>
            </div>

            {error && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', marginBottom: '8px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#7A7A6E', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <ArrowLeft size={14} /> Retour
              </button>
              <button onClick={submit} disabled={loading} style={{ flex: 2, padding: '12px', background: '#E85D26', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {loading ? 'Création…' : <><CheckCircle size={14} /> Créer l'espace</>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Confirmation */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', background: 'rgba(34,197,94,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#FAFAF5', marginBottom: '10px' }}>Demande envoyée !</div>
            <p style={{ fontSize: '13px', color: '#7A7A6E', lineHeight: 1.7, marginBottom: '28px' }}>
              Votre espace entreprise <strong style={{ color: '#FAFAF5' }}>{name}</strong> est en cours de validation par l'équipe AfriOne.
              <br /><br />
              Vous serez notifié par email dès que votre dossier est examiné (généralement sous 24h).
            </p>
            <button onClick={() => router.push('/entreprise-space/dashboard')} style={{ width: '100%', padding: '14px', background: '#E85D26', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Accéder à mon espace
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
