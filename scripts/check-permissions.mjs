#!/usr/bin/env node
/**
 * Vérifie que la matrice de permissions et l'interface ne divergent pas.
 *
 * Deux dérives ont coûté des semaines de chasse aux bugs dans la War Room :
 *
 *   1. Une règle est déclarée dans RULES mais aucun bouton ne l'appelle.
 *      L'action devient injoignable. `schedule_mission` était dans ce cas :
 *      le client payait, fermait la modale, et la mission restait bloquée en
 *      `payment` sans rien à cliquer.
 *
 *   2. Un bloc d'interface teste le rôle à la main (`role === 'artisan'`) au
 *      lieu de passer par `allow()`. Il échappe à la matrice, donc il survit
 *      à toutes les corrections faites dans `mission-roles.ts`.
 *
 * Usage : node scripts/check-permissions.mjs   (sortie 1 si dérive)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const ROLES_FILE = join(ROOT, 'src/lib/mission-roles.ts')

/** Pages et routes qui consomment la matrice. */
function sourcesUsingMatrix() {
  const out = []
  const walk = dir => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) { walk(p); continue }
      if (!/\.tsx?$/.test(p)) continue
      const src = readFileSync(p, 'utf8')
      if (src.includes('mission-roles')) out.push({ path: p, src })
    }
  }
  walk(join(ROOT, 'src'))
  return out
}

/** Noms d'actions déclarés dans la matrice RULES. */
function declaredActions() {
  const src = readFileSync(ROLES_FILE, 'utf8')
  const block = src.slice(src.indexOf('const RULES'), src.indexOf('export interface PermissionContext'))
  return [...block.matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map(m => m[1])
}

/** Conditions de rôle écrites en dur, hors de la matrice. */
function rawRoleChecks(src) {
  const lines = src.split('\n')
  const hits = []
  lines.forEach((line, i) => {
    // Les libellés d'affichage (couleurs, avatars, « Vous » / nom de l'autre)
    // ont le droit de tester le rôle : ils décrivent qui on est, pas ce qu'on
    // peut faire. On ne signale que les gardes de rendu — `{role === 'x' && (`
    // — qui décident si un bloc existe.
    if (!/role\s*===\s*'(client|artisan|admin)'/.test(line)) return
    if (!/^\s*\{/.test(line)) return           // début de bloc JSX conditionnel
    if (/\?/.test(line)) return                // ternaire sur une ligne = libellé
    // Ternaire étalé sur plusieurs lignes : le `?` arrive juste après.
    const next = lines.slice(i + 1, i + 3).find(l => l.trim())
    if (next && /^\s*[?:]/.test(next)) return
    // Exemption explicite : un bloc purement décoratif (aucune action, aucune
    // donnée de l'autre partie) se marque `role-display:` avec sa raison. Le
    // but est qu'une exception soit une décision écrite, pas un oubli.
    if (lines.slice(Math.max(0, i - 3), i).some(l => l.includes('role-display:'))) return
    hits.push({ line: i + 1, text: line.trim() })
  })
  return hits
}

const actions = declaredActions()
const sources = sourcesUsingMatrix()
const all = sources.map(s => s.src).join('\n')

const unwired = actions.filter(a => !new RegExp(`['"]${a}['"]`).test(all))

const rawChecks = sources.flatMap(({ path, src }) =>
  rawRoleChecks(src).map(h => ({ file: relative(ROOT, path), ...h })),
)

console.log(`Actions déclarées : ${actions.length} · fichiers reliés à la matrice : ${sources.length}`)

let failed = false

if (unwired.length) {
  failed = true
  console.log(`\n✗ ${unwired.length} action(s) déclarée(s) mais jamais câblée(s) — injoignables :`)
  for (const a of unwired) console.log(`    ${a}`)
  console.log('  → soit poser le bouton, soit retirer la règle de RULES.')
}

if (rawChecks.length) {
  failed = true
  console.log(`\n✗ ${rawChecks.length} bloc(s) de rendu testant le rôle hors matrice :`)
  for (const h of rawChecks) console.log(`    ${h.file}:${h.line}  ${h.text.slice(0, 90)}`)
  console.log("  → remplacer par allow('<action>') pour que la matrice reste la seule autorité.")
}

if (!failed) console.log('\n✓ Interface et matrice alignées.')
process.exit(failed ? 1 : 0)
