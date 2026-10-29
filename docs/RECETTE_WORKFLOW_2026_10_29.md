# Recette rapide du parcours client — 29 octobre 2026

## Validé
- 12 tests automatisés réussis : contrôles de propriété, choix produit, montant serveur, échecs sans faux succès, historique.
- Intégration SQL prix/paiement réussie, fixtures annulées : fournitures incluses ou client non doublées, quantité et suppléments confirmés, mauvais montant/révision refusés, reçu idempotent et gel des montants après paiement, cas sans prix.
- Intégration SQL rectificatifs réussie, fixtures annulées : rôle client/prestataire, hausse en attente sans effet, blocage paiement en attente, version périmée refusée, acceptation à 12000, refus de hausse conservant 12000, verrouillage après simulation.
- Navigateur en production : reprise de la mission de test, produit à 85000 FCFA ; quantité 1 = 149133, quantité 2 = 234133, retour à 1 = 149133. L’ancien défaut de total figé n’est plus reproduit.
- Choix « sans discussion » confirmé en interface : historique créé et saisie libre bloquée.
- Paiement de démonstration effectué en interface ; reçu c9b811fb-7d0f-4dea-a475-472e54e8f8e6, montant 149133 FCFA, prestation 64133, fournitures 85000, quantité et lien produit conservés.

Mission de test : 7edee33b-ac2c-4132-901e-e9b464cd6ef6, déjà marquée [TEST LOGICIEL]. Le reçu et le choix de mode y restent pour preuve. Aucun paiement réel, achat fournisseur ou notification à un prestataire n’a été déclenché.

## Correction issue de la recette
Le message technique initial était affiché sous forme JSON dans le fil. Il est maintenant masqué dans les bulles ; la fiche technique structurée reste accessible.

## Limites précises
Ce passage reprend un diagnostic existant : il ne valide pas une nouvelle génération IA, l’import d’une nouvelle photo, ni les diagnostics de tous les métiers. Aucun nouveau crédit de diagnostic IA utilisé. L’interface prestataire, la sélection/attribution effective à un prestataire et une conversation à deux comptes n’ont pas été exercées en navigateur ; les règles de rectificatifs sont validées côté base, pas un aller-retour visuel complet entre deux sessions. Paiement réel, dispatch réel, notifications et exécution de travaux ne sont pas validés par ce test.
