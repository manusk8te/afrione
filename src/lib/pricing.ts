/**
 * AfriOne Pricing Engine v3.0 — TypeScript (Monte Carlo pur JS)
 * Pas de dépendance Python. Tourne directement dans Next.js.
 */

const N = 10_000

// ── RNG (Xorshift32) ─────────────────────────────────────────────────────────

function makePRNG(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 0x100000000
  }
}

// ── Normal (Box-Muller) ───────────────────────────────────────────────────────

function normalSamples(rng: () => number, n: number): Float64Array {
  const out = new Float64Array(n)
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(rng(), 1e-12)
    const mag = Math.sqrt(-2 * Math.log(u1))
    out[i]     = mag * Math.cos(2 * Math.PI * rng())
    if (i + 1 < n) out[i + 1] = mag * Math.sin(2 * Math.PI * rng())
  }
  return out
}

// ── Gamma (Marsaglia-Tsang) ───────────────────────────────────────────────────

function gammaSamples(rng: () => number, shape: number, scale: number, n: number): Float64Array {
  const out  = new Float64Array(n)
  const a    = shape >= 1 ? shape : shape + 1
  const d    = a - 1 / 3
  const c    = 1 / Math.sqrt(9 * d)

  for (let i = 0; i < n; i++) {
    let sample = 0
    while (true) {
      const x    = normalSamples(rng, 1)[0]
      const vRaw = 1 + c * x
      if (vRaw <= 0) continue
      const v = vRaw * vRaw * vRaw
      const u = rng()
      const x2 = x * x
      if (u < 1 - 0.0331 * x2 * x2) { sample = d * v; break }
      if (Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) { sample = d * v; break }
    }
    if (shape < 1) sample *= Math.pow(Math.max(rng(), 1e-12), 1 / shape)
    out[i] = sample * scale
  }
  return out
}

// ── Normal CDF / inverse CDF ──────────────────────────────────────────────────

function normCDF(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x / 2)
  return x >= 0 ? y : 1 - y
}

function normPPF(p: number): number {
  p = Math.max(1e-10, Math.min(1 - 1e-10, p))
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pLow = 0.02425, pHigh = 1 - pLow
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
  }
  if (p <= pHigh) {
    const q = p - 0.5, r = q * q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
  }
  const q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
}

// ── Cholesky ──────────────────────────────────────────────────────────────────

function cholesky(A: number[][]): number[][] {
  const n = A.length
  const L = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0
      for (let k = 0; k < j; k++) s += L[i][k] * L[j][k]
      L[i][j] = i === j ? Math.sqrt(Math.max(A[i][i] - s, 1e-10)) : (A[i][j] - s) / L[j][j]
    }
  }
  return L
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

function arrMean(a: Float64Array): number {
  let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length
}
function arrStd(a: Float64Array): number {
  const m = arrMean(a); let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2
  return Math.sqrt(s / a.length)
}
function quantile(a: Float64Array, p: number): number {
  const sorted = a.slice().sort()
  const idx = p * (sorted.length - 1)
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo])
}

// ── Trafic Abidjan ────────────────────────────────────────────────────────────

const QUARTIER_GPS: Record<string, [number, number]> = {
  Adjamé: [5.3667, -4.0167], Plateau: [5.3167, -4.0167], Cocody: [5.3467, -3.9894],
  Treichville: [5.3, -4.0], Marcory: [5.2833, -3.9833], Yopougon: [5.35, -4.0667],
  Abobo: [5.4167, -4.0333], Koumassi: [5.2833, -3.95], 'Port-Bouët': [5.25, -3.9333],
  Bingerville: [5.3667, -3.9], Riviera: [5.37, -3.95], 'Deux-Plateaux': [5.38, -3.97],
  'Zone 4': [5.295, -3.975], Angré: [5.39, -3.95],
}
const TRAFFIC: Record<string, number[]> = {
  // [morning_rush, daytime, evening_rush, night]
  Adjamé: [2.8, 1.5, 3.0, 0.8], Plateau: [2.5, 1.6, 2.8, 0.7], Yopougon: [3.2, 1.4, 3.0, 0.9],
  Abobo: [3.5, 1.6, 3.2, 1.0], Cocody: [2.2, 1.3, 2.5, 0.7], Treichville: [2.0, 1.4, 2.2, 0.8],
  Marcory: [1.8, 1.2, 2.0, 0.7], Koumassi: [2.0, 1.3, 2.2, 0.8], 'Port-Bouët': [1.5, 1.1, 1.8, 0.7],
  Bingerville: [1.8, 1.2, 2.0, 0.7], Riviera: [2.3, 1.3, 2.5, 0.7], 'Deux-Plateaux': [2.0, 1.3, 2.2, 0.7],
  'Zone 4': [2.2, 1.4, 2.5, 0.8], Angré: [2.3, 1.3, 2.3, 0.8],
}
function trafficCoeff(quartier: string, hour: number): number {
  const slot = hour < 6 ? 3 : hour < 9 ? 0 : hour < 16 ? 1 : hour < 20 ? 2 : 3
  return (TRAFFIC[quartier] ?? [2.0, 1.3, 2.2, 0.8])[slot]
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dlat = ((lat2 - lat1) * Math.PI) / 180
  const dlon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dlat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dlon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MaterialInput { price_market: number; price_min: number; price_max: number; qty: number; category: string }
export interface PricingInput {
  laborRate: { tarif_horaire: number; majoration_urgence: number }
  durationHours: number
  yearsExp: number
  materials: MaterialInput[]
  distanceKm: number
  hour: number
  quartier: string
  urgency: string
  serviceFee: { commission_pct: number; assurance_sav_pct: number; artisan_share_pct: number }
  historicalResiduals?: number[]
}

export interface PricingResult {
  estimate: number
  interval: { low: number; high: number; coverage: number }
  decomposition: { labor: C; materials: C; transport: C; premium: C }
  uncertainty_breakdown: { labor_cv: number; materials_cv: number; transport_cv: number; dominant_source: string }
  quantiles: { q025: number; q50: number; q975: number }
  simulations: number
  distance_km: number
  artisan_share: number
}
interface C { median: number; std: number; pct: number }

// ── Engine ────────────────────────────────────────────────────────────────────

export function runMonteCarlo(input: PricingInput): PricingResult {
  const rng = makePRNG((Date.now() * Math.random() * 0xffffff) | 0)

  // ── 1. Labor (Gamma) ──────────────────────────────────────────────────────
  const urgencyMark = ['high', 'emergency'].includes(input.urgency)
    ? input.laborRate.majoration_urgence / 100 : 0
  const baseLabor   = input.laborRate.tarif_horaire * input.durationHours * (1 + urgencyMark)
  const shapeL      = Math.max(2.0, input.yearsExp * 0.35 + 2.0)
  const laborS      = gammaSamples(rng, shapeL, baseLabor / shapeL, N)

  // ── 2. Materials (Log-normal + Gaussian Copula) ───────────────────────────
  let materialS = new Float64Array(N)
  if (input.materials.length > 0) {
    const mats = input.materials
    const n    = mats.length
    const mus: number[] = [], sigmas: number[] = [], cats: string[] = []

    for (const m of mats) {
      const qty = m.qty || 1
      const pMid = m.price_market * qty, pMin = m.price_min * qty, pMax = m.price_max * qty
      const sigma = Math.max(Math.log(pMax / Math.max(pMin, 1)) / 4, 0.05)
      mus.push(Math.log(Math.max(pMid, 1)) - sigma * sigma / 2)
      sigmas.push(sigma)
      cats.push(m.category)
    }

    const corr = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => i === j ? 1 : cats[i] === cats[j] ? 0.7 : 0.3)
    )
    const L = cholesky(corr)

    // n independent normal matrices → correlated via L
    const indep = Array.from({ length: n }, () => normalSamples(rng, N))
    const corrZ = Array.from({ length: n }, () => new Float64Array(N))
    for (let s = 0; s < N; s++) {
      for (let i = 0; i < n; i++) {
        let v = 0
        for (let j = 0; j <= i; j++) v += L[i][j] * indep[j][s]
        corrZ[i][s] = v
      }
    }
    // CDF → inverse lognormal
    for (let i = 0; i < n; i++) {
      for (let s = 0; s < N; s++) {
        const u = Math.max(1e-6, Math.min(1 - 1e-6, normCDF(corrZ[i][s])))
        materialS[s] += Math.exp(mus[i] + sigmas[i] * normPPF(u))
      }
    }
  }

  // ── 3. Transport (d^1.3 physique) ─────────────────────────────────────────
  const tc       = trafficCoeff(input.quartier, input.hour)
  const baseCost = Math.max(600 * Math.pow(input.distanceKm, 1.3) * tc, 500)
  const sigTr    = 0.20
  const transportS = normalSamples(rng, N)
  for (let i = 0; i < N; i++) {
    transportS[i] = Math.exp(Math.log(baseCost) - sigTr * sigTr / 2 + sigTr * transportS[i])
  }

  // ── 4. Premium ────────────────────────────────────────────────────────────
  const feeRate  = (input.serviceFee.commission_pct + input.serviceFee.assurance_sav_pct) / 100
  const premiumS = new Float64Array(N)
  const totalS   = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    const sub   = laborS[i] + materialS[i] + transportS[i]
    premiumS[i] = sub * feeRate
    totalS[i]   = sub + premiumS[i]
  }

  // ── 5. Quantiles ──────────────────────────────────────────────────────────
  const q025 = Math.round(quantile(totalS, 0.025))
  const q50  = Math.round(quantile(totalS, 0.500))
  const q975 = Math.round(quantile(totalS, 0.975))

  // ── 6. Conformal (split-conformal si données historiques) ─────────────────
  let confLow = q025, confHigh = q975
  if (input.historicalResiduals && input.historicalResiduals.length >= 30) {
    const absRes = input.historicalResiduals.map(Math.abs).sort((a, b) => a - b)
    const qHat   = absRes[Math.ceil(0.95 * absRes.length) - 1]
    confLow  = Math.max(0, Math.round(q50 * (1 - qHat)))
    confHigh = Math.round(q50 * (1 + qHat))
  }

  // ── 7. Stats ──────────────────────────────────────────────────────────────
  const medTotal = Math.max(q50, 1)
  const comp = (s: Float64Array): C => {
    const med = Math.round(quantile(s, 0.5))
    return { median: med, std: Math.round(arrStd(s)), pct: Math.round(med / medTotal * 1000) / 10 }
  }
  const cv = (s: Float64Array) => arrStd(s) / Math.max(arrMean(s), 1)
  const cvs = { labor: cv(laborS), materials: cv(materialS), transport: cv(transportS) }
  const dominant = Object.entries(cvs).sort((a, b) => b[1] - a[1])[0][0]

  return {
    estimate:  q50,
    interval:  { low: confLow, high: confHigh, coverage: 0.95 },
    decomposition: {
      labor:     comp(laborS),
      materials: comp(materialS),
      transport: comp(transportS),
      premium:   comp(premiumS),
    },
    uncertainty_breakdown: {
      labor_cv:     Math.round(cvs.labor     * 1000) / 1000,
      materials_cv: Math.round(cvs.materials * 1000) / 1000,
      transport_cv: Math.round(cvs.transport * 1000) / 1000,
      dominant_source: dominant,
    },
    quantiles:    { q025, q50, q975 },
    simulations:  N,
    distance_km:  Math.round(input.distanceKm * 100) / 100,
    artisan_share: Math.round(q50 * (input.serviceFee.artisan_share_pct ?? 88) / 100),
  }
}

// ── Helpers publics ───────────────────────────────────────────────────────────

export function getQuartierGPS(quartier: string): [number, number] {
  return QUARTIER_GPS[quartier] ?? QUARTIER_GPS['Cocody']
}

export function computeDistance(
  artisanGPS: { lat: number; lng: number } | null,
  clientQuartier: string
): number {
  const [lat2, lng2] = getQuartierGPS(clientQuartier)
  if (!artisanGPS) return 5.0
  return haversine(artisanGPS.lat, artisanGPS.lng, lat2, lng2)
}

export const CATEGORY_TO_METIER: Record<string, string> = {
  'Plomberie':    'Plombier',
  'Électricité':  'Électricien',
  'Peinture':     'Peintre',
  'Maçonnerie':   'Maçon',
  'Menuiserie':   'Menuisier',
  'Climatisation':'Climaticien',
  'Serrurerie':   'Serrurier',
  'Carrelage':    'Carreleur',
}
