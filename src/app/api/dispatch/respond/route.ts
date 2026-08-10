import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelAndRefund, closeAttempts, DISPATCH_GRACE_SECONDS } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

// Toute réponse d'échec porte un `code` stable : le client s'appuie dessus
// plutôt que sur la présence d'un booléen, sans quoi un statut HTTP non géré
// retombe dans la branche « succès » et annonce « Mission acceptée ! » alors
// que rien n'a été pris.
type FailureCode =
  | 'bad_request'
  | 'mission_not_found'
  | 'already_taken'
  | 'attempt_not_found'
  | 'already_answered'
  | 'expired'
  | 'mission_gone'

// Nom + horodatage de l'artisan qui a réellement remporté la mission —
// pour une attribution explicite plutôt qu'un "prise par un autre" générique.
async function getTakenByInfo(missionId: string, artisanId: string) {
  const [{ data: pro }, { data: attempt }] = await Promise.all([
    supabaseAdmin.from('artisan_pros').select('users!artisan_pros_user_id_fkey(name)').eq('id', artisanId).maybeSingle(),
    supabaseAdmin.from('dispatch_attempts').select('responded_at').eq('mission_id', missionId).eq('artisan_id', artisanId).eq('response', 'accepted').maybeSingle(),
  ])
  return {
    name: (pro?.users as any)?.name || 'Un autre artisan',
    at:   attempt?.responded_at || null,
  }
}

const fail = (code: FailureCode, error: string, status: number, extra: object = {}) =>
  NextResponse.json({ ok: false, code, error, ...extra }, { status })

export async function POST(req: NextRequest) {
  const { mission_id, artisan_id, response } = await req.json()

  if (!mission_id || !artisan_id || !response) {
    return fail('bad_request', 'Paramètres manquants', 400)
  }

  if (!['accepted', 'refused'].includes(response)) {
    return fail('bad_request', 'Réponse invalide', 400)
  }

  // Vérifier que la mission est encore en cours de dispatch
  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('status, client_id, category, artisan_id')
    .eq('id', mission_id)
    .single()

  if (!mission) return fail('mission_not_found', 'Mission introuvable', 404)

  // Déjà assignée à un AUTRE artisan — attribution explicite (qui, quand)
  if (mission.artisan_id && mission.artisan_id !== artisan_id) {
    const taken_by = await getTakenByInfo(mission_id, mission.artisan_id)
    return fail('already_taken', 'Mission déjà assignée', 409, { already_taken: true, taken_by })
  }

  // Déjà assignée à CET artisan (double-clic, retry réseau, ou auto-assign) —
  // c'est un succès, pas une erreur : on le dit clairement au lieu de renvoyer
  // « tentative introuvable » sur la tentative déjà consommée.
  if (mission.artisan_id === artisan_id && response === 'accepted') {
    return NextResponse.json({ ok: true, accepted: true, already_yours: true })
  }

  // Récupérer la dernière tentative de cet artisan, répondue ou non : distinguer
  // « aucune offre ne t'a été envoyée » de « tu as déjà répondu ».
  const { data: attempt } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('id, expires_at, response')
    .eq('mission_id', mission_id)
    .eq('artisan_id', artisan_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!attempt) {
    return fail('attempt_not_found', "Cette mission ne t'a pas été proposée", 404)
  }

  // Une tentative close a QUATRE causes possibles, et les confondre sous un
  // « offre déjà clôturée » générique fait croire à l'artisan qu'un concurrent
  // l'a doublé alors qu'il a simplement laissé le délai passer. Chaque cause a
  // son message et son code.
  if (attempt.response !== null) {
    if (attempt.response === 'timeout') {
      return fail('expired', 'Le délai de réponse de cette offre est écoulé', 410, {
        previous_response: 'timeout',
      })
    }
    return fail(
      'already_answered',
      attempt.response === 'refused'
        ? 'Tu as déjà refusé cette mission'
        : attempt.response === 'cancelled'
          ? 'Un autre artisan a pris cette mission'
          : 'Tu as déjà accepté cette mission',
      409,
      { previous_response: attempt.response },
    )
  }

  // Marge de grâce : la requête partie juste avant l'expiration reste valable.
  const deadline = new Date(attempt.expires_at).getTime() + DISPATCH_GRACE_SECONDS * 1000
  if (deadline < Date.now()) {
    await supabaseAdmin
      .from('dispatch_attempts')
      .update({ response: 'timeout', responded_at: new Date().toISOString() })
      .eq('id', attempt.id)
    return fail('expired', 'Délai de réponse dépassé', 410)
  }

  if (response === 'refused') {
    const { error: refuseError } = await supabaseAdmin
      .from('dispatch_attempts')
      .update({ response: 'refused', responded_at: new Date().toISOString() })
      .eq('id', attempt.id)

    if (refuseError) {
      console.error('[dispatch/respond] refus non enregistré :', refuseError.message)
      return fail('bad_request', 'Refus non enregistré — réessaie', 500)
    }

    // Vérifier si tous les artisans ont refusé
    const { data: pending } = await supabaseAdmin
      .from('dispatch_attempts')
      .select('id')
      .eq('mission_id', mission_id)
      .is('response', null)

    if (!pending?.length) {
      await cancelAndRefund(mission_id, mission.client_id)
      return NextResponse.json({ ok: true, refused: true, refunded: true })
    }
    return NextResponse.json({ ok: true, refused: true })
  }

  // ── Accepté : tenter la prise atomique AVANT de marquer la tentative ──────
  // Ordre important : marquer response='accepted' avant ce claim laissait la
  // tentative figée sur "accepted" même quand le claim échouait (ex: le
  // timeout client — même fenêtre 60s — annule la mission dans l'instant qui
  // sépare les deux requêtes) → incohérence observée en base (dispatch_attempts
  // accepted, mission cancelled, artisan_id null) et message "prise par un
  // autre artisan" alors que personne ne l'a réellement obtenue.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('missions')
    .update({ status: 'en_route', artisan_id: artisan_id })
    .eq('id', mission_id)
    .eq('status', 'dispatching')
    .select('id')
    .maybeSingle()

  if (claimError || !claimed) {
    // Distinguer les trois échecs possibles — ils n'ont pas le même sens pour
    // l'artisan et ne doivent surtout pas se ranger tous sous « expirée ».
    const { data: current } = await supabaseAdmin
      .from('missions').select('status, artisan_id').eq('id', mission_id).maybeSingle()

    // 1. Un autre artisan a gagné la course : sa tentative est bien close.
    if (current?.artisan_id && current.artisan_id !== artisan_id) {
      await supabaseAdmin
        .from('dispatch_attempts')
        .update({ response: 'cancelled', responded_at: new Date().toISOString() })
        .eq('id', attempt.id)
      const taken_by = await getTakenByInfo(mission_id, current.artisan_id)
      return fail('already_taken', 'Mission déjà assignée', 409, { already_taken: true, taken_by })
    }

    // 2. La mission a été annulée/remboursée entre-temps (timeout client).
    if (current?.status === 'cancelled') {
      await supabaseAdmin
        .from('dispatch_attempts')
        .update({ response: 'timeout', responded_at: new Date().toISOString() })
        .eq('id', attempt.id)
      return fail('mission_gone', 'La mission a été annulée avant ta réponse', 410)
    }

    // 3. La mission est toujours là mais la transition a été refusée (statut
    //    inattendu, trigger de machine à états). Ce n'est PAS la faute de
    //    l'artisan : on laisse sa tentative ouverte pour qu'il puisse retenter,
    //    et on loggue de quoi diagnostiquer côté serveur.
    console.error(
      `[dispatch/respond] prise refusée pour mission ${mission_id} — statut='${current?.status}' artisan_id='${current?.artisan_id}' erreur='${claimError?.message ?? 'aucune ligne'}'`,
    )
    return fail('mission_gone', "La mission n'est plus disponible à la prise", 409, {
      mission_status: current?.status ?? null,
      retryable: true,
    })
  }

  // Confirmer la tentative seulement maintenant que la prise a réussi
  const { error: confirmError } = await supabaseAdmin
    .from('dispatch_attempts')
    .update({ response: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', attempt.id)

  if (confirmError) {
    // La mission est bien à lui (claim réussi) — on ne revient pas en arrière,
    // mais l'incohérence doit être visible dans les logs.
    console.error(
      `[dispatch/respond] mission ${mission_id} attribuée à ${artisan_id} mais tentative ${attempt.id} non confirmée : ${confirmError.message}`,
    )
  }

  // Clore les offres des autres artisans — vérifié : tant que cette écriture
  // échouait, leur carte urgente restait affichée indéfiniment.
  await closeAttempts(mission_id, 'cancelled', artisan_id)

  // Créditer l'escrow du wallet artisan
  const { data: transaction } = await supabaseAdmin
    .from('transactions')
    .select('artisan_amount')
    .eq('mission_id', mission_id)
    .eq('status', 'escrow')
    .maybeSingle()

  if (transaction?.artisan_amount) {
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('artisan_id', artisan_id)
      .maybeSingle()

    if (wallet) {
      await supabaseAdmin
        .from('wallets')
        .update({ balance_escrow: (wallet.balance_escrow || 0) + transaction.artisan_amount })
        .eq('artisan_id', artisan_id)
    } else {
      await supabaseAdmin.from('wallets').insert({
        artisan_id:        artisan_id,
        balance_escrow:    transaction.artisan_amount,
        balance_available: 0,
        total_earned:      0,
      })
    }
  }

  // Message système dans le chat
  await supabaseAdmin.from('chat_history').insert({
    mission_id,
    sender_id:   mission.client_id,
    sender_role: 'system',
    sender_type: 'afrione_system',
    text:        '✅ Un artisan a accepté ta mission urgente. Il est en route vers toi !',
    type:        'system',
  })

  return NextResponse.json({ ok: true, accepted: true })
}
