import { supabaseAdmin } from '@/lib/supabase'

const DISPATCH_TIMEOUT_SECONDS = 45

// ── Trouver le prochain artisan disponible (non encore tenté) ─────────────────

export async function findNextCandidate(missionId: string) {
  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('category')
    .eq('id', missionId)
    .single()

  if (!mission) return null

  const catWord = mission.category?.split(' ')[0] || ''

  const { data: attempts } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('artisan_id')
    .eq('mission_id', missionId)

  const triedIds: string[] = attempts?.map((a: any) => a.artisan_id) ?? []

  // Matching par métier, trié par note
  let { data: candidates } = await supabaseAdmin
    .from('artisan_pros')
    .select('id, user_id, metier, rating_avg')
    .eq('kyc_status', 'approved')
    .eq('is_available', true)
    .ilike('metier', `%${catWord}%`)
    .order('rating_avg', { ascending: false })
    .limit(20)

  // Fallback global si aucun match catégorie
  if (!candidates?.length) {
    const { data: fallback } = await supabaseAdmin
      .from('artisan_pros')
      .select('id, user_id, metier, rating_avg')
      .eq('kyc_status', 'approved')
      .eq('is_available', true)
      .order('rating_avg', { ascending: false })
      .limit(20)
    candidates = fallback
  }

  return candidates?.find((a: any) => !triedIds.includes(a.id)) ?? null
}

// ── Créer un enregistrement de tentative de dispatch ─────────────────────────

export async function createDispatchAttempt(
  missionId: string,
  artisanId: string,
  attemptNumber: number,
) {
  const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_SECONDS * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('dispatch_attempts')
    .insert({
      mission_id:     missionId,
      artisan_id:     artisanId,
      attempt_number: attemptNumber,
      expires_at:     expiresAt,
    })
    .select()
    .single()

  return data
}

// ── Envoyer la notification urgente à l'artisan ───────────────────────────────

export async function sendUrgentNotification(userId: string, category: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://afrione-sepia.vercel.app'
  const url  = `${base}/artisan-space/dashboard`
  const title = '🚨 Mission Urgente !'
  const body  = `${category} — Tu as ${DISPATCH_TIMEOUT_SECONDS}s pour accepter !`

  await Promise.allSettled([
    fetch(`${base}/api/notify`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: userId, title, message: body, url }),
    }),
    fetch(`${base}/api/push-send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: userId, title, body, url }),
    }),
  ])
}

// ── Annuler et déclencher le remboursement ────────────────────────────────────

export async function cancelAndRefund(missionId: string, clientId: string) {
  await supabaseAdmin
    .from('missions')
    .update({ status: 'cancelled' })
    .eq('id', missionId)

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
    text:        '😔 Aucun artisan disponible n\'a pu accepter ta mission urgente. Tu seras remboursé intégralement sous 24h. Désolé pour ce désagrément.',
    type:        'system',
  })
  // Wave refund API : POST /v1/checkout/sessions/{wave_session_id}/refund
  // À déclencher ici une fois le endpoint Wave CI confirmé
}

// ── Lancer le premier dispatch (appelé par le webhook Wave) ───────────────────

export async function startUrgentDispatch(missionId: string, clientId: string, category: string) {
  const candidate = await findNextCandidate(missionId)

  if (!candidate) {
    await cancelAndRefund(missionId, clientId)
    return { dispatched: false, reason: 'no_candidates' }
  }

  const attempt = await createDispatchAttempt(missionId, candidate.id, 1)

  await supabaseAdmin
    .from('missions')
    .update({ status: 'dispatching', artisan_id: candidate.id })
    .eq('id', missionId)

  await sendUrgentNotification(candidate.user_id, category)

  return { dispatched: true, attempt_id: attempt?.id, artisan_id: candidate.id }
}
