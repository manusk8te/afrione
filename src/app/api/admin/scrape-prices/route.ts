/**
 * Scraper réel Jumia CI — POST /api/admin/scrape-prices
 *
 * LOGIQUE DE SÉLECTION :
 * Pour chaque matériau on définit :
 *   - query     : requête Jumia précise
 *   - priceMin  : prix plancher pour exclure les accessoires/pièces détachées
 *   - priceMax  : prix plafond pour exclure les kits pro hors budget
 *   - keywords  : mots-clés obligatoires dans le nom (filtre pertinence)
 *
 * Sur les produits filtrés, on prend 3 tiers par percentile :
 *   - éco      : P15 (15% des moins chers parmi les pertinents)
 *   - standard : P50 (médiane)
 *   - premium  : P85 (85% — haut de gamme sans être hors prix)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ─── Matériaux disponibles sur Jumia CI ───────────────────────────────────────
// Jumia CI est une marketplace généraliste — elle vend les fixtures, outils
// et petite quincaillerie, PAS les matériaux de construction lourds
// (ciment, tuyaux PVC, disjoncteurs, peinture en pot → marchés physiques Adjamé/Koumassi)
const MATERIALS: {
  query: string
  material_name: string
  unit: string
  category: string
  priceMin: number
  priceMax: number
  keywords: string[]
}[] = [
  // ── PLOMBERIE — fixtures disponibles sur Jumia ─────────────────────────────
  {
    query: 'robinet cuisine eau froide lavabo',
    material_name: 'Robinet mélangeur',
    unit: 'unité', category: 'Plomberie',
    priceMin: 2000, priceMax: 40000,
    keywords: ['robinet'],
  },
  {
    query: 'pomme de douche pommeau douchette',
    material_name: 'Pommeau de douche',
    unit: 'unité', category: 'Plomberie',
    priceMin: 1500, priceMax: 20000,
    keywords: ['douche', 'pommeau', 'douchette'],
  },
  {
    query: 'joint torique caoutchouc kit assortiment',
    material_name: 'Kit joints toriques',
    unit: 'kit', category: 'Plomberie',
    priceMin: 1000, priceMax: 10000,
    keywords: ['joint', 'torique', 'caoutchouc'],
  },

  // ── ÉLECTRICITÉ — disponible sur Jumia ────────────────────────────────────
  {
    query: 'interrupteur simple allumage mural',
    material_name: 'Interrupteur mural',
    unit: 'unité', category: 'Électricité',
    priceMin: 1000, priceMax: 15000,
    keywords: ['interrupteur'],
  },
  {
    query: 'ampoule LED E27 blanc chaud',
    material_name: 'Ampoule LED E27',
    unit: 'unité', category: 'Électricité',
    priceMin: 500, priceMax: 8000,
    keywords: ['ampoule', 'led'],
  },
  {
    query: 'cable rallonge electrique prise',
    material_name: 'Rallonge électrique',
    unit: 'unité', category: 'Électricité',
    priceMin: 2000, priceMax: 20000,
    keywords: ['rallonge', 'câble', 'cable'],
  },

  // ── PEINTURE — outils disponibles sur Jumia ───────────────────────────────
  {
    query: 'rouleau peinture poignee set',
    material_name: 'Rouleau à peinture',
    unit: 'unité', category: 'Peinture',
    priceMin: 1500, priceMax: 15000,
    keywords: ['rouleau'],
  },
  {
    query: 'pinceau brosse peinture set lot',
    material_name: 'Set pinceaux peinture',
    unit: 'set', category: 'Peinture',
    priceMin: 1500, priceMax: 20000,
    keywords: ['pinceau', 'brosse'],
  },

  // ── MENUISERIE / SERRURERIE — disponible sur Jumia ────────────────────────
  {
    query: 'serrure verrou porte entree',
    material_name: 'Serrure porte',
    unit: 'unité', category: 'Menuiserie',
    priceMin: 2000, priceMax: 80000,
    keywords: ['serrure', 'verrou', 'barillet'],
  },
  {
    query: 'poignee porte bouton rose',
    material_name: 'Poignée de porte',
    unit: 'unité', category: 'Menuiserie',
    priceMin: 1500, priceMax: 20000,
    keywords: ['poignée', 'poignee', 'bouton'],
  },

  // ── OUTILS ARTISAN — disponible sur Jumia ─────────────────────────────────
  {
    query: 'perceuse visseuse electrique sans fil',
    material_name: 'Perceuse-visseuse',
    unit: 'unité', category: 'Maçonnerie',
    priceMin: 5000, priceMax: 80000,
    keywords: ['perceuse', 'visseuse'],
  },
  {
    query: 'niveau bulle mesure maçon',
    material_name: 'Niveau à bulle',
    unit: 'unité', category: 'Maçonnerie',
    priceMin: 1000, priceMax: 15000,
    keywords: ['niveau'],
  },
]

type JumiaHit = { name: string; brand: string; price: number; photo_url: string; url: string; rating: number; reviews: number }

// Jumia CI ne retourne plus de JSON embarqué — on parse les attributs HTML directement.
// Structure réelle : <a href="/slug-id.html" class="core" data-gtm-name="..." data-gtm-brand="...">
//   <img data-src="https://ci.jumia.is/..."> ... <div class="prc">X,XXX FCFA</div>
// Les prix sont directement en FCFA — pas de conversion nécessaire.
function parseJumiaHtml(html: string): JumiaHit[] {
  const results: JumiaHit[] = []
  // Capture l'ancre produit avec URL, nom, marque sur le même tag <a>
  const cardRe = /href="(\/[a-z0-9][a-z0-9-]+-\d+\.html)"[^>]+class="core"[^>]+data-gtm-name="([^"]+)"[^>]+data-gtm-brand="([^"]+)"/g
  let m: RegExpExecArray | null
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
      rating: 0, reviews: 0,
    })
  }
  return results
}

// ─── Fetch + parse Jumia CI ───────────────────────────────────────────────────
// Sur Vercel (AWS Lambda), Jumia bloque les IPs datacenter.
// Si SCRAPERAPI_KEY est défini, on passe par ScraperAPI (proxy résidentiel CI).
// En local, fetch direct. scraperapi.com — tier gratuit : 1000 req/mois.
async function scrapeJumia(query: string): Promise<{ products: JumiaHit[]; debug: string }> {
  const target = `https://www.jumia.ci/catalog/?q=${encodeURIComponent(query)}`
  const apiKey = process.env.SCRAPERAPI_KEY
  const fetchUrl = apiKey
    ? `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(target)}&country_code=ci&render=false`
    : target

  try {
    const res = await fetch(fetchUrl, {
      headers: apiKey ? {} : {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer': 'https://www.jumia.ci/',
      },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return { products: [], debug: `HTTP ${res.status} ${res.statusText} (proxy:${!!apiKey})` }
    const html = await res.text()
    const products = parseJumiaHtml(html)
    const debug = products.length > 0
      ? `OK — ${products.length} produits (proxy:${!!apiKey})`
      : `HTTP 200, 0 produits — html:${html.length}c hasPrc:${html.includes('class="prc"')} hasCore:${html.includes('class="core"')} (proxy:${!!apiKey})`
    return { products, debug }
  } catch (e: any) {
    return { products: [], debug: `ERREUR: ${e.message} (proxy:${!!apiKey})` }
  }
}

// ─── Handler POST ─────────────────────────────────────────────────────────────
// Pour chaque requête de la liste : scrape Jumia, sauvegarde TOUS les résultats.
// Pas de filtre keyword — Jumia gère la pertinence. On filtre à l'affichage.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { category } = body
  const materials = category ? MATERIALS.filter(m => m.category === category) : MATERIALS

  const saved: any[]   = []
  const skipped: any[] = []
  const errors: any[]  = []

  for (const mat of materials) {
    const { products, debug } = await scrapeJumia(mat.query)

    if (!products.length) {
      skipped.push({ material: mat.material_name, query: mat.query, debug })
      continue
    }

    // Sauvegarde TOUS les produits retournés par la recherche Jumia
    for (const product of products) {
      const payload = {
        name:            product.name,
        category:        mat.category,
        unit:            mat.unit,
        tier:            'standard',
        price_market:    Math.round(product.price * 0.88),
        price_min:       Math.round(product.price * 0.75),
        price_max:       product.price,
        source:          'Jumia CI',
        brand:           product.brand,
        photo_url:       product.photo_url,
        source_url:      product.url,
        web_price:       product.price,
        last_scraped_at: new Date().toISOString(),
      }

      const { data: existing } = await supabaseAdmin
        .from('price_materials').select('id').eq('name', product.name).maybeSingle()

      const { error } = existing
        ? await supabaseAdmin.from('price_materials').update(payload).eq('id', existing.id)
        : await supabaseAdmin.from('price_materials').insert(payload)

      if (error) {
        errors.push({ name: product.name, error: error.message })
      } else {
        saved.push({ name: product.name, price: product.price, brand: product.brand, photo: !!product.photo_url, url: product.url })
      }
    }
  }

  return NextResponse.json({
    updated: saved.length,
    saved,
    skipped,
    errors,
    summary: `${saved.length} sauvegardés · ${skipped.length} sans résultats · ${errors.length} erreurs DB`,
  })
}

// ─── Handler GET — liste les prix actuels OU debug du scraper ─────────────────
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('debug')

  // ?debug=robinet → teste le scraping d'un terme et retourne le diagnostic brut
  if (q) {
    const url = `https://www.jumia.ci/catalog/?q=${encodeURIComponent(q)}`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Referer': 'https://www.jumia.ci/',
        },
        signal: AbortSignal.timeout(12_000),
      })
      const status = res.status
      const html = res.ok ? await res.text() : ''
      const hasNextData = html.includes('__NEXT_DATA__')
      const hasProducts = html.includes('"products":')
      const hasItems    = html.includes('"items":')
      const htmlLen     = html.length
      // Extrait un aperçu du contenu autour de __NEXT_DATA__
      const ndIdx = html.indexOf('__NEXT_DATA__')
      const snippet = ndIdx !== -1 ? html.slice(ndIdx, ndIdx + 500) : html.slice(0, 500)
      const { products, debug } = await scrapeJumia(q)
      return NextResponse.json({ status, htmlLen, hasNextData, hasProducts, hasItems, productsFound: products.length, snippet, debug, products: products.slice(0, 3) })
    } catch (e: any) {
      return NextResponse.json({ error: e.message })
    }
  }

  const { data } = await supabaseAdmin
    .from('price_materials')
    .select('name,category,tier,price_market,web_price,brand,photo_url,source_url,last_scraped_at,source')
    .order('category').order('tier')
  return NextResponse.json(data || [])
}
