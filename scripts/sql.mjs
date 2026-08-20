#!/usr/bin/env node
/**
 * Exécute du SQL sur la base Supabase via l'API Management.
 *
 * Le projet n'expose aucune connexion Postgres directe (pas de `DATABASE_URL`,
 * pas de psql, pas de CLI Supabase) et la clé service_role ne permet que des
 * opérations sur les données, jamais sur le schéma. Les migrations se
 * posaient donc à la main dans le SQL Editor, sans vérification possible —
 * c'est ainsi que la 007 est restée non appliquée pendant une semaine.
 *
 * Usage :
 *   node scripts/sql.mjs "select 1"           SQL en argument
 *   node scripts/sql.mjs -f migrations/007…   depuis un fichier
 *
 * Demande SUPABASE_ACCESS_TOKEN dans .env.local (jeton personnel `sbp_…`).
 */

import { readFileSync } from 'node:fs'
import { config } from 'dotenv'

config({ path: new URL('../.env.local', import.meta.url).pathname })

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL

if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN absent de .env.local.')
  console.error('→ https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

const REF = URL_.replace('https://', '').split('.')[0]

export async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${body.slice(0, 600)}`)
  try { return JSON.parse(body) } catch { return body }
}

// Exécution directe uniquement (pas quand le module est importé).
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const query = args[0] === '-f' ? readFileSync(args[1], 'utf8') : args.join(' ')
  if (!query?.trim()) { console.error('Rien à exécuter.'); process.exit(1) }
  runSql(query)
    .then(r => console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 2)))
    .catch(e => { console.error('✗', e.message); process.exit(1) })
}
