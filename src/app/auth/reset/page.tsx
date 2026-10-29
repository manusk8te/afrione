'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { recoveryLinkError, recoveryErrorMessage, verifyRecoveryCode } from '@/lib/auth-recovery'

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    let active = true
    const linkError = recoveryLinkError(window.location.hash, window.location.search)
    if (linkError) setError(linkError)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) setReady(Boolean(session) && event !== 'SIGNED_OUT')
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      setReady(Boolean(data.session) && !error)
      if (error) setError('Le lien est invalide ou expiré. Demandez un nouveau lien depuis la connexion.')
      setChecking(false)
    }).catch(() => {
      if (active) {
        setError('Le service de connexion est inaccessible. Réessayez dans un instant.')
        setChecking(false)
      }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function confirmCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await verifyRecoveryCode(supabase, email, code)
      setCode('')
      setReady(true)
    } catch (err) {
      setError(recoveryErrorMessage(err))
    } finally { setBusy(false) }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) { setError('Utilisez au moins 8 caractères.'); return }
    if (password !== confirmation) { setError('Les deux mots de passe ne correspondent pas.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword('')
      setConfirmation('')
      await supabase.auth.signOut({ scope: 'local' })
      setDone(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Le mot de passe n’a pas pu être modifié.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 420 }}>
        <p style={{ color: '#E85D26' }}>AfriOne</p>
        <h1 style={{ fontSize: 26, marginBottom: 20 }}>Nouveau mot de passe</h1>
        {checking ? <p>Vérification du lien…</p> : done ? (
          <p role="status">Votre mot de passe a été modifié. <Link href="/auth?redirect=/diagnostic" style={{ color: '#E85D26' }}>Connectez-vous à AfriOne</Link>.</p>
        ) : !ready ? (
          <form onSubmit={confirmCode} style={{ display: 'grid', gap: 14 }}>
            <p>Ouvrez le lien du dernier email AfriOne, ou saisissez le code indiqué dans cet email. Vérifiez aussi les spams.</p>
            <label htmlFor="recovery-email">Adresse email du compte</label>
            <input className="afrione-field" id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ color: '#fff', background: '#1A1A1A', borderRadius: 10, padding: 12 }} />
            <label htmlFor="recovery-code">Code reçu par email</label>
            <input className="afrione-field" id="recovery-code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9\s]{6,14}" maxLength={14} value={code} onChange={e => setCode(e.target.value)} style={{ color: '#fff', background: '#1A1A1A', borderRadius: 10, padding: 12 }} />
            {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
            <button className="afrione-action" type="submit" disabled={busy} style={{ background: '#E85D26', color: '#fff', padding: 14, borderRadius: 10 }}>{busy ? 'Vérification…' : 'Vérifier mon code'}</button>
            <Link href="/auth?redirect=/diagnostic" style={{ color: '#E85D26' }}>Demander un nouvel email</Link>
          </form>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
            <label htmlFor="new-password">Nouveau mot de passe</label>
            <input className="afrione-field" id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} style={{ color: '#fff', background: '#1A1A1A', borderRadius: 10, padding: 12 }} />
            <label htmlFor="confirm-password">Confirmer le mot de passe</label>
            <input className="afrione-field" id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} style={{ color: '#fff', background: '#1A1A1A', borderRadius: 10, padding: 12 }} />
            {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
            <button className="afrione-action" type="submit" disabled={busy} style={{ background: '#E85D26', color: '#fff', padding: 14, borderRadius: 10 }}>{busy ? 'Enregistrement…' : 'Enregistrer mon mot de passe'}</button>
          </form>
        )}
      </section>
    </main>
  )
}
