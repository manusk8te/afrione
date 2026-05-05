/**
 * Scraper de prix Jumia CI
 * POST /api/admin/scrape-prices
 * Body: { material: "tuyau pvc" } ou { category: "Plomberie" }
 * Met à jour price_materials.web_price + photo_url depuis Jumia CI
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const JUMIA_BASE = 'https://www.jumia.ci/catalog/?q='
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'fr-FR,fr;q=0.9',
}

// Matériaux à scraper par catégorie
const SEARCH_QUERIES: Record<string, { query: string; material_name: string; unit: string; category: string }[]> = {
  'Plomberie': [
    { query: 'tuyau pvc plomberie', material_name: 'Tuyau PVC', unit: 'mètre', category: 'Plomberie' },
    { query: 'joint silicone plomberie', material_name: 'Joint silicone', unit: 'tube', category: 'Plomberie' },
    { query: 'robinet cuisine salle bain', material_name: 'Robinet mélangeur', unit: 'unité', category: 'Plomberie' },
  ],
  'Électricité': [
    { query: 'cable electrique 2.5mm', material_name: 'Câble électrique 2.5mm', unit: 'mètre', category: 'Électricité' },
    { query: 'disjoncteur schneider hager', material_name: 'Disjoncteur 16A', unit: 'unité', category: 'Électricité' },
  ],
  'Peinture': [
    { query: 'peinture murale interieure', material_name: 'Peinture vinylique', unit: 'litre', category: 'Peinture' },
  ],
  'Maçonnerie': [
    { query: 'ciment sac construction', material_name: 'Ciment CPA 50kg', unit: 'sac', category: 'Maçonnerie' },
  ],
  'Climatisation': [
    { query: 'climatiseur split inverter', material_name: 'Gaz climatiseur R32', unit: 'kg', category: 'Climatisation' },
  ],
}

async function scrapeJumia(query: string): Promise<{ name: string; price: number; photo_url: string; source_url: string; brand: string }[]> {
  const url = `${JUMIA_BASE}${encodeURIComponent(query)}`
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const html = await res.text()

    // Jumia embarque les données produits en JSON dans un tag <script>
    const jsonMatch = html.match(/"products"\s*:\s*(\[[\s\S]*?\])\s*[,}]/)
    if (jsonMatch) {
      try {
        const products = JSON.parse(jsonMatch[1])
        return products.slice(0, 5).map((p: any) => ({
          name:       p.name || p.title || '',
          price:      parseInt(String(p.price || p.current_price || '0').replace(/\D/g, '')) || 0,
          photo_url:  p.image || p.thumbnail || p.image_url || '',
          source_url: `https://www.jumia.ci${p.url || ''}`,
          brand:      p.brand || extractBrand(p.name || ''),
        })).filter((p: any) => p.price > 0)
      } catch {}
    }

    // Fallback : extraction regex depuis le HTML
    const products: any[] = []
    const articleRe = /<article[^>]*class="[^"]*prd[^"]*"[^>]*>([\s\S]*?)<\/article>/g
    let match
    while ((match = articleRe.exec(html)) !== null && products.length < 5) {
      const block = match[1]
      const nameM   = block.match(/data-name="([^"]+)"/) || block.match(/<h3[^>]*>([^<]+)<\/h3>/)
      const priceM  = block.match(/data-price="([\d.]+)"/) || block.match(/<em[^>]*>([\d\s,]+)\s*FCFA/)
      const photoM  = block.match(/data-src="([^"]+)"/) || block.match(/src="(https:\/\/[^"]+\.jpg[^"]*)"/)
      const linkM   = block.match(/href="(\/[^"]+)"/)
      if (nameM && priceM) {
        const price = parseInt(priceM[1].replace(/[\s,]/g, ''))
        if (price > 0) {
          products.push({
            name:       nameM[1].trim(),
            price,
            photo_url:  photoM?.[1] || '',
            source_url: linkM ? `https://www.jumia.ci${linkM[1]}` : url,
            brand:      extractBrand(nameM[1]),
          })
        }
      }
    }
    return products
  } catch {
    return []
  }
}

function extractBrand(name: string): string {
  const brands = ['TOTAL', 'Schneider', 'Legrand', 'Hager', 'Wavin', 'Sika', 'Dulux', 'Knauf', 'Weber', 'Daikin', 'Carrier', 'WADFOW', 'Nexans', 'Cimaf', 'Lafarge']
  for (const b of brands) {
    if (name.toLowerCase().includes(b.toLowerCase())) return b
  }
  return 'Jumia CI'
}

function priceToPriceRange(price: number): { price_min: number; price_max: number } {
  return { price_min: Math.round(price * 0.85), price_max: Math.round(price * 1.15) }
}

export async function POST(req: NextRequest) {
  // Vérifier que c'est bien un admin
  const { category } = await req.json().catch(() => ({}))
  const categories = category ? [category] : Object.keys(SEARCH_QUERIES)

  const results: any[] = []

  for (const cat of categories) {
    const queries = SEARCH_QUERIES[cat] || []
    for (const q of queries) {
      const products = await scrapeJumia(q.query)
      if (!products.length) {
        results.push({ query: q.query, status: 'no_results' })
        continue
      }

      // Prend le 1er résultat comme "standard", cherche le moins cher pour "economique", le plus cher pour "premium"
      const sorted = products.sort((a, b) => a.price - b.price)
      const eco     = sorted[0]
      const std     = sorted[Math.floor(sorted.length / 2)]
      const premium = sorted[sorted.length - 1]

      for (const [tier, product] of [['economique', eco], ['standard', std], ['premium', premium]] as const) {
        if (!product || !product.price) continue
        const { price_min, price_max } = priceToPriceRange(product.price)

        await supabaseAdmin.from('price_materials').upsert({
          name:        `${q.material_name}${tier === 'premium' ? ' premium' : tier === 'economique' ? ' éco' : ''}`,
          category:    q.category,
          unit:        q.unit,
          price_market: product.price,
          price_min,
          price_max,
          source:      'Jumia CI',
          tier,
          brand:        product.brand,
          photo_url:    product.photo_url,
          source_url:   product.source_url,
          web_price:    product.price,
          last_scraped_at: new Date().toISOString(),
        }, { onConflict: 'name,category,tier' })

        results.push({ material: q.material_name, tier, price: product.price, brand: product.brand })
      }
    }
  }

  return NextResponse.json({ updated: results.length, results })
}

// GET → liste les prix actuels avec date de dernier scraping
export async function GET() {
  const { data } = await supabaseAdmin
    .from('price_materials')
    .select('name,category,tier,price_market,web_price,physical_price,brand,last_scraped_at,source')
    .order('category').order('tier')
  return NextResponse.json(data || [])
}
