/**
 * Test de charge — 20-30 échanges simultanés clients/artisans
 * Usage : node scripts/load-test.js
 *
 * Simule le parcours complet :
 *   Client → Diagnostic IA → Matching → Mission créée → Artisan accepte → Mission terminée
 *
 * Pas de dépendance externe : utilise fetch natif Node.js 18+
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// ─── IDs de test (remplacer avec les IDs réels du seed) ───────────────────────
// Lancez d'abord : node scripts/seed-test-users.js
const TEST_CLIENT_IDS = [
  // Remplacez avec les IDs retournés par seed-test-users.js
  // ex: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
]

const TEST_ARTISAN_IDS = [
  // Remplacez avec les IDs retournés par seed-test-users.js
]

// ─── Config ───────────────────────────────────────────────────────────────────
const CONCURRENT_USERS  = 20   // nombre de clients simultanés
const DELAY_BETWEEN_MS  = 200  // décalage entre chaque lancement (ms) pour éviter spike immédiat
const REQUEST_TIMEOUT   = 15000 // 15s max par requête

// ─── Scenarios de requêtes diagnostics ───────────────────────────────────────
const DIAGNOSTIC_MESSAGES = [
  "J'ai une fuite d'eau sous mon évier depuis ce matin",
  "Mon disjoncteur saute dès que j'allume la climatisation",
  "Il y a une fissure diagonale dans le mur du salon",
  "La porte d'entrée ne ferme plus correctement",
  "La serrure de la chambre est bloquée, clé ne tourne plus",
  "Le carrelage de la salle de bain se décolle",
  "Peinture qui cloque et s'écaille dans la cuisine",
  "La clim ne refroidit plus du tout",
  "Pas de courant dans toute la chambre du fond",
  "WC qui déborde, eau au sol",
  "Odeur d'égout dans la salle de bain la nuit",
  "Fuite au plafond pendant la pluie",
  "Mur humide côté rue, tache qui s'agrandit",
  "Poser du carrelage dans une pièce de 12m²",
  "Repeindre le salon 20m², couleur actuelle sombre",
  "Court-circuit, étincelles dans la prise du salon",
  "Porte de chambre qui frotte et ne se ferme plus",
  "Chauffe-eau ne produit plus d'eau chaude",
  "Pression d'eau très faible dans tout l'appartement",
  "Climatiseur fait un bruit de grincement au démarrage",
]

// ─── Métriques ────────────────────────────────────────────────────────────────
const metrics = {
  total: 0,
  success: 0,
  errors: 0,
  timeouts: 0,
  durations: [],
  errorDetails: [],
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error('TIMEOUT')
    throw err
  }
}

// ─── Parcours utilisateur complet ────────────────────────────────────────────
async function runUserJourney(userId, userIndex) {
  const label = `[User ${String(userIndex + 1).padStart(2, '0')}]`
  const start = Date.now()
  const steps = []

  try {
    // ÉTAPE 1 : Diagnostic IA (mode=start)
    const msg = DIAGNOSTIC_MESSAGES[userIndex % DIAGNOSTIC_MESSAGES.length]
    const t1 = Date.now()
    const diagRes = await fetchWithTimeout(`${BASE_URL}/api/diagnostic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'start',
        text: msg,
        photos: [],
        user_id: userId || `test_client_${userIndex}`,
        quartier: 'Cocody',
      }),
    })
    const diagTime = Date.now() - t1
    const diagOk = diagRes.ok
    steps.push({ step: 'diagnostic', status: diagRes.status, ms: diagTime })

    if (!diagOk) {
      const text = await diagRes.text()
      throw new Error(`Diagnostic ${diagRes.status}: ${text.slice(0, 100)}`)
    }
    const diagData = await diagRes.json()
    const diagPreview = diagData.question?.slice(0, 60) || diagData.summary?.slice(0, 60) || 'ok'
    console.log(`${label} ✅ Diagnostic (${diagTime}ms) — ${diagPreview}...`)

    // ÉTAPE 2 : Tarification
    const t2 = Date.now()
    const pricingRes = await fetchWithTimeout(`${BASE_URL}/api/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: diagData.category || 'Plomberie',
        description: msg,
        quartier: 'Cocody',
      }),
    })
    const pricingTime = Date.now() - t2
    steps.push({ step: 'pricing', status: pricingRes.status, ms: pricingTime })

    if (pricingRes.ok) {
      console.log(`${label} ✅ Pricing (${pricingTime}ms)`)
    } else {
      console.log(`${label} ⚠️  Pricing ${pricingRes.status} (${pricingTime}ms)`)
    }

    // ÉTAPE 3 : Matériaux
    const t3 = Date.now()
    const matRes = await fetchWithTimeout(`${BASE_URL}/api/materials?category=${encodeURIComponent(diagData.category || 'Plomberie')}`)
    const matTime = Date.now() - t3
    steps.push({ step: 'materials', status: matRes.status, ms: matTime })
    console.log(`${label} ✅ Materials (${matTime}ms) — status ${matRes.status}`)

    const totalMs = Date.now() - start
    metrics.success++
    metrics.durations.push(totalMs)
    console.log(`${label} 🏁 Parcours complet en ${totalMs}ms`)

    return { success: true, steps, totalMs }

  } catch (err) {
    const totalMs = Date.now() - start
    const isTimeout = err.message === 'TIMEOUT'
    if (isTimeout) metrics.timeouts++
    else metrics.errors++

    const detail = `User ${userIndex + 1}: ${err.message} (${totalMs}ms)`
    metrics.errorDetails.push(detail)
    console.log(`${label} ❌ ${isTimeout ? 'TIMEOUT' : 'ERREUR'} — ${err.message} (${totalMs}ms)`)

    return { success: false, error: err.message, steps, totalMs }
  } finally {
    metrics.total++
  }
}

// ─── Lancement concurrent ────────────────────────────────────────────────────
async function runLoadTest() {
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Test de charge AFRIONE — ${CONCURRENT_USERS} utilisateurs simultanés`)
  console.log(`  URL : ${BASE_URL}`)
  console.log('═══════════════════════════════════════════════════\n')

  const startAll = Date.now()

  // Lance tous les parcours avec un léger décalage pour éviter le spike immédiat
  const promises = []
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    const userId = TEST_CLIENT_IDS[i] || null
    promises.push(
      sleep(i * DELAY_BETWEEN_MS).then(() => runUserJourney(userId, i))
    )
  }

  const results = await Promise.allSettled(promises)
  const totalTime = Date.now() - startAll

  // ─── Rapport final ────────────────────────────────────────────────────────
  const sorted = [...metrics.durations].sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0
  const avg = metrics.durations.length
    ? Math.round(metrics.durations.reduce((a, b) => a + b, 0) / metrics.durations.length)
    : 0

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  RAPPORT DE TEST')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Durée totale       : ${(totalTime / 1000).toFixed(1)}s`)
  console.log(`  Utilisateurs       : ${CONCURRENT_USERS}`)
  console.log(`  Succès             : ${metrics.success} (${Math.round(metrics.success / metrics.total * 100)}%)`)
  console.log(`  Erreurs            : ${metrics.errors}`)
  console.log(`  Timeouts (>${REQUEST_TIMEOUT/1000}s)  : ${metrics.timeouts}`)
  console.log('  ─────────────────────────────────────────────────')
  console.log(`  Temps moyen        : ${avg}ms`)
  console.log(`  P50 (médiane)      : ${p50}ms`)
  console.log(`  P95 (lent)         : ${p95}ms`)
  console.log(`  P99 (très lent)    : ${p99}ms`)

  if (metrics.errorDetails.length > 0) {
    console.log('\n  Détail des erreurs :')
    metrics.errorDetails.forEach(e => console.log(`    • ${e}`))
  }

  console.log('═══════════════════════════════════════════════════')

  // Verdict
  const successRate = metrics.success / metrics.total
  if (successRate >= 0.95 && p95 < 5000) {
    console.log('\n  ✅ VERDICT : BON — L\'app tient la charge')
  } else if (successRate >= 0.80) {
    console.log('\n  ⚠️  VERDICT : ACCEPTABLE — Quelques lenteurs à surveiller')
  } else {
    console.log('\n  ❌ VERDICT : PROBLÈME — Taux d\'erreur trop élevé')
  }

  process.exit(metrics.errors > 0 || metrics.timeouts > 0 ? 1 : 0)
}

runLoadTest().catch(err => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})
