/**
 * Seed script — crée 4 comptes Supabase Auth de test avec profils complets
 * Usage : npm run seed:auth   (ou: node scripts/seed-auth-test-users.js)
 *
 * Comptes créés :
 *   test.client@afrione.ci    / AfriTest2024!   → client, Cocody
 *   test.plombier@afrione.ci  / AfriTest2024!   → artisan plombier, Yopougon
 *   test.elec@afrione.ci      / AfriTest2024!   → artisan électricien, Abobo
 *   test.admin@afrione.ci     / AfriTest2024!   → admin
 *
 * NE PAS EXÉCUTER EN PRODUCTION
 */

const fs = require('fs')
const path = require('path')

// Charge .env.local manuellement
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  })
}

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SK  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SK) {
  console.error('❌ Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SK, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'AfriTest2024!'

const ACCOUNTS = [
  {
    email: 'test.client@afrione.ci',
    name: 'Client Test Dev',
    role: 'client',
    quartier: 'Cocody',
    phone: '+2250700DEV001',
    artisan: null,
  },
  {
    email: 'test.plombier@afrione.ci',
    name: 'Kouadio Test Plombier',
    role: 'artisan',
    quartier: 'Yopougon',
    phone: '+2250700DEV002',
    artisan: {
      metier: 'Plombier',
      bio: 'Plombier de test — 8 ans d\'expérience à Yopougon',
      quartiers: ['Yopougon', 'Cocody', 'Adjamé'],
      tarif_min: 8000,
      rayon_km: 20,
      years_experience: 8,
    },
  },
  {
    email: 'test.elec@afrione.ci',
    name: 'Bamba Test Électricien',
    role: 'artisan',
    quartier: 'Abobo',
    phone: '+2250700DEV003',
    artisan: {
      metier: 'Électricien',
      bio: 'Électricien de test — 5 ans d\'expérience à Abobo',
      quartiers: ['Abobo', 'Adjamé', 'Plateau'],
      tarif_min: 10000,
      rayon_km: 15,
      years_experience: 5,
    },
  },
  {
    email: 'test.admin@afrione.ci',
    name: 'Admin Test Dev',
    role: 'admin',
    quartier: 'Plateau',
    phone: '+2250700DEV004',
    artisan: null,
  },
]

async function upsertAuthUser(email) {
  // Cherche si l'utilisateur auth existe déjà
  const { data: list } = await sb.auth.admin.listUsers()
  const existing = list?.users?.find(u => u.email === email)

  if (existing) {
    // Met à jour le mot de passe si besoin
    await sb.auth.admin.updateUserById(existing.id, { password: PASSWORD })
    console.log(`  ↻ Auth existant — ${email} (${existing.id})`)
    return existing.id
  }

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })

  if (error) throw new Error(`Auth create failed for ${email}: ${error.message}`)
  console.log(`  + Auth créé — ${email} (${data.user.id})`)
  return data.user.id
}

async function upsertPublicUser(id, acct) {
  const { error } = await sb.from('users').upsert({
    id,
    email: acct.email,
    name: acct.name,
    role: acct.role,
    phone: acct.phone,
    quartier: acct.quartier,
    is_active: true,
  }, { onConflict: 'id' })

  if (error) throw new Error(`users upsert failed for ${acct.email}: ${error.message}`)
  console.log(`  + users table OK — role: ${acct.role}`)
}

async function upsertArtisanPro(userId, artisan) {
  const { data: existing } = await sb.from('artisan_pros').select('id').eq('user_id', userId).maybeSingle()

  const payload = {
    user_id: userId,
    metier: artisan.metier,
    bio: artisan.bio,
    quartiers: artisan.quartiers,
    zone_gps: { lat: 5.345, lng: -4.028 },
    tarif_min: artisan.tarif_min,
    rayon_km: artisan.rayon_km,
    is_available: true,
    kyc_status: 'approved',
    rating_avg: 4.2,
    rating_count: 15,
    years_experience: artisan.years_experience,
    scoring_weight: 0.8,
  }

  if (existing) {
    const { error } = await sb.from('artisan_pros').update(payload).eq('id', existing.id)
    if (error) throw new Error(`artisan_pros update failed: ${error.message}`)
    console.log(`  + artisan_pros OK — ${artisan.metier} (mis à jour)`)
  } else {
    const { error } = await sb.from('artisan_pros').insert(payload)
    if (error) throw new Error(`artisan_pros insert failed: ${error.message}`)
    console.log(`  + artisan_pros OK — ${artisan.metier} (créé)`)
  }
}

async function seed() {
  console.log('🌱 Seed comptes auth de test...\n')

  for (const acct of ACCOUNTS) {
    console.log(`\n▶ ${acct.email}`)
    try {
      const authId = await upsertAuthUser(acct.email)
      await upsertPublicUser(authId, acct)
      if (acct.artisan) await upsertArtisanPro(authId, acct.artisan)
    } catch (err) {
      console.error(`  ❌ Erreur: ${err.message}`)
    }
  }

  console.log('\n─────────────────────────────────────────────')
  console.log('✅ Comptes prêts. Dans le Dev Panel :')
  console.log('  👤 Client       → test.client@afrione.ci')
  console.log('  🔧 Plombier     → test.plombier@afrione.ci')
  console.log('  ⚡ Électricien  → test.elec@afrione.ci')
  console.log('  🛡️ Admin        → test.admin@afrione.ci')
  console.log('  Mot de passe    → AfriTest2024!')
  console.log('─────────────────────────────────────────────')
}

seed().catch(console.error)
