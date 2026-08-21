#!/usr/bin/env node
/**
 * AfriOne — Libérer les artisans bloqués par une mission restée ouverte
 *
 *   node scripts/qa-liberer-artisans.mjs           → DRY-RUN (défaut)
 *   node scripts/qa-liberer-artisans.mjs --apply   → annulation + remboursement
 *
 * `idx_artisan_single_active_mission` (migrations/003_state_machine.sql) est un
 * UNIQUE partiel sur `missions.artisan_id` où status IN ('en_route','en_cours').
 * Un artisan qui traîne UNE seule mission active ne peut plus rien accepter —
 * quel que soit le mode. Avec deux comptes artisans en tout, deux missions de
 * test oubliées paralysent la totalité des tests, et l'erreur Postgres ne
 * remonte jamais jusqu'à l'écran : le bouton « Accepter » échoue en silence.
 *
 * Les outils existants ne couvrent pas ce cas :
 *   qa-purge.mjs              supprime des artisans, pas des missions
 *   cleanup-stuck-dispatch.mjs ne traite que 'dispatching', et saute
 *                             explicitement les missions déjà attribuées
 *
 * Le remboursement reproduit refundEscrow() (src/lib/escrow.ts) : décrémenter
 * balance_escrow du wallet artisan, marquer la transaction 'refunded'. Annuler
 * sans rembourser laisserait les wallets faussés — et les tests suivants
 * ininterprétables.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const APPLY = process.argv.includes('--apply')
const fcfa = n => (n || 0).toLocaleString('fr') + ' FCFA'

const { data: bloquantes, error } = await sb
  .from('missions')
  .select('id, status, created_at, artisan_id, artisan_pros(id, user_id, users(email))')
  .in('status', ['en_route', 'en_cours'])
  .order('created_at')

if (error) { console.error('✗', error.message); process.exit(1) }

if (!bloquantes?.length) {
  console.log('✓ Aucun artisan bloqué — tous peuvent accepter une mission.')
  process.exit(0)
}

console.log(`\n${bloquantes.length} mission(s) active(s) bloquant autant d'artisans\n`)

for (const m of bloquantes) {
  const email = m.artisan_pros?.users?.email ?? '(artisan inconnu)'
  const { data: tx } = await sb
    .from('transactions')
    .select('id, amount, artisan_amount, status')
    .eq('mission_id', m.id)
    .eq('status', 'escrow')
    .maybeSingle()

  console.log(`  ${m.id.slice(0, 8)}  ${m.status.padEnd(9)} ${m.created_at.slice(0, 10)}  ${email}`)
  if (tx) console.log(`            escrow à rembourser : ${fcfa(tx.amount)} (part artisan ${fcfa(tx.artisan_amount)})`)

  if (!APPLY) continue

  // 1. Rembourser l'escrow — même séquence que refundEscrow()
  if (tx && m.artisan_id) {
    const { data: wallet } = await sb
      .from('wallets').select('id, balance_escrow').eq('artisan_id', m.artisan_id).maybeSingle()
    if (wallet) {
      await sb.from('wallets').update({
        balance_escrow: Math.max(0, (wallet.balance_escrow || 0) - (tx.artisan_amount || 0)),
        updated_at:     new Date().toISOString(),
      }).eq('artisan_id', m.artisan_id)
    }
    await sb.from('transactions')
      .update({ status: 'refunded', released_at: new Date().toISOString() })
      .eq('id', tx.id)
    console.log('            ✓ escrow remboursé')
  }

  // 2. Annuler la mission. Le service_role passe les triggers de rôle
  //    (auth.uid() vaut NULL), la machine à états 006 autorise → cancelled.
  const { error: eUpd } = await sb.from('missions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', m.id)
  if (eUpd) { console.log(`            ✗ annulation refusée : ${eUpd.message}`); continue }

  await sb.from('chat_history').insert({
    mission_id:  m.id,
    sender_id:   m.artisan_pros?.user_id ?? null,
    sender_role: 'system',
    text:        '❌ Mission close par le nettoyage QA — artisan libéré pour les tests.',
    type:        'system',
  })
  console.log('            ✓ mission annulée')
}

if (!APPLY) {
  console.log('\nDRY-RUN — aucune donnée modifiée.')
  console.log('Pour exécuter :  node scripts/qa-liberer-artisans.mjs --apply\n')
  process.exit(0)
}

// Vérification : plus personne ne doit être bloqué.
const { data: reste } = await sb
  .from('missions').select('id').in('status', ['en_route', 'en_cours'])

console.log(
  reste?.length
    ? `\n✗ ${reste.length} mission(s) encore active(s) — vérifier manuellement.`
    : '\n✓ Tous les artisans sont libres.',
)
process.exit(reste?.length ? 1 : 0)
