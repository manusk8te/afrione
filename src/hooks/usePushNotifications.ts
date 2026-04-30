'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const existing = await reg.pushManager.getSubscription()
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        })

        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, subscription: sub }),
        })
      } catch (err) {
        console.error('Push registration error:', err)
      }
    }

    register()
  }, [userId])
}
