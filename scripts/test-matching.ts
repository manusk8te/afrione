/**
 * AfriOne — Tests de matching artisans
 * Usage : npm run test:matching
 *
 * Lit conversations-summary.json et pour chaque mission :
 * - Test matching standard (listing artisans)
 * - Test matching urgent (dispatch avec race condition)
 * Produit un rapport JSON + Markdown
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// ── Configuration ─────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SK   = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE_URL      = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

if (!SUPABASE_URL || !SUPABASE_SK) {
  console.error('ERREUR : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SK)

const SUMMARY_FILE  = path.resolve(process.cwd(), 'test-results', 'conversations-summary.json')
const REPORT_JSON   = path.resolve(process.cwd(), 'test-results', 'rapport_matching.json')
const REPORT_MD     = path.resolve(process.cwd(), 'test-results', 'rapport_matching.md')
const TIMEOUT_MS    = 30_000

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArtisanRow {
  id:           string
  metier:       string
  rating_avg:   number | null
  is_available: boolean
  tarif_min:    number | null
  kyc_status:   string
  users?:       { name?: string; quartier?: string }
}

interface MatchingAnomaly {
  type:    'WRONG_METIER' | 'WRONG_ORDER' | 'UNAVAILABLE_SHOWN' | 'QUARTIER_IGNORED' | 'DISPATCH_RACE_CONDITION' | 'NO_RESULTS' | 'DISPATCH_ERROR' | 'INFO'
  missionIdx: number
  category:   string
  quartier:   string
  details:    string
  severity:   'ERROR' | 'WARNING' | 'INFO'
}

interface MatchingTestResult {
  missionIdx:     number
  clientId:       number
  persona:        string
  quartier:       string
  category:       string
  missionId:      string | null
  standardTest:   StandardTestResult
  urgentTest:     UrgentTestResult | null
  anomalies:      MatchingAnomaly[]
}

interface StandardTestResult {
  artisansReturned: number
  isOrderCorrect:   boolean
  noUnavailable:    boolean
  metierMatch:      boolean
  optimalArtisan:   OptimalArtisan | null
  rawArtisans:      Array<{ id: string; metier: string; rating_avg: number | null; is_available: boolean; quartier?: string }>
}

interface OptimalArtisan {
  id:         string
  metier:     string
  rating_avg: number | null
  quartier?:  string
}

interface UrgentTestResult {
  dispatchStarted:   boolean
  dispatchedCount:   number
  acceptedArtisan:   string | null
  raceConditionTest: RaceConditionResult | null
  error?:            string
}

interface RaceConditionResult {
  firstAcceptStatus:  number
  secondAcceptStatus: number
  firstAccepted:      boolean
  secondGotError:     boolean
  errorMessage:       string
  passed:             boolean
}

interface ConversationSummary {
  totalClients:  number
  successCount:  number
  missions: Array<{
    clientId:   number
    persona:    string
    quartier:   string
    category:   string
    missionId:  string | null
    pricing:    Record<string, unknown> | null
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function extractMetierWord(category: string): string {
  return category.split(' ')[0]
}

// ── Test matching standard ────────────────────────────────────────────────────

async function testStandardMatching(
  category: string,
  quartier: string,
  missionIdx: number,
): Promise<{ result: StandardTestResult; anomalies: MatchingAnomaly[] }> {
  const anomalies: MatchingAnomaly[] = []
  const catWord = extractMetierWord(category)

  // Requête Supabase directe (même logique que matching/page.tsx)
  const { data: artisans, error } = await supabase
    .from('artisan_pros')
    .select('id, metier, rating_avg, is_available, tarif_min, kyc_status, users!artisan_pros_user_id_fkey(name, quartier)')
    .eq('kyc_status', 'approved')
    .eq('is_available', true)
    .ilike('metier', `%${catWord}%`)
    .order('rating_avg', { ascending: false })
    .limit(5)

  if (error) {
    console.error(`  [ERREUR matching standard] ${error.message}`)
    anomalies.push({
      type:       'NO_RESULTS',
      missionIdx,
      category,
      quartier,
      details:    `Erreur Supabase: ${error.message}`,
      severity:   'ERROR',
    })
    return {
      result: { artisansReturned: 0, isOrderCorrect: false, noUnavailable: true, metierMatch: false, optimalArtisan: null, rawArtisans: [] },
      anomalies,
    }
  }

  const rows = (artisans || []) as ArtisanRow[]

  // --- Vérification 1 : aucun artisan retourné ---
  if (rows.length === 0) {
    anomalies.push({
      type:     'NO_RESULTS',
      missionIdx,
      category,
      quartier,
      details:  `Aucun artisan retourné pour la catégorie "${category}"`,
      severity: 'WARNING',
    })
  }

  // --- Vérification 2 : métier correct ---
  const wrongMetier = rows.filter(a =>
    !a.metier.toLowerCase().includes(catWord.toLowerCase()) &&
    !catWord.toLowerCase().includes(a.metier.toLowerCase().split(' ')[0])
  )
  const metierMatch = wrongMetier.length === 0
  if (!metierMatch) {
    anomalies.push({
      type:     'WRONG_METIER',
      missionIdx,
      category,
      quartier,
      details:  `${wrongMetier.length} artisan(s) avec mauvais métier: ${wrongMetier.map(a => a.metier).join(', ')}`,
      severity: 'ERROR',
    })
  }

  // --- Vérification 3 : ordre par rating_avg DESC ---
  let isOrderCorrect = true
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i-1].rating_avg ?? -1
    const curr = rows[i].rating_avg   ?? -1
    if (prev < curr) {
      isOrderCorrect = false
      anomalies.push({
        type:     'WRONG_ORDER',
        missionIdx,
        category,
        quartier,
        details:  `Ordre incorrect à la position ${i}: rating ${prev} avant ${curr}`,
        severity: 'ERROR',
      })
      break
    }
  }

  // --- Vérification 4 : aucun artisan indisponible ---
  const unavailable = rows.filter(a => !a.is_available)
  const noUnavailable = unavailable.length === 0
  if (!noUnavailable) {
    anomalies.push({
      type:     'UNAVAILABLE_SHOWN',
      missionIdx,
      category,
      quartier,
      details:  `${unavailable.length} artisan(s) indisponible(s) retourné(s): ${unavailable.map(a => a.id).join(', ')}`,
      severity: 'ERROR',
    })
  }

  // --- Vérification 5 : quartier pris en compte ---
  // La requête actuelle ne filtre pas par quartier → WARNING si le quartier client
  // ne correspond à aucun artisan retourné
  const quartiersArtisans = rows.map(a => (a.users as { quartier?: string })?.quartier).filter(Boolean)
  if (quartiersArtisans.length > 0 && !quartiersArtisans.includes(quartier)) {
    anomalies.push({
      type:     'QUARTIER_IGNORED',
      missionIdx,
      category,
      quartier,
      details:  `Quartier client "${quartier}" non représenté dans les résultats (quartiers retournés: ${quartiersArtisans.slice(0,3).join(', ')})`,
      severity: 'WARNING',
    })
  }

  // --- Calcul de l'artisan optimal théorique ---
  // Meilleur rating_avg, même métier
  let optimalArtisan: OptimalArtisan | null = null
  if (rows.length > 0) {
    const withRating = rows.filter(a => a.rating_avg !== null)
    if (withRating.length > 0) {
      const best = withRating.reduce((prev, curr) =>
        (curr.rating_avg! > prev.rating_avg!) ? curr : prev
      )
      optimalArtisan = {
        id:         best.id,
        metier:     best.metier,
        rating_avg: best.rating_avg,
        quartier:   (best.users as { quartier?: string })?.quartier,
      }
    } else {
      optimalArtisan = {
        id:         rows[0].id,
        metier:     rows[0].metier,
        rating_avg: null,
        quartier:   (rows[0].users as { quartier?: string })?.quartier,
      }
    }
  }

  return {
    result: {
      artisansReturned: rows.length,
      isOrderCorrect,
      noUnavailable,
      metierMatch,
      optimalArtisan,
      rawArtisans: rows.map(a => ({
        id:           a.id,
        metier:       a.metier,
        rating_avg:   a.rating_avg,
        is_available: a.is_available,
        quartier:     (a.users as { quartier?: string })?.quartier,
      })),
    },
    anomalies,
  }
}

// ── Test matching urgent + race condition ─────────────────────────────────────

async function testUrgentMatching(
  missionId: string,
  missionIdx: number,
  category: string,
  quartier: string,
): Promise<{ result: UrgentTestResult; anomalies: MatchingAnomaly[] }> {
  const anomalies: MatchingAnomaly[] = []

  // Vérifier que la mission est en mode urgent
  const { data: mission } = await supabase
    .from('missions')
    .select('id, mode, status, category, client_id')
    .eq('id', missionId)
    .maybeSingle()

  if (!mission) {
    return {
      result: { dispatchStarted: false, dispatchedCount: 0, acceptedArtisan: null, raceConditionTest: null, error: 'Mission introuvable' },
      anomalies: [{
        type: 'DISPATCH_ERROR', missionIdx, category, quartier,
        details: `Mission ${missionId} introuvable en BDD`, severity: 'ERROR',
      }],
    }
  }

  if (mission.mode !== 'urgent') {
    // Mettre en mode urgent pour le test
    await supabase.from('missions').update({ mode: 'urgent', status: 'pending' }).eq('id', missionId)
  }

  // Trouver des artisans disponibles pour simuler les réponses
  const catWord = extractMetierWord(category)
  const { data: candidateArtisans } = await supabase
    .from('artisan_pros')
    .select('id, user_id, metier')
    .eq('kyc_status', 'approved')
    .eq('is_available', true)
    .ilike('metier', `%${catWord}%`)
    .limit(5)

  const artisans = candidateArtisans || []

  if (artisans.length < 2) {
    // Pas assez d'artisans pour tester la race condition
    return {
      result: { dispatchStarted: false, dispatchedCount: 0, acceptedArtisan: null, raceConditionTest: null, error: 'Pas assez d\'artisans disponibles pour le test urgent' },
      anomalies: [{
        type: 'DISPATCH_ERROR', missionIdx, category, quartier,
        details: `Seulement ${artisans.length} artisan(s) disponibles (min 2 requis pour race condition)`, severity: 'WARNING',
      }],
    }
  }

  // ── Démarrer le dispatch urgent ────────────────────────────────────────────
  console.log(`    Démarrage dispatch urgent pour mission ${missionId}...`)

  // Insérer les dispatch_attempts manuellement (simule ce que /api/dispatch/start ferait)
  const expiresAt = new Date(Date.now() + 45_000).toISOString()

  // Nettoyer les anciennes tentatives
  await supabase.from('dispatch_attempts').delete().eq('mission_id', missionId)
  await supabase.from('missions').update({ mode: 'urgent', status: 'dispatching' }).eq('id', missionId)

  // Créer des tentatives pour chaque artisan
  const attempts = []
  for (let i = 0; i < Math.min(artisans.length, 4); i++) {
    const { data: attempt } = await supabase
      .from('dispatch_attempts')
      .insert({
        mission_id:     missionId,
        artisan_id:     artisans[i].id,
        attempt_number: i + 1,
        expires_at:     expiresAt,
      })
      .select('id')
      .single()

    if (attempt) attempts.push({ attemptId: attempt.id, artisanId: artisans[i].id })
  }

  console.log(`    ${attempts.length} artisans contactés`)

  // Simuler des refus (70% → les N-2 premiers refusent)
  const refuseCount = Math.max(0, attempts.length - 2)
  for (let i = 0; i < refuseCount; i++) {
    await fetchWithTimeout(`${BASE_URL}/api/dispatch/respond`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        mission_id: missionId,
        artisan_id: attempts[i].artisanId,
        response:   'refused',
      }),
    }).catch(() => {})

    console.log(`    Artisan ${i+1}/${attempts.length} a refusé`)
    await new Promise<void>(resolve => setTimeout(resolve, 100))
  }

  // ── Test race condition : deux artisans acceptent à 50ms d'intervalle ────────
  const artisan1 = attempts[attempts.length - 2]
  const artisan2 = attempts[attempts.length - 1]

  if (!artisan1 || !artisan2) {
    return {
      result: { dispatchStarted: true, dispatchedCount: attempts.length, acceptedArtisan: null, raceConditionTest: null, error: 'Pas assez de tentatives créées' },
      anomalies,
    }
  }

  console.log(`    Test race condition : artisans ${artisan1.artisanId.slice(0,8)} vs ${artisan2.artisanId.slice(0,8)}`)

  // Lancer les deux requêtes d'acceptation avec 50ms d'intervalle
  let firstStatus  = 0
  let secondStatus = 0
  let firstData:   Record<string, unknown> = {}
  let secondData:  Record<string, unknown> = {}

  const race = async () => {
    const [res1, res2] = await Promise.all([
      (async () => {
        const r = await fetchWithTimeout(`${BASE_URL}/api/dispatch/respond`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            mission_id: missionId,
            artisan_id: artisan1.artisanId,
            response:   'accepted',
          }),
        })
        firstStatus = r.status
        firstData   = await r.json() as Record<string, unknown>
        return r
      })(),
      (async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 50))
        const r = await fetchWithTimeout(`${BASE_URL}/api/dispatch/respond`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            mission_id: missionId,
            artisan_id: artisan2.artisanId,
            response:   'accepted',
          }),
        })
        secondStatus = r.status
        secondData   = await r.json() as Record<string, unknown>
        return r
      })(),
    ])
    return [res1, res2]
  }

  try {
    await race()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`    Race condition test error: ${msg}`)
  }

  const firstAccepted = firstStatus === 200 && firstData.accepted === true
  const secondGotError = secondStatus === 409 || secondData.already_taken === true || secondStatus === 404

  const raceResult: RaceConditionResult = {
    firstAcceptStatus:  firstStatus,
    secondAcceptStatus: secondStatus,
    firstAccepted,
    secondGotError,
    errorMessage: secondData.error as string || String(secondStatus),
    passed: firstAccepted && secondGotError,
  }

  console.log(`    Race condition: premier=${firstStatus} (accepted:${firstAccepted}), second=${secondStatus} (error:${secondGotError})`)

  if (!raceResult.passed) {
    const details = !firstAccepted
      ? `Le premier artisan n'a pas accepté correctement (HTTP ${firstStatus})`
      : `Le second artisan n'a pas reçu d'erreur propre (HTTP ${secondStatus}, got: ${JSON.stringify(secondData).slice(0,100)})`

    anomalies.push({
      type:     'DISPATCH_RACE_CONDITION',
      missionIdx,
      category,
      quartier,
      details,
      severity: 'ERROR',
    })
  } else {
    anomalies.push({
      type:     'INFO',
      missionIdx,
      category,
      quartier,
      details:  `Race condition OK : artisan ${artisan1.artisanId.slice(0,8)} a gagné, artisan ${artisan2.artisanId.slice(0,8)} a reçu HTTP ${secondStatus} "${raceResult.errorMessage}"`,
      severity: 'INFO',
    })
  }

  // Vérifier le vainqueur en BDD
  const { data: updatedMission } = await supabase
    .from('missions')
    .select('artisan_id, status')
    .eq('id', missionId)
    .single()

  const acceptedArtisan = updatedMission?.artisan_id || null

  return {
    result: {
      dispatchStarted:   true,
      dispatchedCount:   attempts.length,
      acceptedArtisan,
      raceConditionTest: raceResult,
    },
    anomalies,
  }
}

// ── Génération du rapport Markdown ────────────────────────────────────────────

function generateMarkdownReport(
  results: MatchingTestResult[],
  allAnomalies: MatchingAnomaly[],
): string {
  const errors   = allAnomalies.filter(a => a.severity === 'ERROR')
  const warnings = allAnomalies.filter(a => a.severity === 'WARNING')
  const infos    = allAnomalies.filter(a => a.severity === 'INFO')

  const lines: string[] = [
    '# Rapport de Test Matching — AfriOne',
    '',
    `**Généré le :** ${new Date().toLocaleString('fr-FR')}`,
    `**Missions testées :** ${results.length}`,
    `**Anomalies :** ${errors.length} erreurs, ${warnings.length} avertissements, ${infos.length} infos`,
    '',
    '---',
    '',
    '## Résumé global',
    '',
    '| Indicateur | Valeur |',
    '|---|---|',
    `| Missions testées | ${results.length} |`,
    `| Avec matching standard | ${results.filter(r => r.standardTest.artisansReturned > 0).length} |`,
    `| Avec test urgent | ${results.filter(r => r.urgentTest !== null).length} |`,
    `| Race conditions testées | ${results.filter(r => r.urgentTest?.raceConditionTest !== null).length} |`,
    `| Race conditions OK | ${results.filter(r => r.urgentTest?.raceConditionTest?.passed === true).length} |`,
    `| Anomalies critiques (ERREUR) | ${errors.length} |`,
    `| Avertissements (WARNING) | ${warnings.length} |`,
    '',
    '---',
    '',
    '## Tableau des anomalies',
    '',
    '| N° | Sévérité | Type | Catégorie | Quartier | Détail |',
    '|---|---|---|---|---|---|',
  ]

  for (const anomaly of allAnomalies) {
    const sev = anomaly.severity === 'ERROR' ? 'ERREUR' :
                anomaly.severity === 'WARNING' ? 'ATTENTION' : 'INFO'
    lines.push(
      `| ${anomaly.missionIdx} | ${sev} | ${anomaly.type} | ${anomaly.category} | ${anomaly.quartier} | ${anomaly.details.slice(0, 100)} |`
    )
  }

  if (allAnomalies.length === 0) {
    lines.push('| — | — | Aucune anomalie détectée | — | — | — |')
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Détail par mission')
  lines.push('')

  for (const result of results) {
    lines.push(`### Mission ${result.missionIdx} — ${result.category} | ${result.quartier} | ${result.persona}`)
    lines.push('')
    lines.push('**Matching standard :**')
    lines.push(`- Artisans retournés : ${result.standardTest.artisansReturned}`)
    lines.push(`- Ordre correct (rating DESC) : ${result.standardTest.isOrderCorrect ? 'OUI' : 'NON'}`)
    lines.push(`- Aucun indisponible : ${result.standardTest.noUnavailable ? 'OUI' : 'NON'}`)
    lines.push(`- Métier correct : ${result.standardTest.metierMatch ? 'OUI' : 'NON'}`)

    if (result.standardTest.optimalArtisan) {
      const opt = result.standardTest.optimalArtisan
      lines.push(`- Artisan optimal : \`${opt.id.slice(0,8)}...\` (${opt.metier}, rating: ${opt.rating_avg ?? 'N/A'}, quartier: ${opt.quartier ?? 'N/A'})`)
    }

    if (result.urgentTest) {
      lines.push('')
      lines.push('**Test urgent :**')
      lines.push(`- Dispatch démarré : ${result.urgentTest.dispatchStarted ? 'OUI' : 'NON'}`)
      lines.push(`- Artisans contactés : ${result.urgentTest.dispatchedCount}`)
      lines.push(`- Artisan gagnant : ${result.urgentTest.acceptedArtisan ? result.urgentTest.acceptedArtisan.slice(0,8) + '...' : 'Aucun'}`)

      if (result.urgentTest.raceConditionTest) {
        const rc = result.urgentTest.raceConditionTest
        lines.push(`- Race condition : ${rc.passed ? 'PASSE' : 'ECHEC'}`)
        lines.push(`  - Premier : HTTP ${rc.firstAcceptStatus} (accepted: ${rc.firstAccepted})`)
        lines.push(`  - Second : HTTP ${rc.secondAcceptStatus} — message: "${rc.errorMessage}"`)
      }
    }

    if (result.anomalies.length > 0) {
      lines.push('')
      lines.push('**Anomalies :**')
      for (const a of result.anomalies) {
        const icon = a.severity === 'ERROR' ? 'ERREUR' : a.severity === 'WARNING' ? 'ATTENTION' : 'INFO'
        lines.push(`- [${icon}] ${a.type}: ${a.details}`)
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('========================================')
  console.log('   AfriOne — Tests de matching          ')
  console.log('========================================')
  console.log(`Supabase URL : ${SUPABASE_URL}`)
  console.log(`Base URL     : ${BASE_URL}`)
  console.log(`Timestamp    : ${new Date().toISOString()}\n`)

  // Lire le résumé des conversations
  if (!fs.existsSync(SUMMARY_FILE)) {
    console.error(`ERREUR : ${SUMMARY_FILE} introuvable. Lancez d'abord : npm run test:simulate`)
    process.exit(1)
  }

  const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf-8')) as ConversationSummary

  console.log(`Missions lues depuis le résumé : ${summary.missions.length}\n`)

  const allResults:   MatchingTestResult[] = []
  const allAnomalies: MatchingAnomaly[]    = []

  for (let idx = 0; idx < summary.missions.length; idx++) {
    const mission = summary.missions[idx]
    console.log(`\n[Mission ${idx+1}/${summary.missions.length}] Client ${mission.clientId} — ${mission.persona} — ${mission.category} — ${mission.quartier}`)

    const testResult: MatchingTestResult = {
      missionIdx:   idx + 1,
      clientId:     mission.clientId,
      persona:      mission.persona,
      quartier:     mission.quartier,
      category:     mission.category,
      missionId:    mission.missionId,
      standardTest: { artisansReturned: 0, isOrderCorrect: true, noUnavailable: true, metierMatch: true, optimalArtisan: null, rawArtisans: [] },
      urgentTest:   null,
      anomalies:    [],
    }

    // ── Test standard ──────────────────────────────────────────────────────────
    console.log(`  Test matching standard pour ${mission.category}...`)
    try {
      const { result: stdResult, anomalies: stdAnomalies } = await testStandardMatching(
        mission.category,
        mission.quartier,
        idx + 1,
      )
      testResult.standardTest = stdResult
      testResult.anomalies.push(...stdAnomalies)
      allAnomalies.push(...stdAnomalies)

      console.log(`  -> ${stdResult.artisansReturned} artisans | ordre OK: ${stdResult.isOrderCorrect} | métier OK: ${stdResult.metierMatch} | sans indispo: ${stdResult.noUnavailable}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ERREUR test standard: ${msg}`)
      const anomaly: MatchingAnomaly = {
        type: 'NO_RESULTS', missionIdx: idx + 1, category: mission.category, quartier: mission.quartier,
        details: `Exception: ${msg}`, severity: 'ERROR',
      }
      testResult.anomalies.push(anomaly)
      allAnomalies.push(anomaly)
    }

    // ── Test urgent (seulement pour les missions 'urgent' avec missionId) ──────
    if (mission.persona === 'urgent' && mission.missionId) {
      console.log(`  Test matching urgent pour mission ${mission.missionId}...`)
      try {
        const { result: urgResult, anomalies: urgAnomalies } = await testUrgentMatching(
          mission.missionId,
          idx + 1,
          mission.category,
          mission.quartier,
        )
        testResult.urgentTest = urgResult
        testResult.anomalies.push(...urgAnomalies)
        allAnomalies.push(...urgAnomalies)

        if (urgResult.raceConditionTest) {
          console.log(`  -> Race condition: ${urgResult.raceConditionTest.passed ? 'PASSE' : 'ECHEC'}`)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  ERREUR test urgent: ${msg}`)
        const anomaly: MatchingAnomaly = {
          type: 'DISPATCH_ERROR', missionIdx: idx + 1, category: mission.category, quartier: mission.quartier,
          details: `Exception: ${msg}`, severity: 'ERROR',
        }
        testResult.urgentTest = { dispatchStarted: false, dispatchedCount: 0, acceptedArtisan: null, raceConditionTest: null, error: msg }
        testResult.anomalies.push(anomaly)
        allAnomalies.push(anomaly)
      }
    }

    allResults.push(testResult)

    // Petite pause entre les tests
    await new Promise<void>(resolve => setTimeout(resolve, 200))
  }

  // ── Rapport final ──────────────────────────────────────────────────────────

  const errors   = allAnomalies.filter(a => a.severity === 'ERROR')
  const warnings = allAnomalies.filter(a => a.severity === 'WARNING')

  const reportData = {
    generatedAt:   new Date().toISOString(),
    totalMissions: allResults.length,
    anomalyCount:  allAnomalies.length,
    errorCount:    errors.length,
    warningCount:  warnings.length,
    results:       allResults,
    anomalies:     allAnomalies,
    summary: {
      standardTests: {
        withResults:     allResults.filter(r => r.standardTest.artisansReturned > 0).length,
        orderCorrect:    allResults.filter(r => r.standardTest.isOrderCorrect).length,
        noUnavailable:   allResults.filter(r => r.standardTest.noUnavailable).length,
        metierMatch:     allResults.filter(r => r.standardTest.metierMatch).length,
      },
      urgentTests: {
        total:             allResults.filter(r => r.urgentTest !== null).length,
        dispatchStarted:   allResults.filter(r => r.urgentTest?.dispatchStarted).length,
        raceConditionPassed: allResults.filter(r => r.urgentTest?.raceConditionTest?.passed === true).length,
      },
    },
  }

  const outDir = path.resolve(process.cwd(), 'test-results')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  fs.writeFileSync(REPORT_JSON, JSON.stringify(reportData, null, 2), 'utf-8')
  fs.writeFileSync(REPORT_MD, generateMarkdownReport(allResults, allAnomalies), 'utf-8')

  console.log('\n========================================')
  console.log('   RESUME TESTS DE MATCHING             ')
  console.log('========================================')
  console.log(`Missions testées         : ${allResults.length}`)
  console.log(`Anomalies critiques      : ${errors.length}`)
  console.log(`Avertissements           : ${warnings.length}`)
  console.log(`Matching standard OK     : ${allResults.filter(r => r.standardTest.artisansReturned > 0 && r.standardTest.isOrderCorrect && r.standardTest.noUnavailable).length}/${allResults.length}`)
  console.log(`Race conditions passées  : ${allResults.filter(r => r.urgentTest?.raceConditionTest?.passed === true).length}/${allResults.filter(r => r.urgentTest?.raceConditionTest !== null).length}`)
  console.log(`\nRapport JSON : ${REPORT_JSON}`)
  console.log(`Rapport MD   : ${REPORT_MD}`)
}

main().catch(err => {
  console.error('\nERREUR CRITIQUE :', err)
  process.exit(1)
})
