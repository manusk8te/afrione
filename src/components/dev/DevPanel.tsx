'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const TEST_ACCOUNTS = [
  { label: 'Client',       emoji: '👤', email: 'test.client@afrione.ci',   password: 'AfriTest2024!', redirect: '/dashboard' },
  { label: 'Plombier',     emoji: '🔧', email: 'test.plombier@afrione.ci', password: 'AfriTest2024!', redirect: '/artisan-space/dashboard' },
  { label: 'Électricien',  emoji: '⚡', email: 'test.elec@afrione.ci',     password: 'AfriTest2024!', redirect: '/artisan-space/dashboard' },
  { label: 'Admin',        emoji: '🛡️', email: 'test.admin@afrione.ci',    password: 'AfriTest2024!', redirect: '/admin' },
] as const

const SCENARIOS = [
  { label: '🚰 Fuite plomberie',  text: "Ma fuite d'eau sous l'évier de cuisine s'aggrave depuis ce matin, tache humide sur le mur" },
  { label: '⚡ Panne électrique', text: "Le disjoncteur de ma chambre saute chaque fois que j'allume la clim, plus de courant dans la pièce" },
  { label: '🎨 Peinture salon',   text: "Je veux peindre mon salon de 25m², les murs ont quelques petits trous à reboucher avant" },
  { label: '🪟 Fenêtre bloquée',  text: "Ma fenêtre de chambre ne s'ouvre plus depuis les pluies, le gond est tordu" },
] as const

const S = {
  wrap:    { position: 'fixed' as const, bottom: 20, left: 20, zIndex: 9999 },
  toggle:  {
    width: 40, height: 40, borderRadius: '50%',
    background: '#111827', color: 'white',
    border: '2px solid #e85d26',
    cursor: 'pointer', fontSize: 17,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  panel: {
    position: 'absolute' as const, bottom: 50, left: 0,
    width: 252,
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '14px',
    color: 'white',
    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: 11,
  },
  label: { color: '#6b7280', fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 6 },
  section: { marginBottom: 12 },
  userBox: { background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', marginBottom: 12 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 },
  btnAcct: {
    background: 'rgba(232,93,38,0.12)', border: '1px solid rgba(232,93,38,0.25)',
    color: 'white', borderRadius: 6, padding: '5px 8px',
    cursor: 'pointer', fontSize: 11, textAlign: 'left' as const,
    transition: 'background 0.15s',
  },
  btnScenario: {
    background: 'rgba(43,107,62,0.12)', border: '1px solid rgba(43,107,62,0.25)',
    color: 'white', borderRadius: 6, padding: '5px 8px',
    cursor: 'pointer', fontSize: 11, textAlign: 'left' as const, width: '100%',
  },
  btnNav: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid #1f2937',
    color: '#9ca3af', borderRadius: 4, padding: '3px 6px',
    cursor: 'pointer', fontSize: 10,
  },
}

export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const { user, userRole, userName } = useAuth()
  const router = useRouter()

  if (userRole !== 'admin') return null

  async function switchTo(acct: typeof TEST_ACCOUNTS[number]) {
    setBusy(acct.email)
    await supabase.auth.signOut()
    const { error } = await supabase.auth.signInWithPassword({ email: acct.email, password: acct.password })
    if (error) {
      alert(`Compte introuvable: ${error.message}\n→ Lance d'abord: npm run seed:auth`)
      setBusy(null)
      return
    }
    window.location.href = acct.redirect
  }

  function injectScenario(s: typeof SCENARIOS[number]) {
    localStorage.setItem('_devScenario', s.text)
    router.push('/diagnostic')
    setOpen(false)
  }

  const NAV_LINKS = [
    { label: 'Dashboard',   path: '/dashboard' },
    { label: 'Artisan',     path: '/artisan-space/dashboard' },
    { label: 'Admin',       path: '/admin' },
    { label: 'Diagnostic',  path: '/diagnostic' },
    { label: 'Mode-select', path: '/mode-select' },
    { label: 'Auth',        path: '/auth' },
  ]

  return (
    <div style={S.wrap}>
      <button
        onClick={() => setOpen(o => !o)}
        style={S.toggle}
        title="Dev Panel (local uniquement)"
      >
        {open ? '✕' : '⚙'}
      </button>

      {open && (
        <div style={S.panel}>
          <div style={{ color: '#e85d26', fontWeight: 700, fontSize: 10, letterSpacing: 1.5, marginBottom: 12 }}>
            ⚙ DEV PANEL — LOCAL ONLY
          </div>

          {/* Utilisateur courant */}
          <div style={S.userBox}>
            {user ? (
              <>
                <div style={{ color: '#6b7280', fontSize: 9.5 }}>CONNECTÉ</div>
                <div style={{ fontWeight: 600, marginTop: 2, fontSize: 12 }}>{userName}</div>
                <div style={{ color: '#e85d26', fontSize: 9.5, marginTop: 1 }}>{userRole}</div>
              </>
            ) : (
              <div style={{ color: '#4b5563' }}>Non connecté</div>
            )}
          </div>

          {/* Switch compte */}
          <div style={S.section}>
            <div style={S.label}>Switch compte</div>
            <div style={S.grid2}>
              {TEST_ACCOUNTS.map(a => (
                <button
                  key={a.email}
                  onClick={() => switchTo(a)}
                  disabled={busy === a.email}
                  style={{ ...S.btnAcct, opacity: busy === a.email ? 0.5 : 1 }}
                >
                  {busy === a.email ? '…' : `${a.emoji} ${a.label}`}
                </button>
              ))}
            </div>
          </div>

          {/* Scénarios diagnostic */}
          <div style={S.section}>
            <div style={S.label}>Injecter scénario</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {SCENARIOS.map(s => (
                <button key={s.label} onClick={() => injectScenario(s)} style={S.btnScenario}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation rapide */}
          <div>
            <div style={S.label}>Navigation</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {NAV_LINKS.map(l => (
                <button
                  key={l.path}
                  onClick={() => { router.push(l.path); setOpen(false) }}
                  style={S.btnNav}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
