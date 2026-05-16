/**
 * Tarifs transport moto-taxi (zem) Abidjan
 * Base : 500 FCFA/km (moitié du tarif taxi voiture Numbeo = 1 000 FCFA/km)
 * Distances calculées depuis le centre (Plateau)
 */
export const TRANSPORT_ABIDJAN: Record<string, number> = {
  'Plateau':        300,   // 0 km  — centre
  'Treichville':    800,   // ~2 km
  'Adjamé':         1200,  // ~3 km
  'Marcory':        1500,  // ~3 km
  'Zone 4':         1500,  // ~3 km
  'Cocody':         2500,  // ~5 km
  'Koumassi':       3000,  // ~6 km
  'Riviera':        3500,  // ~7 km
  'Deux-Plateaux':  4000,  // ~8 km
  'Angré':          4500,  // ~9 km
  'Port-Bouët':     5000,  // ~10 km
  'Yopougon':       6000,  // ~12 km
  'Abobo':          7000,  // ~14 km
  'Bingerville':    9000,  // ~18 km
}

export function getTransport(quartier: string): number {
  return TRANSPORT_ABIDJAN[quartier] ?? 2000
}
