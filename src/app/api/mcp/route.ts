import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { lookupItemOnJumia } from '@/lib/jumia-lookup'
import { SMIG_X2_HORAIRE } from '@/lib/pricing'

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
const TRANSPORT: Record<string, number> = {
  'Cocody': 1000, 'Plateau': 800, 'Adjamé': 900, 'Yopougon': 1500,
  'Abobo': 1800, 'Marcory': 1000, 'Treichville': 800, 'Koumassi': 1200,
  'Port-Bouët': 1400, 'Bingerville': 2000, 'Riviera': 1200,
  'Zone 4': 900, 'Deux-Plateaux': 1100, 'Angré': 1300,
}

// Vérification secret
function checkAuth(req: NextRequest): boolean {
  const secret = process.env.AFRIONE_SECRET
  if (!secret) return true
  const header = req.headers.get('authorization') || req.headers.get('x-afrione-secret')
  return header === `Bearer ${secret}` || header === secret
}

// ── Manifest MCP (GET) ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  return NextResponse.json({
    schema_version: 'v1',
    name_for_human: 'AfriOne Pricing',
    name_for_model: 'afrione_pricing',
    description_for_human: 'Calcule les prix des prestations artisanales à Abidjan (Jumia CI + base AfriOne)',
    description_for_model: 'Outils pour calculer le prix juste d\'une prestation artisanale à Abidjan : prix matériaux Jumia, taux horaire artisan, calcul final AfriOne.',
    auth: { type: 'service_http', authorization_type: 'bearer' },
    api: { type: 'openapi', url: `${req.nextUrl.origin}/api/mcp/openapi.json` },
    tools: [
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
        description: 'Récupère le taux horaire réel de l\'artisan. Appeler en premier.',
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
    ],
  })
}

// ── Exécution des outils MCP (POST) ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { tool, parameters } = body

  if (tool === 'search_material_price') {
    const { item, category, qty = 1 } = parameters

    const { data: cached } = await supabaseAdmin
      .from('price_materials').select('price_market, source, name')
      .ilike('name', `%${item}%`).limit(1).maybeSingle()

    if (cached) {
      return NextResponse.json({ item, qty, price_unit: cached.price_market, total: cached.price_market * qty, source: cached.source || 'Base AfriOne' })
    }

    const jumia = await lookupItemOnJumia(item, category)
    if (jumia.found && jumia.price) {
      return NextResponse.json({ item, qty, price_unit: jumia.price, total: jumia.price * qty, source: 'Jumia CI', product_name: jumia.name })
    }

    const fallback = FALLBACK_MAT[category] || 1500
    return NextResponse.json({ item, qty, price_unit: fallback, total: fallback * qty, source: 'Estimation marché Abidjan' })
  }

  if (tool === 'get_artisan_rate') {
    const { metier, artisan_id } = parameters

    if (artisan_id) {
      const { data } = await supabaseAdmin.from('artisan_pros')
        .select('tarif_min, years_experience').eq('id', artisan_id).maybeSingle()
      if (data?.tarif_min && data.tarif_min >= SMIG_X2_HORAIRE) {
        return NextResponse.json({ rate: data.tarif_min, years_exp: data.years_experience ?? 3, source: 'Déclaré par l\'artisan', smig_floor: SMIG_X2_HORAIRE })
      }
    }

    const { data: labor } = await supabaseAdmin.from('labor_rates')
      .select('tarif_horaire').eq('metier', metier).maybeSingle()
    const rate = Math.max(labor?.tarif_horaire || FALLBACK_RATES[metier] || 3000, SMIG_X2_HORAIRE)
    return NextResponse.json({ rate, source: labor ? 'Référence AfriOne' : 'Référence marché', smig_floor: SMIG_X2_HORAIRE })
  }

  if (tool === 'calculate_final_price') {
    const { hours, hourly_rate, materials_total, urgency = 'medium', quartier = 'Cocody' } = parameters
    const degressif   = hours <= 2 ? 1.0 : hours <= 4 ? 0.85 : hours <= 8 ? 0.70 : 0.60
    const labor_base  = Math.round(hourly_rate * hours * degressif)
    const urgency_pct = urgency === 'emergency' ? 0.40 : urgency === 'high' ? 0.25 : 0
    const labor_final = Math.round(labor_base * (1 + urgency_pct))
    const transport   = TRANSPORT[quartier] || 1000
    const subtotal    = labor_final + (materials_total || 0) + transport
    const commission  = Math.round(subtotal * 0.10)
    const assurance   = Math.round(subtotal * 0.02)
    const total       = subtotal + commission + assurance

    return NextResponse.json({
      breakdown: { main_oeuvre: labor_final, materiaux: materials_total || 0, transport, commission_afrione: commission, assurance_sav: assurance },
      total,
      fourchette:      { min: Math.round(total * 0.92), max: Math.round(total * 1.08) },
      artisan_percoit: Math.round(total * 0.88),
    })
  }

  return NextResponse.json({ error: 'Outil inconnu' }, { status: 400 })
}
