import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { lookupItemOnJumia } from '@/lib/jumia-lookup'
import { SMIG_X2_HORAIRE } from '@/lib/pricing'
import { getTransport } from '@/lib/transport'

export const dynamic = 'force-dynamic'

const FALLBACK_RATES: Record<string, number> = {
  'Plombier': 3200, 'Électricien': 3500, 'Peintre': 2500,
  'Maçon': 2800, 'Menuisier': 3000, 'Climaticien': 4500,
  'Serrurier': 3000, 'Carreleur': 2800,
}
const FALLBACK_MAT: Record<string, number> = {
  'Plomberie': 1500, 'Électricité': 1200, 'Peinture': 2000,
  'Maçonnerie': 2500, 'Menuiserie': 1800, 'Climatisation': 3500,
  'Serrurerie': 1500, 'Carrelage': 2800,
}

const TOOLS = [
  {
    name: 'search_material_price',
    description: 'Cherche le prix réel d\'un matériau sur Jumia CI et dans la base AfriOne.',
    inputSchema: {
      type: 'object',
      properties: {
        item:     { type: 'string',  description: 'Nom du matériau (ex: joint plomberie, câble 2.5mm)' },
        category: { type: 'string',  description: 'Catégorie métier (ex: Plomberie, Électricité)' },
        qty:      { type: 'number',  description: 'Quantité (défaut: 1)' },
      },
      required: ['item', 'category'],
    },
  },
  {
    name: 'get_artisan_rate',
    description: 'Récupère le taux horaire réel de l\'artisan depuis AfriOne. Appeler en premier.',
    inputSchema: {
      type: 'object',
      properties: {
        metier:     { type: 'string', description: 'Métier (ex: Plombier, Électricien, Maçon)' },
        artisan_id: { type: 'string', description: 'ID artisan si disponible' },
      },
      required: ['metier'],
    },
  },
  {
    name: 'calculate_final_price',
    description: 'Calcule le prix final AfriOne avec dégressivité longues tâches + commission 10% + assurance 2%.',
    inputSchema: {
      type: 'object',
      properties: {
        hours:           { type: 'number', description: 'Durée en heures' },
        hourly_rate:     { type: 'number', description: 'Taux horaire FCFA' },
        materials_total: { type: 'number', description: 'Total matériaux FCFA' },
        urgency:         { type: 'string', enum: ['low', 'medium', 'high', 'emergency'] },
        quartier:        { type: 'string', description: 'Quartier client Abidjan' },
      },
      required: ['hours', 'hourly_rate', 'materials_total'],
    },
  },
]

async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  if (name === 'search_material_price') {
    const { item, category, qty = 1 } = args
    const { data: cached } = await supabaseAdmin
      .from('price_materials').select('price_market, source, name')
      .ilike('name', `%${item}%`).limit(1).maybeSingle()
    if (cached) return { item, qty, price_unit: cached.price_market, total: cached.price_market * qty, source: cached.source || 'Base AfriOne' }
    const jumia = await lookupItemOnJumia(item, category)
    if (jumia.found && jumia.price) return { item, qty, price_unit: jumia.price, total: jumia.price * qty, source: 'Jumia CI' }
    const fallback = FALLBACK_MAT[category] || 1500
    return { item, qty, price_unit: fallback, total: fallback * qty, source: 'Estimation marché Abidjan' }
  }

  if (name === 'get_artisan_rate') {
    const { metier, artisan_id } = args
    if (artisan_id) {
      const { data } = await supabaseAdmin.from('artisan_pros')
        .select('tarif_min, years_experience').eq('id', artisan_id).maybeSingle()
      if (data?.tarif_min && data.tarif_min >= SMIG_X2_HORAIRE)
        return { rate: data.tarif_min, years_exp: data.years_experience ?? 3, source: 'Déclaré par l\'artisan', smig_floor: SMIG_X2_HORAIRE }
    }
    const { data: labor } = await supabaseAdmin.from('labor_rates')
      .select('tarif_horaire').eq('metier', metier).maybeSingle()
    const rate = Math.max(labor?.tarif_horaire || FALLBACK_RATES[metier] || 3000, SMIG_X2_HORAIRE)
    return { rate, source: labor ? 'Référence AfriOne' : 'Référence marché', smig_floor: SMIG_X2_HORAIRE }
  }

  if (name === 'calculate_final_price') {
    const { hours, hourly_rate, materials_total, urgency = 'medium', quartier = 'Cocody' } = args
    const degressif   = hours <= 2 ? 1.0 : hours <= 4 ? 0.85 : hours <= 8 ? 0.70 : 0.60
    const labor_final = Math.round(hourly_rate * hours * degressif * (1 + (urgency === 'emergency' ? 0.40 : urgency === 'high' ? 0.25 : 0)))
    const transport   = getTransport(quartier)
    const subtotal    = labor_final + (materials_total || 0) + transport
    const commission  = Math.round(subtotal * 0.10)
    const assurance   = Math.round(subtotal * 0.02)
    const total       = subtotal + commission + assurance
    return {
      breakdown: { main_oeuvre: labor_final, materiaux: materials_total || 0, transport, commission_afrione: commission, assurance_sav: assurance },
      total,
      fourchette:      { min: Math.round(total * 0.92), max: Math.round(total * 1.08) },
      artisan_percoit: Math.round(total * 0.88),
    }
  }

  throw new Error(`Outil inconnu: ${name}`)
}

// ── JSON-RPC 2.0 handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { jsonrpc, id, method, params } = body

  const ok = (result: any) => NextResponse.json({ jsonrpc: '2.0', id, result })
  const err = (code: number, message: string) =>
    NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })

  if (method === 'initialize') {
    return ok({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'AfriOne Pricing', version: '1.0.0' },
    })
  }

  if (method === 'notifications/initialized') {
    return NextResponse.json({}, { status: 200 })
  }

  if (method === 'tools/list') {
    return ok({ tools: TOOLS })
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params
    try {
      const result = await executeTool(name, args || {})
      return ok({ content: [{ type: 'text', text: JSON.stringify(result) }] })
    } catch (e: any) {
      return err(-32603, e.message)
    }
  }

  return err(-32601, `Méthode inconnue: ${method}`)
}

// GET pour vérifier que le serveur est en ligne
export async function GET() {
  return NextResponse.json({ status: 'ok', server: 'AfriOne MCP', tools: TOOLS.map(t => t.name) })
}
