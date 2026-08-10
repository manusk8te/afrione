/**
 * AfriOne — Purge de remise à zéro
 *
 *   node scripts/qa-purge.mjs              → DRY-RUN (lecture seule, défaut)
 *   node scripts/qa-purge.mjs --apply      → suppression réelle (sauvegarde d'abord)
 *
 * Règle : on garde 5 comptes humains ET tout leur historique.
 * Tout le reste (comptes de test + leurs données) est supprimé.
 *
 * Une mission est CONSERVÉE si son client fait partie des comptes gardés.
 * Si son artisan est supprimé, artisan_id passe à NULL (état valide).
 * Une mission dont le client est supprimé est supprimée, même si l'artisan
 * est gardé : une mission sans client n'a pas de sens.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: '.env.local' })

const APPLY = process.argv.includes('--apply')

const KEEP_EMAILS = [
  'goblyemmanuel95@gmail.com',
  'goblyemmanuel94@gmail.com',
  'peniellanvia10@gmail.com',
  'noussi236@gmail.com',
  'peniellanviavisa1@gmail.com',
]

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('ERREUR : credentials Supabase manquants'); process.exit(1) }

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const log = (...a) => console.log(...a)
const chunk = (arr, n = 200) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// ───────────────────────────────────────────────────────────── 1. Périmètre

log(`\n${'='.repeat(70)}`)
log(APPLY ? '  MODE : APPLY — SUPPRESSION RÉELLE' : '  MODE : DRY-RUN — aucune écriture')
log(`  Projet : ${URL.replace(/^https:\/\//, '').split('.')[0]}`)
log(`${'='.repeat(70)}\n`)

const { data: allUsers, error: uErr } = await db.from('users').select('id, email, role, name')
if (uErr) { console.error('ERREUR lecture users :', uErr.message); process.exit(1) }

const keepUsers = allUsers.filter(u => KEEP_EMAILS.includes((u.email || '').toLowerCase()))
const delUsers  = allUsers.filter(u => !KEEP_EMAILS.includes((u.email || '').toLowerCase()))
const KEEP_UIDS = new Set(keepUsers.map(u => u.id))
const DEL_UIDS  = delUsers.map(u => u.id)

// Garde-fou : si un email attendu est introuvable, on s'arrête. Mieux vaut
// échouer que supprimer un compte qu'on croyait garder.
const missing = KEEP_EMAILS.filter(e => !keepUsers.some(u => (u.email || '').toLowerCase() === e))
if (missing.length) {
  console.error('ARRÊT — comptes à garder introuvables en base :', missing.join(', '))
  process.exit(1)
}

log(`Comptes gardés    : ${keepUsers.length}`)
for (const u of keepUsers) log(`   ✓ ${u.email.padEnd(34)} ${u.role}`)
log(`Comptes supprimés : ${delUsers.length}`)

const { data: allPros } = await db.from('artisan_pros').select('id, user_id, metier')
const keepPros = allPros.filter(p => KEEP_UIDS.has(p.user_id))
const delPros  = allPros.filter(p => !KEEP_UIDS.has(p.user_id))
const DEL_PIDS = delPros.map(p => p.id)
log(`\nProfils artisan   : ${keepPros.length} gardés / ${delPros.length} supprimés`)

const { data: allMissions } = await db.from('missions').select('id, client_id, artisan_id, status')
const keepMissions = allMissions.filter(m => KEEP_UIDS.has(m.client_id))
const delMissions  = allMissions.filter(m => !KEEP_UIDS.has(m.client_id))
const DEL_MIDS = delMissions.map(m => m.id)

// Missions gardées dont l'artisan disparaît → artisan_id = NULL
const orphanArtisan = keepMissions.filter(m => m.artisan_id && DEL_PIDS.includes(m.artisan_id))

log(`\nMissions          : ${keepMissions.length} gardées / ${delMissions.length} supprimées`)
log(`   dont ${orphanArtisan.length} mission(s) gardée(s) perdront leur artisan (artisan_id → NULL)`)

// ───────────────────────────────────────────────── 2. Dépendances à traiter

const countIn = async (table, col, ids) => {
  if (!ids.length) return 0
  let total = 0
  for (const c of chunk(ids)) {
    const { count } = await db.from(table).select('*', { count: 'exact', head: true }).in(col, c)
    total += count || 0
  }
  return total
}

log(`\n${'─'.repeat(70)}\nDONNÉES RATTACHÉES AUX MISSIONS SUPPRIMÉES\n${'─'.repeat(70)}`)
const missionChildren = [
  ['transactions',    'mission_id', 'BLOQUANT — pas de cascade'],
  ['sentiment_logs',  'mission_id', 'BLOQUANT — pas de cascade'],
  ['pricing_alerts',  'mission_id', 'BLOQUANT — pas de cascade'],
  ['cas_c_reports',   'mission_id', 'BLOQUANT — pas de cascade'],
  ['chat_history',    'mission_id', 'cascade auto'],
  ['diagnostics',     'mission_id', 'cascade auto'],
  ['quotations',      'mission_id', 'cascade auto'],
  ['dispatch_attempts','mission_id','cascade auto'],
  ['gps_tracking',    'mission_id', 'cascade auto'],
  ['proof_of_work',   'mission_id', 'cascade auto'],
]
for (const [t, col, note] of missionChildren) {
  const n = await countIn(t, col, DEL_MIDS)
  log(`  ${t.padEnd(20)} ${String(n).padStart(5)}   ${note}`)
}

log(`\n${'─'.repeat(70)}\nRÉFÉRENCES À NEUTRALISER SUR LES DONNÉES GARDÉES\n${'─'.repeat(70)}`)
// chat_history.sender_id n'a pas de cascade : un message gardé écrit par un
// compte supprimé empêcherait la suppression du compte.
const KEEP_MIDS = keepMissions.map(m => m.id)
let orphanMsgs = 0
for (const c of chunk(KEEP_MIDS)) {
  const { data } = await db.from('chat_history').select('id, sender_id').in('mission_id', c)
  orphanMsgs += (data || []).filter(m => m.sender_id && !KEEP_UIDS.has(m.sender_id)).length
}
log(`  chat_history.sender_id → NULL           ${String(orphanMsgs).padStart(5)} message(s)`)
log(`  missions.artisan_id    → NULL           ${String(orphanArtisan.length).padStart(5)} mission(s)`)

const { data: kyc } = await db.from('kyc_security').select('id, reviewed_by')
const kycToNull = (kyc || []).filter(k => k.reviewed_by && !KEEP_UIDS.has(k.reviewed_by))
log(`  kyc_security.reviewed_by → NULL         ${String(kycToNull.length).padStart(5)} ligne(s)`)

const { data: ents } = await db.from('entreprises').select('id, name, owner_id')
const entOrphan = (ents || []).filter(e => e.owner_id && !KEEP_UIDS.has(e.owner_id))
log(`  entreprises orphelines                  ${String(entOrphan.length).padStart(5)} (supprimées)`)
for (const e of entOrphan) log(`      · ${e.name}`)

const { data: related } = await db.from('missions').select('id, related_mission_id').not('related_mission_id', 'is', null)
const relToNull = (related || []).filter(m => DEL_MIDS.includes(m.related_mission_id))
log(`  missions.related_mission_id → NULL      ${String(relToNull.length).padStart(5)} ligne(s)`)

log(`\n${'─'.repeat(70)}\nDONNÉES RATTACHÉES AUX ARTISANS SUPPRIMÉS\n${'─'.repeat(70)}`)
for (const [t, col] of [['gps_tracking','artisan_id'], ['sentiment_logs','artisan_id'],
                        ['dispatch_attempts','artisan_id'], ['cas_c_reports','artisan_id'],
                        ['wallets','artisan_id'], ['kyc_security','artisan_id']]) {
  log(`  ${t.padEnd(20)} ${String(await countIn(t, col, DEL_PIDS)).padStart(5)}`)
}

if (!APPLY) {
  log(`\n${'='.repeat(70)}`)
  log('  DRY-RUN terminé — AUCUNE donnée modifiée.')
  log('  Pour exécuter réellement :  node scripts/qa-purge.mjs --apply')
  log(`${'='.repeat(70)}\n`)
  process.exit(0)
}

// ───────────────────────────────────────────────────────── 3. SAUVEGARDE

const stamp   = new Date().toISOString().replace(/[:.]/g, '-')
const backup  = path.resolve(`backups/purge-${stamp}`)
fs.mkdirSync(backup, { recursive: true })

log(`\n${'─'.repeat(70)}\nSAUVEGARDE → ${backup}\n${'─'.repeat(70)}`)
const ALL_TABLES = [
  'users','artisan_pros','entreprises','entreprise_requests','missions','diagnostics',
  'quotations','chat_history','dispatch_attempts','transactions','wallets','gps_tracking',
  'proof_of_work','sentiment_logs','kyc_security','cas_c_reports','pricing_alerts',
  'push_subscriptions',
]
for (const t of ALL_TABLES) {
  const { data, error } = await db.from(t).select('*')
  if (error) { log(`  ${t.padEnd(22)} ignorée (${error.message})`); continue }
  fs.writeFileSync(path.join(backup, `${t}.json`), JSON.stringify(data, null, 2))
  log(`  ${t.padEnd(22)} ${String(data.length).padStart(5)} lignes`)
}

// ───────────────────────────────────────── 4. NEUTRALISER LES RÉFÉRENCES

log(`\n${'─'.repeat(70)}\nNEUTRALISATION\n${'─'.repeat(70)}`)
const run = async (label, fn) => {
  const { error, count } = await fn()
  if (error) { console.error(`  ✗ ${label} — ${error.message}`); process.exit(1) }
  log(`  ✓ ${label}${count != null ? ` (${count})` : ''}`)
}

for (const c of chunk(relToNull.map(m => m.id))) {
  await run('missions.related_mission_id → NULL', () =>
    db.from('missions').update({ related_mission_id: null }).in('id', c))
}
for (const c of chunk(orphanArtisan.map(m => m.id))) {
  await run('missions.artisan_id → NULL', () =>
    db.from('missions').update({ artisan_id: null }).in('id', c))
}
for (const c of chunk(kycToNull.map(k => k.id))) {
  await run('kyc_security.reviewed_by → NULL', () =>
    db.from('kyc_security').update({ reviewed_by: null }).in('id', c))
}
for (const c of chunk(KEEP_MIDS)) {
  const { data } = await db.from('chat_history').select('id, sender_id').in('mission_id', c)
  const ids = (data || []).filter(m => m.sender_id && !KEEP_UIDS.has(m.sender_id)).map(m => m.id)
  for (const cc of chunk(ids)) {
    await run('chat_history.sender_id → NULL', () =>
      db.from('chat_history').update({ sender_id: null }).in('id', cc))
  }
}

// ────────────────────────────────────────────────────── 5. SUPPRESSIONS

log(`\n${'─'.repeat(70)}\nSUPPRESSION\n${'─'.repeat(70)}`)

// 5a. Enfants bloquants des missions supprimées
for (const t of ['pricing_alerts','cas_c_reports','sentiment_logs','transactions']) {
  for (const c of chunk(DEL_MIDS)) {
    await run(`${t} (missions supprimées)`, () => db.from(t).delete().in('mission_id', c))
  }
}

// 5b. Missions supprimées → cascade sur diagnostics/quotations/chat_history/
//     dispatch_attempts/gps_tracking/proof_of_work
for (const c of chunk(DEL_MIDS)) {
  await run('missions', () => db.from('missions').delete().in('id', c))
}

// 5c. Références résiduelles vers les artisans supprimés (missions gardées)
for (const t of ['gps_tracking','sentiment_logs','dispatch_attempts','cas_c_reports']) {
  for (const c of chunk(DEL_PIDS)) {
    await run(`${t} (artisans supprimés)`, () => db.from(t).delete().in('artisan_id', c))
  }
}

// 5d. Entreprises orphelines (cascade sur entreprise_requests)
for (const e of entOrphan) {
  await run(`entreprise « ${e.name} »`, () => db.from('entreprises').delete().eq('id', e.id))
}

// 5e. artisan_pros → cascade wallets, kyc_security, entreprise_requests
for (const c of chunk(DEL_PIDS)) {
  await run('artisan_pros', () => db.from('artisan_pros').delete().in('id', c))
}

// 5f. push_subscriptions — database/push_subscriptions.sql déclare
//     ON DELETE CASCADE, mais la table en base ne l'a pas : la suppression des
//     users échoue sur push_subscriptions_user_id_fkey. On supprime donc
//     explicitement plutôt que de compter sur une cascade absente.
for (const c of chunk(DEL_UIDS)) {
  await run('push_subscriptions', () => db.from('push_subscriptions').delete().in('user_id', c))
}

// 5g. users → cascade artisan_pros restants
for (const c of chunk(DEL_UIDS)) {
  await run('users', () => db.from('users').delete().in('id', c))
}

// 5g. auth.users — sans ça les comptes restent connectables
log(`\n${'─'.repeat(70)}\nSUPPRESSION AUTH (auth.users)\n${'─'.repeat(70)}`)
let authOk = 0, authFail = 0
for (const id of DEL_UIDS) {
  const { error } = await db.auth.admin.deleteUser(id)
  if (error) { authFail++; if (authFail <= 5) log(`  ✗ ${id} — ${error.message}`) }
  else authOk++
}
log(`  ${authOk} supprimés / ${authFail} en échec`)

// ───────────────────────────────────────────────────────── 6. VÉRIFICATION

log(`\n${'─'.repeat(70)}\nÉTAT FINAL\n${'─'.repeat(70)}`)
for (const t of ALL_TABLES) {
  const { count, error } = await db.from(t).select('*', { count: 'exact', head: true })
  if (!error) log(`  ${t.padEnd(22)} ${String(count).padStart(5)}`)
}
const { data: rest } = await db.from('users').select('email, role').order('email')
log('\nComptes restants :')
for (const u of rest || []) log(`  ${u.email?.padEnd(34)} ${u.role}`)
log(`\nSauvegarde : ${backup}\n`)
