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
 *   50 pts — rating_avg    (0–5 → 0–50)
 *   25 pts — proximity     (0 km=25, ≥10 km=0, linear)
 *   15 pts — mission_count (0 missions=0, ≥100 missions=15, linear)
 *   10 pts — response speed (≤15 min=10, ≥60 min=0, linear)
 */
export function scoreArtisan(
  artisan: {
    rating_avg?: number | null
    mission_count?: number | null
    response_time_min?: number | null
    users?: { quartier?: string | null } | null
  },
  missionQuartier: string,
): number {
  // Rating — 50 pts
  const rating = Math.min(5, Math.max(0, artisan.rating_avg ?? 0))
  const ratingPts = (rating / 5) * 50

  // Proximity — 25 pts
  const artisanQuartier = artisan.users?.quartier ?? ''
  const [aLat, aLng] = QUARTIER_COORDS[artisanQuartier] ?? ABIDJAN_CENTER
  const [mLat, mLng] = QUARTIER_COORDS[missionQuartier] ?? ABIDJAN_CENTER
  const distKm = haversineKm(aLat, aLng, mLat, mLng)
  const proximityPts = Math.max(0, 25 - (distKm / 10) * 25)

  // Completion volume — 15 pts
  const missions = Math.min(100, Math.max(0, artisan.mission_count ?? 0))
  const missionPts = (missions / 100) * 15

  // Response speed — 10 pts (lower is better)
  const responseMin = Math.max(0, artisan.response_time_min ?? 60)
  const speedPts = responseMin <= 15
    ? 10
    : responseMin >= 60
      ? 0
      : ((60 - responseMin) / 45) * 10

  return ratingPts + proximityPts + missionPts + speedPts
}
