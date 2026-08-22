#!/usr/bin/env node
/**
 * AfriOne — Transactions restées en escrow alors que leur mission est close
 *
 *   node scripts/qa-escrow-orphelins.mjs           → DRY-RUN (défaut)
 *   node scripts/qa-escrow-orphelins.mjs --apply   → régularisation
 *
 * `src/lib/escrow.ts` déplaçait de l'argent sans vérifier une seule de ses
 * écritures. Supabase ne lève pas d'exception : il renvoie l'erreur dans
 * l'objet retour. Un `update` de wallet qui échouait rendait la main comme si
 * tout allait bien, et l'appelant enchaînait sur « mission terminée ».
 *
 * Résultat en production le 2026-08-22 : 3 missions `completed` dont l'artisan
 * n'a jamais été payé (21 364 FCFA) et 1 `cancelled` jamais remboursée
 * (20 966 FCFA). Aucune trace, aucune alerte.
 *
 * La cause est corrigée (les deux fonctions renvoient un résultat explicite et
 * les appelants refusent de clore une mission dont l'argent n'a pas bougé).
 * Ce script traite les cas déjà produits.
 *
 * Règle appliquée, la même que le code :
 *   mission 'completed' → transaction 'released'  + créditer balance_available
 *   mission 'cancelled' → transaction 'refunded'  + décrémenter balance_escrow
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const APPLY = process.argv.includes('--apply')
const fcfa = n => (n || 0).toLocaleString('fr') + ' FCFA'

const { data: orphelines, error } = await db
  .from('transactions')
  .select('id, mission_id, amount, artisan_amount, status, missions(status, artisan_id)')
  .eq('status', 'escrow')

if (error) { console.error('✗', error.message); process.exit(1) }

const aTraiter = (orphelines ?? []).filter(
  t => t.missions && ['completed', 'cancelled'].includes(t.missions.status),
)

if (!aTraiter.length) {
  console.log('✓ Aucune transaction en escrow sur une mission close.')
  process.exit(0)
}

const total = aTraiter.reduce((s, t) => s + (t.amount || 0), 0)
console.log(`\n${aTraiter.length} transaction(s) bloquée(s) — ${fcfa(total)}\n`)

let ok = 0, ko = 0

for (const t of aTraiter) {
  const close     = t.missions.status
  const artisanId = t.missions.artisan_id
  const montant   = t.artisan_amount || 0
  const action    = close === 'completed' ? 'released' : 'refunded'

  console.log(`  ${t.mission_id.slice(0, 8)}  mission ${close.padEnd(9)} → transaction ${action}`)
  console.log(`            ${fcfa(t.amount)} (part artisan ${fcfa(montant)})`)

  if (!APPLY) continue

  if (!artisanId) {
    console.log('            ⚠️  aucun artisan attribué — transaction marquée, wallet non touché')
  } else {
    const { data: wallet, error: eLect } = await db
      .from('wallets').select('balance_escrow, balance_available, total_earned')
      .eq('artisan_id', artisanId).maybeSingle()

    if (eLect) { console.log(`            ✗ lecture wallet : ${eLect.message}`); ko++; continue }

    if (wallet) {
      const maj = close === 'completed'
        ? {
            balance_escrow:    Math.max(0, (wallet.balance_escrow || 0) - montant),
            balance_available: (wallet.balance_available || 0) + montant,
            total_earned:      (wallet.total_earned || 0) + montant,
          }
        : {
            balance_escrow:    Math.max(0, (wallet.balance_escrow || 0) - montant),
          }

      const { error: eW } = await db.from('wallets')
        .update({ ...maj, updated_at: new Date().toISOString() })
        .eq('artisan_id', artisanId)

      // Même règle que le code : on ne marque pas la transaction si le wallet
      // n'a pas bougé, sinon l'incohérence devient indétectable.
      if (eW) { console.log(`            ✗ écriture wallet : ${eW.message}`); ko++; continue }
      console.log(`            ✓ wallet ${close === 'completed' ? 'crédité' : 'escrow libéré'}`)
    } else {
      console.log(`            ⚠️  aucun wallet pour l'artisan — transaction marquée seule`)
    }
  }

  const { error: eT } = await db.from('transactions')
    .update({ status: action, released_at: new Date().toISOString() })
    .eq('id', t.id)

  if (eT) { console.log(`            ✗ statut transaction : ${eT.message}`); ko++; continue }
  console.log(`            ✓ transaction ${action}`)
  ok++
}

if (!APPLY) {
  console.log('\nDRY-RUN — aucune donnée modifiée.')
  console.log('Pour exécuter :  node scripts/qa-escrow-orphelins.mjs --apply\n')
  process.exit(0)
}

const { data: reste } = await db
  .from('transactions')
  .select('id, missions(status)')
  .eq('status', 'escrow')

const encore = (reste ?? []).filter(t => t.missions && ['completed', 'cancelled'].includes(t.missions.status))

console.log(`\n${ok} régularisée(s)${ko ? `, ${ko} en échec` : ''}`)
console.log(encore.length ? `✗ ${encore.length} encore bloquée(s)` : '✓ plus aucune transaction bloquée')
process.exit(ko || encore.length ? 1 : 0)
