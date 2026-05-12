import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  runMonteCarlo, computeDistance, CATEGORY_TO_METIER,
  diagnosticAlpha,
  type PricingInput, type MaterialInput,
} from '@/lib/pricing'

// Fallbacks quand Supabase ne renvoie rien
const FALLBACK_LABOR: Record<string, { tarif_horaire: number; majoration_urgence: number }> = {
  'Plombier':    { tarif_horaire: 3000, majoration_urgence: 50 },
  'Électricien': { tarif_horaire: 3500, majoration_urgence: 50 },
  'Peintre':     { tarif_horaire: 2500, majoration_urgence: 40 },
  'Maçon':       { tarif_horaire: 2800, majoration_urgence: 45 },
  'Menuisier':   { tarif_horaire: 3000, majoration_urgence: 45 },
  'Climaticien': { tarif_horaire: 4000, majoration_urgence: 60 },
  'Serrurier':   { tarif_horaire: 3000, majoration_urgence: 50 },
  'Carreleur':   { tarif_horaire: 2800, majoration_urgence: 40 },
}
const FALLBACK_FEE       = { commission_pct: 10, assurance_sav_pct: 2, artisan_share_pct: 88 }
const FALLBACK_URGENCY   = { commission_pct: 12, assurance_sav_pct: 3, artisan_share_pct: 85 }
// Fallback matériaux quand ni Jumia ni DB ne trouvent l'item
// [price_market, price_min, price_max] en FCFA — estimation marché local Abidjan
// Ces valeurs sont volontairement conservatrices (bas) pour rester accessible
// À remplacer par de vraies données via l'admin dès que possible
const FALLBACK_MATERIAL: Record<string, [number, number, number]> = {
  'Plomberie':    [800,  300,  3000], // joint, siphon, petit raccord
  'Électricité':  [1000, 400,  4000], // fil, interrupteur, prise
  'Peinture':     [1500, 800,  5000], // rouleau, petit pot peinture
  'Maçonnerie':   [2000, 800,  6000], // enduit, mortier, vis
  'Carrelage':    [2500, 1000, 8000], // colle, joint, baguette
  'Climatisation':[3000, 1500, 10000],// filtre, courroie, gaz
  'Menuiserie':   [1500, 500,  5000], // charnière, vis, poignée
  'Serrurerie':   [1500, 500,  4000], // barillet, pêne, clé
}

function parseDuration(s: string): number {
  if (!s) return 2
  const lower = s.toLowerCase()
  // "30 minutes", "45 min", "1h30" → convertir en heures
  const minMatch = lower.match(/(\d+)\s*min/)
  if (minMatch && !lower.includes('heure') && !lower.match(/\d+\s*h(?:eure)?s?\s+\d+/)) {
    return Math.max(0.25, parseInt(minMatch[1]) / 60)
  }
  // "1h30", "1h 30min"
  const hMinMatch = lower.match(/(\d+)\s*h(?:eure)?s?\s*(\d+)/)
  if (hMinMatch) return parseInt(hMinMatch[1]) + parseInt(hMinMatch[2]) / 60
  // "1 à 3 heures", "2 à 4 heures" → prendre la borne basse (on veut être pas cher)
  const rangeMatch = lower.match(/(\d+(?:\.\d+)?)\s*[àa-]\s*(\d+(?:\.\d+)?)/)
  if (rangeMatch) return parseFloat(rangeMatch[1])
  const nums = s.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
  return nums.length ? nums[0] : 2
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    metier: rawMetier, category, urgency = 'medium',
    duration_hours, duration_estimate,
    quartier = 'Cocody', items_needed = [],
    artisan_id, diagnostic_id, hour_override,
    surface_m2, budget_client,
  } = body

  // Auto-enrichissement depuis le diagnostic si fourni
  // items_needed peut être [{name, qty, unit}] ou ["string"]
  let resolvedItems: { name: string; qty: number; unit: string }[] =
    (items_needed as any[]).map((it: any) =>
      typeof it === 'string' ? { name: it, qty: 1, unit: 'unité' } : it
    )
  let resolvedDuration  = duration_hours ?? (duration_estimate ? parseDuration(duration_estimate) : 2)
  let resolvedCategory  = category
  let resolvedUrgency   = urgency

  if (diagnostic_id) {
    const { data: diag } = await supabaseAdmin
      .from('diagnostics').select('*').eq('id', diagnostic_id).maybeSingle()
    if (diag) {
      resolvedItems    = diag.items_needed?.length ? diag.items_needed : resolvedItems
      resolvedCategory = diag.category_detected || resolvedCategory
      resolvedUrgency  = diag.urgency_level     || resolvedUrgency
      if (!duration_hours) {
        try {
          const raw = JSON.parse(diag.raw_text || '{}')
          if (raw.duration_estimate) resolvedDuration = parseDuration(raw.duration_estimate)
        } catch {}
      }
    }
  }

  const metier = rawMetier || CATEGORY_TO_METIER[resolvedCategory] || 'Maçon'

  // ── Données marché depuis Supabase ────────────────────────────────────────
  const [laborRes, feeRes, artisanRes, quotRes] = await Promise.allSettled([
    supabaseAdmin.from('labor_rates').select('*').eq('metier', metier).maybeSingle(),
    supabaseAdmin.from('service_fees').select('*')
      .eq('category', ['high','emergency'].includes(resolvedUrgency) ? 'urgence' : 'default').maybeSingle(),
    artisan_id
      ? supabaseAdmin.from('artisan_pros').select('zone_gps,years_experience,tarif_min').eq('id', artisan_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('quotations').select('total_price').eq('status', 'accepted').limit(200).order('created_at', { ascending: false }),
  ])

  const laborRate = (laborRes.status === 'fulfilled' && laborRes.value.data)
    ? laborRes.value.data as { tarif_horaire: number; majoration_urgence: number }
    : FALLBACK_LABOR[metier] ?? { tarif_horaire: 3000, majoration_urgence: 50 }

  const serviceFee = (feeRes.status === 'fulfilled' && feeRes.value.data)
    ? feeRes.value.data as { commission_pct: number; assurance_sav_pct: number; artisan_share_pct: number }
    : ['high','emergency'].includes(resolvedUrgency) ? FALLBACK_URGENCY : FALLBACK_FEE

  const artisan = artisanRes.status === 'fulfilled' ? (artisanRes as any).value?.data : null
  const yearsExp = artisan?.years_experience ?? 3
  const distanceKm = computeDistance(artisan?.zone_gps ?? null, quartier)

  // ── Tarif déclaré artisan + interpolation SMIG×2 ──────────────────────────
  // artisan_pros.tarif_min = ce que l'artisan a inscrit (considéré exagéré)
  // α = intensité du diagnostic → positionne le prix entre SMIG×2 et tarif déclaré
  const artisanDeclaredRate: number | undefined = artisan?.tarif_min ?? undefined
  const alpha = diagnosticAlpha(resolvedUrgency, resolvedItems.length, resolvedDuration)

  // Matériaux — cherche dans price_materials avec qty réelle du diagnostic
  const materials: MaterialInput[] = []
  if (resolvedItems.length > 0) {
    await Promise.all(resolvedItems.slice(0, 10).map(async (item) => {
      const { data } = await supabaseAdmin
        .from('price_materials').select('*').ilike('name', `%${item.name}%`).limit(1).maybeSingle()
      const qty = item.qty || 1
      if (data) {
        materials.push({ price_market: data.price_market, price_min: data.price_min, price_max: data.price_max, qty, category: data.category })
      } else {
        const [mid, lo, hi] = FALLBACK_MATERIAL[resolvedCategory] ?? [800, 300, 3000]
        materials.push({ price_market: mid, price_min: lo, price_max: hi, qty, category: resolvedCategory })
      }
    }))
  }

  // Residuals historiques pour conformal prediction
  let historicalResiduals: number[] | undefined
  if (quotRes.status === 'fulfilled' && quotRes.value.data && quotRes.value.data.length >= 30) {
    const prices = quotRes.value.data.map((r: any) => r.total_price as number)
    const med    = prices.slice().sort((a, b) => a - b)[Math.floor(prices.length / 2)]
    historicalResiduals = med > 0 ? prices.map(p => (p - med) / med) : undefined
  }

  const hour = hour_override ?? new Date().getHours()

  const input: PricingInput = {
    laborRate, artisanDeclaredRate, alpha,
    durationHours: resolvedDuration, yearsExp,
    materials, distanceKm, hour, quartier: quartier,
    urgency: resolvedUrgency, serviceFee, historicalResiduals,
  }

  let result = runMonteCarlo(input)

  // ── Contrainte : prix final < prix marché traditionnel ───────────────────
  const { data: refData } = await supabaseAdmin
    .from('market_reference_prices')
    .select('reference_price_fcfa')
    .eq('category', resolvedCategory)
    .maybeSingle()

  const marketRef = refData?.reference_price_fcfa ?? null
  let savings = 0
  let belowMarket = false

  if (marketRef && result.estimate >= marketRef) {
    // Réduire la commission pour rester sous le marché (min 5%)
    const targetPrice = Math.round(marketRef * 0.95) // 5% sous le marché
    const reducedFee  = { ...serviceFee }
    // On réduit commission jusqu'à 5% minimum
    const excess      = result.estimate - targetPrice
    const feeReduction = Math.min(Math.round(excess / result.estimate * 100), serviceFee.commission_pct - 5)
    reducedFee.commission_pct = serviceFee.commission_pct - feeReduction
    reducedFee.artisan_share_pct = 100 - reducedFee.commission_pct - serviceFee.assurance_sav_pct
    result = runMonteCarlo({ ...input, serviceFee: reducedFee })
  }

  if (marketRef) {
    savings     = Math.max(0, marketRef - result.estimate)
    belowMarket = result.estimate < marketRef
  }

  const explanation = buildExplanation(result, resolvedCategory, quartier, distanceKm, hour, resolvedUrgency)

  return NextResponse.json({
    ...result,
    explanation_human: explanation,
    market_reference_fcfa: marketRef,
    savings_vs_market:     savings,
    below_market:          belowMarket,
  })
}

function buildExplanation(
  r: ReturnType<typeof runMonteCarlo>,
  category: string, quartier: string,
  distKm: number, hour: int, urgency: string,
): string {
  const d = r.decomposition, u = r.uncertainty_breakdown
  const slot = hour < 6 ? 'nuit' : hour < 9 ? 'pointe matin' : hour < 16 ? 'journée' : hour < 20 ? 'pointe soir' : 'nuit'
  const parts = [
    `${category} à ${quartier} : ${r.interval.low.toLocaleString('fr')} – ${r.interval.high.toLocaleString('fr')} FCFA (IC 95%).`,
    `Médiane MC : ${r.estimate.toLocaleString('fr')} FCFA.`,
    `MO ${d.labor.pct}% | Mat. ${d.materials.pct}% | Transport ${d.transport.pct}% | Commission ${d.premium.pct}%.`,
    `Distance ${distKm.toFixed(1)} km (${slot}).`,
    `Incertitude dominante : ${u.dominant_source} (CV=${(u as any)[u.dominant_source + '_cv']?.toFixed(2)}).`,
    `Artisan perçoit : ${r.artisan_share.toLocaleString('fr')} FCFA.`,
  ]
  if (['high','emergency'].includes(urgency)) parts.push("Majoration urgence sur MO.")
  return parts.join(' ')
}

// TypeScript ne connaît pas `int` — alias
type int = number
