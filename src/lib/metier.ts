/**
 * Taxonomie unique des métiers AfriOne. `artisan_pros.metier` doit toujours
 * contenir une de ces 8 valeurs canoniques (format catégorie, identique à
 * `missions.category`) — c'est le format écrit par la page d'inscription
 * artisan (/artisan-space/register).
 *
 * Historiquement, des scripts de seed ont écrit le nom du métier ("Plombier")
 * au lieu de la catégorie ("Plomberie"), rendant le matching dispatch
 * incohérent — normalizeMetier() absorbe ces variantes pour l'affichage et
 * le matching, mais toute nouvelle écriture doit utiliser CANONICAL_METIERS.
 */

export type CanonicalMetier =
  | 'Plomberie' | 'Électricité' | 'Peinture' | 'Maçonnerie'
  | 'Menuiserie' | 'Climatisation' | 'Serrurerie' | 'Carrelage'
  | 'Chauffeur' | 'Ménage' | 'Cuisine' | 'Coiffure'

export const CANONICAL_METIERS: { id: CanonicalMetier; label: string }[] = [
  { id: 'Plomberie',     label: 'Plomberie' },
  { id: 'Électricité',   label: 'Électricité' },
  { id: 'Maçonnerie',    label: 'Maçonnerie' },
  { id: 'Peinture',      label: 'Peinture' },
  { id: 'Menuiserie',    label: 'Menuiserie' },
  { id: 'Climatisation', label: 'Climatisation' },
  { id: 'Serrurerie',    label: 'Serrurerie' },
  { id: 'Carrelage',     label: 'Carrelage' },
  { id: 'Chauffeur', label: 'Chauffeur' },
  { id: 'Ménage', label: 'Aide ménagère' },
  { id: 'Cuisine', label: 'Cuisinier' },
  { id: 'Coiffure', label: 'Coiffure' },
]

// Variantes connues (nom du métier, fautes de frappe passées) → catégorie canonique.
// Alimenté par les valeurs trouvées en base le 2026-07-28 (seeds historiques).
const ALIASES: Record<string, CanonicalMetier> = {
  'frigoriste': 'Climatisation',
  'aide ménagère': 'Ménage',
  'cuisinier': 'Cuisine',
  'coiffeuse': 'Coiffure',
  'coiffeur': 'Coiffure',
  'plombier':      'Plomberie',
  'électricien':   'Électricité',
  'electricien':   'Électricité',
  'peintre':       'Peinture',
  'maçon':         'Maçonnerie',
  'macon':         'Maçonnerie',
  'menuisier':     'Menuiserie',
  'climaticien':   'Climatisation',
  'climatiseur':   'Climatisation', // faute de frappe historique (scripts legacy)
  'serrurier':     'Serrurerie',
  'carreleur':     'Carrelage',
}

/**
 * Repli sans accents ni casse : « Electricite », « ELECTRICITÉ », « maconnerie »
 * désignent tous « Électricité » / « Maçonnerie ».
 *
 * Les accents se perdent partout — saisie clavier, sortie du diagnostic IA,
 * imports manuels. `price_materials` contenait ainsi 155 articles en
 * « Électricité » et 6 en « Electricite », deux catégories distinctes pour la
 * requête `.eq('category', …)` de /api/materials : une mission taguée sans
 * accent ne voyait que 6 matériaux au lieu de 161.
 */
const sansAccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Normalise n'importe quelle valeur historique de `metier` vers la catégorie canonique. */
export function normalizeMetier(raw: string | null | undefined): CanonicalMetier | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const exact = CANONICAL_METIERS.find(m => m.id === trimmed)
  if (exact) return exact.id
  const alias = ALIASES[trimmed.toLowerCase()]
  if (alias) return alias

  // Dernier recours : comparaison désaccentuée, sur les canoniques puis les alias.
  const nu = sansAccent(trimmed)
  const parCanonique = CANONICAL_METIERS.find(m => sansAccent(m.id) === nu)
  if (parCanonique) return parCanonique.id
  const cleAlias = Object.keys(ALIASES).find(k => sansAccent(k) === nu)
  return cleAlias ? ALIASES[cleAlias] : null
}

/** Icône + libellé propre pour l'affichage (admin, fiches artisan), quelle que soit la valeur brute stockée. */
export function metierDisplay(raw: string | null | undefined): { label: string; canonical: boolean } {
  const norm = normalizeMetier(raw)
  if (norm) {
    const m = CANONICAL_METIERS.find(x => x.id === norm)!
    return { label: m.label, canonical: raw?.trim() === norm }
  }
  return { label: raw || '—', canonical: false }
}
