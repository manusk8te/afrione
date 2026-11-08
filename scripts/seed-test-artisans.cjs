// Run against a dedicated local Supabase with the AfriOne schema installed.
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const { readFile, writeFile, unlink } = require('node:fs/promises')
const Module = require('node:module')
const path = require('node:path')
const { createClient } = require('@supabase/supabase-js')

const trades = [
  ['Plomberie', 'Recherche de fuites, remplacement de robinetterie et débouchage de canalisations.'],
  ['Électricité', 'Diagnostic de pannes, remplacement de prises et mise en sécurité de tableaux.'],
  ['Peinture', 'Préparation des murs, traitement des fissures superficielles et finitions intérieures.'],
  ['Maçonnerie', 'Réparation d’enduits, reprise de joints et montage de cloisons.'],
  ['Menuiserie', 'Réglage de portes, réparation de placards et pose d’étagères sur mesure.'],
  ['Climatisation', 'Entretien de climatiseurs, nettoyage et diagnostic de défauts de refroidissement.'],
  ['Serrurerie', 'Diagnostic de portes bloquées et remplacement de cylindres et serrures.'],
  ['Carrelage', 'Remplacement de carreaux, reprise de joints et pose de crédences.'],
  ['Chauffeur', 'Trajets planifiés et transport de petits colis dans le district d’Abidjan.'],
  ['Ménage', 'Entretien des logements et nettoyage de fin de chantier.'],
  ['Cuisine', 'Préparation de repas à domicile et organisation de petits buffets.'],
  ['Coiffure', 'Coiffure à domicile, entretien des cheveux et mise en forme.'],
]

const profiles = [
  { name: 'Camille', quartier: 'Cocody', lat: 5.36, lng: -3.991, rating: 4.8, years: 11, jobs: 53, response: 12, available: true },
  { name: 'Sacha', quartier: 'Marcory', lat: 5.30, lng: -3.989, rating: 4.5, years: 7, jobs: 32, response: 24, available: true },
  { name: 'Dominique', quartier: 'Yopougon', lat: 5.345, lng: -4.07, rating: 4.4, years: 5, jobs: 24, response: 35, available: true },
  { name: 'Lou', quartier: 'Plateau', lat: 5.319, lng: -4.020, rating: 4.9, years: 15, jobs: 82, response: 10, available: false },
]

async function run() {
  const { TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_ROLE_KEY } = process.env
  const remote = process.env.AFRIONE_SEED_REMOTE === '1'
  const expectedUrl = remote ? 'https://bfvziiajxhjoqfefkwwm.supabase.co' : 'http://127.0.0.1:54321'
  assert.equal(TEST_SUPABASE_URL, expectedUrl, 'URL Supabase AfriOne de test attendue')
  assert.ok(TEST_SUPABASE_ANON_KEY && TEST_SUPABASE_SERVICE_ROLE_KEY, 'Clés locales de test requises')
  const output = process.argv[2]
  const urgentCategory = process.argv[3]
  assert.ok(output, 'Indiquer un fichier hors dépôt pour les identifiants')

  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, options)
  const publicClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, options)
  const db = async result => {
    const { data, error } = await result
    if (error) throw Error(error.message)
    return data
  }
  if (urgentCategory) {
    assert.ok(!remote, 'Le lancement urgent en ligne doit passer par le serveur AfriOne')
    assert.ok(trades.some(([metier]) => metier === urgentCategory), 'Métier inconnu')
    const { clientId } = JSON.parse(await readFile(output, 'utf8'))
    const { user } = await db(admin.auth.admin.getUserById(clientId))
    assert.equal(user.app_metadata.afrione_test, true)
    const { id } = await db(admin.from('missions').insert({
      client_id: clientId, category: urgentCategory, quartier: 'Cocody',
      is_test: true, mode: 'urgent', status: 'payment', logic_version: 1, total_price: 15000,
    }).select('id').single())
    process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs', moduleResolution: 'node' })
    process.env.NEXT_PUBLIC_APP_URL = process.env.TEST_APP_URL || 'http://localhost:3000'
    require('ts-node/register/transpile-only')
    const original = Module._load
    let dispatch
    try {
      Module._load = function (name, ...args) {
        if (name === '@/lib/supabase') return { supabase: publicClient, supabaseAdmin: admin }
        if (name.startsWith('@/')) name = path.join(__dirname, '../src', name.slice(2))
        return original.call(this, name, ...args)
      }
      dispatch = require('../src/lib/dispatch.ts')
    } finally {
      Module._load = original
    }
    const candidates = await dispatch.findAllCandidates(id)
    assert.equal(candidates.length, 3)
    const result = await dispatch.startUrgentDispatch(id, clientId, urgentCategory, 120)
    assert.ok(result.dispatched, JSON.stringify(result))
    const attempts = await db(admin.from('dispatch_attempts').select('artisan_id,attempt_number')
      .eq('mission_id', id).order('attempt_number'))
    assert.deepEqual(attempts.map(attempt => attempt.artisan_id), candidates.map(candidate => candidate.id))
    console.log(JSON.stringify({ mission: '/dispatch/' + id, offers: attempts.length,
      ranking: candidates.map(candidate => ({ quartier: candidate.users?.quartier, score: candidate._score })) }))
    return
  }

  const existing = await db(admin.from('artisan_pros').select('id').eq('is_test', true).limit(1))
  assert.equal(existing.length, 0, 'Utiliser une base de test sans lot existant')

  // Reserve the file before provisioning, to avoid losing credentials on reruns.
  await writeFile(output, '', { flag: 'wx', mode: 0o600 })
  const created = []
  const profileIds = []
  const availableProfileIds = []
  const missionIds = []
  const batch = randomBytes(5).toString('hex')
  const credentials = []
  async function createAccount(role, name, quartier) {
    const email = `qa-${batch}-${created.length}@afrione.test`
    const password = randomBytes(24).toString('base64url')
    const { user } = await db(admin.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { afrione_test: true },
      user_metadata: { name },
    }))
    created.push(user.id)
    await db(admin.from('users').upsert({ id: user.id, email, name, quartier, role }))
    credentials.push({ email, password, role, name, quartier })
    return user.id
  }
  try {
    const clientId = await createAccount('client', '[TEST] Client AfriOne', 'Cocody')
    for (const [metier, bio] of trades) {
      for (const profile of profiles) {
        const name = `[TEST] ${profile.name} · ${metier}`
        const userId = await createAccount('artisan', name, profile.quartier)
        const { id } = await db(admin.from('artisan_pros').insert({
          user_id: userId, metier, bio, zone_gps: { lat: profile.lat, lng: profile.lng },
          kyc_status: 'approved', is_test: true, is_available: !remote && profile.available,
          years_experience: profile.years, rating_avg: profile.rating, rating_count: 18,
          mission_count: profile.jobs, response_time_min: profile.response, tarif_min: 12000,
        }).select('id').single())
        profileIds.push(id)
        if (profile.available) availableProfileIds.push(id)
      }
      const { id } = await db(admin.from('missions').insert({
        client_id: clientId, category: metier, quartier: 'Cocody',
        is_test: true, mode: 'standard', status: 'matching',
      }).select('id').single())
      missionIds.push(id)
    }

    assert.equal((await db(publicClient.from('artisan_pros').select('id').in('id', profileIds))).length, 0)
    const viewer = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, options)
    await db(viewer.auth.signInWithPassword(credentials[0]))
    const visible = await db(viewer.from('artisan_pros').select('id').in('id', profileIds).eq('is_available', true))
    assert.equal(visible.length, remote ? 0 : trades.length * 3)
    await db(viewer.auth.signInWithPassword(credentials[1]))
    await writeFile(output, JSON.stringify({
      clientId,
      availableProfileIds,
      accounts: credentials,
      standard: trades.map(([category], index) => ({
        category, path: '/matching?category=' + encodeURIComponent(category) + '&mission=' + missionIds[index],
      })),
    }, null, 2) + '\n')
    console.log(`${profileIds.length} artisans de test, ${visible.length} disponibles, ${missionIds.length} missions standard.`)
  } catch (error) {
    if (missionIds.length) await db(admin.from('missions').delete().in('id', missionIds))
    if (profileIds.length) await db(admin.from('artisan_pros').delete().in('id', profileIds))
    if (created.length) await db(admin.from('users').delete().in('id', created))
    for (const id of created) await db(admin.auth.admin.deleteUser(id))
    await unlink(output)
    throw error
  }
}

run().catch(error => { console.error(error.message); process.exitCode = 1 })
