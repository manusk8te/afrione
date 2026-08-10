import { supabaseAdmin } from '@/lib/supabase'
import { scoreArtisan } from '@/lib/scoring'
import { sendPushToUser } from '@/lib/push'
import { normalizeMetier } from '@/lib/metier'

export const DISPATCH_TIMEOUT_SECONDS = 60

// Marge accordée à un artisan dont la requête d'acceptation part juste avant
// l'expiration : sans elle, le timer client (même fenêtre de 60s) annule la
// mission dans les millisecondes qui séparent le clic de son traitement, et
// l'artisan reçoit « Mission expirée » alors qu'il a répondu dans les temps.
export const DISPATCH_GRACE_SECONDS = 5

// ── Trouver TOUS les artisans qualifiés pour la mission ───────────────────────

// Le dispatch branchait autrefois sur l'email du client : un compte @afrione.ci
// ou de rôle admin ne diffusait qu'à trois artisans écrits en dur
// (test.plombier / test.elec / test.peintre @afrione.ci). Deux conséquences :
//   1. tester depuis un compte admin n'empruntait PAS le chemin de production,
//      donc ne testait rien de réel ;
//   2. ces trois comptes ayant été supprimés, le broadcast retournait zéro
//      candidat et la mission était annulée sur-le-champ.
// Le matching se comporte désormais de façon identique pour tous les clients.

const ARTISAN_SELECT = `
  id, user_id, metier,
  rating_avg, rating_count, mission_count, response_time_min,
  years_experience, certifications, portfolio,
  users!artisan_pros_user_id_fkey(quartier)
`

export async function findAllCandidates(missionId: string): Promise<any[]> {
  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('category, quartier, client_id')
    .eq('id', missionId)
    .single()

  if (!mission) return []

  const missionQuartier: string = mission.quartier || 'Cocody'

  // Artisans déjà tentés (pour éviter les doublons si relance)
  const { data: attempts } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('artisan_id')
    .eq('mission_id', missionId)

  const triedIds: string[] = attempts?.map((a: any) => a.artisan_id) ?? []

  // Le métier stocké en base a historiquement 2 conventions incompatibles
  // ("Plomberie" via l'inscription artisan vs "Plombier" via d'anciens scripts
  // de seed) — normalizeMetier() les ramène toutes à la même catégorie
  // canonique pour un matching fiable, quelle que soit la valeur brute stockée.
  const missionMetier = normalizeMetier(mission.category)

  // Classement par score seul. Un email d'artisan était auparavant remonté de
  // force en tête des missions de plomberie — un biais permanent sur de vraies
  // missions. Il était de surcroît inopérant : ARTISAN_SELECT ne récupère pas
  // users.email, donc la comparaison était toujours fausse.
  const sortByScore = (list: any[]) =>
    list
      .filter((a: any) => !triedIds.includes(a.id))
      .map((a: any) => ({ ...a, _score: scoreArtisan(a, missionQuartier) }))
      .sort((a: any, b: any) => b._score - a._score)

  // ── Broadcast à TOUS les artisans disponibles du métier demandé ─────────
  // Filtre par métier de la mission (normalisé), notif simultanée à tous,
  // premier qui accepte prend la mission. Fallback sans filtre si aucun
  // spécialiste libre — mieux vaut un artisan du mauvais corps de métier
  // que zéro artisan.
  const { data: allCandidates } = await supabaseAdmin
    .from('artisan_pros')
    .select(ARTISAN_SELECT)
    .eq('kyc_status', 'approved')
    .eq('is_available', true)
    .limit(200)

  const matched = (allCandidates ?? []).filter(a => normalizeMetier(a.metier) === missionMetier)

  return sortByScore(matched.length ? matched : (allCandidates ?? []))
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

export async function sendUrgentNotification(userId: string, category: string) {
  const base  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://afrione-sepia.vercel.app'
  const url   = `${base}/artisan-space/dashboard`
  const title = '🚨 Mission Urgente !'
  const body  = `${category} — Tu as ${DISPATCH_TIMEOUT_SECONDS}s pour accepter !`

  // Web-push direct (même process) — plus de hop HTTP vers /api/push-send qui
  // partait vers la prod quand NEXT_PUBLIC_APP_URL manquait, ni d'appel
  // OneSignal (SDK jamais initialisé côté client → livraison impossible).
  const result = await sendPushToUser(userId, { title, body, url })
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
    text:        '😔 Aucun artisan disponible n\'a pu accepter ta mission urgente. Tu seras remboursé intégralement sous 24h.',
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

  // Créer une tentative pour chaque candidat + notifier en parallèle
  await Promise.all(
    candidates.map((c: any, i: number) =>
      createDispatchAttempt(missionId, c.id, i + 1, expiresAt)
    )
  )

  // Notifier tous les artisans en parallèle (fire-and-forget)
  Promise.allSettled(candidates.map((c: any) => sendUrgentNotification(c.user_id, category)))

  return { dispatched: true, count: candidates.length, expires_at: expiresAt }
}
