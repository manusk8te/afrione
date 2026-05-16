'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Check, ChevronRight, ChevronLeft, ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

const QUARTIERS = [
  'Adjamé','Koumassi','Yopougon','Cocody','Plateau','Marcory',
  'Treichville','Abobo','Port-Bouët','Attécoubé','Bingerville','Anyama',
  'Deux-Plateaux','Angré','Riviera','Zone 4',
]

const CATEGORIES = ['Plomberie','Électricité','Peinture','Maçonnerie','Menuiserie','Climatisation','Carrelage','Serrurerie']
const UNITS = ['pièce','mètre','m²','kg','litre','sac','rouleau','boîte','pot','kit']

const INTERVENTIONS_BY_METIER: Record<string, string[]> = {
  'Plombier':     ['Fuite d\'eau','Robinet cassé','Débouchage WC','Installation évier','Remplacement chauffe-eau','Réparation toilette'],
  'Électricien':  ['Panne électrique','Installation prise','Tableau électrique','Éclairage','Câblage réseau','Court-circuit'],
  'Peintre':      ['Peinture intérieure','Enduit','Ravalement façade','Peinture plafond','Décoration murale','Ponçage'],
  'Maçon':        ['Réparation fissure','Carrelage','Enduit béton','Construction muret','Dallage','Ragréage'],
  'Menuisier':    ['Pose de porte','Réparation meuble','Installation placard','Parquet','Fenêtre','Escalier bois'],
  'Climatiseur':  ['Installation clim','Entretien clim','Nettoyage filtre','Fuite gaz','Dépannage ventilo'],
  'Carreleur':    ['Pose carrelage','Joint carrelage','Réparation sol','Faïence salle de bain'],
  'Serrurier':    ['Serrure bloquée','Changement cylindre','Installation verrou','Porte claquée'],
}

const DEFAULT_INTERVENTIONS = ['Dépannage urgence','Réparation','Installation','Entretien préventif']

type Material = {
  name: string
  category: string
  unit: string
  price_fcfa: number | ''
  qty_per_intervention: number | ''
}

const emptyMaterial = (): Material => ({
  name: '', category: 'Plomberie', unit: 'pièce', price_fcfa: '', qty_per_intervention: 1
})

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#F5F7FA',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#3D4852',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: '#6B7280',
  marginBottom: '5px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  fontWeight: 600,
}

type Submission = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  admin_notes?: string | null
}

export default function ArtisanQuestionnairePage() {
  const router = useRouter()

  const [loading, setLoading]     = useState(true)
  const [artisan, setArtisan]     = useState<any>(null)
  const [accessToken, setAccessToken] = useState<string>('')
  const [existing, setExisting]   = useState<Submission | null>(null)
  const [step, setStep]           = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [msg, setMsg]             = useState<{ text: string; ok: boolean } | null>(null)

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [experienceYears, setExperienceYears]     = useState<number | ''>(5)
  const [hasIdCard, setHasIdCard]                 = useState<boolean | null>(null)
  const [hasTrainingCert, setHasTrainingCert]     = useState<boolean | null>(null)
  const [transportMoyen, setTransportMoyen]       = useState<string>('')
  const [zonesTravail, setZonesTravail]           = useState<string[]>([])

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [dailyHours, setDailyHours]               = useState<number>(8)
  const [dailyEarnings, setDailyEarnings]         = useState<number | ''>(20000)

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [materials, setMaterials]                 = useState<Material[]>([emptyMaterial()])

  // ── Step 4 state ──────────────────────────────────────────────────────────
  const [hasOwnTools, setHasOwnTools]             = useState<boolean | null>(null)
  const [toolsDescription, setToolsDescription]   = useState<string>('')
  const [interventionTypes, setInterventionTypes] = useState<string[]>([])

  const hourlyRate = useMemo(() => {
    if (!dailyEarnings || !dailyHours || dailyHours === 0) return 0
    return Math.round(Number(dailyEarnings) / Number(dailyHours))
  }, [dailyEarnings, dailyHours])

  const availableInterventions = useMemo(() => {
    if (!artisan?.metier) return DEFAULT_INTERVENTIONS
    return INTERVENTIONS_BY_METIER[artisan.metier] || DEFAULT_INTERVENTIONS
  }, [artisan])

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      setAccessToken(session.access_token)

      const { data: artisanData } = await supabase
        .from('artisan_pros')
        .select('id, metier, years_experience, tarif_min')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!artisanData) { router.push('/artisan-space/register'); return }
      setArtisan(artisanData)

      // Pre-fill from artisan profile
      if (artisanData.years_experience) setExperienceYears(artisanData.years_experience)

      // Fetch existing submission
      const res = await fetch('/api/artisan-questionnaire', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setExisting(data)
          // Pre-fill form from existing submission
          if (data.experience_years)    setExperienceYears(data.experience_years)
          if (data.has_id_card != null) setHasIdCard(data.has_id_card)
          if (data.has_training_cert != null) setHasTrainingCert(data.has_training_cert)
          if (data.transport_moyen)     setTransportMoyen(data.transport_moyen)
          if (data.zones_travail?.length)   setZonesTravail(data.zones_travail)
          if (data.daily_hours)         setDailyHours(data.daily_hours)
          if (data.daily_earnings)      setDailyEarnings(data.daily_earnings)
          if (data.materials_used?.length)  setMaterials(data.materials_used.map((m: any) => ({
            name:                m.name                || '',
            category:            m.category            || 'Plomberie',
            unit:                m.unit                || 'pièce',
            price_fcfa:          m.price_fcfa          || '',
            qty_per_intervention: m.qty_per_intervention || 1,
          })))
          if (data.has_own_tools != null) setHasOwnTools(data.has_own_tools)
          if (data.tools_description)   setToolsDescription(data.tools_description)
          if (data.intervention_types?.length) setInterventionTypes(data.intervention_types)
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const toggleZone = (z: string) =>
    setZonesTravail(prev => prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z])

  const toggleIntervention = (i: string) =>
    setInterventionTypes(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

  const addMaterial = () => {
    if (materials.length >= 5) return
    setMaterials(prev => [...prev, emptyMaterial()])
  }

  const removeMaterial = (idx: number) =>
    setMaterials(prev => prev.filter((_, i) => i !== idx))

  const updateMaterial = (idx: number, field: keyof Material, value: any) =>
    setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))

  const canNextStep1 = hasIdCard !== null && hasTrainingCert !== null && transportMoyen !== '' && zonesTravail.length > 0 && experienceYears !== ''
  const canNextStep2 = dailyEarnings !== '' && Number(dailyEarnings) > 0
  const canNextStep3 = materials.every(m => m.name.trim() !== '' && m.price_fcfa !== '' && Number(m.price_fcfa) > 0)
  const canSubmit = hasOwnTools !== null && toolsDescription.trim().length > 3 && interventionTypes.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)

    const payload = {
      experience_years:      Number(experienceYears),
      has_id_card:           hasIdCard,
      has_training_cert:     hasTrainingCert,
      zones_travail:         zonesTravail,
      intervention_types:    interventionTypes,
      transport_moyen:       transportMoyen,
      daily_hours:           dailyHours,
      daily_earnings:        Number(dailyEarnings),
      hourly_rate_declared:  hourlyRate,
      materials_used:        materials.filter(m => m.name.trim() !== '').map(m => ({
        name:                m.name.trim(),
        category:            m.category,
        unit:                m.unit,
        price_fcfa:          Number(m.price_fcfa),
        qty_per_intervention: Number(m.qty_per_intervention) || 1,
      })),
      has_own_tools:         hasOwnTools,
      tools_description:     toolsDescription.trim(),
    }

    const res = await fetch('/api/artisan-questionnaire', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (data.ok) {
      setSubmitted(true)
      setExisting(data.submission)
    } else {
      flash('Erreur : ' + (data.error || 'inconnue'), false)
    }
    setSubmitting(false)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid rgba(232,93,38,0.2)', borderTop: '4px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ background: '#fff', borderRadius: '20px', padding: '40px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: NEU_SHADOW }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(43,107,62,0.12)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Check size={32} color="#2B6B3E" />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#3D4852', marginBottom: '12px' }}>Questionnaire soumis</h2>
          <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.7, marginBottom: '28px' }}>
            Votre questionnaire est en attente de validation AfriOne. Nous examinerons vos informations et mettrons à jour votre profil sous 24–48h.
          </p>
          <Link href="/artisan-space/dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#E85D26', color: 'white', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    )
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      pending:  { label: 'En attente de validation', color: '#C9A84C', bg: 'rgba(201,168,76,0.1)'  },
      approved: { label: 'Approuvé',                 color: '#2B6B3E', bg: 'rgba(43,107,62,0.1)'   },
      rejected: { label: 'Rejeté',                   color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
    }
    return map[status] || map.pending
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', padding: '24px 16px', maxWidth: '680px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link href="/artisan-space/dashboard" style={{ color: '#8B95A5', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#3D4852', margin: 0 }}>Questionnaire artisan</h1>
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>Renseignez vos informations pour optimiser votre profil</p>
        </div>
        <ClipboardList size={22} color="#E85D26" />
      </div>

      {/* ── Flash ── */}
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px',
          background: msg.ok ? 'rgba(43,107,62,0.1)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${msg.ok ? 'rgba(43,107,62,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: msg.ok ? '#2B6B3E' : '#ef4444',
        }}>
          {msg.text}
        </div>
      )}

      {/* ── Existing submission banner ── */}
      {existing && !submitted && (
        <div style={{
          padding: '12px 16px', borderRadius: '12px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '12px',
          background: statusBadge(existing.status).bg,
          border: `1px solid ${statusBadge(existing.status).color}40`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: statusBadge(existing.status).color }}>
              Questionnaire déjà soumis — {statusBadge(existing.status).label}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
              Soumis le {new Date(existing.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            {existing.admin_notes && (
              <div style={{ fontSize: '12px', color: '#3D4852', marginTop: '6px', fontStyle: 'italic' }}>
                Note admin : {existing.admin_notes}
              </div>
            )}
          </div>
          {existing.status === 'rejected' && (
            <span style={{ fontSize: '12px', color: '#E85D26', fontWeight: 600 }}>Vous pouvez resoumettre</span>
          )}
        </div>
      )}

      {/* ── Progress bar ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          {['Crédibilité', 'Tarification', 'Matériaux', 'Équipement'].map((label, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step > i + 1 ? '#2B6B3E' : step === i + 1 ? '#E85D26' : '#E2E8F0',
                color: step >= i + 1 ? 'white' : '#8B95A5',
                fontSize: '12px', fontWeight: 700, marginBottom: '4px',
                transition: 'all 0.2s',
              }}>
                {step > i + 1 ? <Check size={13} /> : i + 1}
              </div>
              <span style={{ fontSize: '10px', color: step === i + 1 ? '#E85D26' : '#8B95A5', fontWeight: step === i + 1 ? 700 : 400 }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((step - 1) / 3) * 100}%`, background: '#E85D26', borderRadius: '2px', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1 — Crédibilité
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Années d'expérience */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Années d'expérience dans le métier</label>
            <input
              type="number" min={1} max={40}
              value={experienceYears}
              onChange={e => setExperienceYears(e.target.value === '' ? '' : Number(e.target.value))}
              style={inputStyle}
              placeholder="Ex: 5"
            />
          </div>

          {/* CNI */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Avez-vous une CNI (Carte Nationale d'Identité) ?</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              {[true, false].map(val => (
                <button key={String(val)} onClick={() => setHasIdCard(val)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                    background: hasIdCard === val ? (val ? '#2B6B3E' : '#ef4444') : '#F5F7FA',
                    color: hasIdCard === val ? 'white' : '#6B7280',
                    boxShadow: hasIdCard === val ? 'none' : NEU_SMALL,
                    transition: 'all 0.15s',
                  }}>
                  {val ? 'Oui' : 'Non'}
                </button>
              ))}
            </div>
          </div>

          {/* Attestation formation */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Avez-vous une attestation de formation professionnelle ?</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              {[true, false].map(val => (
                <button key={String(val)} onClick={() => setHasTrainingCert(val)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                    background: hasTrainingCert === val ? (val ? '#2B6B3E' : '#ef4444') : '#F5F7FA',
                    color: hasTrainingCert === val ? 'white' : '#6B7280',
                    boxShadow: hasTrainingCert === val ? 'none' : NEU_SMALL,
                    transition: 'all 0.15s',
                  }}>
                  {val ? 'Oui' : 'Non'}
                </button>
              ))}
            </div>
          </div>

          {/* Moyen de transport */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Moyen de transport pour vos déplacements</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
              {[
                { id: 'pied',    label: '🚶 À pied'  },
                { id: 'moto',    label: '🏍️ Moto'     },
                { id: 'voiture', label: '🚗 Voiture'  },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setTransportMoyen(id)}
                  style={{
                    flex: 1, minWidth: '90px', padding: '10px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    background: transportMoyen === id ? '#E85D26' : '#F5F7FA',
                    color: transportMoyen === id ? 'white' : '#6B7280',
                    boxShadow: transportMoyen === id ? 'none' : NEU_SMALL,
                    transition: 'all 0.15s',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Zones d'intervention */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Zones d'intervention à Abidjan (sélectionnez toutes vos zones)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {QUARTIERS.map(q => (
                <button key={q} onClick={() => toggleZone(q)}
                  style={{
                    padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                    background: zonesTravail.includes(q) ? '#E85D26' : '#F5F7FA',
                    color: zonesTravail.includes(q) ? 'white' : '#6B7280',
                    boxShadow: zonesTravail.includes(q) ? 'none' : NEU_SMALL,
                    transition: 'all 0.15s',
                  }}>
                  {q}
                </button>
              ))}
            </div>
            {zonesTravail.length > 0 && (
              <p style={{ fontSize: '12px', color: '#2B6B3E', marginTop: '10px' }}>
                {zonesTravail.length} zone{zonesTravail.length > 1 ? 's' : ''} sélectionnée{zonesTravail.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2 — Tarification
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Heures par jour */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Combien d'heures travaillez-vous par jour en moyenne ?</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
              <input
                type="range" min={4} max={12} step={0.5}
                value={dailyHours}
                onChange={e => setDailyHours(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#E85D26' }}
              />
              <div style={{ textAlign: 'center', minWidth: '64px' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#E85D26' }}>{dailyHours}h</div>
                <div style={{ fontSize: '10px', color: '#8B95A5' }}>/ jour</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8B95A5', marginTop: '4px' }}>
              <span>4h (demi-journée)</span>
              <span>12h (longue journée)</span>
            </div>
          </div>

          {/* Revenus journaliers */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Pour une journée de travail typique, combien gagnez-vous ?</label>
            <div style={{ position: 'relative', marginTop: '4px' }}>
              <input
                type="number" min={0}
                value={dailyEarnings}
                onChange={e => setDailyEarnings(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 25000"
                style={{ ...inputStyle, paddingRight: '60px' }}
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#8B95A5', fontWeight: 600 }}>FCFA</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>
              Inclure le coût des matériaux si vous les fournissez, ou la main d'œuvre seule.
            </p>
          </div>

          {/* Taux horaire calculé */}
          <div style={{
            background: 'rgba(232,93,38,0.05)', border: '1.5px solid rgba(232,93,38,0.2)',
            borderRadius: '16px', padding: '20px', boxShadow: NEU_SMALL,
          }}>
            <div style={{ fontSize: '11px', color: '#E85D26', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
              Taux horaire estimé (calculé automatiquement)
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#3D4852' }}>
              {hourlyRate > 0 ? hourlyRate.toLocaleString('fr-FR') : '—'}
              <span style={{ fontSize: '14px', fontWeight: 400, color: '#6B7280', marginLeft: '6px' }}>FCFA/h</span>
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>
              Référence SMIG×2 : 866 FCFA/h (seuil minimum recommandé AfriOne)
            </div>
            {hourlyRate > 0 && hourlyRate < 866 && (
              <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '12px', color: '#ef4444' }}>
                Ce taux est en-dessous du SMIG×2. Vérifiez vos informations.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 3 — Matériaux
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '16px 20px', boxShadow: NEU_SMALL }}>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
              Listez les <strong style={{ color: '#3D4852' }}>matériaux que vous utilisez le plus souvent</strong> avec leur prix habituel à Abidjan. Ces données nous aident à améliorer les devis pour tous.
            </p>
          </div>

          {materials.map((mat, idx) => (
            <div key={idx} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '16px 20px', boxShadow: NEU_SHADOW }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#E85D26' }}>Matériau {idx + 1}</span>
                {materials.length > 1 && (
                  <button onClick={() => removeMaterial(idx)}
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Nom du matériau *</label>
                <input
                  value={mat.name}
                  onChange={e => updateMaterial(idx, 'name', e.target.value)}
                  placeholder="Ex: Joint plomberie, Câble 2.5mm…"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={labelStyle}>Catégorie</label>
                  <select value={mat.category} onChange={e => updateMaterial(idx, 'category', e.target.value)}
                    style={{ ...inputStyle }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Unité</label>
                  <select value={mat.unit} onChange={e => updateMaterial(idx, 'unit', e.target.value)}
                    style={{ ...inputStyle }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Prix unitaire (FCFA) *</label>
                  <input
                    type="number" min={0}
                    value={mat.price_fcfa}
                    onChange={e => updateMaterial(idx, 'price_fcfa', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 1200"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Qté par intervention</label>
                  <input
                    type="number" min={1}
                    value={mat.qty_per_intervention}
                    onChange={e => updateMaterial(idx, 'qty_per_intervention', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="1"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          ))}

          {materials.length < 5 && (
            <button onClick={addMaterial}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '12px', borderRadius: '12px', cursor: 'pointer',
                background: 'rgba(232,93,38,0.06)', border: '1.5px dashed rgba(232,93,38,0.3)',
                color: '#E85D26', fontWeight: 700, fontSize: '14px',
              }}>
              <Plus size={16} /> Ajouter un matériau ({materials.length}/5)
            </button>
          )}

          {materials.length === 5 && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#8B95A5' }}>Maximum de 5 matériaux atteint</p>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 4 — Équipement
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Outillage propre */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Avez-vous votre propre outillage professionnel ?</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              {[true, false].map(val => (
                <button key={String(val)} onClick={() => setHasOwnTools(val)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                    background: hasOwnTools === val ? (val ? '#2B6B3E' : '#ef4444') : '#F5F7FA',
                    color: hasOwnTools === val ? 'white' : '#6B7280',
                    boxShadow: hasOwnTools === val ? 'none' : NEU_SMALL,
                    transition: 'all 0.15s',
                  }}>
                  {val ? 'Oui, j\'ai mon outillage' : 'Non, j\'emprunte ou loue'}
                </button>
              ))}
            </div>
          </div>

          {/* Description des outils */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Décrivez vos principaux outils de travail</label>
            <textarea
              value={toolsDescription}
              onChange={e => setToolsDescription(e.target.value)}
              placeholder="Ex: Clé à molette, pince multiprise, perceuse, multimètre…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Types d'interventions */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: NEU_SHADOW }}>
            <label style={labelStyle}>Types d'interventions les plus fréquentes (sélectionnez-en au moins 1)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {availableInterventions.map(i => (
                <button key={i} onClick={() => toggleIntervention(i)}
                  style={{
                    padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                    background: interventionTypes.includes(i) ? '#E85D26' : '#F5F7FA',
                    color: interventionTypes.includes(i) ? 'white' : '#6B7280',
                    boxShadow: interventionTypes.includes(i) ? 'none' : NEU_SMALL,
                    transition: 'all 0.15s',
                  }}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none', cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
              background: canSubmit && !submitting ? '#E85D26' : '#E2E8F0',
              color: canSubmit && !submitting ? 'white' : '#8B95A5',
              fontSize: '15px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.15s',
            }}>
            {submitting ? (
              <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Envoi en cours…</>
            ) : (
              <><Check size={16} /> Soumettre mon questionnaire</>
            )}
          </button>

          {!canSubmit && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#8B95A5' }}>
              Remplissez tous les champs obligatoires pour soumettre
            </p>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0',
              background: '#fff', color: '#6B7280', fontWeight: 600, fontSize: '14px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              boxShadow: NEU_SMALL,
            }}>
            <ChevronLeft size={16} /> Précédent
          </button>
        )}
        {step < 4 && (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={
              (step === 1 && !canNextStep1) ||
              (step === 2 && !canNextStep2) ||
              (step === 3 && !canNextStep3)
            }
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: (
                (step === 1 && !canNextStep1) ||
                (step === 2 && !canNextStep2) ||
                (step === 3 && !canNextStep3)
              ) ? '#E2E8F0' : '#E85D26',
              color: (
                (step === 1 && !canNextStep1) ||
                (step === 2 && !canNextStep2) ||
                (step === 3 && !canNextStep3)
              ) ? '#8B95A5' : 'white',
              fontSize: '14px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'all 0.15s',
            }}>
            Suivant <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
