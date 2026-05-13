/**
 * Scraper Jumia CI — tourne dans GitHub Actions (IPs Azure, non bloquées)
 * Déclenché manuellement ou chaque dimanche.
 * Variables d'environnement requises (GitHub Secrets) :
 *   SUPABASE_URL          → ton URL Supabase (ex: https://xxx.supabase.co)
 *   SUPABASE_SERVICE_KEY  → service_role key (pas la anon key)
 */

// Charge .env.local si présent (exécution locale)
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dir = dirname(fileURLToPath(import.meta.url))
try {
  const env = readFileSync(resolve(__dir, '../.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  }
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis')
  process.exit(1)
}

// ─── Liste des requêtes à scraper ────────────────────────────────────────────
const QUERIES = [
  // Plomberie
  { query: 'robinet cuisine lavabo',                  category: 'Plomberie'     },
  { query: 'pomme douche pommeau',                    category: 'Plomberie'     },
  { query: 'joint plomberie kit',                     category: 'Plomberie'     },
  { query: 'tuyau raccord plomberie',                 category: 'Plomberie'     },
  { query: 'siphon evacuation bonde',                 category: 'Plomberie'     },
  // Électricité
  { query: 'interrupteur prise murale',               category: 'Électricité'   },
  { query: 'ampoule LED lampe',                       category: 'Électricité'   },
  { query: 'rallonge electrique multiprise',          category: 'Électricité'   },
  { query: 'disjoncteur electrique',                  category: 'Électricité'   },
  { query: 'fil electrique cable',                    category: 'Électricité'   },
  // Peinture
  { query: 'rouleau peinture',                        category: 'Peinture'      },
  { query: 'pinceau peinture',                        category: 'Peinture'      },
  { query: 'bache protection peinture',               category: 'Peinture'      },
  // Menuiserie
  { query: 'serrure porte',                           category: 'Menuiserie'    },
  { query: 'poignee porte',                           category: 'Menuiserie'    },
  { query: 'charniere porte',                         category: 'Menuiserie'    },
  // Maçonnerie
  { query: 'perceuse visseuse',                       category: 'Maçonnerie'    },
  { query: 'niveau bulle',                            category: 'Maçonnerie'    },
  { query: 'truelle spatule macon',                   category: 'Maçonnerie'    },
  // Carrelage
  { query: 'carrelage sol interieur',                 category: 'Carrelage'     },
  { query: 'colle carrelage joint',                   category: 'Carrelage'     },
  // Climatisation
  { query: 'telecommande climatiseur',                category: 'Climatisation' },
  { query: 'filtre air climatiseur',                  category: 'Climatisation' },
  { query: 'ventilateur brasseur air',                category: 'Climatisation' },
]

// ─── Parser HTML Jumia CI ─────────────────────────────────────────────────────
function parseJumiaHtml(html) {
  const results = []
  const cardRe = /href="(\/[a-z0-9][a-z0-9-]+-\d+\.html)"[^>]+class="core"[^>]+data-gtm-name="([^"]+)"[^>]+data-gtm-brand="([^"]+)"/g
  let m
  while ((m = cardRe.exec(html)) !== null) {
    const after = html.slice(m.index, m.index + 2000)
    const priceM = after.match(/class="prc">([0-9,]+) FCFA/)
    if (!priceM) continue
    const price = parseInt(priceM[1].replace(/,/g, ''), 10)
    if (!price) continue
    const imgM = after.match(/data-src="(https:\/\/ci\.jumia\.is\/[^"]+)"/)
    results.push({
      name:      m[2],
      brand:     m[3] === 'Generic' ? 'Jumia CI' : m[3],
      price,
      photo_url: imgM ? imgM[1] : '',
      url:       `https://www.jumia.ci${m[1]}`,
    })
  }
  return results
}

// ─── Fetch Jumia ──────────────────────────────────────────────────────────────
async function fetchProducts(query) {
  const url = `https://www.jumia.ci/catalog/?q=${encodeURIComponent(query)}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer': 'https://www.jumia.ci/',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) { console.log(`  HTTP ${res.status}`); return [] }
    const html = await res.text()
    const products = parseJumiaHtml(html)
    if (!products.length) console.log(`  HTTP 200 mais 0 produits (hasPrc:${html.includes('class="prc"')})`)
    return products
  } catch (e) {
    console.log(`  Erreur fetch: ${e.message}`)
    return []
  }
}

// ─── Upsert Supabase via REST ─────────────────────────────────────────────────
async function upsertProducts(products, category) {
  let saved = 0
  for (const p of products) {
    const payload = {
      name:            p.name,
      category,
      unit:            'unité',
      tier:            'standard',
      price_market:    Math.round(p.price * 0.88),
      price_min:       Math.round(p.price * 0.75),
      price_max:       p.price,
      source:          'Jumia CI',
      brand:           p.brand,
      photo_url:       p.photo_url,
      source_url:      p.url,
      web_price:       p.price,
      last_scraped_at: new Date().toISOString(),
    }

    // Essaie de mettre à jour d'abord
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/price_materials?name=eq.${encodeURIComponent(p.name)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payload),
      }
    )
    const patched = await patchRes.json()

    // Si aucune ligne mise à jour → INSERT
    if (!Array.isArray(patched) || patched.length === 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/price_materials`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(payload),
      })
    }
    saved++
  }
  return saved
}

// ─── Main ─────────────────────────────────────────────────────────────────────
let totalSaved = 0
let totalSkipped = 0

for (const { query, category } of QUERIES) {
  process.stdout.write(`[${category}] "${query}" → `)
  const products = await fetchProducts(query)
  if (!products.length) {
    console.log('0 produits, skip')
    totalSkipped++
    continue
  }
  const saved = await upsertProducts(products, category)
  console.log(`${saved} produits indexés`)
  totalSaved += saved
  // Pause entre requêtes pour ne pas se faire bloquer
  await new Promise(r => setTimeout(r, 1500))
}

console.log(`\n✓ Terminé — ${totalSaved} produits indexés, ${totalSkipped} requêtes sans résultat`)
