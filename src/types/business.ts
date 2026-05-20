export const ARTISAN_LEVELS = {
  N1_MANOEUVRE: {
    label: 'Manœuvre / Aide',
    rate_per_hour: 800,
    examples: ['aide-plombier', 'manœuvre BTP', 'livraison'],
  },
  N2_COMPAGNON: {
    label: 'Compagnon qualifié',
    rate_per_hour: 1300,
    examples: ['plombier', 'électricien', 'peintre', 'maçon'],
  },
  N3_SPECIALISTE: {
    label: 'Spécialiste certifié',
    rate_per_hour: 2000,
    examples: ['climaticien', 'soudeur', 'carreleur expert'],
  },
  N4_EXPERT: {
    label: 'Expert / Master',
    rate_per_hour: 3000,
    examples: ['frigoriste industriel', 'expert diagnostic'],
  },
} as const

export type ArtisanLevel = keyof typeof ARTISAN_LEVELS

export const MISSION_MODES = {
  urgent:   { label: 'Urgent',    color: '#E85D26', description: 'Dispatch immédiat, prix fixé' },
  standard: { label: 'Standard',  color: '#2B6B3E', description: '3 artisans proposés, discussion' },
  libre:    { label: 'Libre',     color: '#C9A84C', description: 'Navigation directe sur le site' },
} as const

export type MissionMode = keyof typeof MISSION_MODES

export const SENSITIVITY_COEFS = {
  critique: { label: 'Critique',  coef: 2.0, color: '#ef4444' },
  urgent:   { label: 'Urgent',    coef: 1.5, color: '#E85D26' },
  gênant:   { label: 'Gênant',    coef: 1.2, color: '#C9A84C' },
  normal:   { label: 'Normal',    coef: 1.0, color: '#2B6B3E' },
} as const

export const TEMPORAL_COEFS = {
  express: { label: 'Express < 1h', coef: 1.4 },
  rapide:  { label: 'Rapide 2-3h',  coef: 1.2 },
  today:   { label: 'Aujourd\'hui', coef: 1.0 },
  demain:  { label: 'Demain',       coef: 0.9 },
} as const

export const TRANSPORT_ZONES = {
  zone1: { label: 'Zone 1 (< 3 km)',    fee: 2000 },
  zone2: { label: 'Zone 2 (3–7 km)',    fee: 3500 },
  zone3: { label: 'Zone 3 (7–15 km)',   fee: 5000 },
} as const

export const INSURANCE_AMOUNT = 500 // FCFA fixe
export const AFRIONE_FEE_PCT  = 0.20 // 20% sur main-d'œuvre + transport
