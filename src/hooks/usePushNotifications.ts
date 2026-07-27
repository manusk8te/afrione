'use client'
import { useCallback, useEffect, useState } from 'react'

export type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied'

/**
 * Enregistre le service worker + la subscription push.
 * - Si la permission est déjà accordée : souscription automatique au montage.
 * - Sinon : exposer `enable()` à appeler depuis un clic utilisateur —
 *   Notification.requestPermission() sans geste utilisateur est bloqué
 *   silencieusement par les navigateurs modernes.
 */
export function usePushNotifications(userId: string | null) {
  const [status, setStatus] = useState<PushStatus>('default')

  const subscribe = useCallback(async (uid: string) => {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const existing = await reg.pushManager.getSubscription()
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid, subscription: sub }),
    })
  }, [])

  // Demande la permission (à appeler depuis un clic) puis souscrit
  const enable = useCallback(async () => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
    try {
      const permission = await Notification.requestPermission()
      setStatus(permission as PushStatus)
      if (permission !== 'granted') return false
      await subscribe(userId)
      return true
    } catch (err) {
      console.error('Push enable error:', err)
      return false
    }
  }, [userId, subscribe])

  useEffect(() => {
    if (!userId) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported')
      return
    }
    setStatus(Notification.permission as PushStatus)
    // Permission déjà accordée → (re)souscrire silencieusement
    if (Notification.permission === 'granted') {
      subscribe(userId).catch(err => console.error('Push registration error:', err))
    }
  }, [userId, subscribe])

  return { status, enable }
}
