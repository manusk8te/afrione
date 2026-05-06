/**
 * Test de stress Supabase direct — 30 missions simultanées
 * Usage : node scripts/stress-test-db.js
 *
 * Ce script bypasse Next.js et tape directement Supabase pour isoler
 * les goulots d'étranglement DB (RLS, transactions, concurrent writes).
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SK  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SK) {
  console.error('❌ Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SK)

const CONCURRENT_MISSIONS = 30

// ─── Métriques ────────────────────────────────────────────────────────────────
const m = { ok: 0, fail: 0, durations: [], errors: [] }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Récupère les IDs de test depuis la DB ───────────────────────────────────
async function getTestIds() {
  const { data: clients } = await supabase
    .from('users')
    .select('id')
    .like('phone', '%TEST%')
    .limit(15)

  const { data: artisans } = await supabase
    .from('artisan_pros')
    .select('id, user_id')
    .eq('kyc_status', 'approved')
    .eq('is_available', true)
    .limit(15)

  if (!clients?.length || !artisans?.length) {
    console.error('❌ Aucun utilisateur de test trouvé. Lancez d\'abord seed-test-users.js')
    process.exit(1)
  }

  console.log(`✅ ${clients.length} clients test, ${artisans.length} artisans approuvés trouvés\n`)
  return { clients, artisans }
}

// ─── Simulation parcours mission complet ────────────────────────────────────
async function simulateMission(clientId, artisanId, index) {
  const t = Date.now()
  const label = `[Mission ${String(index + 1).padStart(2, '0')}]`

  try {
    // 1. Création de la mission
    const { data: mission, error: mErr } = await supabase
      .from('missions')
      .insert({
        client_id: clientId,
        artisan_id: artisanId,
        status: 'matching',
        category: ['Plomberie', 'Électricité', 'Maçonnerie', 'Peinture', 'Climatisation'][index % 5],
        quartier: ['Cocody', 'Yopougon', 'Abobo', 'Adjamé', 'Plateau'][index % 5],
        address: `${index + 1} Rue de test, Abidjan`,
      })
      .select('id')
      .single()

    if (mErr) throw new Error(`Mission create: ${mErr.message}`)

    const missionId = mission.id

    // 2. Diagnostic (simultané avec 2 autres queries)
    const [diagResult, chatResult] = await Promise.all([
      supabase.from('diagnostics').insert({
        mission_id: missionId,
        raw_text: `Test diagnostic ${index + 1}`,
        ai_summary: `Résumé automatique test ${index + 1}`,
        category_detected: 'Plomberie',
        estimated_price_min: 15000,
        estimated_price_max: 50000,
        urgency_level: 'medium',
      }).select('id').single(),

      supabase.from('chat_history').insert({
        mission_id: missionId,
        sender_role: 'client',
        text: `Test message ${index + 1}`,
        type: 'text',
      }).select('id').single(),
    ])

    if (diagResult.error) throw new Error(`Diag: ${diagResult.error.message}`)
    if (chatResult.error) throw new Error(`Chat: ${chatResult.error.message}`)

    // 3. Devis
    const { error: qErr } = await supabase.from('quotations').insert({
      mission_id: missionId,
      labor_cost: 20000,
      platform_fee: 2000,
      assurance_fee: 500,
      total_price: 22500,
      artisan_receives: 20000,
      status: 'proposed',
    })

    if (qErr) throw new Error(`Quotation: ${qErr.message}`)

    // 4. Mise à jour statut → payment
    const { error: uErr } = await supabase
      .from('missions')
      .update({ status: 'payment' })
      .eq('id', missionId)

    if (uErr) throw new Error(`Update status: ${uErr.message}`)

    // 5. Proof of work (mission terminée)
    await supabase.from('missions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', missionId)

    const ms = Date.now() - t
    m.ok++
    m.durations.push(ms)
    console.log(`${label} ✅ OK (${ms}ms) — mission ${missionId.slice(0, 8)}...`)

    return { ok: true, ms, missionId }

  } catch (err) {
    const ms = Date.now() - t
    m.fail++
    m.errors.push(`Mission ${index + 1}: ${err.message}`)
    console.log(`${label} ❌ FAIL (${ms}ms) — ${err.message}`)
    return { ok: false, ms, error: err.message }
  }
}

// ─── Nettoyage des données de test ──────────────────────────────────────────
async function cleanup() {
  console.log('\n🧹 Nettoyage des missions de test...')
  const { count } = await supabase
    .from('missions')
    .delete()
    .like('address', '%Rue de test%')
    .select('*', { count: 'exact', head: true })

  console.log(`   ${count || 0} missions de test supprimées`)
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Stress test DB — ${CONCURRENT_MISSIONS} missions simultanées`)
  console.log('═══════════════════════════════════════════════════\n')

  const { clients, artisans } = await getTestIds()

  const start = Date.now()

  const promises = []
  for (let i = 0; i < CONCURRENT_MISSIONS; i++) {
    const clientId  = clients[i % clients.length].id
    const artisanId = artisans[i % artisans.length].id
    // Décalage de 50ms entre chaque pour simuler un flux naturel
    promises.push(sleep(i * 50).then(() => simulateMission(clientId, artisanId, i)))
  }

  await Promise.allSettled(promises)

  const total = Date.now() - start
  const sorted = [...m.durations].sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  RAPPORT DB STRESS TEST')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Missions lancées   : ${CONCURRENT_MISSIONS}`)
  console.log(`  Succès             : ${m.ok} (${Math.round(m.ok / CONCURRENT_MISSIONS * 100)}%)`)
  console.log(`  Échecs             : ${m.fail}`)
  console.log(`  Durée totale       : ${(total / 1000).toFixed(1)}s`)
  console.log(`  P50                : ${p50}ms`)
  console.log(`  P95                : ${p95}ms`)
  console.log(`  Débit              : ${Math.round(CONCURRENT_MISSIONS / (total / 1000))} missions/s`)

  if (m.errors.length) {
    console.log('\n  Erreurs :')
    m.errors.forEach(e => console.log(`    • ${e}`))
  }

  const verdict = m.ok / CONCURRENT_MISSIONS >= 0.95 ? '✅ DB stable' : '❌ Problèmes détectés'
  console.log(`\n  ${verdict}`)
  console.log('═══════════════════════════════════════════════════')

  // Nettoyage optionnel — commentez la ligne si vous voulez garder les données
  await cleanup()
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
