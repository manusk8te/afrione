'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, LogIn, RefreshCw, CheckCircle, XCircle, Bell } from 'lucide-react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const NEU_SHADOW = '6px 6px 16px rgba(163,177,198,0.55), -4px -4px 12px rgba(255,255,255,0.9)'
const NEU_SMALL  = '4px 4px 8px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)'

const TEST_PASSWORD = 'AfriTest2024!'

const TEST_ACCOUNTS = [
  { label: 'Client Test',      emoji: '👤', email: 'test.client@afrione.ci',   role: 'client',  redirect: '/dashboard' },
  { label: 'Plombier Test',    emoji: '🔧', email: 'test.plombier@afrione.ci', role: 'artisan', redirect: '/artisan-space/dashboard' },
  { label: 'Électricien Test', emoji: '⚡', email: 'test.elec@afrione.ci',     role: 'artisan', redirect: '/artisan-space/dashboard' },
  { label: 'Peintre Test',     emoji: '🎨', email: 'test.peintre@afrione.ci',  role: 'artisan', redirect: '/artisan-space/dashboard' },
  { label: 'Admin Test',       emoji: '🛡️', email: 'test.admin@afrione.ci',    role: 'admin',   redirect: '/admin' },
] as const

const CATEGORIES = ['Plomberie', 'Électricité', 'Climatisation', 'Serrurerie'] as const

type AccountStatus = {
  email: string
  exists: boolean
  userId: string | null
  pushSubscribed: boolean
  isAvailable: boolean | null
}

type DispatchResult = {
  ok: boolean
  mission_id: string
  count: number
  reason: string | null
  timeout_seconds?: number
  targets: { name: string; email: string; metier: string }[]
}

// Bascule mono-navigateur : après le broadcast, se connecter directement
// sur un artisan test pour recevoir la mission sans second navigateur.
const ARTISAN_SWITCH = [
  { label: 'Plombier',    emoji: '🔧', email: 'test.plombier@afrione.ci' },
  { label: 'Électricien', emoji: '⚡', email: 'test.elec@afrione.ci' },
  { label: 'Peintre',     emoji: '🎨', email: 'test.peintre@afrione.ci' },
] as const

export default function AdminComptesPage() {
  const router = useRouter()
  const [statuses, setStatuses]   = useState<AccountStatus[]>([])
  const [loading, setLoading]     = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)

  const [category, setCategory]   = useState<string>('Plomberie')
  const [amount, setAmount]       = useState('15000')
  const [launching, setLaunching] = useState(false)
  const [result, setResult]       = useState<DispatchResult | null>(null)

  // Statut de chaque compte test : existe ? push activé ? disponible ?
  // Via l'API admin (service role) — les requêtes client directes seraient bloquées par RLS.
  const loadStatuses = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/test-urgent', {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
      })
      if (res.ok) {
        const data = await res.json()
        setStatuses(data.accounts || [])
      } else {
        toast.error('Impossible de charger le statut des comptes')
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setLoading(false)
  }

  useEffect(() => { loadStatuses() }, [])

  // Bascule de session vers un compte test (déconnecte l'admin courant)
  const switchTo = async (acct: typeof TEST_ACCOUNTS[number]) => {
    setSwitching(acct.email)
    await supabase.auth.signOut()
    const { error } = await supabase.auth.signInWithPassword({ email: acct.email, password: TEST_PASSWORD })
    if (error) {
      toast.error(`Connexion échouée : ${error.message} — lancez "npm run seed:auth"`)
      setSwitching(null)
      return
    }
    window.location.href = acct.redirect
  }

  // Crée + paie + broadcast une mission urgente test (client = test.client)
  const launchUrgent = async () => {
    setLaunching(true)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/test-urgent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ category, amount: parseInt(amount) || 15000 }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors du lancement')
      } else {
        setResult(data)
        if (data.ok) toast.success(`Mission broadcastée à ${data.count} artisan(s) test !`)
        else toast.error(`Dispatch échoué : ${data.reason || 'aucun candidat'}`)
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setLaunching(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#F5F7FA' }}>
      <AdminSidebar activeId="comptes" />

      <main className="flex-1 p-6" style={{ maxWidth: '1000px', minWidth: 0 }}>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#3D4852' }}>
              Comptes & Test urgence
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '2px' }}>
              Basculer entre les comptes de test · Déclencher une mission urgente vers les artisans test
            </p>
          </div>
          <button onClick={loadStatuses}
            style={{ padding: '8px', background: '#FFF', borderRadius: '12px', border: '1.5px solid #E2E8F0', cursor: 'pointer', boxShadow: NEU_SMALL }}>
            <RefreshCw size={14} style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* ── Comptes de test ─────────────────────────────────────────── */}
        <div style={{ background: '#FFF', borderRadius: '20px', padding: '22px', boxShadow: NEU_SHADOW, marginBottom: '24px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.12em', marginBottom: '14px', fontFamily: 'Tahoma' }}>
            COMPTES DE TEST · mot de passe : {TEST_PASSWORD}
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#8B95A5', fontSize: '13px', padding: '12px 0' }}>
              <div style={{ width: '14px', height: '14px', border: '2px solid rgba(232,93,38,0.3)', borderTop: '2px solid #E85D26', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Chargement des comptes…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {TEST_ACCOUNTS.map(acct => {
                const st = statuses.find(s => s.email === acct.email)
                return (
                  <div key={acct.email} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#F5F7FA', borderRadius: '14px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '22px', flexShrink: 0 }}>{acct.emoji}</span>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#3D4852' }}>{acct.label}</div>
                      <div style={{ fontSize: '12px', color: '#8B95A5', fontFamily: 'Tahoma' }}>{acct.email}</div>
                    </div>

                    {/* Badges d'état */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {!st?.exists && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '3px 9px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={10} /> absent — seed:auth
                        </span>
                      )}
                      {st?.exists && acct.role === 'artisan' && (
                        <>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            color: st.pushSubscribed ? '#16a34a' : '#d97706',
                            background: st.pushSubscribed ? 'rgba(22,163,74,0.08)' : 'rgba(217,119,6,0.08)' }}>
                            <Bell size={10} /> {st.pushSubscribed ? 'Push OK' : 'Push non activé'}
                          </span>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            color: st.isAvailable ? '#16a34a' : '#dc2626',
                            background: st.isAvailable ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)' }}>
                            {st.isAvailable ? <CheckCircle size={10} /> : <XCircle size={10} />} {st.isAvailable ? 'Disponible' : 'Indisponible'}
                          </span>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => switchTo(acct)}
                      disabled={!!switching || !st?.exists}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '9px 14px', background: st?.exists ? '#E85D26' : '#E2E8F0',
                        color: 'white', border: 'none', borderRadius: '10px',
                        fontWeight: 700, fontSize: '12px', cursor: st?.exists ? 'pointer' : 'default',
                        opacity: switching === acct.email ? 0.6 : 1, flexShrink: 0,
                      }}>
                      <LogIn size={13} /> {switching === acct.email ? 'Connexion…' : 'Se connecter'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <p style={{ fontSize: '11px', color: '#8B95A5', marginTop: '12px', lineHeight: 1.6 }}>
            ⚠️ « Se connecter » remplace votre session admin par le compte test dans cet onglet.
            Flux mono-navigateur : lancez la mission ci-dessous, puis basculez sur un artisan — vous avez
            120&nbsp;s pour accepter, le dashboard artisan charge l'urgence dès son ouverture.
          </p>
        </div>

        {/* ── Déclencheur mission urgente ─────────────────────────────── */}
        <div style={{ background: '#FFF', borderRadius: '20px', padding: '22px', boxShadow: NEU_SHADOW, border: '1.5px solid rgba(232,93,38,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div className="afrione-gradient" style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#3D4852' }}>Lancer une mission urgente test</div>
              <div style={{ fontSize: '12px', color: '#8B95A5' }}>
                Client : test.client@afrione.ci · Paiement escrow simulé · Broadcast aux artisans test uniquement
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>CATÉGORIE</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)} style={{
                    padding: '9px 14px', borderRadius: '10px', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                    border: `1.5px solid ${category === c ? '#E85D26' : '#E2E8F0'}`,
                    background: category === c ? 'rgba(232,93,38,0.08)' : '#FFF',
                    color: category === c ? '#E85D26' : '#6B7280',
                  }}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>MONTANT (FCFA)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none', width: '120px', color: '#3D4852', fontFamily: 'Tahoma' }} />
            </div>
          </div>

          <button onClick={launchUrgent} disabled={launching} className="btn-primary"
            style={{ padding: '13px 22px', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: launching ? 0.6 : 1 }}>
            {launching
              ? <><div style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Broadcast en cours…</>
              : <>🚨 Créer & broadcaster la mission</>}
          </button>

          {/* Résultat */}
          {result && (
            <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '14px', background: result.ok ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${result.ok ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}` }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: result.ok ? '#16a34a' : '#dc2626', marginBottom: '8px' }}>
                {result.ok
                  ? `✅ Broadcastée à ${result.count} artisan(s) — ils ont ${result.timeout_seconds ?? 60}s pour accepter`
                  : `❌ Dispatch échoué : ${result.reason || 'aucun candidat disponible'}`}
              </div>
              {result.targets?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                  {result.targets.map(t => (
                    <div key={t.email} style={{ fontSize: '12px', color: '#6B7280' }}>
                      🔔 {t.name} · {t.metier} · <span style={{ fontFamily: 'Tahoma' }}>{t.email}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Bascule directe : recevoir la mission sur un artisan test (même navigateur) */}
              {result.ok && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B95A5', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    RECEVOIR LA MISSION SUR… (bascule de session, {result.timeout_seconds ?? 120}s pour accepter)
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {ARTISAN_SWITCH.map(a => (
                      <button key={a.email}
                        onClick={async () => {
                          setSwitching(a.email)
                          await supabase.auth.signOut()
                          const { error } = await supabase.auth.signInWithPassword({ email: a.email, password: TEST_PASSWORD })
                          if (error) { toast.error(`Connexion échouée : ${error.message}`); setSwitching(null); return }
                          window.location.href = '/artisan-space/dashboard'
                        }}
                        disabled={!!switching}
                        style={{ padding: '9px 14px', background: '#E85D26', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', opacity: switching === a.email ? 0.6 : 1 }}>
                        {a.emoji} {switching === a.email ? 'Bascule…' : `${a.label} →`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => router.push(`/dispatch/${result.mission_id}`)}
                  style={{ padding: '8px 14px', background: '#FFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', color: '#3D4852' }}>
                  Voir le dispatch (vue client) →
                </button>
                <button onClick={() => router.push(`/warroom/${result.mission_id}`)}
                  style={{ padding: '8px 14px', background: '#FFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', color: '#3D4852' }}>
                  Warroom →
                </button>
              </div>
              <p style={{ fontSize: '11px', color: '#8B95A5', marginTop: '10px', margin: '10px 0 0', lineHeight: 1.6 }}>
                Le dashboard artisan charge l'urgence en attente dès son ouverture — pas besoin de rafraîchir
                ni d'un second navigateur.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
