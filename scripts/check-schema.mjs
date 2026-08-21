#!/usr/bin/env node
/**
 * Vérifie que toute table interrogée par le code existe réellement en base.
 *
 *   node scripts/check-schema.mjs      (sortie 1 si une table manque)
 *
 * Supabase ne lève pas d'exception quand on écrit dans une table absente : il
 * renvoie une erreur dans l'objet retour. Un appel en `.catch(() => {})` ou
 * dont on ne lit pas `error` échoue donc sans laisser de trace.
 *
 * Constaté le 2026-08-21, six tables interrogées et inexistantes :
 *
 *   accepted_prices      /api/accepted-price écrivait dedans depuis le début.
 *                        Tous les prix acceptés sont partis à la poubelle.
 *   pricing_reference    resolveHourlyRate l'interroge en priorité 2 et 3,
 *                        avant le repli labor_rates. Absente, l'agent est
 *                        TOUJOURS tombé sur le repli : la logique « données
 *                        terrain » n'a jamais servi.
 *   agent_runs           pricing-agent y journalise chaque exécution. Zéro
 *                        observabilité sur le moteur de prix.
 *   entreprise_requests  deux tableaux de bord la lisent.
 *   pricing_test_cases   \_ non-régression du moteur de prix.
 *   shadow_test_results  /
 *
 * Le point commun : aucune ne produisait d'erreur visible.
 *
 * `avatars` et `portfolio` sont exclues — ce sont des buckets de stockage
 * (`supabase.storage.from(...)`), pas des tables.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { runSql } from './sql.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const BUCKETS = new Set(['avatars', 'portfolio'])

/** Toutes les tables citées dans un `.from('…')` du code applicatif. */
function tablesCitees() {
  const trouvees = new Set()
  const parcourir = dir => {
    for (const entree of readdirSync(dir)) {
      if (entree === 'node_modules' || entree === '.next') continue
      const p = join(dir, entree)
      if (statSync(p).isDirectory()) { parcourir(p); continue }
      if (!/\.tsx?$/.test(p)) continue
      for (const m of readFileSync(p, 'utf8').matchAll(/\.from\('([a-z_]+)'\)/g)) {
        if (!BUCKETS.has(m[1])) trouvees.add(m[1])
      }
    }
  }
  parcourir(join(ROOT, 'src'))
  return [...trouvees].sort()
}

const citees = tablesCitees()

const existantes = new Set(
  (await runSql(`select table_name from information_schema.tables where table_schema = 'public'`))
    .map(r => r.table_name),
)

const manquantes = citees.filter(t => !existantes.has(t))

console.log(`Tables interrogées par le code : ${citees.length} · présentes en base : ${existantes.size}`)

if (manquantes.length) {
  console.log(`\n✗ ${manquantes.length} table(s) interrogée(s) mais inexistante(s) :`)
  for (const t of manquantes) {
    const ou = []
    const parcourir = dir => {
      for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e === '.next') continue
        const p = join(dir, e)
        if (statSync(p).isDirectory()) { parcourir(p); continue }
        if (/\.tsx?$/.test(p) && readFileSync(p, 'utf8').includes(`.from('${t}')`)) {
          ou.push(p.replace(ROOT, ''))
        }
      }
    }
    parcourir(join(ROOT, 'src'))
    console.log(`    ${t}`)
    for (const f of ou) console.log(`      ${f}`)
  }
  console.log('\n  → écrire la migration, ou retirer le code qui interroge la table.')
  console.log('  Ces écritures échouent SANS erreur visible : rien ne signalera le problème.')
  process.exit(1)
}

console.log('\n✓ Toute table interrogée par le code existe en base.')
