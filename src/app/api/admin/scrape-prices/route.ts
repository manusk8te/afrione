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

function mapProducts(arr: any[]): JumiaHit[] {
  return arr.map(p => ({
    name:      (p.displayName || p.name || '') as string,
    brand:     (p.brand || 'Jumia CI') as string,
    price:     Math.round(parseFloat(p.prices?.rawPrice || p.price || '0')),
    photo_url: (p.image || p.images?.[0] || '') as string,
    url:       `https://www.jumia.ci${p.url || ''}`,
    rating:    p.rating?.average || 0,
    reviews:   p.rating?.totalRatings || 0,
  })).filter(p => p.price > 0)
}

function extractJsonArray(html: string, key: string): any[] | null {
  const idx = html.indexOf(key)
  if (idx === -1) return null
  const start = html.indexOf('[', idx)
  if (start === -1) return null
  let depth = 0, i = start
  for (; i < html.length; i++) {
    if (html[i] === '[') depth++
    else if (html[i] === ']') { depth--; if (depth === 0) break }
  }
  try { return JSON.parse(html.slice(start, i + 1)) } catch { return null }
}

// ─── Parser HTML Jumia — 3 stratégies en cascade ─────────────────────────────
async function scrapeJumia(query: string): Promise<JumiaHit[]> {
  const url = `https://www.jumia.ci/catalog/?q=${encodeURIComponent(query)}`
  let html = ''
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.jumia.ci/',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  }

  // Stratégie 1 : __NEXT_DATA__ (Next.js SSR — structure la plus fiable)
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (m) {
    try {
      const nd = JSON.parse(m[1])
      const pp = nd?.props?.pageProps
      const candidates = [
        pp?.catalog?.products,
        pp?.data?.catalog?.products,
        pp?.initialData?.catalog?.products,
        pp?.products,
        pp?.catalog?.items,
        pp?.data?.products,
      ]
      for (const arr of candidates) {
        if (Array.isArray(arr) && arr.length > 0) {
          const result = mapProducts(arr)
          if (result.length > 0) return result
        }
      }
    } catch {}
  }

  // Stratégie 2 : "products": quelque part dans le HTML
  const byProducts = extractJsonArray(html, '"products":')
  if (byProducts) {
    const result = mapProducts(byProducts)
    if (result.length > 0) return result
  }

  // Stratégie 3 : "items": quelque part dans le HTML
  const byItems = extractJsonArray(html, '"items":')
  if (byItems) {
    const result = mapProducts(byItems.filter(p => p.prices?.rawPrice || p.price))
    if (result.length > 0) return result
  }

  return []
}

// ─── Sélection des 3 tiers ────────────────────────────────────────────────────
// Filtre par pertinence (keywords + fourchette de prix)
// Puis prend P15, P50, P85 comme éco/standard/premium
function selectTiers(
  products: Awaited<ReturnType<typeof scrapeJumia>>,
  mat: typeof MATERIALS[0]
) {
  // 1. Filtre par fourchette de prix et pertinence keywords
  const relevant = products.filter(p => {
    if (p.price < mat.priceMin || p.price > mat.priceMax) return false
    const nameLow = p.name.toLowerCase()
    return mat.keywords.some(k => nameLow.includes(k.toLowerCase()))
  })

  if (relevant.length === 0) return null

  // 2. Trie par prix croissant
  const sorted = [...relevant].sort((a, b) => a.price - b.price)
  const n = sorted.length

  // 3. Prend les 3 percentiles
  const pick = (pct: number) => sorted[Math.min(Math.floor(n * pct), n - 1)]

  return {
    economique: pick(0.15),
    standard:   pick(0.50),
    premium:    pick(0.85),
  }
}

// ─── Handler POST ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { category } = body
  const materials = category ? MATERIALS.filter(m => m.category === category) : MATERIALS

  const saved: any[]    = []
  const skipped: any[]  = []
  const errors: any[]   = []

  for (const mat of materials) {
    const products = await scrapeJumia(mat.query)

    if (!products.length) {
      skipped.push({ material: mat.material_name, reason: 'no_results_jumia' })
      continue
    }

    const tiers = selectTiers(products, mat)
    if (!tiers) {
      skipped.push({
        material: mat.material_name,
        reason: `aucun produit dans [${mat.priceMin}–${mat.priceMax} FCFA] avec keywords ${mat.keywords.join('/')}`,
        found: products.length,
        prices: products.slice(0, 3).map(p => p.price),
      })
      continue
    }

    for (const [tier, product] of Object.entries(tiers) as ['economique'|'standard'|'premium', any][]) {
      const name = `${mat.material_name}${tier === 'premium' ? ' premium' : tier === 'economique' ? ' éco' : ''}`
      // Jumia = retail e-commerce, 2-3× marché physique Abidjan
      // price_market = estimation marché local selon tier
      const localFactor = tier === 'economique' ? 0.30 : tier === 'standard' ? 0.45 : 0.70
      const localPrice  = Math.round(product.price * localFactor)

      // UPDATE si existe, INSERT sinon
      const { data: existing } = await supabaseAdmin
        .from('price_materials')
        .select('id')
        .eq('name', name).eq('category', mat.category).eq('tier', tier)
        .maybeSingle()

      const payload = {
        name, category: mat.category, unit: mat.unit, tier,
        price_market:    localPrice,
        price_min:       Math.round(product.price * 0.25),
        price_max:       product.price,
        source:          'Jumia CI',
        brand:           product.brand,
        photo_url:       product.photo_url,
        source_url:      product.url,
        web_price:       product.price,
        last_scraped_at: new Date().toISOString(),
      }

      const { error } = existing
        ? await supabaseAdmin.from('price_materials').update(payload).eq('id', existing.id)
        : await supabaseAdmin.from('price_materials').insert(payload)

      if (error) {
        errors.push({ material: name, error: error.message })
      } else {
        saved.push({ material: name, tier, price: product.price, brand: product.brand, photo: !!product.photo_url })
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
      const products = await scrapeJumia(q)
      return NextResponse.json({ status, htmlLen, hasNextData, hasProducts, hasItems, productsFound: products.length, snippet, products: products.slice(0, 3) })
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
