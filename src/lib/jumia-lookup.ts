/**
 * Lookup Jumia CI à la demande pour un matériau spécifique
 * Appelé depuis le diagnostic finalize quand l'IA détecte des items_needed
 */

import { supabaseAdmin } from './supabase'

interface JumiaProduct {
  name:      string
  brand:     string
  price:     number
  photo_url: string
  url:       string
}

function mapJumia(arr: any[]): JumiaProduct[] {
  return arr.map(p => ({
    name:      (p.displayName || p.name || '') as string,
    brand:     (p.brand || 'Jumia CI') as string,
    price:     Math.round(parseFloat(p.prices?.rawPrice || p.price || '0')),
    photo_url: (p.image || p.images?.[0] || '') as string,
    url:       `https://www.jumia.ci${p.url || ''}`,
  })).filter(p => p.price > 0)
}

function extractArr(html: string, key: string): any[] | null {
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

// Extrait les produits du HTML Jumia CI — 3 stratégies en cascade
async function fetchJumiaProducts(query: string): Promise<JumiaProduct[]> {
  const url = `https://www.jumia.ci/catalog/?q=${encodeURIComponent(query)}`
  let html = ''
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer': 'https://www.jumia.ci/',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  }

  // Stratégie 1 : __NEXT_DATA__
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (m) {
    try {
      const pp = JSON.parse(m[1])?.props?.pageProps
      for (const arr of [pp?.catalog?.products, pp?.data?.catalog?.products, pp?.initialData?.catalog?.products, pp?.products, pp?.catalog?.items]) {
        if (Array.isArray(arr) && arr.length > 0) {
          const r = mapJumia(arr)
          if (r.length > 0) return r
        }
      }
    } catch {}
  }

  // Stratégie 2 : "products":
  const p2 = extractArr(html, '"products":')
  if (p2) { const r = mapJumia(p2); if (r.length > 0) return r }

  // Stratégie 3 : "items":
  const p3 = extractArr(html, '"items":')
  if (p3) { const r = mapJumia(p3.filter(p => p.prices?.rawPrice || p.price)); if (r.length > 0) return r }

  return []
}

// Vérifie si un produit est pertinent pour l'item recherché
// Au moins 1 mot de l'item (3+ lettres) doit être dans le nom du produit
function isRelevant(productName: string, itemQuery: string): boolean {
  const nameLow = productName.toLowerCase()
  const words   = itemQuery.toLowerCase().split(/\s+/).filter(w => w.length >= 3)
  return words.some(w => nameLow.includes(w))
}

// Prend le produit au prix médian parmi les pertinents
function pickMedian(products: JumiaProduct[]): JumiaProduct | null {
  if (!products.length) return null
  const sorted = [...products].sort((a, b) => a.price - b.price)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Cherche un item sur Jumia CI et met à jour price_materials si trouvé.
 * Retourne { found, product } — appelé en parallèle pour tous les items_needed.
 */
export async function lookupItemOnJumia(item: string, category: string): Promise<{
  item:      string
  found:     boolean
  price?:    number
  photo_url?: string
  url?:      string
  name?:     string
}> {
  const products = await fetchJumiaProducts(item)
  if (!products.length) return { item, found: false }

  // Filtre les produits pertinents
  const relevant = products.filter(p => isRelevant(p.name, item))
  if (!relevant.length) return { item, found: false }

  const best = pickMedian(relevant)!

  // Sauvegarde / mise à jour dans price_materials
  const { data: existing } = await supabaseAdmin
    .from('price_materials')
    .select('id')
    .ilike('name', `%${item}%`)
    .maybeSingle()

  // Jumia = prix e-commerce retail importé ≈ 2–3× marché physique Abidjan
  // web_price conserve le vrai prix Jumia pour affichage
  // price_market = estimation marché local (Adjamé/Koumassi) ≈ 45% du prix Jumia
  // price_min    = bas du marché local ≈ 25% du prix Jumia
  // price_max    = prix Jumia (plafond, si l'artisan achète en ligne)
  const payload = {
    name:            item,
    category,
    unit:            'unité',
    tier:            'standard',
    price_market:    Math.round(best.price * 0.45),
    price_min:       Math.round(best.price * 0.25),
    price_max:       best.price,
    source:          'Jumia CI',
    brand:           best.brand,
    photo_url:       best.photo_url,
    source_url:      best.url,
    web_price:       best.price,
    last_scraped_at: new Date().toISOString(),
  }

  if (existing) {
    await supabaseAdmin.from('price_materials').update(payload).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('price_materials').insert(payload)
  }

  return {
    item,
    found:     true,
    price:     best.price,
    photo_url: best.photo_url,
    url:       best.url,
    name:      best.name,
  }
}

/**
 * Lance le lookup Jumia pour tous les items_needed en parallèle
 * Timeout global de 10s — si Jumia est lent on ne bloque pas le diagnostic
 */
type JumiaResult = Awaited<ReturnType<typeof lookupItemOnJumia>>

export async function enrichItemsWithJumia(
  items: string[],
  category: string
): Promise<JumiaResult[]> {
  if (!items.length) return []

  const timeout = new Promise<JumiaResult[]>(resolve =>
    setTimeout(() => resolve([]), 10_000)
  )

  const lookups = Promise.all(items.slice(0, 6).map(item => lookupItemOnJumia(item, category)))

  return Promise.race([lookups, timeout])
}
