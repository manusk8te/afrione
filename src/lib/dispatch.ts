import { supabaseAdmin } from '@/lib/supabase'

const DISPATCH_TIMEOUT_SECONDS = 45

// ── Trouver TOUS les artisans qualifiés pour la mission ───────────────────────

const TEST_ARTISAN_EMAILS = ['test.plombier@afrione.ci', 'test.elec@afrione.ci']

export async function findAllCandidates(missionId: string): Promise<any[]> {
  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('category, client_id, users!client_id(email, role)')
    .eq('id', missionId)
    .single()

  if (!mission) return []

  const clientEmail: string = (mission.users as any)?.email ?? ''
  const clientRole: string  = (mission.users as any)?.role  ?? ''
  const isTestSession = clientEmail.endsWith('@afrione.ci') || clientRole === 'admin'

  // Artisans déjà tentés (pour éviter les doublons si relance)
  const { data: attempts } = await supabaseAdmin
    .from('dispatch_attempts')
    .select('artisan_id')
    .eq('mission_id', missionId)

  const triedIds: string[] = attempts?.map((a: any) => a.artisan_id) ?? []

  // ── Session de test : matcher uniquement les artisans test ───────────────
  if (isTestSession) {
    const { data: testUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .in('email', TEST_ARTISAN_EMAILS)

    const testUserIds = testUsers?.map((u: any) => u.id) ?? []

    const { data: testArtisans } = await supabaseAdmin
      .from('artisan_pros')
      .select('id, user_id, metier, rating_avg')
      .in('user_id', testUserIds)
      .eq('kyc_status', 'approved')
      .eq('is_available', true)

    return (testArtisans ?? []).filter((a: any) => !triedIds.includes(a.id))
  }

  // ── Session réelle : matching normal ─────────────────────────────────────
  const catWord = mission.category?.split(' ')[0] || ''

  let { data: candidates } = await supabaseAdmin
    .from('artisan_pros')
    .select('id, user_id, metier, rating_avg')
    .eq('kyc_status', 'approved')
    .eq('is_available', true)
    .ilike('metier', `%${catWord}%`)
    .order('rating_avg', { ascending: false })
    .limit(50)

  if (!candidates?.length) {
    const { data: fallback } = await supabaseAdmin
      .from('artisan_pros')
      .select('id, user_id, metier, rating_avg')
      .eq('kyc_status', 'approved')
      .eq('is_available', true)
      .order('rating_avg', { ascending: false })
      .limit(50)
    candidates = fallback
  }

  return (candidates ?? []).filter((a: any) => !triedIds.includes(a.id))
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
    text:        '😔 Aucun artisan disponible n\'a pu accepter ta mission urgente. Tu seras remboursé intégralement sous 24h.',
    type:        'system',
  })
}

// ── Broadcaster à TOUS les artisans qualifiés simultanément ──────────────────

export async function startUrgentDispatch(missionId: string, clientId: string, category: string) {
  const candidates = await findAllCandidates(missionId)

  if (!candidates.length) {
    await cancelAndRefund(missionId, clientId)
    return { dispatched: false, reason: 'no_candidates' }
  }

  // Même expiry pour tous — premier arrivé premier servi
  const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_SECONDS * 1000).toISOString()

  // Créer une tentative pour chaque candidat + notifier en parallèle
  await Promise.all(
    candidates.map((c: any, i: number) =>
      createDispatchAttempt(missionId, c.id, i + 1, expiresAt)
    )
  )

  await supabaseAdmin
    .from('missions')
    .update({ status: 'dispatching' })
    .eq('id', missionId)

  // Notifier tous les artisans en parallèle (fire-and-forget)
  Promise.allSettled(candidates.map((c: any) => sendUrgentNotification(c.user_id, category)))

  return { dispatched: true, count: candidates.length, expires_at: expiresAt }
}
