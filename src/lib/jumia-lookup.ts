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

// Extrait les produits du HTML Jumia CI
async function fetchJumiaProducts(query: string): Promise<JumiaProduct[]> {
  const url = `https://www.jumia.ci/catalog/?q=${encodeURIComponent(query)}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return []
    const html = await res.text()

    const idx = html.indexOf('"products":')
    if (idx === -1) return []

    // Extrait le tableau JSON complet en suivant les crochets
    let depth = 0
    const start = html.indexOf('[', idx)
    let i = start
    for (; i < html.length; i++) {
      if (html[i] === '[') depth++
      else if (html[i] === ']') { depth--; if (depth === 0) break }
    }

    const raw = JSON.parse(html.slice(start, i + 1)) as any[]
    return raw
      .map(p => ({
        name:      (p.displayName || p.name || '') as string,
        brand:     (p.brand || 'Jumia CI') as string,
        price:     Math.round(parseFloat(p.prices?.rawPrice || '0')),
        photo_url: (p.image || '') as string,
        url:       `https://www.jumia.ci${p.url || ''}`,
      }))
      .filter(p => p.price > 0)
  } catch {
    return []
  }
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

  const payload = {
    name:            item,
    category,
    unit:            'unité',
    tier:            'standard',
    price_market:    best.price,
    price_min:       Math.round(best.price * 0.80),
    price_max:       Math.round(best.price * 1.20),
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
