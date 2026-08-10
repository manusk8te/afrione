/**
 * AfriOne — Inventaire des comptes exploitables pour les tests
 *
 *   node scripts/qa-inventory.mjs
 *
 * Lecture seule. Répond à une seule question : avec les comptes actuellement
 * en base, quels modes peut-on réellement dérouler ?
 *
 * Le mode urgent broadcaste aux artisans qui passent TROIS filtres simultanés
 * (findAllCandidates, src/lib/dispatch.ts) : kyc_status='approved',
 * is_available=true, et métier normalisé égal à celui de la mission. Un artisan
 * qui rate un seul des trois ne reçoit jamais l'offre — d'où l'affichage
 * séparé ci-dessous plutôt qu'un simple total.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// Même normalisation que src/lib/metier.ts — le métier est stocké selon deux
// conventions historiques ("Plomberie" vs "Plombier").
const CANON = {
  plomberie: 'Plomberie', plombier: 'Plomberie',
  electricite: 'Électricité', électricité: 'Électricité', electricien: 'Électricité', électricien: 'Électricité',
  peinture: 'Peinture', peintre: 'Peinture',
  maconnerie: 'Maçonnerie', maçonnerie: 'Maçonnerie', macon: 'Maçonnerie', maçon: 'Maçonnerie',
  menuiserie: 'Menuiserie', menuisier: 'Menuiserie',
  climatisation: 'Climatisation', climaticien: 'Climatisation',
  serrurerie: 'Serrurerie', serrurier: 'Serrurerie',
  carrelage: 'Carrelage', carreleur: 'Carrelage',
}
const norm = m => CANON[(m || '').toLowerCase().trim()] || m || '(vide)'

const { data: users }    = await db.from('users').select('id, email, role, quartier')
const { data: artisans } = await db
  .from('artisan_pros')
  .select('id, user_id, metier, kyc_status, is_available, rating_avg, mission_count')

const byUser = new Map((users ?? []).map(u => [u.id, u]))

console.log(`\n═══ COMPTES (${users?.length ?? 0}) ═══\n`)
for (const u of users ?? []) {
  const pro = (artisans ?? []).find(a => a.user_id === u.id)
  const tag = pro ? `artisan ${norm(pro.metier)}` : (u.role || 'client')
  console.log(`  ${u.email.padEnd(34)} ${tag}${u.quartier ? ` · ${u.quartier}` : ''}`)
}

console.log(`\n═══ ARTISANS — éligibilité au broadcast urgent (${artisans?.length ?? 0}) ═══\n`)

const ready = []
for (const a of artisans ?? []) {
  const email    = byUser.get(a.user_id)?.email ?? '(user_id orphelin)'
  const kycOk    = a.kyc_status === 'approved'
  const dispoOk  = a.is_available === true
  const eligible = kycOk && dispoOk
  if (eligible) ready.push({ ...a, email })

  const blocages = [
    kycOk   ? null : `kyc='${a.kyc_status ?? 'null'}'`,
    dispoOk ? null : `is_available=${a.is_available}`,
  ].filter(Boolean)

  console.log(
    `  ${eligible ? '✅' : '❌'} ${email.padEnd(34)} ${norm(a.metier).padEnd(14)}` +
    (blocages.length ? ` ← ${blocages.join(', ')}` : ''),
  )
}

console.log('\n═══ MÉTIERS COUVERTS ═══\n')
if (!ready.length) {
  console.log('  ⚠️  AUCUN artisan éligible : toute mission urgente sera annulée')
  console.log('     immédiatement (no_candidates) et remboursée.\n')
} else {
  const parMetier = ready.reduce((acc, a) => {
    (acc[norm(a.metier)] ??= []).push(a.email)
    return acc
  }, {})
  for (const [metier, emails] of Object.entries(parMetier)) {
    console.log(`  ${metier.padEnd(14)} ${emails.length} artisan(s) — ${emails.join(', ')}`)
  }
  console.log(
    '\n  Une mission urgente dans un métier absent de cette liste part quand même :',
  )
  console.log(
    '  le fallback de findAllCandidates diffuse alors à TOUS les artisans dispos,',
  )
  console.log('  quel que soit leur corps de métier (bug C-06, connu, non corrigé).\n')
}

// Missions urgentes déjà en base — pour repérer celles restées coincées
const { data: urgentes } = await db
  .from('missions')
  .select('id, status, category, created_at, artisan_id')
  .eq('mode', 'urgent')
  .order('created_at', { ascending: false })
  .limit(10)

if (urgentes?.length) {
  console.log(`═══ 10 DERNIÈRES MISSIONS URGENTES ═══\n`)
  for (const m of urgentes) {
    const date = new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
    console.log(
      `  ${date}  ${(m.category || '?').padEnd(14)} ${m.status.padEnd(20)}` +
      `${m.artisan_id ? ' (attribuée)' : ''}`,
    )
  }
  console.log()
}
