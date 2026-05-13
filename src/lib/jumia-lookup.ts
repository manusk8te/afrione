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

// Jumia CI utilise des attributs HTML (data-gtm-name, class="prc", data-src)
// Les prix sont directement en FCFA — pas de conversion.
function parseJumiaHtml(html: string): JumiaProduct[] {
  const results: JumiaProduct[] = []
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
    })
  }
  return results
}

// Extrait les produits du HTML Jumia CI
async function fetchJumiaProducts(query: string): Promise<JumiaProduct[]> {
  const url = `https://www.jumia.ci/catalog/?q=${encodeURIComponent(query)}`
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
    return parseJumiaHtml(await res.text())
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

  // Prix Jumia CI déjà en FCFA (marketplace locale).
  // price_market ≈ marché physique Adjamé (légèrement sous Jumia, ~88%)
  // price_min    = bas du marché (soldeur, fin de stock) ≈ 75%
  // price_max    = prix Jumia (plafond achat en ligne)
  const payload = {
    name:            item,
    category,
    unit:            'unité',
    tier:            'standard',
    price_market:    Math.round(best.price * 0.88),
    price_min:       Math.round(best.price * 0.75),
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
