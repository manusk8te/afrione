/**
 * Règle d'admission au catalogue de prix.
 *
 * Un artisan peut déclarer un magasin et y ajouter des articles depuis son
 * espace (`/artisan-space/materiaux`). L'article partait **directement** dans
 * `price_materials`, le catalogue vivant : il chiffrait des devis avant qu'un
 * administrateur l'ait seulement vu. La validation existait pourtant — l'admin
 * pose `confirmed_at` depuis `/admin/sources` — mais aucune requête ne lisait
 * cette colonne. Elle n'affichait qu'un badge vert. L'interface annonçait un
 * contrôle qui n'existait pas côté données.
 *
 * Depuis le 2026-08-24, seuls sont servis :
 *   - les articles sans contributeur (`added_by IS NULL`) : catalogue Jumia et
 *     relevés de marchés saisis en interne ;
 *   - les articles d'artisans validés par un administrateur
 *     (`confirmed_at IS NOT NULL`).
 *
 * Les routes d'administration ne l'appliquent pas : un modérateur doit voir ce
 * qui attend sa décision.
 */

/** Filtre PostgREST correspondant. */
export const FILTRE_CATALOGUE_VALIDE = 'added_by.is.null,confirmed_at.not.is.null'

/**
 * Restreint une requête `price_materials` aux articles admis.
 *
 * ```ts
 * const q = catalogueValide(supabaseAdmin.from('price_materials').select('*'))
 * ```
 */
export function catalogueValide<T extends { or: (f: string) => T }>(query: T): T {
  return query.or(FILTRE_CATALOGUE_VALIDE)
}
