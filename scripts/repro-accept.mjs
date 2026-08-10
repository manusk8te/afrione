/**
 * AfriOne — Reproduction contrôlée d'une acceptation de mission urgente
 *
 *   node scripts/repro-accept.mjs [url]
 *   (défaut : https://afrione-sepia.vercel.app)
 *
 * Monte en base exactement l'état qui précède un clic « Accepter » — mission
 * en 'dispatching', une offre vivante pour un artisan réel — puis appelle
 * l'API déployée comme le ferait le dashboard. Affiche la réponse brute et
 * l'état de la mission après coup.
 *
 * Sert à trancher entre les causes que le message client ne distingue pas :
 * transition refusée par le trigger, contrainte violée, statut inattendu.
 * La mission jetable est supprimée dans tous les cas.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const BASE = process.argv[2] || 'https://afrione-sepia.vercel.app'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

let missionId = null

try {
  const { data: client } = await db
    .from('users').select('id, email').eq('email', 'goblyemmanuel94@gmail.com').maybeSingle()
  const { data: artisan } = await db
    .from('artisan_pros').select('id, user_id, metier').limit(1).maybeSingle()

  if (!client)  throw new Error('client goblyemmanuel94@gmail.com introuvable')
  if (!artisan) throw new Error('aucun artisan_pros')

  console.log(`\nCible : ${BASE}`)
  console.log(`Client : ${client.email}`)
  console.log(`Artisan : ${artisan.id} (${artisan.metier})\n`)

  // ── Monter l'état exact d'avant le clic ───────────────────────────────────
  const { data: mission, error: createError } = await db
    .from('missions')
    .insert({ client_id: client.id, status: 'diagnostic', category: 'Menuiserie', quartier: 'Cocody', mode: 'urgent' })
    .select('id').single()
  if (createError) throw new Error(`création : ${createError.message}`)
  missionId = mission.id
  console.log(`  mission ${missionId.slice(0, 8)} créée (diagnostic)`)

  for (const to of ['payment', 'dispatching']) {
    const { data, error } = await db
      .from('missions').update({ status: to }).eq('id', missionId).select('status').maybeSingle()
    if (error || !data) throw new Error(`transition vers ${to} : ${error?.message ?? 'aucune ligne'}`)
    console.log(`  → ${to}`)
  }

  const { data: attempt, error: attemptError } = await db
    .from('dispatch_attempts')
    .insert({
      mission_id:     missionId,
      artisan_id:     artisan.id,
      attempt_number: 1,
      expires_at:     new Date(Date.now() + 180_000).toISOString(),
    })
    .select('id').single()
  if (attemptError) throw new Error(`tentative : ${attemptError.message}`)
  console.log(`  offre créée, expire dans 180s\n`)

  // ── Le clic « Accepter » ──────────────────────────────────────────────────
  console.log('── POST /api/dispatch/respond ──')
  const res  = await fetch(`${BASE}/api/dispatch/respond`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ mission_id: missionId, artisan_id: artisan.id, response: 'accepted' }),
  })
  const body = await res.text()
  console.log(`HTTP ${res.status}`)
  console.log(body)

  // ── L'état réel après coup ────────────────────────────────────────────────
  const { data: after } = await db
    .from('missions').select('status, artisan_id').eq('id', missionId).maybeSingle()
  const { data: att } = await db
    .from('dispatch_attempts').select('response').eq('id', attempt.id).maybeSingle()

  console.log(`\n── état après ──`)
  console.log(`mission  : status='${after?.status}' artisan_id=${after?.artisan_id ?? 'null'}`)
  console.log(`tentative: response=${att?.response ?? 'null'}`)

  const ok = after?.status === 'en_route' && after?.artisan_id === artisan.id
  console.log(ok ? '\n✅ Acceptation réussie.\n' : '\n❌ Acceptation refusée — voir la réponse ci-dessus.\n')
} catch (err) {
  console.error(`\n❌ ${err.message}\n`)
} finally {
  if (missionId) {
    const { error } = await db.from('missions').delete().eq('id', missionId)
    console.log(error ? `⚠️  mission ${missionId} non supprimée : ${error.message}` : `🧹 mission de test supprimée`)
  }
}
