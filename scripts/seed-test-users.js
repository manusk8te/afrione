/**
 * Seed script — crée 10 clients et 10 artisans de test dans Supabase
 * Usage : node scripts/seed-test-users.js
 *
 * NE PAS EXÉCUTER EN PRODUCTION — table users uniquement, pas Auth
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SK       = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SK) {
  console.error('❌ Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SK)

const METIERS = ['Plombier', 'Électricien', 'Maçon', 'Peintre', 'Menuisier', 'Climatiseur', 'Serrurier', 'Carreleur', 'Plombier', 'Électricien']
const QUARTIERS = ['Cocody', 'Yopougon', 'Abobo', 'Adjamé', 'Plateau', 'Marcory', 'Treichville', 'Koumassi', 'Bingerville', 'Port-Bouët']

async function seed() {
  console.log('🌱 Seed démarré...\n')

  // ── 1. Clients ─────────────────────────────────────────────────────────────
  const clients = []
  for (let i = 1; i <= 10; i++) {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        phone: `+2250700TEST${String(i).padStart(2, '0')}`,
        name: `Client Test ${i}`,
        email: `client_test_${i}@afrione-test.com`,
        role: 'client',
        quartier: QUARTIERS[i - 1],
        is_active: true,
      }, { onConflict: 'phone' })
      .select('id')
      .single()

    if (error) { console.error(`❌ Client ${i}:`, error.message); continue }
    clients.push(data.id)
    console.log(`✅ Client ${i} — ${data.id}`)
  }

  // ── 2. Artisans ────────────────────────────────────────────────────────────
  const artisans = []
  for (let i = 1; i <= 10; i++) {
    const { data: user, error: uErr } = await supabase
      .from('users')
      .upsert({
        phone: `+2250700ARTI${String(i).padStart(2, '0')}`,
        name: `Artisan Test ${i}`,
        email: `artisan_test_${i}@afrione-test.com`,
        role: 'artisan',
        quartier: QUARTIERS[i - 1],
        is_active: true,
      }, { onConflict: 'phone' })
      .select('id')
      .single()

    if (uErr) { console.error(`❌ Artisan user ${i}:`, uErr.message); continue }

    // Vérifie si un profil artisan existe déjà pour cet user
    const { data: existing } = await supabase
      .from('artisan_pros')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let pro, pErr
    if (existing) {
      const { data, error } = await supabase
        .from('artisan_pros')
        .update({
          metier: METIERS[i - 1],
          bio: `Artisan de test ${i} — ${METIERS[i - 1]} expérimenté`,
          kyc_status: 'approved',
          is_available: true,
        })
        .eq('id', existing.id)
        .select('id')
        .single()
      pro = data; pErr = error
    } else {
      const { data, error } = await supabase
        .from('artisan_pros')
        .insert({
          user_id: user.id,
          metier: METIERS[i - 1],
          bio: `Artisan de test ${i} — ${METIERS[i - 1]} expérimenté`,
          quartiers: [QUARTIERS[i - 1], QUARTIERS[(i) % 10]],
          zone_gps: { lat: 5.345 + (i * 0.01), lng: -4.028 + (i * 0.01) },
          tarif_min: 5000 + (i * 1000),
          rayon_km: 15,
          is_available: true,
          kyc_status: 'approved',
          rating_avg: 3.5 + (Math.random() * 1.5),
          rating_count: 10 + i,
          years_experience: i + 2,
          scoring_weight: 0.7 + (i * 0.02),
        })
        .select('id')
        .single()
      pro = data; pErr = error
    }

    if (pErr) { console.error(`❌ Artisan pro ${i}:`, pErr.message); continue }
    artisans.push({ userId: user.id, proId: pro.id })
    console.log(`✅ Artisan ${i} — ${METIERS[i - 1]} — ${pro.id}`)
  }

  // ── 3. Affiche les IDs pour les tests ─────────────────────────────────────
  console.log('\n─────────────────────────────────────────────')
  console.log('IDs clients (copiez dans load-test.js) :')
  console.log(JSON.stringify(clients, null, 2))
  console.log('\nIDs artisans :')
  console.log(JSON.stringify(artisans.map(a => a.userId), null, 2))
  console.log('─────────────────────────────────────────────')
  console.log('\n✅ Seed terminé !')
}

seed().catch(console.error)
