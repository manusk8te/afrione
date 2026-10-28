# Agent SDK de tarification AfriOne

Le parcours `/diagnostic` appelle `/api/pricing-agent`, qui exécute l’agent OpenAI (`@openai/agents`) côté serveur. La clé OpenAI reste dans les réglages serveur du projet Vercel AfriOne.

## Réutilisation des études

L’agent utilise les artefacts existants de `src/data/pricing-studies` sans réentraîner ni modifier leurs coefficients :

1. `search_price_reference` retrouve les références publiées France/Sénégal avec leurs sources.
2. `contextualize_reference_price` exécute la fonction de contexte économique vers la Côte d’Ivoire.
3. `estimate_service_price` donne accès aux autres estimateurs déjà calculés (médiane, régressions, transfert quantile) et à leurs limites.
4. `search_material_price` recherche les fournitures dans le catalogue validé puis sur Jumia. Le repli historique est encore signalé par `is_fallback`; ce n’est pas un prix observé.
5. `calculate_final_price` produit la décomposition du devis dans le moteur horaire existant.

La contextualisation et les études restent comparatives : leurs artefacts indiquent `production_allowed: false`, notamment parce que la main-d’œuvre et les fournitures ne sont pas encore harmonisées dans l’enquête. Leur montant ne doit pas être assimilé à de la main-d’œuvre seule ni additionné une seconde fois aux fournitures. Leur activation comme tarif automatique n’est pas réalisée par cette intégration.

## Garantie d’exécution

Chaque run doit avoir réellement consulté une étude ou un contexte et appelé `calculate_final_price`. Le serveur reprend les montants de cet outil, même si le modèle les réécrit dans sa réponse finale. La durée, le taux horaire, l’urgence et le quartier sont verrouillés par le contexte serveur existant. La rédaction et le choix des références restent confiés à l’agent.

Le champ `calculation_source: "calculate_final_price"` identifie l’origine du calcul. `applied_estimator: "legacy_hourly"` décrit le moteur réellement appliqué au total ; `study` et `price_context` gardent les résultats et versions statistiques consultés.

Les demandes sans description exploitable ou avec une durée invalide sont refusées avant tout appel OpenAI. Un run incomplet ne devient pas un prix nul ni un montant inventé.

## Vérifications

- Six tests SDK hors ligne : outils réels, isolation des requêtes, consultation effective des études, refus sans calcul et protection contre la réécriture des montants.
- Deux tests API : validation avant appel et transmission des données normalisées.
- Vingt tests existants de parité Python, sources, contextualisation et affichage.
- Vérification TypeScript et compilation Vercel.

Les essais techniques éventuels sont identifiés comme tels dans les descriptions. Ils ne créent aucune observation de marché ni prix accepté dans `accepted_prices`.
