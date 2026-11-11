'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/* Questionnaire artisan : 3 étapes + relecture.
 * Il ne redemande rien de ce qui existe déjà : la carte d'identité et le diplôme
 * viennent de la vérification d'identité, l'expérience du profil. */

const QUARTIERS = [
  'Adjamé', 'Koumassi', 'Yopougon', 'Cocody', 'Plateau', 'Marcory',
  'Treichville', 'Abobo', 'Port-Bouët', 'Attécoubé', 'Bingerville', 'Anyama',
  'Deux-Plateaux', 'Angré', 'Riviera', 'Zone 4',
]
const CATEGORIES = ['Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie', 'Climatisation', 'Carrelage', 'Serrurerie']
const UNITS = ['pièce', 'mètre', 'm²', 'kg', 'litre', 'sac', 'rouleau', 'boîte', 'pot', 'kit']
const TRANSPORTS = [{ id: 'À pied', label: 'À pied' }, { id: 'Moto', label: 'Moto' }, { id: 'Voiture', label: 'Voiture' }]
const MIN_HOURLY = 866

const INTERVENTIONS_BY_METIER: Record<string, string[]> = {
  Plombier: ['Fuite d’eau', 'Robinet cassé', 'Débouchage WC', 'Installation évier', 'Remplacement chauffe-eau', 'Réparation toilette'],
  Électricien: ['Panne électrique', 'Installation prise', 'Tableau électrique', 'Éclairage', 'Câblage réseau', 'Court-circuit'],
  Peintre: ['Peinture intérieure', 'Enduit', 'Ravalement façade', 'Peinture plafond', 'Décoration murale', 'Ponçage'],
  Maçon: ['Réparation fissure', 'Carrelage', 'Enduit béton', 'Construction muret', 'Dallage', 'Ragréage'],
  Menuisier: ['Pose de porte', 'Réparation meuble', 'Installation placard', 'Parquet', 'Fenêtre', 'Escalier bois'],
  Climatiseur: ['Installation clim', 'Entretien clim', 'Nettoyage filtre', 'Fuite gaz', 'Dépannage ventilo'],
  Carreleur: ['Pose carrelage', 'Joint carrelage', 'Réparation sol', 'Faïence salle de bain'],
  Serrurier: ['Serrure bloquée', 'Changement cylindre', 'Installation verrou', 'Porte claquée'],
}
const DEFAULT_INTERVENTIONS = ['Dépannage urgence', 'Réparation', 'Installation', 'Entretien préventif']

type Material = { name: string; category: string; unit: string; price_fcfa: number | ''; qty_per_intervention: number | '' }
const emptyMaterial = (category = 'Plomberie'): Material => ({ name: '', category, unit: 'pièce', price_fcfa: '', qty_per_intervention: 1 })
type Submission = { id: string; status: 'pending' | 'approved' | 'rejected'; submitted_at: string; admin_notes?: string | null }

const STEPS = [
  { title: 'Votre activité', why: 'Où vous travaillez et ce que vous faites le plus souvent. Les clients proches de vous et qui cherchent ce métier vous voient en premier.' },
  { title: 'Vos prix', why: 'Pour calculer des devis justes, AfriOne a besoin de savoir combien vous gagnez. Ce n’est pas affiché aux clients.' },
  { title: 'Matériel et matériaux', why: 'Ce que vous avez déjà comme outils, et le prix des matériaux que vous utilisez le plus. Cela rend les devis plus précis.' },
  { title: 'Vérifier et envoyer', why: 'Relisez vos réponses. Vous pourrez les modifier plus tard.' },
]

const field: React.CSSProperties = { width: '100%', minHeight: 48, padding: '0 14px', border: '1.5px solid #d6cbc1', borderRadius: 12, background: '#fff', fontSize: 16, color: '#1f1611', outline: 'none', boxSizing: 'border-box' }
const label: React.CSSProperties = { display: 'block', margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#1f1611' }
const hint: React.CSSProperties = { margin: '6px 0 0', fontSize: 13, color: '#65564b', lineHeight: 1.45 }

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{
      minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 600,
      border: `1.5px solid ${on ? '#c2410c' : '#d6cbc1'}`, background: on ? '#c2410c' : '#fff', color: on ? '#fff' : '#1f1611',
    }}>{on && <Check size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />}{children}</button>
  )
}

export default function ArtisanQuestionnairePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [artisan, setArtisan] = useState<any>(null)
  const [token, setToken] = useState('')
  const [existing, setExisting] = useState<Submission | null>(null)
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const [transport, setTransport] = useState('')
  const [zones, setZones] = useState<string[]>([])
  const [interventions, setInterventions] = useState<string[]>([])
  const [dailyHours, setDailyHours] = useState<number>(8)
  const [dailyEarnings, setDailyEarnings] = useState<number | ''>('')
  const [hasTools, setHasTools] = useState<boolean | null>(null)
  const [toolsText, setToolsText] = useState('')
  const [materials, setMaterials] = useState<Material[]>([])

  const hourly = useMemo(() => (dailyEarnings && dailyHours ? Math.round(Number(dailyEarnings) / Number(dailyHours)) : 0), [dailyEarnings, dailyHours])
  const choices = useMemo(() => INTERVENTIONS_BY_METIER[artisan?.metier] || DEFAULT_INTERVENTIONS, [artisan])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      setToken(session.access_token)
      const { data: a } = await supabase.from('artisan_pros').select('id, metier, years_experience, tarif_min, quartiers').eq('user_id', session.user.id).maybeSingle()
      if (!a) { router.push('/artisan-space/register'); return }
      setArtisan(a)
      if (Array.isArray(a.quartiers) && a.quartiers.length) setZones(a.quartiers.filter((q: string) => QUARTIERS.includes(q)))
      const res = await fetch('/api/artisan-questionnaire', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (res.ok) {
        const d = await res.json()
        if (d) {
          setExisting(d)
          if (d.transport_moyen) setTransport(d.transport_moyen)
          if (d.zones_travail?.length) setZones(d.zones_travail)
          if (d.intervention_types?.length) setInterventions(d.intervention_types)
          if (d.daily_hours) setDailyHours(d.daily_hours)
          if (d.daily_earnings) setDailyEarnings(d.daily_earnings)
          if (d.has_own_tools != null) setHasTools(d.has_own_tools)
          if (d.tools_description) setToolsText(d.tools_description)
          if (d.materials_used?.length) setMaterials(d.materials_used.map((m: any) => ({ name: m.name || '', category: m.category || 'Plomberie', unit: m.unit || 'pièce', price_fcfa: m.price_fcfa || '', qty_per_intervention: m.qty_per_intervention || 1 })))
        }
      }
      setLoading(false)
    }
    init()
  }, [router])

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  const startedMaterials = materials.filter(m => m.name.trim() || m.price_fcfa !== '')
  const materialsOk = startedMaterials.every(m => m.name.trim() && Number(m.price_fcfa) > 0)

  const ok1 = !!transport && zones.length > 0 && interventions.length > 0
  const ok2 = Number(dailyEarnings) > 0 && dailyHours > 0 && hourly > 0
  const ok3 = hasTools !== null && materialsOk
  const canNext = step === 1 ? ok1 : step === 2 ? ok2 : step === 3 ? ok3 : true

  const submit = async () => {
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/artisan-questionnaire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        experience_years: artisan?.years_experience ?? null,
        zones_travail: zones,
        intervention_types: interventions,
        transport_moyen: transport,
        daily_hours: dailyHours,
        daily_earnings: Number(dailyEarnings),
        hourly_rate_declared: hourly,
        materials_used: startedMaterials.map(m => ({ name: m.name.trim(), category: m.category, unit: m.unit, price_fcfa: Number(m.price_fcfa), qty_per_intervention: Number(m.qty_per_intervention) || 1 })),
        has_own_tools: hasTools,
        tools_description: toolsText.trim() || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.ok) { setDone(true); setExisting(data.submission) } else setError(data.error || 'L’envoi a échoué. Réessayez.')
    setSubmitting(false)
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#faf8f5' }}><span className="wr-spinner" style={{ borderColor: 'rgba(194,65,12,0.25)', borderTopColor: '#c2410c', width: 34, height: 34 }} /></div>

  if (done) {
    return (
      <main style={{ minHeight: '100vh', background: '#faf8f5', display: 'grid', placeItems: 'center', padding: 16 }}>
        <section className="acard" style={{ maxWidth: 520, width: '100%', padding: 28 }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: 999, background: '#e7f4ea', color: '#1f6b3a' }}><Check size={28} /></span>
          <h1 style={{ margin: '16px 0 6px', fontFamily: 'var(--font-display)', fontSize: 24, color: '#1f1611' }}>Questionnaire envoyé</h1>
          <p style={{ margin: 0, color: '#65564b', fontSize: 15, lineHeight: 1.5 }}>Voici ce qui se passe maintenant :</p>
          <ol style={{ margin: '14px 0 0', paddingLeft: 20, display: 'grid', gap: 10, color: '#1f1611', fontSize: 15, lineHeight: 1.45 }}>
            <li><strong>AfriOne relit vos réponses</strong> sous 24 à 48 h ouvrées. Vous n’avez rien à faire.</li>
            <li><strong>Vos prix servent à calculer vos devis</strong> une fois le questionnaire validé.</li>
            <li><strong>Vous êtes prévenu</strong> : le tableau de bord se met à jour. Activez les notifications (la cloche) pour recevoir l’alerte.</li>
          </ol>
          <Link className="journey__btn" href="/artisan-space/dashboard" style={{ marginTop: 20 }}>Retour à mon tableau de bord <ArrowRight size={18} /></Link>
        </section>
      </main>
    )
  }

  const status = existing?.status
  return (
    <main style={{ minHeight: '100vh', background: '#faf8f5', paddingBottom: 96 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.94)', borderBottom: '1px solid rgba(110,72,44,0.12)', backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/artisan-space/dashboard" aria-label="Retour au tableau de bord" className="warroom-icon-button" style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 999, border: '1px solid rgba(110,72,44,0.16)', color: '#1f1611' }}><ArrowLeft size={18} /></Link>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, color: '#1f1611' }}>Questionnaire artisan</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#65564b' }}>Étape {step} sur {STEPS.length} · {STEPS[step - 1].title}</p>
          </div>
        </div>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px 10px', display: 'grid', gridTemplateColumns: `repeat(${STEPS.length},1fr)`, gap: 4 }} aria-hidden="true">
          {STEPS.map((s, i) => <span key={s.title} style={{ height: 5, borderRadius: 999, background: i < step ? '#c2410c' : 'rgba(110,72,44,0.14)' }} />)}
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px', display: 'grid', gap: 16 }}>
        {status === 'rejected' && (
          <div role="alert" style={{ padding: 16, borderRadius: 16, background: '#fdecea', color: '#7a1a12' }}>
            <strong>À corriger</strong>
            <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.45 }}>{existing?.admin_notes || 'AfriOne vous demande de revoir vos réponses.'}</p>
          </div>
        )}
        {status === 'pending' && <div style={{ padding: 14, borderRadius: 16, background: '#fff4d6', color: '#6b4a00', fontSize: 14 }}>Votre questionnaire est en cours de vérification. Vous pouvez encore le modifier.</div>}
        {status === 'approved' && <div style={{ padding: 14, borderRadius: 16, background: '#e7f4ea', color: '#1f6b3a', fontSize: 14 }}>Questionnaire validé. Si vous le modifiez, AfriOne le relira.</div>}

        <p style={{ margin: 0, color: '#4a3d33', fontSize: 15, lineHeight: 1.5 }}>{STEPS[step - 1].why}</p>

        {step === 1 && (
          <section className="acard" style={{ padding: 20, display: 'grid', gap: 22 }}>
            <div>
              <p style={label}>Comment vous déplacez-vous ?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{TRANSPORTS.map(t => <Chip key={t.id} on={transport === t.id} onClick={() => setTransport(t.id)}>{t.label}</Chip>)}</div>
            </div>
            <div>
              <p style={label}>Dans quels quartiers intervenez-vous ?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{QUARTIERS.map(z => <Chip key={z} on={zones.includes(z)} onClick={() => toggle(zones, setZones, z)}>{z}</Chip>)}</div>
              <p style={hint}>{zones.length ? `${zones.length} quartier${zones.length > 1 ? 's' : ''} choisi${zones.length > 1 ? 's' : ''}` : 'Choisissez au moins un quartier.'}</p>
            </div>
            <div>
              <p style={label}>Quelles interventions faites-vous le plus souvent ?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{choices.map(i => <Chip key={i} on={interventions.includes(i)} onClick={() => toggle(interventions, setInterventions, i)}>{i}</Chip>)}</div>
              <p style={hint}>Choisissez-en au moins une.</p>
            </div>
            <p style={{ ...hint, margin: 0, padding: '10px 12px', borderRadius: 12, background: '#f4efe9' }}>
              Votre expérience ({artisan?.years_experience ? `${artisan.years_experience} ans` : 'non renseignée'}) vient de votre profil. <Link href="/artisan-space/dashboard?tab=profile" style={{ color: '#9a3412', fontWeight: 700 }}>La modifier</Link>
            </p>
          </section>
        )}

        {step === 2 && (
          <section className="acard" style={{ padding: 20, display: 'grid', gap: 20 }}>
            <div>
              <label htmlFor="hours" style={label}>Combien d’heures travaillez-vous par jour en moyenne ?</label>
              <input id="hours" style={field} type="number" inputMode="numeric" min={1} max={16} value={dailyHours} onChange={e => setDailyHours(Math.min(16, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
            <div>
              <label htmlFor="earn" style={label}>Pour une journée de travail normale, combien gagnez-vous (en FCFA) ?</label>
              <input id="earn" style={field} type="number" inputMode="numeric" placeholder="Ex : 25000" value={dailyEarnings} onChange={e => setDailyEarnings(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div style={{ padding: 16, borderRadius: 16, background: hourly && hourly < MIN_HOURLY ? '#fdecea' : '#fff1e8' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#65564b' }}>Votre tarif horaire, calculé</p>
              <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: '#9a3412' }}>{hourly ? `${hourly.toLocaleString('fr-FR')} FCFA/h` : '—'}</p>
              <p style={hint}>{hourly && hourly < MIN_HOURLY ? `C’est en dessous du minimum légal (${MIN_HOURLY} FCFA/h). Vérifiez vos chiffres.` : 'C’est ce tarif qui sert de base à vos devis. Vous pourrez l’ajuster dans votre profil.'}</p>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="acard" style={{ padding: 20, display: 'grid', gap: 22 }}>
            <div>
              <p style={label}>Avez-vous votre propre outillage professionnel ?</p>
              <div style={{ display: 'flex', gap: 8 }}><Chip on={hasTools === true} onClick={() => setHasTools(true)}>Oui</Chip><Chip on={hasTools === false} onClick={() => setHasTools(false)}>Non</Chip></div>
              {hasTools && (
                <div style={{ marginTop: 12 }}>
                  <label htmlFor="tools" style={label}>Vos principaux outils (facultatif)</label>
                  <textarea id="tools" rows={3} value={toolsText} onChange={e => setToolsText(e.target.value)} placeholder="Ex : clé à molette, perceuse, multimètre…" style={{ ...field, minHeight: 84, padding: 12, resize: 'vertical' }} />
                </div>
              )}
            </div>
            <div>
              <p style={label}>Matériaux que vous utilisez souvent <span style={{ color: '#65564b', fontWeight: 500 }}>(facultatif, 5 maximum)</span></p>
              <p style={{ ...hint, margin: '0 0 12px' }}>Indiquez le prix que vous payez. AfriOne s’en sert pour estimer le matériel dans les devis, après relecture.</p>
              <div style={{ display: 'grid', gap: 12 }}>
                {materials.map((m, i) => (
                  <div key={i} style={{ padding: 14, border: '1.5px solid #e9e1d9', borderRadius: 16, display: 'grid', gap: 10 }}>
                    <input aria-label="Nom du matériau" style={field} placeholder="Nom (ex : joint plomberie)" value={m.name} onChange={e => setMaterials(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input aria-label="Prix unitaire en FCFA" style={field} type="number" inputMode="numeric" placeholder="Prix (FCFA)" value={m.price_fcfa} onChange={e => setMaterials(p => p.map((x, j) => j === i ? { ...x, price_fcfa: e.target.value === '' ? '' : Number(e.target.value) } : x))} />
                      <select aria-label="Unité" style={field} value={m.unit} onChange={e => setMaterials(p => p.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <select aria-label="Métier" style={{ ...field, flex: 1 }} value={m.category} onChange={e => setMaterials(p => p.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                      <button type="button" onClick={() => setMaterials(p => p.filter((_, j) => j !== i))} aria-label="Retirer ce matériau" style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #d6cbc1', background: '#fff', color: '#b42318', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
              {materials.length < 5 && (
                <button type="button" onClick={() => setMaterials(p => [...p, emptyMaterial(artisan?.metier && CATEGORIES.includes(artisan.metier) ? artisan.metier : 'Plomberie')])} style={{ marginTop: 12, minHeight: 44, padding: '0 16px', borderRadius: 999, border: '1.5px dashed #c2410c', background: '#fff', color: '#9a3412', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Ajouter un matériau</button>
              )}
              {!materialsOk && <p role="alert" style={{ ...hint, color: '#b42318', fontWeight: 600 }}>Chaque matériau commencé a besoin d’un nom et d’un prix.</p>}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="acard" style={{ padding: 20, display: 'grid', gap: 14 }}>
            {[
              { t: 'Activité', s: 1, v: `${transport} · ${zones.join(', ')}`, w: `${interventions.length} intervention${interventions.length > 1 ? 's' : ''} : ${interventions.join(', ')}` },
              { t: 'Prix', s: 2, v: `${hourly.toLocaleString('fr-FR')} FCFA/h`, w: `${dailyHours} h par jour, ${Number(dailyEarnings).toLocaleString('fr-FR')} FCFA par jour` },
              { t: 'Matériel', s: 3, v: hasTools ? 'Outillage personnel' : 'Sans outillage personnel', w: startedMaterials.length ? `${startedMaterials.length} matériau${startedMaterials.length > 1 ? 'x' : ''} renseigné${startedMaterials.length > 1 ? 's' : ''}` : 'Aucun matériau renseigné' },
            ].map(r => (
              <div key={r.t} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid rgba(110,72,44,0.1)' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#65564b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{r.t}</p>
                  <p style={{ margin: '3px 0 0', fontWeight: 700, color: '#1f1611', overflowWrap: 'anywhere' }}>{r.v}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13.5, color: '#4a3d33', overflowWrap: 'anywhere' }}>{r.w}</p>
                </div>
                <button type="button" onClick={() => setStep(r.s)} style={{ flex: 'none', alignSelf: 'flex-start', minHeight: 36, padding: '0 14px', borderRadius: 999, border: '1px solid #d6cbc1', background: '#fff', color: '#9a3412', fontWeight: 700, cursor: 'pointer' }}>Modifier</button>
              </div>
            ))}
            {error && <p role="alert" style={{ margin: 0, color: '#b42318', fontWeight: 600 }}>{error}</p>}
          </section>
        )}
      </div>

      <footer style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.96)', borderTop: '1px solid rgba(110,72,44,0.12)', backdropFilter: 'blur(12px)', padding: '12px 16px max(12px, env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', gap: 10 }}>
          {step > 1 && <button type="button" onClick={() => setStep(s => s - 1)} style={{ minHeight: 50, padding: '0 20px', borderRadius: 999, border: '1.5px solid #d6cbc1', background: '#fff', color: '#1f1611', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Retour</button>}
          {step < STEPS.length ? (
            <button type="button" disabled={!canNext} onClick={() => setStep(s => s + 1)} className="journey__btn" style={{ marginTop: 0, flex: 1, border: 0, cursor: canNext ? 'pointer' : 'not-allowed', opacity: canNext ? 1 : 0.45 }}>
              Continuer <ArrowRight size={18} />
            </button>
          ) : (
            <button type="button" disabled={submitting} onClick={submit} className="journey__btn" style={{ marginTop: 0, flex: 1, border: 0, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Envoi…' : 'Envoyer mon questionnaire'} <Check size={18} />
            </button>
          )}
        </div>
        {!canNext && step < STEPS.length && <p style={{ maxWidth: 680, margin: '6px auto 0', fontSize: 12.5, color: '#65564b' }}>Complétez les champs ci-dessus pour continuer.</p>}
      </footer>
    </main>
  )
}
