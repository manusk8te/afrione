/**
 * AfriOne — Script de seed de données de test
 * Usage : npm run test:seed
 *
 * Insère 50 artisans et 50 clients fictifs.
 * Marqueur de test : email se terminant par @afrione-test.ci
 * Si la colonne is_test_account existe (ou peut être ajoutée), elle est aussi utilisée.
 * Utilise SUPABASE_SERVICE_ROLE_KEY pour bypasser le RLS.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
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

// ── Domaine de marquage des comptes de test ──────────────────────────────────
const TEST_EMAIL_DOMAIN = '@afrione-test.ci'

// ── Constantes ──────────────────────────────────────────────────────────────

// `metier` DOIT être la catégorie (identique à artisan-space/register et
// missions.category) — c'est la seule valeur reconnue par le matching
// dispatch. `label` est juste le nom du métier pour les textes générés.
const METIERS_CATEGORIES: Array<{ metier: string; label: string; category: string }> = [
  { metier: 'Plomberie',     label: 'Plombier',    category: 'Plomberie'     },
  { metier: 'Électricité',   label: 'Électricien', category: 'Électricité'   },
  { metier: 'Peinture',      label: 'Peintre',     category: 'Peinture'      },
  { metier: 'Menuiserie',    label: 'Menuisier',   category: 'Menuiserie'    },
  { metier: 'Climatisation', label: 'Climaticien', category: 'Climatisation' },
]

const QUARTIERS = ['Cocody', 'Yopougon', 'Plateau', 'Marcory', 'Adjamé', 'Abobo', 'Treichville', 'Koumassi', 'Bingerville', 'Riviera']

const PRENOMS = ['Kofi', 'Ama', 'Kwame', 'Akosua', 'Yaw', 'Abena', 'Kojo', 'Efua', 'Kweku', 'Adwoa',
                 'Mamadou', 'Fatoumata', 'Ibrahim', 'Mariam', 'Oumar', 'Aminata', 'Seydou', 'Kadiatou',
                 'Jean-Baptiste', 'Marie-Claire', 'Armand', 'Philomène', 'Gustave', 'Solange', 'Roger']

const NOMS = ['Kouassi', 'Traoré', 'Koné', 'Bamba', 'Diallo', 'Coulibaly', 'Ouédraogo', 'Touré',
              'Gnamba', 'Dembélé', 'Kouyaté', 'Sanogo', 'Fofana', 'Cissé', 'Diabaté']

const GPS_COORDS: Record<string, { lat: number; lng: number }> = {
  Cocody:      { lat: 5.3467, lng: -3.9894 },
  Yopougon:    { lat: 5.35,   lng: -4.0667 },
  Plateau:     { lat: 5.3167, lng: -4.0167 },
  Marcory:     { lat: 5.2833, lng: -3.9833 },
  Adjamé:      { lat: 5.3667, lng: -4.0167 },
  Abobo:       { lat: 5.4167, lng: -4.0333 },
  Treichville: { lat: 5.3,    lng: -4.0    },
  Koumassi:    { lat: 5.2833, lng: -3.95   },
  Bingerville: { lat: 5.3667, lng: -3.9    },
  Riviera:     { lat: 5.37,   lng: -3.95   },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals = 1): number {
  const val = Math.random() * (max - min) + min
  return parseFloat(val.toFixed(decimals))
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomPrenom(): string { return randomItem(PRENOMS) }
function randomNom(): string    { return randomItem(NOMS) }

// Compteur global pour garantir l'unicité des phones dans un même run
let _phoneCounter = 0
function uniqueTestPhone(): string {
  _phoneCounter++
  // Format : +225 07 9TEST XXX (13 chiffres au total, numéro fictif ivoirien)
  const counter = String(_phoneCounter).padStart(4, '0')
  const rand    = String(randomInt(100, 999))
  return `+225079${counter}${rand}`
}

function uniqueTestEmail(prefix: string): string {
  const ts = Date.now() % 1000000
  return `${prefix}_${ts}_${_phoneCounter}@afrione-test.ci`
}

function addGpsJitter(coords: { lat: number; lng: number }): { lat: number; lng: number } {
  return {
    lat: coords.lat + (Math.random() - 0.5) * 0.02,
    lng: coords.lng + (Math.random() - 0.5) * 0.02,
  }
}

// ── Gestion de la colonne is_test_account ─────────────────────────────────────
// La colonne peut ne pas exister en BDD. On tente de l'ajouter via une fonction
// SQL (si le service role key a les droits), sinon on utilise uniquement le
// marqueur email @afrione-test.ci.

let hasTestAccountColumn = false

async function ensureTestAccountColumn(): Promise<void> {
  // Test rapide : est-ce que la colonne existe ?
  const { error: testErr } = await supabase
    .from('users')
    .select('is_test_account')
    .limit(1)

  if (!testErr) {
    hasTestAccountColumn = true
    console.log('  Colonne is_test_account : déjà présente dans users')
    return
  }

  if (!testErr.message.includes('does not exist') && testErr.code !== '42703') {
    console.warn(`  Avertissement colonne is_test_account: ${testErr.message}`)
    return
  }

  // Tenter d'ajouter la colonne via SQL raw (nécessite les droits DDL)
  try {
    const { error: ddlErr } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT FALSE;
        ALTER TABLE artisan_pros ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT FALSE;
      `
    })

    if (ddlErr) {
      console.log(`  Note: impossible d'ajouter is_test_account via RPC (${ddlErr.message.slice(0, 80)})`)
      console.log('  Marqueur de test = email *@afrione-test.ci uniquement')
    } else {
      hasTestAccountColumn = true
      console.log('  Colonne is_test_account ajoutée via RPC SQL')
    }
  } catch {
    console.log('  Marqueur de test = email *@afrione-test.ci uniquement (pas de colonne DDL)')
  }
}

function buildUserPayload(
  phone: string,
  name: string,
  email: string,
  role: string,
  quartier: string,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    phone,
    name,
    email,
    role,
    quartier,
    is_active: true,
  }
  if (hasTestAccountColumn) {
    base.is_test_account = true
  }
  return base
}

function buildArtisanPayload(
  userId: string,
  metier: string,
  label: string,
  yearsExp: number,
  quartier: string,
  quartiersCov: string[],
  gpsCoords: { lat: number; lng: number },
  tarifMin: number,
  isAvailable: boolean,
  ratingAvg: number | null,
  ratingCount: number,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    user_id:         userId,
    metier,
    bio:             `${label} expérimenté — ${yearsExp} ans d'expérience à Abidjan`,
    quartiers:       quartiersCov,
    zone_gps:        gpsCoords,
    tarif_min:       tarifMin,
    rayon_km:        randomInt(5, 25),
    is_available:    isAvailable,
    kyc_status:      'approved',
    rating_avg:      ratingAvg,
    rating_count:    ratingCount,
    years_experience: yearsExp,
    mission_count:   randomInt(0, 150),
    response_time_min: randomInt(15, 60),
    scoring_weight:  parseFloat((0.5 + Math.random() * 0.5).toFixed(2)),
  }
  if (hasTestAccountColumn) {
    base.is_test_account = true
  }
  return base
}

// ── Résultats ─────────────────────────────────────────────────────────────────

interface SeedIds {
  clients:  string[]
  artisans: Array<{ userId: string; proId: string; metier: string; quartier: string }>
  createdAt: string
}

const seedIds: SeedIds = {
  clients:  [],
  artisans: [],
  createdAt: new Date().toISOString(),
}

// ── Seed artisans ─────────────────────────────────────────────────────────────

async function seedArtisans(): Promise<void> {
  console.log('\n=== Insertion des 50 artisans ===\n')

  let artisanIndex = 0

  for (const { metier, label, category } of METIERS_CATEGORIES) {
    console.log(`\n-- Métier : ${label} (10 artisans) --`)

    for (let i = 0; i < 10; i++) {
      artisanIndex++
      const prenom  = randomPrenom()
      const nom     = randomNom()
      const quartier = randomItem(QUARTIERS)

      const phoneNum = uniqueTestPhone()
      const email    = uniqueTestEmail(`artisan_test_${artisanIndex}_${metier.toLowerCase().replace(/[éèêëî]/g, 'e').replace(/\s/g, '_')}`)

      const userPayload = buildUserPayload(
        phoneNum,
        `${prenom} ${nom}`,
        email,
        'artisan',
        quartier,
      )

      const { data: user, error: uErr } = await supabase
        .from('users')
        .upsert(userPayload, { onConflict: 'phone' })
        .select('id')
        .single()

      if (uErr || !user) {
        console.error(`  ERREUR user artisan ${artisanIndex} (${label}):`, uErr?.message)
        continue
      }

      // rating_avg : 2 artisans null (i=0 et i=9), le reste entre 3.0 et 4.9
      const ratingAvg    = (i === 0 || i === 9) ? null : randomFloat(3.0, 4.9)
      const ratingCount  = ratingAvg === null ? 0 : randomInt(1, 80)
      const isAvailable  = Math.random() < 0.80  // 80% disponible
      const tarifMin     = randomInt(5000, 50000)
      const yearsExp     = randomInt(1, 20)
      const gpsCoords    = addGpsJitter(GPS_COORDS[quartier] || GPS_COORDS['Cocody'])
      const quartiersCov = [quartier, randomItem(QUARTIERS)].filter((q, idx, arr) => arr.indexOf(q) === idx)

      // Vérifier si un profil artisan existe déjà pour cet user
      const { data: existing } = await supabase
        .from('artisan_pros')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      let proId: string | null = null

      if (existing) {
        const updatePayload: Record<string, unknown> = {
          metier,
          bio:              `${label} expérimenté — ${yearsExp} ans d'expérience à Abidjan`,
          kyc_status:       'approved',
          is_available:     isAvailable,
          tarif_min:        tarifMin,
          rating_avg:       ratingAvg,
          rating_count:     ratingCount,
          years_experience: yearsExp,
        }
        if (hasTestAccountColumn) updatePayload.is_test_account = true

        const { data: updated, error: pErr } = await supabase
          .from('artisan_pros')
          .update(updatePayload)
          .eq('id', existing.id)
          .select('id')
          .single()

        if (pErr || !updated) {
          console.error(`  ERREUR update artisan_pros ${artisanIndex}:`, pErr?.message)
          continue
        }
        proId = updated.id
      } else {
        const artisanPayload = buildArtisanPayload(
          user.id, metier, label, yearsExp, quartier, quartiersCov,
          gpsCoords, tarifMin, isAvailable, ratingAvg, ratingCount,
        )

        const { data: pro, error: pErr } = await supabase
          .from('artisan_pros')
          .insert(artisanPayload)
          .select('id')
          .single()

        if (pErr || !pro) {
          console.error(`  ERREUR insert artisan_pros ${artisanIndex}:`, pErr?.message)
          continue
        }
        proId = pro.id
      }

      seedIds.artisans.push({ userId: user.id, proId: proId!, metier, quartier })
      console.log(`  [OK] Artisan ${artisanIndex} — ${prenom} ${nom} — ${label} — ${quartier} — rating: ${ratingAvg ?? 'nouveau'} — dispo: ${isAvailable}`)
    }
  }
}

// ── Seed clients ──────────────────────────────────────────────────────────────

async function seedClients(): Promise<void> {
  console.log('\n=== Insertion des 50 clients ===\n')

  for (let i = 1; i <= 50; i++) {
    const prenom   = randomPrenom()
    const nom      = randomNom()
    const quartier = randomItem(QUARTIERS)
    const phoneNum = uniqueTestPhone()
    const email    = uniqueTestEmail(`client_test_${i}`)

    const userPayload = buildUserPayload(phoneNum, `${prenom} ${nom}`, email, 'client', quartier)

    const { data: user, error } = await supabase
      .from('users')
      .upsert(userPayload, { onConflict: 'phone' })
      .select('id')
      .single()

    if (error || !user) {
      console.error(`  ERREUR client ${i}:`, error?.message)
      continue
    }

    seedIds.clients.push(user.id)
    console.log(`  [OK] Client ${i} — ${prenom} ${nom} — ${quartier} — tel: ${phoneNum}`)
  }
}

// ── Sauvegarde des IDs ────────────────────────────────────────────────────────

async function saveIds(): Promise<void> {
  const outDir  = path.resolve(process.cwd(), 'test-results')
  const outFile = path.join(outDir, 'seed-ids.json')

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  fs.writeFileSync(outFile, JSON.stringify(seedIds, null, 2), 'utf-8')
  console.log(`\nIDs sauvegardés dans : ${outFile}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('========================================')
  console.log('   AfriOne — Seed données de test       ')
  console.log('========================================')
  console.log(`Supabase URL : ${SUPABASE_URL}`)
  console.log(`Marqueur     : email *${TEST_EMAIL_DOMAIN}`)
  console.log(`Timestamp    : ${new Date().toISOString()}\n`)

  // Vérifier/ajouter la colonne is_test_account
  console.log('Vérification de la colonne is_test_account...')
  await ensureTestAccountColumn()

  try {
    await seedArtisans()
    await seedClients()
    await saveIds()

    console.log('\n========================================')
    console.log('  RESUME                                 ')
    console.log(`  Artisans insérés : ${seedIds.artisans.length}`)
    console.log(`  Clients insérés  : ${seedIds.clients.length}`)
    console.log(`  Marqueur test    : ${hasTestAccountColumn ? 'is_test_account=true + email @afrione-test.ci' : 'email *@afrione-test.ci uniquement'}`)
    console.log('========================================')
    console.log('\nSeed terminé avec succès !')
  } catch (err) {
    console.error('\nERREUR CRITIQUE :', err)
    process.exit(1)
  }
}

main()
