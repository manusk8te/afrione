import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Envoi web-push direct côté serveur — sans hop HTTP vers /api/push-send.
 * Retourne { sent, reason? } pour diagnostiquer les échecs de livraison.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<{ sent: boolean; reason?: string }> {
  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate) return { sent: false, reason: 'vapid_missing' }

  webpush.setVapidDetails('mailto:contact@afrione.ci', vapidPublic, vapidPrivate)

  const { data } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data?.subscription) return { sent: false, reason: 'no_subscription' }

  try {
    await webpush.sendNotification(data.subscription, JSON.stringify(payload))
    return { sent: true }
  } catch (err: any) {
    // 404/410 = subscription expirée → nettoyer pour re-souscription propre
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId)
      return { sent: false, reason: 'subscription_expired' }
    }
    return { sent: false, reason: err?.message || 'send_failed' }
  }
}
