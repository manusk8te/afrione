/**
 * GET /api/materials?category=Plomberie&items=Joint,Tuyau
 * Retourne les 3 tiers (economique/standard/premium) pour chaque item
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') || 'Plomberie'
  const items    = req.nextUrl.searchParams.get('items')?.split(',').filter(Boolean) || []

  // Cherche les matériaux avec tiers dans la BDD
  const { data: dbMaterials } = await supabaseAdmin
    .from('price_materials')
    .select('*')
    .eq('category', category)
    .order('tier')

  // Récupère le prix de référence marché
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

  // Pour chaque item demandé, trouve les 3 tiers
  const tierResults: any[] = []

  const itemsToProcess = items.length > 0 ? items : Object.keys(grouped).slice(0, 5)

  for (const item of itemsToProcess) {
    // Cherche une correspondance dans les données BDD
    const matchKey = Object.keys(grouped).find(k =>
      k.toLowerCase().includes(item.toLowerCase().split(' ')[0]) ||
      item.toLowerCase().includes(k.toLowerCase().split(' ')[0])
    )

    if (matchKey && grouped[matchKey]) {
      const tiers = grouped[matchKey]
      tierResults.push({
        name: item,
        tiers: {
          economique: tiers.find(t => t.tier === 'economique') || buildFallbackTier(item, category, 'economique'),
          standard:   tiers.find(t => t.tier === 'standard')   || buildFallbackTier(item, category, 'standard'),
          premium:    tiers.find(t => t.tier === 'premium')     || buildFallbackTier(item, category, 'premium'),
        },
      })
    } else {
      // Fallback : on génère 3 tiers depuis les multiplicateurs
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
          economique: { price_market: Math.round(basePrice * mult.economique), tier: 'economique', brand: 'Sans marque', photo_url: null },
          standard:   { price_market: basePrice, tier: 'standard', brand: 'Standard', photo_url: base?.photo_url || null },
          premium:    { price_market: Math.round(basePrice * mult.premium),   tier: 'premium',    brand: 'Premium',    photo_url: null },
        },
      })
    }
  }

  return NextResponse.json({ category, market_reference_fcfa: marketRef, materials: tierResults })
}

function buildFallbackTier(name: string, category: string, tier: 'economique' | 'standard' | 'premium') {
  const bases: Record<string, number> = {
    'Plomberie': 2000, 'Électricité': 3000, 'Peinture': 2500,
    'Maçonnerie': 6000, 'Climatisation': 12000, 'Serrurerie': 3500, 'Carrelage': 8000,
  }
  const mult = { economique: 0.65, standard: 1.0, premium: 1.65 }
  const base = bases[category] || 3000
  return {
    name, tier, brand: tier === 'premium' ? 'Marque premium' : tier === 'economique' ? 'Sans marque' : 'Standard',
    price_market: Math.round(base * mult[tier]), photo_url: null,
  }
}
