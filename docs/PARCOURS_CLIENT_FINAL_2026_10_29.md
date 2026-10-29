# Parcours client — 29 octobre 2026

## Comportements
- `/diagnostics` : demandes du client connecté ; reprise par `/diagnostic?mission=UUID`, sans nouvel appel modèle. Les produits choisis sont récupérés en priorité, sans attendre une nouvelle collecte fournisseur.
- Produits : quantité en articles/conditionnements vendus ; distinction entre déjà compris, achat séparé par le client, supplément confirmé ou périmètre inconnu. Un supplément exige confirmation explicite du conditionnement et de son exclusion du prix de prestation. Cette confirmation est déclarée par le client, pas présentée comme une vérification indépendante de la plateforme.
- Total : fonction SQL canonique, pas une somme provenant du navigateur. Produits inclus/achetés séparément non additionnés. Les lignes non confirmées ou les suppléments avec observation de plus de 24 heures bloquent le paiement jusqu’à clarification ou devis. Prix de prestation et suppléments séparés.
- Devis sans prix : demande enregistrée dans `quote_requests`, retrouvable dans l’historique, avec accès au choix des prestataires disponibles. Pas de fausse affirmation de notification ou d’acceptation : le prestataire doit encore être choisi et accepter/établir son devis.
- Simulation : montant et version du devis contrôlés ; reçu unique contenant la prestation, les produits, les quantités, les traitements et les liens ; modifications financières refusées après simulation. Aucun débit, portefeuille, versement, dispatch ou achat fournisseur déclenché par la simulation.
- Qualité : marque annoncée et référence extraites lorsqu’elles existent dans les données publiques, unité, disponibilité annoncée, source et date. Garantie/certification manquante reste inconnue ; aucune étiquette premium déduite du prix. Ces informations ne constituent pas une certification fabricant.
- Questions : guide différencié pour les douze catégories de l’application. Une question utile, une justification, pas de quota minimum ni de diamètre ou quantité inventés. Une validation métier terrain reste distincte d’un test logiciel.

## Validation
Tests HTTP : propriété/identité, sélection hors besoin refusée, lecture et retrait limités à la mission, devis demandé sans prix, historique filtré côté serveur.
Tests transactionnels PostgreSQL dans `scripts/test-client-quote.sql` : inclus/client fourni non doublonnés, suppléments et quantité, confirmation obligatoire, version de devis, montant modifié refusé, reçu idempotent et figé, devis sans montant. Données de ces tests annulées par ROLLBACK.

Les tests navigateur et leurs captures sont consignés dans les sorties de cette tâche. Les missions utilisées pour la démonstration sont marquées comme tests ; aucun paiement réel ni sollicitation d’artisan n’est exécuté pour les vérifier.
