import { supabaseAdmin } from '@/lib/supabase'
import { listMatchingArtisans } from '@/lib/artisan-matching'
import { sendPushToUser } from '@/lib/push'

import { DISPATCH_TIMEOUT_SECONDS } from '@/lib/dispatch-window'

const configuredRecipients = Number(process.env.DISPATCH_RECIPIENT_LIMIT)
const recipientLimit = Number.isInteger(configuredRecipients) && configuredRecipients >= 1 && configuredRecipients <= 10
  ? configuredRecipients
  : 3

// Marge accordée à un artisan dont la requête d'acceptation part juste avant
// l'expiration : sans elle, le timer client (même fenêtre de 60s) annule la
// mission dans les millisecondes qui séparent le clic de son traitement, et
// l'artisan reçoit « Mission expirée » alors qu'il a répondu dans les temps.
export const DISPATCH_GRACE_SECONDS = 5

// ── Trouver TOUS les artisans qualifiés pour la mission ───────────────────────

export async function findAllCandidates(missionId: string) {
  const { data: mission, error } = await supabaseAdmin.from('missions')
    .select('category, quartier, client_id, is_test').eq('id', missionId).single()
  if (error) throw error
  if (!mission?.category || !mission.client_id) return []

  const [{ data: attempts, error: attemptsError }, candidates] = await Promise.all([
    supabaseAdmin.from('dispatch_attempts').select('artisan_id').eq('mission_id', missionId),
    listMatchingArtisans(supabaseAdmin, {
      category: mission.category, quartier: mission.quartier || 'Cocody',
      clientId: mission.client_id, isTest: mission.is_test === true, mode: 'urgent', useCoordinates: true,
    }),
  ])
  if (attemptsError) throw attemptsError
  const tried = new Set(attempts?.map(attempt => attempt.artisan_id))
  const eligible = candidates.filter(candidate => !tried.has(candidate.id))
  if (!eligible.length) return []
  const available = []
  for (let offset = 0; offset < eligible.length; offset += 100) {
    const batch = eligible.slice(offset, offset + 100)
    const { data: busy, error } = await supabaseAdmin.from('missions').select('artisan_id')
      .in('artisan_id', batch.map(candidate => candidate.id)).in('status', ['en_route', 'en_cours'])
    if (error) throw error
    const busyIds = new Set(busy.map(mission => mission.artisan_id))
    available.push(...batch.filter(candidate => !busyIds.has(candidate.id)))
  }
  return available
}

// ── Clore les tentatives encore ouvertes d'une mission ───────────────────────
// Centralisé et vérifié. Les appelants faisaient cet UPDATE sans regarder
// `.error` : si l'écriture échoue, les tentatives restent NULL, la carte
// urgente ne se ferme jamais chez les artisans perdants, et leur clic
// « Accepter » sur cette offre fantôme renvoie « Mission déjà assignée ».
// Un échec est désormais tracé au lieu de passer inaperçu.

export async function closeAttempts(
  missionId: string,
  response: 'cancelled' | 'timeout',
  exceptArtisanId?: string,
) {
  let query = supabaseAdmin
    .from('dispatch_attempts')
    .update({ response, responded_at: new Date().toISOString() })
    .eq('mission_id', missionId)
    .is('response', null)

  if (exceptArtisanId) query = query.neq('artisan_id', exceptArtisanId)

  const { error } = await query
  if (error) {
    console.error(
      `[dispatch] clôture des tentatives de ${missionId} en '${response}' échouée : ${error.message}`,
    )
  }
  return { ok: !error, error }
}

// ── Créer un enregistrement de tentative de dispatch ─────────────────────────

export async function createDispatchAttempt(
  missionId: string,
  artisanId: string,
  attemptNumber: number,
  expiresAt?: string,
) {
  const exp = expiresAt ?? new Date(Date.now() + DISPATCH_TIMEOUT_SECONDS * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('dispatch_attempts')
    .insert({
      mission_id:     missionId,
      artisan_id:     artisanId,
      attempt_number: attemptNumber,
      expires_at:     exp,
    })
    .select()
    .single()

  return data
}

// ── Envoyer la notification urgente à un artisan ──────────────────────────────

export async function sendUrgentNotification(userId: string, category: string, timeoutSeconds: number, missionId?: string) {
  const base  = process.env.VERCEL_ENV === 'production'
    ? 'https://www.afrioneapp.com'
    : process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.afrioneapp.com'
  const url = `${base}/artisan-space/dashboard${missionId ? `?offer=${missionId}#offres-urgentes` : ""}`
  const title = 'Nouvelle mission urgente'
  const body  = `${category} — Tu as ${timeoutSeconds} s pour répondre.`

  // Web-push direct (même process) — plus de hop HTTP vers /api/push-send qui
  // partait vers la prod quand NEXT_PUBLIC_APP_URL manquait, ni d'appel
  // OneSignal (SDK jamais initialisé côté client → livraison impossible).
  const result = await sendPushToUser(userId, { title, body, url, tag: missionId ? `urgent-${missionId}` : undefined, ttlSeconds: timeoutSeconds })
  if (!result.sent) {
    console.warn(`[dispatch] push non délivré à ${userId}: ${result.reason}`)
  }
  return result
}

// ── Annuler et déclencher le remboursement ────────────────────────────────────

export async function cancelAndRefund(missionId: string, clientId: string) {
  // Garde de statut : sans elle, un timeout qui arrive au moment exact où un
  // artisan accepte annulerait une mission déjà passée en_route (et
  // rembourserait une transaction dont le wallet artisan a été crédité).
  const { data: cancelled } = await supabaseAdmin
    .from('missions')
    .update({ status: 'cancelled' })
    .eq('id', missionId)
    .in('status', ['payment', 'dispatching', 'diagnostic'])
    .select('id')
    .maybeSingle()

  // Mission déjà assignée (ou déjà annulée) → ne rien faire, l'acceptation gagne
  if (!cancelled) return { cancelled: false }

  await supabaseAdmin
    .from('transactions')
    .update({ status: 'refunded', released_at: new Date().toISOString() })
    .eq('mission_id', missionId)
    .eq('status', 'escrow')

  await supabaseAdmin.from('chat_history').insert({
    mission_id:  missionId,
    sender_id:   clientId,
    sender_role: 'system',
    sender_type: 'afrione_system',
    text:        'Aucun artisan disponible n\'a pu accepter ta mission urgente. Tu seras remboursé intégralement sous 24h.',
    type:        'system',
  })

  return { cancelled: true }
}

// ── Broadcaster à TOUS les artisans qualifiés simultanément ──────────────────

export async function startUrgentDispatch(
  missionId: string,
  clientId: string,
  category: string,
  timeoutSeconds: number = DISPATCH_TIMEOUT_SECONDS,
) {
  const candidates = await findAllCandidates(missionId)

  if (!candidates.length) {
    await cancelAndRefund(missionId, clientId)
    return { dispatched: false, reason: 'no_candidates' }
  }

  // Même expiry pour tous — premier arrivé premier servi
  const expiresAt = new Date(Date.now() + timeoutSeconds * 1000).toISOString()

  // Statut 'dispatching' posé AVANT de créer les tentatives / notifier : sinon
  // un artisan rapide qui accepte pendant la fenêtre où les dispatch_attempts
  // existent déjà mais où la mission a encore son ancien statut se voit
  // refuser la prise atomique (respond/route.ts exige status='dispatching')
  // et reçoit un faux message "mission expirée" alors que personne n'a accepté.
  //
  // L'erreur DOIT être vérifiée : la machine à états (trigger SQL) ou le CHECK
  // de statut peuvent refuser la transition. Sans ce contrôle on notifiait
  // quand même tous les artisans d'une mission qui n'entrerait jamais en
  // dispatching — chaque acceptation renvoyait alors « Mission expirée ou
  // annulée avant confirmation » sans qu'aucune mission n'ait expiré.
  const { data: dispatching, error: statusError } = await supabaseAdmin
    .from('missions')
    .update({ status: 'dispatching' })
    .eq('id', missionId)
    .select('id')
    .maybeSingle()

  if (statusError || !dispatching) {
    console.error(
      `[dispatch] mission ${missionId} n'a pas pu passer en 'dispatching' — dispatch abandonné`,
      statusError?.message ?? 'aucune ligne mise à jour',
    )
    await cancelAndRefund(missionId, clientId)
    return {
      dispatched: false,
      reason: 'status_transition_failed',
      detail: statusError?.message ?? 'mission introuvable ou statut non modifiable',
    }
  }

  const attempts = await Promise.all(
    candidates.map((candidate, index) => createDispatchAttempt(missionId, candidate.id, index + 1, expiresAt))
  )
  const recipients = candidates.filter((_, index) => attempts[index])
  if (!recipients.length) {
    await cancelAndRefund(missionId, clientId)
    return { dispatched: false, reason: 'offers_not_saved' }
  }

  const notifications = await Promise.allSettled(recipients.map(candidate =>
    sendUrgentNotification(candidate.user_id, category, timeoutSeconds, missionId)
  ))
  const pushSent = notifications.filter(result => result.status === 'fulfilled' && result.value.sent).length
  return { dispatched: true, count: recipients.length, expires_at: expiresAt, push_sent: pushSent }
}

export async function startPaidUrgentDispatch(missionId: string, category: string) {
  const candidates = (await findAllCandidates(missionId)).slice(0, recipientLimit)
  if (!candidates.length) return
  const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_SECONDS * 1000).toISOString()
  const { data: recipients, error } = await supabaseAdmin.rpc('start_paid_urgent_dispatch', {
    mid: missionId, candidates: candidates.map(candidate => candidate.id), deadline: expiresAt,
  })
  if (error) throw error
  await Promise.allSettled(candidates.filter(candidate => recipients.includes(candidate.id))
    .map(candidate => sendUrgentNotification(candidate.user_id, category, DISPATCH_TIMEOUT_SECONDS, missionId)))
}
