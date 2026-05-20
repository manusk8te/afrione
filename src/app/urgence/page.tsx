'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import { Zap, X, Shield, Clock } from 'lucide-react'
import { SENSITIVITY_COEFS, TEMPORAL_COEFS, INSURANCE_AMOUNT } from '@/types/business'
import toast from 'react-hot-toast'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_HOVER  = '10px 10px 22px rgba(163,177,198,0.65), -6px -6px 16px rgba(255,255,255,1)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

const syne = { fontFamily: "'Satoshi', sans-serif" }  as const
const body = { fontFamily: "'Inter', sans-serif" }    as const
const mono = { fontFamily: "'Tahoma', sans-serif" }   as const

const CATEGORY_ICONS: Record<string, string> = {
  plomberie:     '🔧',
  electricite:   '⚡',
  climatisation: '❄️',
  serrurerie:    '🔑',
}

type Prestation = {
  id: string
  code: string
  category: string
  label: string
  base_price: number
  estimated_duration_minutes: number
  required_level: string
  default_sensitivity: string
}

type TemporalKey = keyof typeof TEMPORAL_COEFS
type SensitivityKey = keyof typeof SENSITIVITY_COEFS

export default function UrgencePage() {
  const router = useRouter()
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [selected,    setSelected]    = useState<Prestation | null>(null)
  const [temporal,    setTemporal]    = useState<TemporalKey>('express')
  const [insurance,   setInsurance]   = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [userId,      setUserId]      = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null)
    })

    supabase
      .from('prestations_catalog')
      .select('*')
      .in('default_sensitivity', ['urgent', 'critique'])
      .order('category')
      .limit(12)
      .then(({ data }) => setPrestations(data || []))
  }, [])

  const computePrice = (p: Prestation): number => {
    const sens = SENSITIVITY_COEFS[p.default_sensitivity as SensitivityKey] ?? SENSITIVITY_COEFS.normal
    const temp = TEMPORAL_COEFS[temporal]
    const base = Math.round(p.base_price * sens.coef * temp.coef)
    const fee  = Math.round(base * 0.20)
    return base + fee + (insurance ? INSURANCE_AMOUNT : 0)
  }

  const handleCommander = async () => {
    if (!selected) return
    if (!userId) { router.push('/auth?redirect=/urgence'); return }

    setLoading(true)
    const price = computePrice(selected)

    try {
      const { data: mission, error } = await supabase
        .from('missions')
        .insert({
          client_id:         userId,
          mode:              'urgent',
          category:          selected.category.charAt(0).toUpperCase() + selected.category.slice(1),
          status:            'diagnostic',
          insurance_taken:   insurance,
          insurance_amount:  insurance ? INSURANCE_AMOUNT : 0,
          final_amount_client: price,
        })
        .select('id')
        .single()

      if (error || !mission) { toast.error('Erreur création mission'); setLoading(false); return }

      const res = await fetch('/api/wave-checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          mission_id:  mission.id,
          amount:      price,
          description: `AfriOne Urgent — ${selected.label}`,
        }),
      })
      const data = await res.json()

      if (data.simulation) {
        toast('Paiement simulé — recherche d\'un artisan…', { icon: '🧪' })
        await fetch('/api/dispatch/simulate-pay', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ mission_id: mission.id, amount: price }),
        })
        router.push(`/dispatch/${mission.id}`)
        return
      }

      if (data.wave_launch_url) {
        window.location.href = data.wave_launch_url
      } else {
        toast.error('Erreur Wave')
        setLoading(false)
      }
    } catch {
      toast.error('Erreur réseau')
      setLoading(false)
    }
  }

  const price = selected ? computePrice(selected) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', color: '#3D4852' }}>
      <Navbar />

      {/* Hero */}
      <div className="afrione-gradient" style={{ paddingTop: '80px', paddingBottom: '32px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', borderRadius: '20px', padding: '5px 14px', marginBottom: '14px' }}>
          <Zap size={11} color="white" />
          <span style={{ ...mono, fontSize: '10px', color: 'white', letterSpacing: '0.1em' }}>INTERVENTION URGENTE</span>
        </div>
        <h1 style={{ ...syne, fontWeight: 800, fontSize: 'clamp(24px, 5vw, 40px)', color: 'white', margin: '0 0 8px', lineHeight: 1.1 }}>
          Quel est ton problème ?
        </h1>
        <p style={{ ...body, fontSize: '14px', color: 'rgba(255,255,255,0.75)', margin: 0 }}>
          Choisis, paie, un artisan arrive chez toi.
        </p>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* Grille 12 problèmes */}
        {prestations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8B95A5' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid rgba(232,93,38,0.3)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            Chargement...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {prestations.map(p => {
              const isSelected = selected?.code === p.code
              const sensCfg    = SENSITIVITY_COEFS[p.default_sensitivity as SensitivityKey] ?? SENSITIVITY_COEFS.normal
              return (
                <button
                  key={p.code}
                  onClick={() => { setSelected(isSelected ? null : p); setInsurance(false) }}
                  style={{
                    textAlign: 'left', border: 'none', cursor: 'pointer',
                    background: 'white', borderRadius: '18px', padding: '18px',
                    boxShadow: isSelected ? 'none' : NEU_SMALL,
                    outline: isSelected ? `2px solid #E85D26` : 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.boxShadow = NEU_HOVER }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.boxShadow = NEU_SMALL }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '10px' }}>
                    {CATEGORY_ICONS[p.category] ?? '🔧'}
                  </div>
                  <div style={{ ...syne, fontWeight: 700, fontSize: '14px', color: '#3D4852', marginBottom: '4px', lineHeight: 1.3 }}>
                    {p.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ ...mono, fontSize: '12px', color: sensCfg.color, fontWeight: 700 }}>
                      {p.base_price.toLocaleString('fr')} F
                    </span>
                    <span style={{ fontSize: '10px', ...mono, color: sensCfg.color, background: `${sensCfg.color}15`, padding: '2px 8px', borderRadius: '10px' }}>
                      {p.default_sensitivity}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Modal inline de calcul */}
        {selected && (
          <div style={{ background: 'white', borderRadius: '24px', padding: '24px', boxShadow: NEU_SHADOW, marginBottom: '16px' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ ...mono, fontSize: '10px', color: '#E85D26', letterSpacing: '0.1em', marginBottom: '4px' }}>PRESTATION SÉLECTIONNÉE</div>
                <div style={{ ...syne, fontWeight: 700, fontSize: '18px', color: '#3D4852' }}>{selected.label}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B95A5' }}>
                <X size={18} />
              </button>
            </div>

            {/* Décomposition prix */}
            <div style={{ background: '#F5F7FA', borderRadius: '14px', padding: '14px', marginBottom: '16px' }}>
              {(() => {
                const sens = SENSITIVITY_COEFS[selected.default_sensitivity as SensitivityKey] ?? SENSITIVITY_COEFS.normal
                const temp = TEMPORAL_COEFS[temporal]
                const base = selected.base_price
                const afterSens = Math.round(base * sens.coef)
                const afterTemp = Math.round(afterSens * temp.coef)
                const fee       = Math.round(afterTemp * 0.20)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Prix de base', value: base, note: '' },
                      { label: `Sensibilité (×${sens.coef})`, value: afterSens - base, note: sens.label, color: sens.color },
                      { label: `Horaire (×${temp.coef})`,    value: afterTemp - afterSens, note: temp.label },
                      { label: 'Commission AfriOne (20%)',   value: fee,                   note: '' },
                      ...(insurance ? [{ label: 'Assurance travaux', value: INSURANCE_AMOUNT, note: 'Garantie 30j', color: '#2B6B3E' }] : []),
                    ].map(({ label, value, note, color }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ ...body, fontSize: '13px', color: '#6B7280' }}>{label}</span>
                          {note && <span style={{ ...mono, fontSize: '10px', color: color ?? '#8B95A5', marginLeft: '6px' }}>{note}</span>}
                        </div>
                        <span style={{ ...mono, fontSize: '13px', color: value > 0 ? '#3D4852' : '#8B95A5', fontWeight: 600 }}>
                          {value > 0 ? `+${value.toLocaleString('fr')}` : '—'} F
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Sélection temporelle */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ ...mono, fontSize: '10px', color: '#8B95A5', letterSpacing: '0.08em', marginBottom: '8px' }}>QUAND ?</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {(Object.keys(TEMPORAL_COEFS) as TemporalKey[]).map(key => {
                  const t = TEMPORAL_COEFS[key]
                  const active = temporal === key
                  return (
                    <button key={key} onClick={() => setTemporal(key)} style={{
                      padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      background: active ? '#E85D26' : 'white',
                      color:      active ? 'white'   : '#6B7280',
                      boxShadow:  active ? 'none'    : NEU_SMALL,
                      ...syne, fontWeight: 600, fontSize: '12px',
                      transition: 'all 0.15s',
                    }}>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Assurance */}
            <button
              onClick={() => setInsurance(v => !v)}
              style={{
                width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                background: insurance ? 'rgba(43,107,62,0.06)' : 'white',
                borderRadius: '14px', padding: '14px 16px',
                boxShadow: insurance ? 'none' : NEU_SMALL,
                outline: insurance ? '1.5px solid #2B6B3E' : 'none',
                display: 'flex', alignItems: 'center', gap: '12px',
                marginBottom: '20px', transition: 'all 0.15s',
              }}>
              <Shield size={18} color={insurance ? '#2B6B3E' : '#8B95A5'} />
              <div style={{ flex: 1 }}>
                <div style={{ ...syne, fontWeight: 700, fontSize: '14px', color: insurance ? '#2B6B3E' : '#3D4852' }}>
                  Assurance travaux +{INSURANCE_AMOUNT} F
                </div>
                <div style={{ ...body, fontSize: '12px', color: '#8B95A5' }}>Garantie 30 jours sur la prestation</div>
              </div>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${insurance ? '#2B6B3E' : '#E2E8F0'}`, background: insurance ? '#2B6B3E' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {insurance && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
              </div>
            </button>

            {/* Total + CTA */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #E2E8F0', marginBottom: '16px' }}>
              <div>
                <div style={{ ...mono, fontSize: '10px', color: '#8B95A5', marginBottom: '2px' }}>TOTAL</div>
                <div style={{ ...mono, fontSize: '28px', fontWeight: 700, color: '#E85D26' }}>
                  {price.toLocaleString('fr')} <span style={{ fontSize: '14px' }}>FCFA</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', ...body, fontSize: '12px', color: '#8B95A5' }}>
                <Clock size={12} />
                ~{selected.estimated_duration_minutes} min
              </div>
            </div>

            <button
              onClick={handleCommander}
              disabled={loading}
              style={{
                width: '100%', padding: '16px', border: 'none', borderRadius: '16px',
                background: 'linear-gradient(135deg, #E85D26, #ff7043)',
                color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
                ...syne, fontWeight: 800, fontSize: '16px',
                boxShadow: '0 8px 24px rgba(232,93,38,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                opacity: loading ? 0.75 : 1,
              }}>
              {loading
                ? <><div style={{ width: '18px', height: '18px', border: '2.5px solid rgba(255,255,255,0.4)', borderTop: '2.5px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Traitement...</>
                : <><Zap size={20} /> Payer & Trouver un artisan</>
              }
            </button>
          </div>
        )}

        <p style={{ ...body, fontSize: '12px', color: '#8B95A5', textAlign: 'center' }}>
          Remboursement intégral si aucun artisan n'est disponible
        </p>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
