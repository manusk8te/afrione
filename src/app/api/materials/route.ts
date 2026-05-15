/**
 * GET  /api/materials?category=Plomberie&items=Joint,Tuyau&client_quartier=Cocody
 * POST /api/materials { name, category } → lookup DB puis Jumia on-demand, retourne fiche produit complète
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { quartierKm } from '@/lib/pricing'
import { lookupItemOnJumia } from '@/lib/jumia-lookup'

export const dynamic = 'force-dynamic'


const FALLBACK_TIERS: Record<string, { economique: number; standard: number; premium: number }> = {
  'Plomberie':    { economique: 0.65, standard: 1.0, premium: 1.6 },
  'Électricité':  { economique: 0.65, standard: 1.0, premium: 1.7 },
  'Peinture':     { economique: 0.70, standard: 1.0, premium: 1.8 },
  'Maçonnerie':   { economique: 0.75, standard: 1.0, premium: 1.5 },
  'Menuiserie':   { economique: 0.70, standard: 1.0, premium: 1.6 },
  'Climatisation':{ economique: 0.65, standard: 1.0, premium: 1.7 },
  'Serrurerie':   { economique: 0.70, standard: 1.0, premium: 1.6 },
  'Carrelage':    { economique: 0.70, standard: 1.0, premium: 1.6 },
}

function addProximity(
  tier: any,
  clientQ: string | null,
  artisanQ: string | null,
): any {
  if (!tier || !tier.vendor_quartier) return tier
  const out: any = { ...tier }
  if (clientQ)  out.km_to_client  = quartierKm(tier.vendor_quartier, clientQ)
  if (artisanQ) out.km_to_artisan = quartierKm(tier.vendor_quartier, artisanQ)
  if (out.km_to_client != null && out.km_to_artisan != null) {
    out.vendor_closest = out.km_to_client <= out.km_to_artisan ? 'client' : 'artisan'
  } else if (out.km_to_client != null) {
    out.vendor_closest = 'client'
  }
  return out
}

export async function GET(req: NextRequest) {
  const category       = req.nextUrl.searchParams.get('category')        || 'Plomberie'
  const items          = req.nextUrl.searchParams.get('items')?.split(',').filter(Boolean) || []
  const clientQ        = req.nextUrl.searchParams.get('client_quartier')  || null
  const artisanQ       = req.nextUrl.searchParams.get('artisan_quartier') || null

  // Cherche les matériaux avec tiers dans la BDD
  const { data: dbMaterials } = await supabaseAdmin
    .from('price_materials')
    .select('*')
    .eq('category', category)
    .order('tier')

  // Prix de référence marché
  const { data: refData } = await supabaseAdmin
    .from('market_reference_prices')
    .select('reference_price_fcfa')
    .eq('category', category)
    .maybeSingle()

  const marketRef = refData?.reference_price_fcfa || 60000

  // Groupe par matériau de base (sans suffixe tier)
  const grouped: Record<string, any[]> = {}
  for (const m of (dbMaterials || [])) {
    const baseName = m.name.replace(/ (premium|éco)$/, '').trim()
    if (!grouped[baseName]) grouped[baseName] = []
    grouped[baseName].push(m)
  }

  const tierResults: any[] = []
  const itemsToProcess = items.length > 0 ? items : Object.keys(grouped).slice(0, 5)

  for (const item of itemsToProcess) {
    const matchKey = Object.keys(grouped).find(k =>
      k.toLowerCase().includes(item.toLowerCase().split(' ')[0]) ||
      item.toLowerCase().includes(k.toLowerCase().split(' ')[0])
    )

    if (matchKey && grouped[matchKey]) {
      const tiers = grouped[matchKey]
      const eco = addProximity(tiers.find((t: any) => t.tier === 'economique') || buildFallbackTier(item, category, 'economique'), clientQ, artisanQ)
      const std = addProximity(tiers.find((t: any) => t.tier === 'standard')   || buildFallbackTier(item, category, 'standard'),   clientQ, artisanQ)
      const prm = addProximity(tiers.find((t: any) => t.tier === 'premium')    || buildFallbackTier(item, category, 'premium'),     clientQ, artisanQ)
      tierResults.push({ name: item, tiers: { economique: eco, standard: std, premium: prm } })
    } else {
      const { data: base } = await supabaseAdmin
        .from('price_materials')
        .select('*')
        .eq('category', category)
        .ilike('name', `%${item.split(' ')[0]}%`)
        .eq('tier', 'standard')
        .maybeSingle()

      const mult = FALLBACK_TIERS[category] || { economique: 0.70, standard: 1.0, premium: 1.6 }
      const basePrice = base?.price_market || 3000

      tierResults.push({
        name: item,
        tiers: {
          economique: addProximity({ price_market: Math.round(basePrice * mult.economique), tier: 'economique', brand: 'Sans marque', photo_url: null, source: null, vendor_quartier: base?.vendor_quartier || null }, clientQ, artisanQ),
          standard:   addProximity({ price_market: basePrice, tier: 'standard', brand: 'Standard', photo_url: base?.photo_url || null, source_url: base?.source_url || null, source: base?.source || null, vendor_quartier: base?.vendor_quartier || null }, clientQ, artisanQ),
          premium:    addProximity({ price_market: Math.round(basePrice * mult.premium), tier: 'premium', brand: 'Premium', photo_url: null, source: null, vendor_quartier: base?.vendor_quartier || null }, clientQ, artisanQ),
        },
      })
    }
  }

  return NextResponse.json({ category, market_reference_fcfa: marketRef, materials: tierResults })
}

// ── POST /api/materials — lookup on-demand pour un article (warroom mat_suggest) ──
export async function POST(req: NextRequest) {
  const { name, category } = await req.json()
  if (!name) return NextResponse.json({ found: false }, { status: 400 })

  const cat = category || 'Plomberie'

  // 1. Cherche dans la DB (ilike sur le premier mot significatif)
  const firstWord = name.split(/\s+/).find((w: string) => w.length >= 3) || name
  const { data: db } = await supabaseAdmin
    .from('price_materials')
    .select('name,brand,price_market,web_price,photo_url,source_url,source,tier')
    .ilike('name', `%${firstWord}%`)
    .eq('tier', 'standard')
    .maybeSingle()

  if (db && db.price_market > 0) {
    return NextResponse.json({
      found:        true,
      name:         db.name,
      brand:        db.brand || null,
      price_market: db.price_market,
      web_price:    db.web_price || null,
      photo_url:    db.photo_url || null,
      source_url:   db.source_url || null,
      source:       db.source || 'Base AfriOne',
      from_db:      true,
    })
  }

  // 2. Pas en DB → lookup Jumia on-demand (scraping réel)
  const result = await lookupItemOnJumia(name, cat)
  if (result.found && result.price) {
    return NextResponse.json({
      found:        true,
      name:         result.name || name,
      brand:        null,
      price_market: Math.round(result.price * 0.88),   // Jumia CI déjà en FCFA, marché physique ≈ 88%
      web_price:    result.price,
      photo_url:    result.photo_url || null,
      source_url:   result.url || null,
      source:       'Jumia CI',
      from_db:      false,
    })
  }

  return NextResponse.json({ found: false })
}

function buildFallbackTier(name: string, category: string, tier: 'economique' | 'standard' | 'premium') {
  const bases: Record<string, number> = {
    'Plomberie': 2000, 'Électricité': 3000, 'Peinture': 2500,
    'Maçonnerie': 6000, 'Climatisation': 12000, 'Serrurerie': 3500, 'Carrelage': 8000,
  }
  const mult = { economique: 0.65, standard: 1.0, premium: 1.65 }
  const base = bases[category] || 3000
  return {
    name, tier,
    brand: tier === 'premium' ? 'Marque premium' : tier === 'economique' ? 'Sans marque' : 'Standard',
    price_market: Math.round(base * mult[tier]),
    photo_url: null, source_url: null, source: null, vendor_quartier: null,
  }
}
