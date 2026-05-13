/**
 * Lookup Jumia CI à la demande pour un matériau spécifique.
 * Principe : on fait la recherche exactement comme un utilisateur Jumia.
 * Jumia retourne les résultats les plus pertinents — on sauvegarde TOUT
 * dans price_materials sans filtrer par mots-clés. Le filtre se fait
 * au moment de l'affichage, pas à l'indexation.
 */

import { supabaseAdmin } from './supabase'

interface JumiaProduct {
  name:      string
  brand:     string
  price:     number
  photo_url: string
  url:       string
}

// Parse les cartes produit Jumia CI depuis le HTML (data-gtm-* + class="prc")
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

// Sauvegarde tous les produits Jumia dans price_materials (upsert par nom exact)
async function saveAllProducts(products: JumiaProduct[], category: string) {
  await Promise.all(products.map(async p => {
    const payload = {
      name:            p.name,
      category,
      unit:            'unité',
      tier:            'standard',
      price_market:    Math.round(p.price * 0.88), // marché physique ≈ 88% du prix Jumia CI
      price_min:       Math.round(p.price * 0.75),
      price_max:       p.price,
      source:          'Jumia CI',
      brand:           p.brand,
      photo_url:       p.photo_url,
      source_url:      p.url,
      web_price:       p.price,
      last_scraped_at: new Date().toISOString(),
    }
    const { data: existing } = await supabaseAdmin
      .from('price_materials').select('id').eq('name', p.name).maybeSingle()
    if (existing) {
      await supabaseAdmin.from('price_materials').update(payload).eq('id', existing.id)
    } else {
      await supabaseAdmin.from('price_materials').insert(payload)
    }
  }))
}

/**
 * Cherche un item sur Jumia CI, sauvegarde TOUS les résultats dans price_materials,
 * et retourne le produit au prix médian pour l'affichage dans le diagnostic.
 */
export async function lookupItemOnJumia(item: string, category: string): Promise<{
  item:       string
  found:      boolean
  price?:     number
  photo_url?: string
  url?:       string
  name?:      string
  saved?:     number
}> {
  const products = await fetchJumiaProducts(item)
  if (!products.length) return { item, found: false }

  // Sauvegarde tout en arrière-plan (sans bloquer le retour)
  saveAllProducts(products, category).catch(() => {})

  // Produit médian = référence de prix pour l'affichage
  const sorted = [...products].sort((a, b) => a.price - b.price)
  const best   = sorted[Math.floor(sorted.length / 2)]

  return {
    item,
    found:     true,
    price:     best.price,
    photo_url: best.photo_url,
    url:       best.url,
    name:      best.name,
    saved:     products.length,
  }
}

/**
 * Lance le lookup Jumia pour tous les items_needed en parallèle.
 * Timeout global de 12s — si Jumia est lent on ne bloque pas le diagnostic.
 */
type JumiaResult = Awaited<ReturnType<typeof lookupItemOnJumia>>

export async function enrichItemsWithJumia(
  items: string[],
  category: string
): Promise<JumiaResult[]> {
  if (!items.length) return []

  const timeout = new Promise<JumiaResult[]>(resolve =>
    setTimeout(() => resolve([]), 12_000)
  )

  const lookups = Promise.all(items.slice(0, 8).map(item => lookupItemOnJumia(item, category)))

  return Promise.race([lookups, timeout])
}
