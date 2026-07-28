/**
 * Normalise artisan_pros.metier vers la taxonomie canonique (src/lib/metier.ts).
 * À relancer si des valeurs incohérentes réapparaissent (import manuel,
 * script hors repo, édition directe dans Supabase Table Editor…).
 * Usage : node scripts/normalize-metier.js
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  })
}

const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Doit rester synchronisé avec src/lib/metier.ts (ALIASES + CANONICAL_METIERS)
const CANONICAL = ['Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie', 'Climatisation', 'Serrurerie', 'Carrelage']
const ALIASES = {
  'plombier': 'Plomberie', 'électricien': 'Électricité', 'electricien': 'Électricité',
  'peintre': 'Peinture', 'maçon': 'Maçonnerie', 'macon': 'Maçonnerie',
  'menuisier': 'Menuiserie', 'climaticien': 'Climatisation', 'climatiseur': 'Climatisation',
  'serrurier': 'Serrurerie', 'carreleur': 'Carrelage',
}

function normalize(raw) {
  if (!raw) return null
  const trimmed = raw.trim()
  if (CANONICAL.includes(trimmed)) return trimmed
  return ALIASES[trimmed.toLowerCase()] ?? null
}

async function main() {
  const { data: artisans, error } = await sb.from('artisan_pros').select('id, metier')
  if (error) { console.error('❌', error.message); process.exit(1) }

  let fixed = 0, unknown = 0
  for (const a of artisans) {
    const norm = normalize(a.metier)
    if (!norm) {
      console.log(`  ⚠️  Valeur non reconnue, ignorée : "${a.metier}" (id: ${a.id})`)
      unknown++
      continue
    }
    if (norm !== a.metier) {
      const { error: upErr } = await sb.from('artisan_pros').update({ metier: norm }).eq('id', a.id)
      if (upErr) console.error(`  ❌ ${a.id}:`, upErr.message)
      else { console.log(`  ✓ "${a.metier}" → "${norm}" (id: ${a.id})`); fixed++ }
    }
  }

  console.log(`\n${fixed} corrigé(s), ${unknown} valeur(s) inconnue(s) sur ${artisans.length} artisan(s).`)
}

main().catch(err => { console.error('Fatal :', err); process.exit(1) })
