/**
 * AfriOne — Vérification de la migration 006 (flux urgent)
 *
 *   node scripts/verify-006.mjs
 *
 * Ne teste pas le SQL sur pièces : déroule réellement le parcours d'une mission
 * urgente sur une mission jetable, puis la supprime. Chaque écriture que le
 * trigger de machine à états ou un CHECK pouvait refuser est vérifiée
 * individuellement — c'est exactement ce silence-là qui remontait à l'artisan
 * sous forme de « Mission expirée » alors que la mission était vivante.
 *
 * La mission jetable est supprimée dans tous les cas, y compris en cas d'échec
 * (dispatch_attempts et chat_history partent en cascade).
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente de .env.local')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

const results = []
const record = (label, ok, detail = '') => {
  results.push({ label, ok, detail })
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${detail ? ` — ${detail}` : ''}`)
}

// Une transition de statut. Deux précautions :
//  - le statut de départ est LU, jamais supposé : si une transition précédente
//    a échoué, la mission n'est pas où on croit et on testerait alors une autre
//    arête de la machine à états en l'annonçant sous le mauvais nom ;
//  - on exige la ligne EN RETOUR, pas seulement l'absence d'erreur — un UPDATE
//    qui ne touche aucune ligne ne lève rien.
async function transition(missionId, expectedFrom, to) {
  const { data: before } = await db
    .from('missions').select('status').eq('id', missionId).maybeSingle()

  const from = before?.status
  if (from !== expectedFrom) {
    record(`${expectedFrom} → ${to}`, false, `non testée : la mission est en '${from}'`)
    return false
  }

  const { data, error } = await db
    .from('missions')
    .update({ status: to })
    .eq('id', missionId)
    .select('id, status')
    .maybeSingle()

  const ok = !error && data?.status === to
  record(`${from} → ${to}`, ok, error?.message ?? (data ? '' : 'aucune ligne mise à jour'))
  return ok
}

let missionId = null

try {
  // ── Prérequis : un client et un artisan réels (contraintes de clés étrangères)
  const { data: client } = await db.from('users').select('id, email').limit(1).maybeSingle()
  const { data: artisan } = await db.from('artisan_pros').select('id').limit(1).maybeSingle()

  if (!client) throw new Error('aucun utilisateur en base — impossible de créer une mission de test')
  if (!artisan) throw new Error('aucun artisan_pros en base — impossible de créer une tentative de test')

  console.log(`\nMission jetable pour ${client.email}\n`)

  // ── 1. Création ────────────────────────────────────────────────────────────
  const { data: mission, error: createError } = await db
    .from('missions')
    .insert({
      client_id: client.id,
      status:    'diagnostic',
      category:  'Plomberie',
      quartier:  'Cocody',
      mode:      'urgent',
    })
    .select('id')
    .single()

  if (createError) throw new Error(`création de la mission de test : ${createError.message}`)
  missionId = mission.id

  // ── 2. Machine à états : les 3 transitions que la 006 rouvre ───────────────
  console.log('Machine à états (trigger validate_mission_transition) :')
  await transition(missionId, 'diagnostic', 'payment')
  // Celle-ci était BLOQUÉE — c'est la cause racine du flux urgent cassé.
  const dispatchOk = await transition(missionId, 'payment', 'dispatching')

  // ── 3. dispatch_attempts.response = 'cancelled' ────────────────────────────
  console.log("\nCHECK dispatch_attempts.response (clôture des artisans perdants) :")
  const { data: attempt, error: attemptError } = await db
    .from('dispatch_attempts')
    .insert({
      mission_id:     missionId,
      artisan_id:     artisan.id,
      attempt_number: 1,
      expires_at:     new Date(Date.now() + 60_000).toISOString(),
    })
    .select('id')
    .single()

  if (attemptError) {
    record("insertion d'une tentative", false, attemptError.message)
  } else {
    const { data: closed, error: closeError } = await db
      .from('dispatch_attempts')
      .update({ response: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', attempt.id)
      .select('id, response')
      .maybeSingle()

    record(
      "response = 'cancelled'",
      !closeError && closed?.response === 'cancelled',
      closeError?.message ?? (closed ? '' : 'aucune ligne mise à jour'),
    )
  }

  // ── 4. Acceptation : dispatching → en_route ────────────────────────────────
  console.log('\nAcceptation par un artisan :')
  if (dispatchOk) {
    await transition(missionId, 'dispatching', 'en_route')
  } else {
    record('dispatching → en_route', false, 'non testable, la mission n\'a pas atteint dispatching')
  }

  // ── 5. Unicité de la fiche technique ───────────────────────────────────────
  console.log('\nUnicité du brief (idx_chat_one_brief_per_mission) :')
  const brief = () => ({
    mission_id:  missionId,
    sender_id:   client.id,
    sender_role: 'system',
    text:        'Brief de vérification 006',
    type:        'brief',
  })

  const { error: brief1 } = await db.from('chat_history').insert(brief())
  const { error: brief2 } = await db.from('chat_history').insert(brief())

  if (brief1) {
    record('premier brief inséré', false, brief1.message)
  } else {
    record('second brief rejeté (index unique)', !!brief2, brief2 ? '' : 'DOUBLON ACCEPTÉ — index absent')
  }
} catch (err) {
  console.error(`\n❌ ${err.message}`)
  results.push({ label: err.message, ok: false })
} finally {
  if (missionId) {
    const { error } = await db.from('missions').delete().eq('id', missionId)
    console.log(
      error
        ? `\n⚠️  Mission de test ${missionId} NON supprimée : ${error.message} — à retirer à la main`
        : `\n🧹 Mission de test supprimée (${missionId})`,
    )
  }
}

const failed = results.filter(r => !r.ok)
console.log(
  failed.length
    ? `\n❌ Migration 006 incomplète — ${failed.length}/${results.length} vérification(s) en échec.\n   Rejoue migrations/006_fix_urgent_dispatch.sql dans le SQL Editor Supabase.\n`
    : `\n✅ Migration 006 appliquée — les ${results.length} vérifications passent, le flux urgent est débloqué.\n`,
)

process.exit(failed.length ? 1 : 0)
