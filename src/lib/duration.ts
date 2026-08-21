/**
 * Lecture d'une durée écrite en français libre → heures de travail.
 *
 * `duration_estimate` sort du diagnostic IA sous forme de chaîne non
 * contrainte (`"duration_estimate": "string"` dans le schéma envoyé au
 * modèle). Elle peut donc valoir « 45 min », « 1h30 », « 1 à 3 heures »,
 * « 1 journée », « 2 semaines »…
 *
 * Trois copies divergentes de ce parseur coexistaient, et aucune ne
 * connaissait les semaines :
 *
 *   src/app/diagnostic/page.tsx   jours ×8, intervalle → moyenne
 *   src/app/warroom/[id]/page.tsx jours ×8, intervalle → borne basse
 *   src/app/api/pricing/route.ts  aucune gestion des jours du tout
 *
 * Conséquences : « 2 semaines » retombait sur le filet final et valait 2
 * heures — un chantier de deux semaines chiffré comme une intervention de
 * deux heures, soit ×40 sous-estimé. Et « 1 journée » valait 1 heure côté
 * /api/pricing, soit ×8.
 *
 * L'écart entre moyenne et borne basse, lui, est délibéré : le diagnostic
 * annonce une fourchette au client, le devis part du bas. Il est conservé,
 * mais nommé.
 */

/** Heures de travail par unité. Une journée de chantier = 8 h, une semaine = 5 j. */
const UNITES: Array<{ motif: RegExp; heures: number }> = [
  { motif: /mois/,            heures: 160 },
  { motif: /semaine/,         heures: 40 },
  { motif: /jour|journ[ée]e/, heures: 8 },
]

/** Multiplicateur induit par l'unité mentionnée. 1 si la durée est en heures. */
function multiplicateur(texte: string): number {
  return UNITES.find(u => u.motif.test(texte))?.heures ?? 1
}

export type BorneDuree = 'basse' | 'moyenne'

/**
 * @param texte  durée en toutes lettres, ex. « 1 à 3 heures »
 * @param borne  sur un intervalle : borne basse (devis) ou moyenne (estimation)
 * @returns      durée en heures ; 2 par défaut si illisible
 */
export function parseDuree(texte: string, borne: BorneDuree = 'basse'): number {
  if (!texte) return 2
  const bas = texte.toLowerCase()
  const mult = multiplicateur(bas)

  // « 45 min » seul — jamais quand des heures sont aussi mentionnées,
  // auquel cas c'est la partie minutes d'un « 1h30 ».
  const min = bas.match(/(\d+)\s*min/)
  if (min && !bas.includes('heure') && !bas.match(/\d+\s*h(?:eure)?s?\s+\d+/)) {
    return Math.max(0.25, parseInt(min[1]) / 60)
  }

  // « 1h30 », « 1 heure 30 »
  const hMin = bas.match(/(\d+)\s*h(?:eure)?s?\s*(\d+)/)
  if (hMin) return parseInt(hMin[1]) + parseInt(hMin[2]) / 60

  // « 1 à 3 heures », « 2-4 jours »
  const plage = bas.match(/(\d+(?:\.\d+)?)\s*[àa-]\s*(\d+(?:\.\d+)?)/)
  if (plage) {
    const basse = parseFloat(plage[1])
    const haute = parseFloat(plage[2])
    const val = borne === 'moyenne' ? (basse + haute) / 2 : basse
    return val * mult
  }

  const nombres = bas.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
  return (nombres.length ? nombres[0] : 2) * mult
}
