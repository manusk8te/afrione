# Agent SDK de tarification AfriOne

Le parcours `/diagnostic` appelle `/api/pricing-agent`, qui exécute l’agent OpenAI existant côté serveur. La clé OpenAI reste sur Vercel.

## Prix indicatif réellement appliqué

L’IA comprend la mission et choisit une référence techniquement comparable parmi les 55 références publiées France/Sénégal des dix métiers, avec une justification et la quantité dans l’unité source. Le catalogue complet est accessible même si les mots du client diffèrent. Une proximité lexicale seule ne suffit pas.

`contextualize_reference_price` réutilise les coefficients et le multiplicateur V4 existants sans les réentraîner. Pour une unité, le calcul est identique au Python `afrione_contextualisation_v4.py`. Pour une quantité q, il applique q fois la fonction à la durée par unité h/q. Un tarif publié par heure est appliqué à h heures avec un facteur de contexte calculé pour une heure, pour éviter de compter deux fois la durée. Ces extensions sont des choix de généralisation applicatifs, pas des coefficients estimés sur de nouvelles observations. Les contrats annuels restent soumis à devis.

`calculate_final_price` arrondit ce résultat V4 : c’est maintenant le total proposé et enregistré. Le serveur écrase toute réécriture monétaire du modèle. Un nouveau choix de référence invalide le calcul précédent. Aucun repli automatique vers l’ancien prix horaire n’est effectué.

`applied_estimator: "context_v4"`, `version_reference` et `price_context` indiquent ce qui a été appliqué. Le contexte garde la référence, la source, l’unité, la quantité, la justification, le statut de calibration locale et l’extrapolation.

## Limites explicites

Les 55 prix publiés ne sont pas 55 observations ivoiriennes. La calibration existante repose sur 14 réponses, six prestataires, cinq tâches. Les autres tâches sont estimées par analogie non validée localement. `production_allowed: false` reste le statut scientifique ; l’application utilise le résultat uniquement comme proposition indicative à confirmer par devis, pas comme prix validé de facturation. Aucune garantie d’être sous le marché réel ou de couvrir les coûts.

La ventilation main-d’œuvre, fournitures, transport, commission, assurance et versement au prestataire est inconnue et renvoyée `null`. On n’additionne pas automatiquement les fournitures recherchées à une référence de périmètre variable. Le diagnostic masque cette ventilation et les options matériaux qui recalculaient auparavant le total. Il ne présente plus le ±8 % arbitraire comme intervalle pour la V4.

Une quantité manquante, une durée hors domaine ou l’absence de référence comparable déclenche `request_pricing_details` : l’API renvoie une question avec statut 422, sans prix. L’agent conserve aussi l’accès aux études antérieures avec `estimate_service_price`, et à la recherche de fournitures `search_material_price` (les replis éventuels restent signalés).

Les nouvelles observations ne modifient pas automatiquement les coefficients. L’apprentissage continu nécessitera un réentraînement versionné, une validation hors apprentissage et une promotion contrôlée du modèle.

## Vérification

Tests de parité Python existants, tests d’extrapolation sur les dix métiers, unités et quantités, outils SDK réels avec modèle simulé, montants verrouillés, absence de repli horaire, validation API et affichage. Les essais techniques ne créent aucune observation de marché ni prix accepté.
