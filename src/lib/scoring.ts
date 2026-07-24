export const QUARTIER_COORDS: Record<string, [number, number]> = {
  'Cocody':      [5.3600, -3.9910],
  'Plateau':     [5.3190, -4.0200],
  'Marcory':     [5.3000, -4.0050],
  'Treichville': [5.3050, -4.0100],
  'Yopougon':    [5.3450, -4.0700],
  'Adjamé':      [5.3550, -4.0300],
  'Abobo':       [5.4150, -4.0000],
  'Port-Bouët':  [5.2550, -3.9400],
  'Koumassi':    [5.2950, -3.9800],
}

const ABIDJAN_CENTER: [number, number] = [5.3600, -4.0083]

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Composite Uber-style artisan score — 0 to 100.
 *
 * Weights:
 *   40 pts — rating_avg       (0–5 → 0–40)
 *   20 pts — proximity        (0 km=20, ≥10 km=0, linear)
 *   25 pts — profile strength (years_experience + certifications + portfolio)
 *   10 pts — mission_count    (0 missions=0, ≥100 missions=10, linear)
 *    5 pts — response speed   (≤15 min=5, ≥60 min=0, linear)
 *
 * Profile strength ensures new artisans with verified credentials and a
 * portfolio are visible even before accumulating reviews and missions.
 * Fields sourced from: register (years_experience), dashboard profile
 * (specialties, certifications), and portfolio upload (portfolio[]).
 */
export function scoreArtisan(
  artisan: {
    rating_avg?: number | null
    rating_count?: number | null
    mission_count?: number | null
    response_time_min?: number | null
    years_experience?: number | null
    specialties?: string[] | null
    certifications?: string[] | null
    portfolio?: string[] | null
    users?: { quartier?: string | null } | null
  },
  missionQuartier: string,
): number {
  // ── Rating — 40 pts ──────────────────────────────────────────────────────
  const rating = Math.min(5, Math.max(0, artisan.rating_avg ?? 0))
  const ratingPts = (rating / 5) * 40

  // ── Proximity — 20 pts ───────────────────────────────────────────────────
  const artisanQuartier = artisan.users?.quartier ?? ''
  const [aLat, aLng] = QUARTIER_COORDS[artisanQuartier] ?? ABIDJAN_CENTER
  const [mLat, mLng] = QUARTIER_COORDS[missionQuartier] ?? ABIDJAN_CENTER
  const distKm = haversineKm(aLat, aLng, mLat, mLng)
  const proximityPts = Math.max(0, 20 - (distKm / 10) * 20)

  // ── Profile strength — 25 pts ────────────────────────────────────────────
  // years_experience → 0–15 pts (capped at 20 years)
  const years = Math.min(20, Math.max(0, artisan.years_experience ?? 0))
  const yearsPts = (years / 20) * 15

  // certifications[] → 0–5 pts (0=0, 1=2, 2=4, 3+=5)
  const certCount = artisan.certifications?.length ?? 0
  const certPts = certCount === 0 ? 0 : certCount === 1 ? 2 : certCount === 2 ? 4 : 5

  // portfolio[] → 0–5 pts (0=0, 1-2=2, 3-4=4, 5+=5)
  const portCount = artisan.portfolio?.length ?? 0
  const portPts = portCount === 0 ? 0 : portCount <= 2 ? 2 : portCount <= 4 ? 4 : 5

  const profilePts = yearsPts + certPts + portPts

  // ── Mission count — 10 pts ───────────────────────────────────────────────
  const missions = Math.min(100, Math.max(0, artisan.mission_count ?? 0))
  const missionPts = (missions / 100) * 10

  // ── Response speed — 5 pts (lower is better) ─────────────────────────────
  const responseMin = Math.max(0, artisan.response_time_min ?? 60)
  const speedPts = responseMin <= 15
    ? 5
    : responseMin >= 60
      ? 0
      : ((60 - responseMin) / 45) * 5

  return ratingPts + proximityPts + profilePts + missionPts + speedPts
}
