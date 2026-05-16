import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { lookupItemOnJumia } from '@/lib/jumia-lookup'

export const dynamic = 'force-dynamic'

const FALLBACK_MAT: Record<string, number> = {
  'Plomberie': 1500, 'Électricité': 1200, 'Peinture': 2000,
  'Maçonnerie': 2500, 'Menuiserie': 1800, 'Climatisation': 3500,
  'Serrurerie': 1500, 'Carrelage': 2800,
}

export async function POST(req: NextRequest) {
  const { item, category, qty = 1 } = await req.json()

  // 1. Base AfriOne d'abord
  const { data: cached } = await supabaseAdmin
    .from('price_materials')
    .select('price_market, source, name')
    .ilike('name', `%${item}%`)
    .limit(1)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({
      item, qty,
      price_unit: cached.price_market,
      total: cached.price_market * qty,
      source: cached.source || 'Base AfriOne',
      product_name: cached.name,
    })
  }

  // 2. Jumia CI live
  const jumia = await lookupItemOnJumia(item, category)
  if (jumia.found && jumia.price) {
    return NextResponse.json({
      item, qty,
      price_unit: jumia.price,
      total: jumia.price * qty,
      source: 'Jumia CI',
      product_name: jumia.name,
    })
  }

  // 3. Fallback
  const fallback = FALLBACK_MAT[category] || 1500
  return NextResponse.json({
    item, qty,
    price_unit: fallback,
    total: fallback * qty,
    source: 'Estimation marché Abidjan',
  })
}
