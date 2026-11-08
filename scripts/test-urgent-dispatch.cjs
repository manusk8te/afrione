const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { setTimeout: delay } = require('node:timers/promises')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const { createClient } = require('@supabase/supabase-js')

const postgres = process.env.AFRIONE_TEST_POSTGRES === '1'
const load = process.env.AFRIONE_LOAD_TEST === '1'
const categories = ['Plomberie', 'Électricité', 'Peinture', 'Menuiserie', 'Maçonnerie']
const quartiers = ['Cocody', 'Yopougon', 'Marcory', 'Treichville', 'Abobo']

async function batch(items, size, run) {
  for (let index = 0; index < items.length; index += size) {
    const results = await Promise.allSettled(items.slice(index, index + size).map(run))
    const failed = results.find(result => result.status === 'rejected')
    if (failed) throw failed.reason
  }
}

test(load ? 'Pic urgent AfriOne : 100 clients et 50 artisans' : 'Deux urgences simultanées et trois artisans', async () => {
  let admin, sessionClient
  if (postgres) {
    const { postgresClient } = require('./urgent-test-postgres.cjs')
    admin = postgresClient()
    sessionClient = id => postgresClient(id)
  } else {
    const { TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_ROLE_KEY } = process.env
    assert.ok(TEST_SUPABASE_URL && TEST_SUPABASE_ANON_KEY && TEST_SUPABASE_SERVICE_ROLE_KEY,
      'Configurer les trois variables TEST_SUPABASE_* pour une base AfriOne locale dédiée')
    const url = new URL(TEST_SUPABASE_URL)
    assert.equal(url.origin, 'http://127.0.0.1:54321', 'Ce test utilise uniquement Supabase local')
    const localFetch = (input, init) => {
      assert.equal(new URL(input instanceof Request ? input.url : input).origin, url.origin)
      return fetch(input, { ...init, redirect: 'error' })
    }
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: localFetch },
    }
    admin = createClient(url.origin, TEST_SUPABASE_SERVICE_ROLE_KEY, options)
    sessionClient = () => createClient(url.origin, TEST_SUPABASE_ANON_KEY, options)
  }
  const db = async (query) => {
    const { data, error } = await query
    if (error) throw Error(error.message)
    return data
  }

  const profiles = await db(admin.from('artisan_pros').select('id').limit(1))
  assert.equal(profiles.length, 0, 'Utiliser une base dédiée sans profil artisan préexistant')

  const pushRecipients = []
  process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs', moduleResolution: 'node' })
  require('ts-node/register/transpile-only')
  const originalLoad = Module._load
  let startUrgentDispatch, respond
  try {
    Module._load = function (name, ...args) {
      if (name === '@/lib/supabase') return { supabaseAdmin: admin }
      if (name === '@/lib/push') {
        return { sendPushToUser: async (id) => {
          pushRecipients.push(id)
          return { sent: true }
        } }
      }
      if (name.startsWith('@/')) name = path.join(__dirname, '../src', name.slice(2))
      return originalLoad.call(this, name, ...args)
    }
    ;({ startUrgentDispatch } = require('../src/lib/dispatch.ts'))
    ;({ POST: respond } = require('../src/app/api/dispatch/respond/route.ts'))
  } finally {
    Module._load = originalLoad
  }

  const accounts = []
  const missionIds = []
  const profileIds = []
  async function account(role, quartier) {
    const email = `dispatch-${randomUUID()}@afrione.test`
    const password = randomUUID() + randomUUID()
    const identity = await db(admin.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { afrione_test: true },
    }))
    const actor = { id: identity.user.id, client: sessionClient(identity.user.id), events: new Map() }
    accounts.push(actor)
    await db(admin.from('users').upsert({ id: actor.id, email, name: '[TEST] Dispatch', role, ...(quartier ? { quartier } : {}), ...(postgres ? { phone: '+' + String(accounts.length).padStart(12, '0') } : {}) }))
    if (!postgres) await db(actor.client.auth.signInWithPassword({ email, password }))
    return actor
  }

  async function listen(actor) {
    await new Promise((resolve, reject) => {
      actor.client.channel('urgent-test-' + actor.id)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'dispatch_attempts',
          filter: 'artisan_id=eq.' + actor.profileId,
        }, ({ new: row }) => actor.events.set(row.mission_id, Date.now()))
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') resolve()
          if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            reject(error ?? Error(status))
          }
        }, 5000)
    })
  }

  try {
    const clients = []
    await batch(Array.from({ length: load ? 100 : 1 }), 5, async () => {
      clients.push(await account('client'))
    })
    const artisans = []
    await batch(Array.from({ length: load ? 50 : 3 }, (_, index) => index), 5, async index => {
      const actor = await account('artisan', quartiers[index % quartiers.length])
      actor.category = categories[Math.floor(index / 10)]
      actor.available = !load || index % 10 < 8
      const profile = await db(admin.from('artisan_pros').insert({
        user_id: actor.id, metier: actor.category, kyc_status: 'approved',
        is_available: actor.available, is_test: true,
      }).select('id').single())
      actor.profileId = profile.id
      profileIds.push(profile.id)
      artisans.push(actor)
    })
    if (!postgres) await batch(artisans, 10, listen)

    const requestedCategories = load
      ? [...Array(15).fill(categories[0]), ...Array.from({ length: 15 }, (_, index) => categories[1 + index % 4])]
      : Array(2).fill(categories[0])
    const missions = []
    await batch(requestedCategories.map((category, index) => ({ category, index })), 5, async ({ category, index }) => {
      const client = clients[index % clients.length]
      const { id } = await db(admin.from('missions').insert({
        client_id: client.id, mode: 'urgent', category, quartier: quartiers[index % quartiers.length],
        status: 'payment', total_price: 15000, logic_version: 1, is_test: true,
      }).select('id').single())
      missionIds.push(id)
      missions.push({ id, category, client, targets: artisans.filter(actor => actor.available && actor.category === category) })
    })

    // Les autres clients consultent leur espace pendant le pic.
    const initialRequests = [
      ...missions.map(async mission => {
        mission.startedAt = Date.now()
        const result = await startUrgentDispatch(mission.id, mission.client.id, mission.category, 60)
        mission.dispatchMs = Date.now() - mission.startedAt
        assert.equal(result.count, mission.targets.length, JSON.stringify(result))
      }),
      ...clients.slice(missions.length).map(async client => {
        const visible = await db(client.client.from('missions').select('id').in('id', missionIds))
        assert.equal(visible.length, 0, 'Un autre client ne doit pas voir ces missions')
        assert.equal((await db(client.client.rpc('list_urgent_offers'))).length, 0)
      }),
    ]
    const initialResults = await Promise.allSettled(initialRequests)
    const initialFailure = initialResults.find(result => result.status === 'rejected')
    if (initialFailure) throw initialFailure.reason
    assert.deepEqual(pushRecipients.sort(), missions.flatMap(mission => mission.targets.map(actor => actor.id)).sort())

    const expectedOffers = missions.flatMap(mission => mission.targets.map(actor => ({
      mission_id: mission.id, artisan_id: actor.profileId,
    })))
    const pair = row => row.mission_id + '/' + row.artisan_id
    const logged = await db(admin.from('dispatch_attempts').select('mission_id, artisan_id').in('mission_id', missionIds))
    assert.deepEqual(logged.map(pair).sort(), expectedOffers.map(pair).sort(), 'Registre des offres')

    const deadline = Date.now() + 12000
    while (!postgres && missions.some(mission => mission.targets.some(actor => !actor.events.has(mission.id))) && Date.now() < deadline) {
      await delay(100)
    }
    const realtimeMs = []
    for (const mission of missions) {
      for (const actor of mission.targets) {
        const receivedAt = actor.events.get(mission.id)
        if (receivedAt) realtimeMs.push(receivedAt - mission.startedAt)
      }
    }
    const percentile = (values, rank) => values.length
      ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * rank) - 1]
      : null
    console.log(JSON.stringify({
      phase: 'dispatch', clients: clients.length, artisans: artisans.length, missions: missions.length,
      expectedOffers: expectedOffers.length, loggedOffers: logged.length, realtimeReceived: postgres ? null : realtimeMs.length,
      dispatchP95Ms: percentile(missions.map(mission => mission.dispatchMs), 0.95),
      realtimeP95Ms: percentile(realtimeMs, 0.95),
    }))

    const visibilityFailures = []
    await batch(artisans, 10, async actor => {
      const expected = missions.filter(mission => mission.targets.includes(actor)).map(mission => mission.id).sort()
      const visible = await db(actor.client.rpc('list_urgent_offers'))
      if ((!postgres && JSON.stringify([...actor.events.keys()].sort()) !== JSON.stringify(expected))
          || JSON.stringify(visible.map(row => row.mission_id).sort()) !== JSON.stringify(expected)
          || visible.some(row => row.artisan_id !== actor.profileId || !row.category || !row.quartier || row.total_price !== 15000)) {
        visibilityFailures.push({ artisan: actor.profileId, expected: expected.length,
          realtime: actor.events.size, readable: visible.length,
          readableWithMission: visible.filter(row => row.category && row.quartier && row.total_price === 15000).length })
      }
    })

    const accept = async (mission, actor) => {
      const startedAt = Date.now()
      const response = await respond(new Request('http://localhost/api/dispatch/respond', {
        method: 'POST',
        body: JSON.stringify({ mission_id: mission.id, artisan_id: actor.profileId, response: 'accepted' }),
      }))
      const body = await response.json()
      return { ok: response.ok && body.accepted === true, code: body.code, elapsedMs: Date.now() - startedAt }
    }
    // Lance toutes les acceptations d'une vague ensemble, y compris des offres
    // concurrentes adressées au même artisan.
    const races = new Map()
    await batch(missions, missions.length, async mission => {
      const outcomes = await Promise.allSettled(mission.targets.map(actor => accept(mission, actor)))
      const failure = outcomes.find(outcome => outcome.status === 'rejected')
      if (failure) throw failure.reason
      races.set(mission.id, outcomes.map(outcome => outcome.value))
    })

    const assigned = new Set()
    const responseCodes = {}
    const acceptTimes = []
    for (const mission of missions) {
      const responses = races.get(mission.id)
      const winners = responses.filter(response => response.ok)
      assert.ok(winners.length <= 1, 'Deux réponses gagnantes pour une seule mission')
      for (const response of responses) {
        const key = response.ok ? 'accepted' : response.code ?? 'unknown'
        responseCodes[key] = (responseCodes[key] ?? 0) + 1
        acceptTimes.push(response.elapsedMs)
      }
      const attempts = await db(admin.from('dispatch_attempts')
        .select('artisan_id,response').eq('mission_id', mission.id))
      const current = await db(mission.client.client.from('missions')
        .select('artisan_id,status').eq('id', mission.id).single())
      if (winners.length) {
        const accepted = attempts.filter(attempt => attempt.response === 'accepted')
        assert.equal(accepted.length, 1)
        assert.ok(attempts.every(attempt => ['accepted', 'cancelled'].includes(attempt.response)))
        assert.equal(current.status, 'en_route')
        assert.equal(current.artisan_id, accepted[0].artisan_id)
        assert.ok(!assigned.has(current.artisan_id), 'Un artisan a reçu deux missions actives')
        assigned.add(current.artisan_id)
      } else {
        assert.equal(current.artisan_id, null)
        assert.equal(current.status, 'dispatching')
        assert.ok(attempts.every(attempt => attempt.response === null))
      }
    }
    console.log(JSON.stringify({
      phase: 'acceptance', assigned: assigned.size, stillSearching: missions.length - assigned.size,
      responseCodes, acceptP95Ms: percentile(acceptTimes, 0.95), visibilityFailures,
    }))
    assert.equal(assigned.size, load ? 23 : 2, 'Attributions possibles selon les métiers et les disponibilités')
    assert.ok(Object.keys(responseCodes).every(code =>
      ['accepted', 'already_taken', 'already_answered', 'artisan_busy'].includes(code)))
    assert.deepEqual(visibilityFailures, [], 'Offres accessibles aux bons artisans, en direct et après lecture')
  } finally {
    await Promise.all(accounts.map(actor => actor.client.removeAllChannels()))
    if (missionIds.length) {
      for (const table of ['dispatch_attempts', 'chat_history', 'missions']) {
        await db(admin.from(table).delete().in(table === 'missions' ? 'id' : 'mission_id', missionIds))
      }
    }
    if (profileIds.length) await db(admin.from('artisan_pros').delete().in('id', profileIds))
    if (accounts.length) {
      await db(admin.from('users').delete().in('id', accounts.map(actor => actor.id)))
      for (const actor of accounts) await db(admin.auth.admin.deleteUser(actor.id))
    }
  }
})
