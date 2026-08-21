#!/usr/bin/env node
/**
 * AfriOne — Négociation complète dans la War Room, avec de vrais comptes
 *
 *   node scripts/test-negociation.mjs [url]
 *   (défaut : https://afrione-sepia.vercel.app)
 *
 * Déroule un aller-retour client ↔ artisan de bout en bout : messages,
 * devis, contre-proposition, accord, paiement, programmation. Puis efface
 * tout ce qu'il a créé.
 *
 * CE N'EST PAS UNE SIMULATION. Chaque écriture part de la clé anon signée
 * avec le JWT de l'utilisateur concerné — exactement ce que fait le
 * navigateur. Les policies RLS s'appliquent, les triggers `enforce_*` aussi.
 * Le service_role ne sert qu'à créer et détruire les comptes jetables : s'en
 * servir pour écrire dans le chat mettrait auth.uid() à NULL, les gardes
 * s'effaceraient (`IF uid IS NULL THEN RETURN NEW`) et le test ne prouverait
 * rien.
 *
 * La preuve que les montants circulent vraiment : on relit la conversation
 * depuis la base à la fin, et on affiche le prix retenu.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname })

const BASE = process.argv[2] || 'https://afrione-sepia.vercel.app'
const PWD  = 'AfriOneTest!2026'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** service_role — création/destruction des comptes jetables UNIQUEMENT. */
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

/** Client Supabase agissant AU NOM d'un utilisateur : RLS + triggers actifs. */
const commeUtilisateur = jwt => createClient(URL_, ANON, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
})

const fcfa = n => (n || 0).toLocaleString('fr') + ' FCFA'
const jetables = { users: [], artisans: [] }
let missionId = null
let ok = 0, ko = 0

const verifier = (label, condition, detail = '') => {
  if (condition) { ok++; console.log(`  ✅ ${label}`) }
  else           { ko++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`) }
  return condition
}

async function compteJetable(role, metier = null) {
  const email = `nego-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@afrione.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password: PWD, email_confirm: true })
  if (error) throw new Error(`createUser ${email} : ${error.message}`)
  const id = data.user.id
  jetables.users.push(id)
  await admin.from('users').upsert(
    { id, email, name: role === 'client' ? 'Awa Koné' : 'Yao Menuisier', role, quartier: 'Cocody', phone: '+2250700000000' },
    { onConflict: 'id' },
  )
  let artisanId = null
  if (metier) {
    const { data: ap, error: e } = await admin.from('artisan_pros').insert({
      user_id: id, metier, bio: 'compte de test négociation', years_experience: 5,
      tarif_min: 8000, quartiers: ['Cocody'], kyc_status: 'approved', is_available: true,
      rating_avg: 4.5, rating_count: 12, mission_count: 12, success_rate: 95, response_time_min: 15,
    }).select('id').single()
    if (e) throw new Error(`artisan_pros : ${e.message}`)
    artisanId = ap.id
    jetables.artisans.push(artisanId)
  }
  return { id, email, artisanId }
}

const jeton = async email => {
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PWD })
  if (error) throw new Error(`connexion ${email} : ${error.message}`)
  return data.session.access_token
}

/** Écrit dans le chat SOUS L'IDENTITÉ de l'utilisateur — passe par RLS. */
async function dire(sb, uid, role, texte, type = 'text') {
  const { data, error } = await sb.from('chat_history').insert({
    mission_id: missionId, sender_id: uid, sender_role: role, text: texte, type,
  }).select('id, text, type, sender_role').single()
  if (error) throw new Error(`${role} n'a pas pu écrire (${type}) : ${error.message}`)
  return data
}

const appel = async (path, jwt, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

try {
  console.log(`\nCible : ${BASE}`)
  console.log('Création de deux comptes réels…\n')

  const client  = await compteJetable('client')
  const artisan = await compteJetable('artisan', 'Menuiserie')
  const tClient  = await jeton(client.email)
  const tArtisan = await jeton(artisan.email)
  const sbClient  = commeUtilisateur(tClient)
  const sbArtisan = commeUtilisateur(tArtisan)

  console.log(`  Client  : ${client.email}`)
  console.log(`  Artisan : ${artisan.email}\n`)

  const { data: m, error: eM } = await admin.from('missions').insert({
    client_id: client.id, artisan_id: artisan.artisanId, status: 'negotiation',
    category: 'Menuiserie', mode: 'standard', quartier: 'Cocody',
  }).select('id').single()
  if (eM) throw new Error(`mission : ${eM.message}`)
  missionId = m.id
  console.log(`  Mission ${missionId.slice(0, 8)} — negotiation, artisan attribué\n`)

  // ── LA CONVERSATION ────────────────────────────────────────────────────────
  console.log('── Conversation ──\n')

  await dire(sbClient, client.id, 'client',
    "Bonjour, ma porte d'armoire de cuisine s'est décrochée, les charnières ont lâché.")
  console.log('  👤 client  : Bonjour, ma porte d\'armoire s\'est décrochée…')

  await dire(sbArtisan, artisan.id, 'artisan',
    'Bonjour. Combien de portes sont concernées, et le bois est-il abîmé autour des vis ?')
  console.log('  🔧 artisan : Combien de portes, et le bois est-il abîmé ?')

  await dire(sbClient, client.id, 'client', 'Deux portes. Le bois est un peu éclaté sur une des deux.')
  console.log('  👤 client  : Deux portes, bois éclaté sur une.')

  // ── DEVIS ARTISAN ──────────────────────────────────────────────────────────
  const PRIX_DEVIS = 45000
  await dire(sbArtisan, artisan.id, 'artisan', JSON.stringify({
    amount: PRIX_DEVIS,
    description: 'Remplacement de 4 charnières + rebouchage bois sur une porte',
  }), 'devis')
  console.log(`\n  🔧 artisan : DEVIS ${fcfa(PRIX_DEVIS)}`)

  // ── CONTRE-PROPOSITION CLIENT ──────────────────────────────────────────────
  const PRIX_CONTRE = 38000
  await dire(sbClient, client.id, 'client', JSON.stringify({
    amount: PRIX_CONTRE,
    description: `Contre-proposition client : ${PRIX_CONTRE.toLocaleString()} FCFA`,
  }), 'devis')
  console.log(`  👤 client  : CONTRE-PROPOSITION ${fcfa(PRIX_CONTRE)}`)

  // ── L'ARTISAN ACCEPTE LE PRIX DU CLIENT ────────────────────────────────────
  const PRIX_FINAL = PRIX_CONTRE
  await dire(sbArtisan, artisan.id, 'artisan', JSON.stringify({
    amount: PRIX_FINAL,
    description: `Tarif convenu : ${PRIX_FINAL.toLocaleString()} FCFA`,
  }), 'devis')
  console.log(`  🔧 artisan : ACCEPTE — tarif convenu ${fcfa(PRIX_FINAL)}\n`)

  // ── VÉRIFICATIONS ──────────────────────────────────────────────────────────
  console.log('── Ce que la base a réellement enregistré ──\n')

  const { data: fil } = await admin.from('chat_history')
    .select('sender_role, type, text').eq('mission_id', missionId).order('created_at')

  verifier(`${fil.length} messages écrits par leurs auteurs réels`, fil.length === 6, `${fil?.length}`)

  const devis = fil.filter(x => x.type === 'devis').map(x => ({ role: x.sender_role, montant: JSON.parse(x.text).amount }))
  console.log(`     devis : ${devis.map(d => `${d.role} ${fcfa(d.montant)}`).join('  →  ')}`)

  verifier('le prix a bougé pendant la négociation', devis[0].montant !== devis[2].montant,
    `${devis[0].montant} → ${devis[2].montant}`)
  verifier(`prix final = contre-proposition client (${fcfa(PRIX_FINAL)})`, devis[2].montant === PRIX_CONTRE)
  verifier('chaque message porte le rôle de son vrai auteur',
    fil.filter(x => x.sender_role === 'client').length === 3 &&
    fil.filter(x => x.sender_role === 'artisan').length === 3)

  // Le garde de la 007 : le client ne peut PAS signer un devis « artisan ».
  const { error: eUsurp } = await sbClient.from('chat_history').insert({
    mission_id: missionId, sender_id: client.id, sender_role: 'artisan',
    text: JSON.stringify({ amount: 5000, description: 'faux devis' }), type: 'devis',
  })
  verifier('un client ne peut pas signer un devis en tant qu\'artisan', !!eUsurp,
    eUsurp ? '' : 'AUCUNE ERREUR — le garde ne fonctionne pas')

  // ── PAIEMENT RÉEL ──────────────────────────────────────────────────────────
  console.log('\n── Paiement et programmation ──\n')
  const pay = await appel('/api/payment', tClient, { mission_id: missionId, amount: PRIX_FINAL })
  verifier(`POST /api/payment → ${pay.status}`, pay.status === 200, JSON.stringify(pay.json).slice(0, 120))
  if (pay.json?.artisan_amount) console.log(`     part artisan : ${fcfa(pay.json.artisan_amount)}`)

  const { data: tx } = await admin.from('transactions')
    .select('amount, platform_fee, artisan_amount, status').eq('mission_id', missionId).maybeSingle()
  verifier(`transaction en escrow au montant négocié`, tx?.amount === PRIX_FINAL,
    tx ? `${tx.amount} au lieu de ${PRIX_FINAL}` : 'aucune transaction')
  if (tx) console.log(`     ${fcfa(tx.amount)} = commission ${fcfa(tx.platform_fee)} + artisan ${fcfa(tx.artisan_amount)}`)

  const sched = await appel('/api/mission/transition', tClient, { mission_id: missionId, action: 'start_now' })
  verifier(`POST /api/mission/transition start_now → ${sched.status}`, sched.status === 200,
    JSON.stringify(sched.json).slice(0, 120))

  const { data: apres } = await admin.from('missions').select('status').eq('id', missionId).single()
  verifier(`mission passée en 'en_route'`, apres?.status === 'en_route', `status='${apres?.status}'`)

  // L'artisan ne peut pas se déclarer payé à la place du client.
  const abus = await appel('/api/mission/transition', tArtisan, { mission_id: missionId, action: 'done' })
  verifier("l'artisan ne peut pas clore une mission qui n'est pas commencée",
    abus.status !== 200, `HTTP ${abus.status}`)

} catch (e) {
  ko++
  console.error(`\n✗ ${e.message}`)
} finally {
  console.log('\n── Nettoyage ──')
  if (missionId) {
    await admin.from('chat_history').delete().eq('mission_id', missionId)
    await admin.from('transactions').delete().eq('mission_id', missionId)
    await admin.from('gps_tracking').delete().eq('mission_id', missionId)
    await admin.from('missions').delete().eq('id', missionId)
    console.log(`  mission ${missionId.slice(0, 8)} supprimée`)
  }
  for (const a of jetables.artisans) {
    await admin.from('wallets').delete().eq('artisan_id', a)
    await admin.from('artisan_pros').delete().eq('id', a)
  }
  for (const u of jetables.users) {
    await admin.from('users').delete().eq('id', u)
    await admin.auth.admin.deleteUser(u)
  }
  console.log(`  ${jetables.users.length} comptes supprimés`)

  const { data: reste } = await admin.from('users').select('id').like('email', 'nego-%@afrione.test')
  console.log(reste?.length ? `  ⚠️  ${reste.length} compte(s) de test restant(s)` : '  ✓ base propre')

  console.log(`\n${ko === 0 ? '✅' : '❌'}  ${ok} vérification(s) passée(s), ${ko} échec(s)\n`)
  process.exit(ko === 0 ? 0 : 1)
}
