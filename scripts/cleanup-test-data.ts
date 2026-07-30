/**
 * AfriOne — Nettoyage des données de test
 * Usage : npm run test:cleanup
 *
 * Supprime tous les enregistrements créés par les scripts de test.
 * Marqueur : email se terminant par @afrione-test.ci
 * Si la colonne is_test_account existe, elle est aussi utilisée.
 * Utilise SUPABASE_SERVICE_ROLE_KEY pour bypasser le RLS.
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SK  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SK) {
  console.error('ERREUR : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SK)

const TEST_EMAIL_DOMAIN = '@afrione-test.ci'

// ── Helpers ──────────────────────────────────────────────────────────────────

function logOk(msg: string)  { console.log(`  [OK] ${msg}`) }
function logWarn(msg: string) { console.warn(`  [AVERTISSEMENT] ${msg}`) }
function logErr(msg: string)  { console.error(`  [ERREUR] ${msg}`) }
function logSkip(msg: string) { console.log(`  [SKIP] ${msg}`) }

// ── Récupérer les IDs des utilisateurs de test ────────────────────────────────

async function getTestUserIds(): Promise<{ allIds: string[]; clientIds: string[]; artisanUserIds: string[] }> {
  const { data: testUsers, error } = await supabase
    .from('users')
    .select('id, role')
    .ilike('email', `%${TEST_EMAIL_DOMAIN}`)

  if (error) {
    logErr(`Impossible de lister les utilisateurs de test: ${error.message}`)
    return { allIds: [], clientIds: [], artisanUserIds: [] }
  }

  const allIds         = testUsers?.map(u => u.id) || []
  const clientIds      = testUsers?.filter(u => u.role === 'client').map(u => u.id) || []
  const artisanUserIds = testUsers?.filter(u => u.role === 'artisan').map(u => u.id) || []

  // Si la colonne is_test_account existe, compléter avec les éventuels comptes
  // marqués is_test_account=true mais sans le bon domaine email
  const { data: flagged } = await supabase
    .from('users')
    .select('id, role')
    .eq('is_test_account', true)
    .not('id', 'in', `(${allIds.map(() => '?').join(',')})`)

  if (flagged && flagged.length > 0) {
    const extraIds         = flagged.map(u => u.id)
    const extraClientIds   = flagged.filter(u => u.role === 'client').map(u => u.id)
    const extraArtisanIds  = flagged.filter(u => u.role === 'artisan').map(u => u.id)
    allIds.push(...extraIds)
    clientIds.push(...extraClientIds)
    artisanUserIds.push(...extraArtisanIds)
    logOk(`${extraIds.length} utilisateurs supplémentaires trouvés via is_test_account=true`)
  }

  return { allIds, clientIds, artisanUserIds }
}

// ── Récupérer les IDs des profils artisan de test ─────────────────────────────

async function getTestArtisanProIds(artisanUserIds: string[]): Promise<string[]> {
  if (artisanUserIds.length === 0) return []

  const { data: artisanPros, error } = await supabase
    .from('artisan_pros')
    .select('id')
    .in('user_id', artisanUserIds)

  if (error) {
    logErr(`Impossible de lister les artisan_pros de test: ${error.message}`)
    return []
  }

  const ids = artisanPros?.map(a => a.id) || []

  // Compléter avec les artisans marqués is_test_account=true
  const { data: flagged } = await supabase
    .from('artisan_pros')
    .select('id')
    .eq('is_test_account', true)

  if (flagged) {
    for (const f of flagged) {
      if (!ids.includes(f.id)) ids.push(f.id)
    }
  }

  return ids
}

// ── Supprimer les données liées aux missions de test ──────────────────────────

async function cleanupMissionDependencies(clientIds: string[], artisanProIds: string[]): Promise<number> {
  if (clientIds.length === 0 && artisanProIds.length === 0) return 0

  let totalDeleted = 0

  // Récupérer les IDs des missions de test
  const missionIdsSet = new Set<string>()

  if (clientIds.length > 0) {
    const { data: clientMissions } = await supabase
      .from('missions')
      .select('id')
      .in('client_id', clientIds)
    clientMissions?.forEach(m => missionIdsSet.add(m.id))
  }

  if (artisanProIds.length > 0) {
    const { data: artisanMissions } = await supabase
      .from('missions')
      .select('id')
      .in('artisan_id', artisanProIds)
    artisanMissions?.forEach(m => missionIdsSet.add(m.id))
  }

  const missionIds = Array.from(missionIdsSet)

  if (missionIds.length > 0) {
    console.log(`\n  Suppression des données liées à ${missionIds.length} mission(s) de test...`)

    // Tables dépendantes des missions
    const missionDeps: Array<{ table: string; column: string }> = [
      { table: 'diagnostics',        column: 'mission_id' },
      { table: 'dispatch_attempts',  column: 'mission_id' },
      { table: 'chat_history',       column: 'mission_id' },
      { table: 'gps_tracking',       column: 'mission_id' },
      { table: 'transactions',       column: 'mission_id' },
      { table: 'quotations',         column: 'mission_id' },
      { table: 'proof_of_work',      column: 'mission_id' },
      { table: 'sentiment_logs',     column: 'mission_id' },
    ]

    for (const dep of missionDeps) {
      try {
        const { count: depCount } = await supabase
          .from(dep.table)
          .select('*', { count: 'exact', head: true })
          .in(dep.column, missionIds)

        if ((depCount || 0) > 0) {
          const { error } = await supabase
            .from(dep.table)
            .delete()
            .in(dep.column, missionIds)

          if (error) {
            if (!error.message.includes('does not exist') && error.code !== '42703') {
              logWarn(`${dep.table}: ${error.message}`)
            }
          } else {
            logOk(`${dep.table}: ${depCount} ligne(s) supprimée(s)`)
            totalDeleted += depCount || 0
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        // Ignorer les erreurs "table not found"
        if (!msg.includes('does not exist') && !msg.includes('42703')) {
          logWarn(`${dep.table} exception: ${msg}`)
        }
      }
    }

    // Supprimer les missions elles-mêmes
    const { error: mErr } = await supabase
      .from('missions')
      .delete()
      .in('id', missionIds)

    if (mErr) {
      logWarn(`missions: ${mErr.message}`)
    } else {
      logOk(`${missionIds.length} mission(s) supprimée(s)`)
      totalDeleted += missionIds.length
    }
  }

  // Supprimer les wallets des artisans de test
  if (artisanProIds.length > 0) {
    const { count: wCount } = await supabase
      .from('wallets')
      .select('*', { count: 'exact', head: true })
      .in('artisan_id', artisanProIds)

    if ((wCount || 0) > 0) {
      const { error: wErr } = await supabase
        .from('wallets')
        .delete()
        .in('artisan_id', artisanProIds)

      if (wErr) {
        if (!wErr.message.includes('does not exist') && wErr.code !== '42703') {
          logWarn(`wallets: ${wErr.message}`)
        }
      } else {
        logOk(`${wCount} wallet(s) supprimé(s)`)
        totalDeleted += wCount || 0
      }
    }

    // dispatch_attempts par artisan
    const { error: daErr } = await supabase
      .from('dispatch_attempts')
      .delete()
      .in('artisan_id', artisanProIds)

    if (daErr && !daErr.message.includes('does not exist') && daErr.code !== '42703') {
      logWarn(`dispatch_attempts (artisan): ${daErr.message}`)
    }
  }

  return totalDeleted
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('========================================')
  console.log('   AfriOne — Nettoyage données de test  ')
  console.log('========================================')
  console.log(`Supabase URL    : ${SUPABASE_URL}`)
  console.log(`Marqueur email  : *${TEST_EMAIL_DOMAIN}`)
  console.log(`Timestamp       : ${new Date().toISOString()}\n`)

  let totalDeleted = 0
  let hasErrors    = false

  // ── Étape 1 : Récupérer les IDs des utilisateurs de test ─────────────────────
  console.log('Étape 1 : Identification des utilisateurs de test...')
  const { allIds: testUserIds, clientIds: testClientIds, artisanUserIds: testArtisanUserIds } = await getTestUserIds()

  if (testUserIds.length === 0) {
    console.log('\nAucun utilisateur de test trouvé. Base déjà propre.')
    return
  }

  console.log(`  ${testUserIds.length} utilisateur(s) de test trouvé(s) (${testClientIds.length} clients, ${testArtisanUserIds.length} artisans)`)

  // ── Étape 2 : Récupérer les IDs des profils artisan ──────────────────────────
  console.log('\nÉtape 2 : Identification des profils artisan de test...')
  const testArtisanProIds = await getTestArtisanProIds(testArtisanUserIds)
  console.log(`  ${testArtisanProIds.length} profil(s) artisan_pros de test trouvé(s)`)

  // ── Étape 3 : Supprimer les données liées aux missions ────────────────────────
  console.log('\nÉtape 3 : Nettoyage des missions et données associées...')
  try {
    const missionDeleted = await cleanupMissionDependencies(testClientIds, testArtisanProIds)
    totalDeleted += missionDeleted
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logErr(`Nettoyage missions: ${msg}`)
    hasErrors = true
  }

  // ── Étape 4 : Supprimer les profils artisan_pros ──────────────────────────────
  console.log('\nÉtape 4 : Suppression des profils artisan_pros...')
  if (testArtisanProIds.length > 0) {
    const { error: apErr } = await supabase
      .from('artisan_pros')
      .delete()
      .in('id', testArtisanProIds)

    if (apErr) {
      logErr(`artisan_pros: ${apErr.message}`)
      hasErrors = true
    } else {
      logOk(`${testArtisanProIds.length} artisan_pros supprimé(s)`)
      totalDeleted += testArtisanProIds.length
    }
  } else {
    logSkip('Aucun profil artisan_pros à supprimer')
  }

  // ── Étape 5 : Supprimer les utilisateurs ─────────────────────────────────────
  console.log('\nÉtape 5 : Suppression des utilisateurs de test...')
  if (testUserIds.length > 0) {
    const { error: usrErr } = await supabase
      .from('users')
      .delete()
      .in('id', testUserIds)

    if (usrErr) {
      logErr(`users: ${usrErr.message}`)
      hasErrors = true
    } else {
      logOk(`${testUserIds.length} utilisateur(s) supprimé(s)`)
      totalDeleted += testUserIds.length
    }
  } else {
    logSkip('Aucun utilisateur à supprimer')
  }

  // ── Étape 6 : Vérification post-nettoyage ─────────────────────────────────────
  console.log('\nÉtape 6 : Vérification post-nettoyage...')

  const { count: remainingUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .ilike('email', `%${TEST_EMAIL_DOMAIN}`)

  const { count: remainingArtisans } = await supabase
    .from('artisan_pros')
    .select('id', { count: 'exact', head: true })
    .in('user_id', testUserIds.length > 0 ? testUserIds : ['00000000-0000-0000-0000-000000000000'])

  const remaining = (remainingUsers || 0) + (remainingArtisans || 0)

  if (remaining > 0) {
    logWarn(`${remaining} enregistrement(s) de test potentiellement non supprimé(s)`)
  } else {
    logOk('Aucun enregistrement de test restant')
  }

  // ── Résumé ────────────────────────────────────────────────────────────────────
  console.log('\n========================================')
  console.log('   RESUME DU NETTOYAGE                  ')
  console.log('========================================')
  console.log(`Total supprimé    : ${totalDeleted} enregistrements`)
  console.log(`Erreurs           : ${hasErrors ? 'OUI (voir ci-dessus)' : 'NON'}`)
  console.log('\nNettoyage terminé !')

  if (hasErrors) process.exit(1)
}

main().catch(err => {
  console.error('\nERREUR CRITIQUE :', err)
  process.exit(1)
})
