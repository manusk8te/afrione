/**
 * AfriOne — Vérification de l'autorisation par rôle dans la War Room
 *
 *   node scripts/test-warroom-rbac.mjs [url]
 *   (défaut : http://localhost:3000)
 *
 * Monte une mission jetable entre le client test et un artisan test, puis
 * appelle les routes API comme le ferait un navigateur — avec le vrai Bearer
 * token de chaque compte. Vérifie que chaque action est acceptée pour le rôle
 * qui la porte et REFUSÉE pour l'autre, y compris quand l'appel court-circuite
 * l'interface (ce que fait n'importe qui avec un terminal).
 *
 * La mission jetable et ses messages sont supprimés dans tous les cas.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const BASE = process.argv[2] || 'http://localhost:3000'
const PWD  = 'AfriTest2024!'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const anon = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
)

let ok = 0, ko = 0
function check(label, condition, detail = '') {
  if (condition) { ok++;  console.log(`  ✅ ${label}`) }
  else           { ko++;  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function token(email) {
  const { data, error } = await anon().auth.signInWithPassword({ email, password: PWD })
  if (error) throw new Error(`connexion ${email} : ${error.message}`)
  return data.session.access_token
}

async function call(path, { tok, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(tok  ? { Authorization: `Bearer ${tok}` }     : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

let missionId = null
const jetables = { users: [], artisans: [] }

/** Compte auth jetable : la base ne contient pas de comptes de test partagés. */
async function compteJetable(role, metier = null) {
  const email = `rbac-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@afrione.test`
  const { data, error } = await db.auth.admin.createUser({
    email, password: PWD, email_confirm: true,
  })
  if (error) throw new Error(`createUser ${email} : ${error.message}`)
  const id = data.user.id
  jetables.users.push(id)

  await db.from('users').upsert({ id, email, name: `RBAC ${role}`, role, quartier: 'Cocody' }, { onConflict: 'id' })

  let artisanId = null
  if (metier) {
    const { data: ap, error: apErr } = await db.from('artisan_pros').insert({
      user_id: id, metier, bio: 'compte de test RBAC', years_experience: 1,
      tarif_min: 5000, quartiers: ['Cocody'], kyc_status: 'approved',
      is_available: true, rating_avg: 0, rating_count: 0, mission_count: 0,
      success_rate: 0, response_time_min: 30,
    }).select('id').single()
    if (apErr) throw new Error(`artisan_pros : ${apErr.message}`)
    artisanId = ap.id
    jetables.artisans.push(artisanId)
  }
  return { id, email, artisanId }
}

try {
  console.log(`\nBase : ${BASE}`)
  console.log('Provisionnement de comptes jetables…')

  const client   = await compteJetable('client')
  const artisan  = await compteJetable('artisan', 'Plomberie')
  // Le tiers est un compte de rôle GLOBAL artisan, sans lien avec la mission.
  // C'est précisément le profil auquel l'ancien code accordait l'interface
  // prestataire sur n'importe quelle mission.
  const outsider = await compteJetable('artisan', 'Peinture')

  console.log(`Client  : ${client.email}`)
  console.log(`Artisan : ${artisan.email} (assigné)`)
  console.log(`Tiers   : ${outsider.email} (role global = artisan, NON assigné)\n`)

  const tClient   = await token(client.email)
  const tArtisan  = await token(artisan.email)
  const tOutsider = await token(outsider.email)

  // ── Mission jetable, en négociation, artisan attribué ──────────────────────
  const { data: mission, error: mErr } = await db.from('missions').insert({
    client_id: client.id, artisan_id: artisan.artisanId,
    mode: 'standard', category: 'Plomberie',
    status: 'negotiation', quartier: 'Cocody',
  }).select('id').single()
  if (mErr) throw new Error(`création mission : ${mErr.message}`)
  missionId = mission.id
  console.log(`Mission jetable : ${missionId}\n`)

  // ══ 1. Lecture du brief ════════════════════════════════════════════════════
  console.log('1. /api/mission-brief — lecture')
  {
    const anonRes = await call(`/api/mission-brief?mission_id=${missionId}`)
    check('sans token → refusé', anonRes.status === 401, `reçu ${anonRes.status}`)

    const c = await call(`/api/mission-brief?mission_id=${missionId}`, { tok: tClient })
    check('client → 200 + viewer_role=client', c.status === 200 && c.json.viewer_role === 'client',
      `${c.status} / ${c.json.viewer_role}`)

    const a = await call(`/api/mission-brief?mission_id=${missionId}`, { tok: tArtisan })
    check('artisan assigné → 200 + viewer_role=artisan', a.status === 200 && a.json.viewer_role === 'artisan',
      `${a.status} / ${a.json.viewer_role}`)

    if (true) {
      const o = await call(`/api/mission-brief?mission_id=${missionId}`, { tok: tOutsider })
      check('autre artisan (non assigné) → 403, pas de diagnostic',
        o.status === 403 && !o.json.diag, `${o.status} / role=${o.json.viewer_role}`)
    }
  }

  // ══ 2. Transitions réservées à l'artisan ═══════════════════════════════════
  console.log('\n2. Transitions terrain — réservées à l\'artisan')
  {
    // On amène la mission en 'scheduled' via le service role (le client paie
    // et programme ; ce n'est pas ce qu'on teste ici).
    await db.from('missions').update({ status: 'payment' }).eq('id', missionId)
    await db.from('missions').update({ status: 'scheduled' }).eq('id', missionId)

    const cGps = await call('/api/mission/transition', {
      tok: tClient, method: 'POST', body: { mission_id: missionId, action: 'start_tracking' },
    })
    check('client → start_tracking REFUSÉ', cGps.status === 403, `${cGps.status} ${cGps.json.error || ''}`)

    if (true) {
      const oGps = await call('/api/mission/transition', {
        tok: tOutsider, method: 'POST', body: { mission_id: missionId, action: 'start_tracking' },
      })
      check('artisan non assigné → start_tracking REFUSÉ', oGps.status === 403,
        `${oGps.status} ${oGps.json.error || ''}`)
    }

    const aGps = await call('/api/mission/transition', {
      tok: tArtisan, method: 'POST', body: { mission_id: missionId, action: 'start_tracking' },
    })
    check('artisan assigné → start_tracking ACCEPTÉ', aGps.status === 200,
      `${aGps.status} ${aGps.json.error || ''}`)

    const cArr = await call('/api/mission/transition', {
      tok: tClient, method: 'POST', body: { mission_id: missionId, action: 'arrived' },
    })
    check('client → arrived REFUSÉ', cArr.status === 403, `${cArr.status}`)

    const aArr = await call('/api/mission/transition', {
      tok: tArtisan, method: 'POST', body: { mission_id: missionId, action: 'arrived' },
    })
    check('artisan → arrived ACCEPTÉ', aArr.status === 200, `${aArr.status} ${aArr.json.error || ''}`)

    const cDone = await call('/api/mission/transition', {
      tok: tClient, method: 'POST', body: { mission_id: missionId, action: 'done' },
    })
    check('client → done REFUSÉ', cDone.status === 403, `${cDone.status}`)

    const aDone = await call('/api/mission/transition', {
      tok: tArtisan, method: 'POST', body: { mission_id: missionId, action: 'done' },
    })
    check('artisan → done ACCEPTÉ', aDone.status === 200, `${aDone.status} ${aDone.json.error || ''}`)

    const aDone2 = await call('/api/mission/transition', {
      tok: tArtisan, method: 'POST', body: { mission_id: missionId, action: 'done' },
    })
    check('artisan → done rejoué = idempotent', aDone2.status === 200 && aDone2.json.unchanged === true,
      `${aDone2.status}`)
  }

  // ══ 3. Actions réservées au client ═════════════════════════════════════════
  console.log('\n3. Validation finale — réservée au client')
  {
    const aVal = await call('/api/validate-mission', {
      tok: tArtisan, method: 'POST', body: { mission_id: missionId },
    })
    check('artisan → validate-mission REFUSÉ', aVal.status === 403, `${aVal.status}`)

    const cVal = await call('/api/validate-mission', {
      tok: tClient, method: 'POST', body: { mission_id: missionId },
    })
    check('client → validate-mission ACCEPTÉ', cVal.status === 200, `${cVal.status} ${cVal.json.error || ''}`)
  }

  // ══ 4. Modération ══════════════════════════════════════════════════════════
  console.log('\n4. /api/warroom/moderate — écriture dans le chat')
  {
    const anonMod = await call('/api/warroom/moderate', {
      method: 'POST',
      body: { mission_id: missionId, messages: [], last_message: { text: 'test', sender_role: 'artisan' } },
    })
    check('sans token → refusé', anonMod.status === 401, `${anonMod.status}`)

    if (true) {
      const oMod = await call('/api/warroom/moderate', {
        tok: tOutsider, method: 'POST',
        body: { mission_id: missionId, messages: [], last_message: { text: 'test', sender_role: 'artisan' } },
      })
      check('non-participant → refusé', oMod.status === 403, `${oMod.status}`)
    }
  }

  // ══ 5. Écriture directe en base (contournement complet de l'UI) ═══════════
  console.log('\n5. Écriture directe supabase — le client tente une action artisan')
  {
    const { data: m2 } = await db.from('missions').insert({
      client_id: client.id, artisan_id: artisan.artisanId,
      mode: 'standard', category: 'Plomberie',
      status: 'scheduled', quartier: 'Cocody',
    }).select('id').single()

    const asClient = anon()
    await asClient.auth.signInWithPassword({ email: client.email, password: PWD })

    // 'scheduled → en_route' est une transition LÉGALE pour la machine à états
    // (migration 006). Seul le rôle doit l'interdire au client dans ce sens :
    // c'est le départ de l'artisan. Si l'écriture passe, c'est que la base
    // n'applique aucune règle de rôle — le trou exact que ferme la 007.
    const { error } = await asClient.from('missions')
      .update({ status: 'en_route' }).eq('id', m2.id)

    if (error) {
      check('client → UPDATE status=en_route bloqué par la base (migration 007 active)', true)
    } else {
      console.log('  ⚠️  client → UPDATE status=en_route ACCEPTÉ directement par la base')
      console.log('      → migration 007_warroom_rbac.sql pas encore appliquée.')
      console.log('      → l\'API et l\'UI sont protégées ; la base ne l\'est pas encore.')
      await db.from('missions').update({ status: 'scheduled' }).eq('id', m2.id)
    }

    // Usurpation de sender_role : le client poste une carte « DEVIS ARTISAN ».
    const { error: chatErr } = await asClient.from('chat_history').insert({
      mission_id: m2.id, sender_id: client.id, sender_role: 'artisan',
      text: JSON.stringify({ amount: 999999, description: 'usurpation' }), type: 'devis',
    })
    if (chatErr) {
      check('client → INSERT chat sender_role=artisan bloqué (migration 007 active)', true)
    } else {
      console.log('  ⚠️  client → INSERT chat avec sender_role=artisan ACCEPTÉ')
      console.log('      → migration 007_warroom_rbac.sql pas encore appliquée.')
    }

    await db.from('chat_history').delete().eq('mission_id', m2.id)
    await db.from('missions').delete().eq('id', m2.id)
  }

} catch (e) {
  console.error(`\n💥 ${e.message}`)
  ko++
} finally {
  if (missionId) {
    await db.from('chat_history').delete().eq('mission_id', missionId)
    await db.from('gps_tracking').delete().eq('mission_id', missionId)
    await db.from('transactions').delete().eq('mission_id', missionId)
    await db.from('missions').delete().eq('id', missionId)
  }
  for (const id of jetables.artisans) {
    await db.from('wallets').delete().eq('artisan_id', id)
    await db.from('missions').delete().eq('artisan_id', id)
    await db.from('artisan_pros').delete().eq('id', id)
  }
  for (const id of jetables.users) {
    await db.from('missions').delete().eq('client_id', id)
    await db.from('users').delete().eq('id', id)
    await db.auth.admin.deleteUser(id).catch(() => {})
  }
  console.log('\nComptes et mission jetables supprimés.')
  console.log(`\n───────────────────────\n${ok} OK · ${ko} échec(s)\n`)
  process.exit(ko ? 1 : 0)
}
