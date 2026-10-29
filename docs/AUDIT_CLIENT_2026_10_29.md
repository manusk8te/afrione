# AfriOne — audit du parcours client et fournitures, 29 octobre 2026

## Vérifié en navigateur

Connexion active → diagnostic de plomberie (quatre réponses) → mission et diagnostic enregistrés → prix V4 de 5 770 FCFA → choix du mode → indication « fournitures non comprises dans la référence, mitigeur exclu ; déplacement séparé » → paiement simulé → reçu consultable et enregistré.

Mission de test : `46790e2f-7e73-4e7d-9b45-44d52b99b5ff`. Reçu : `1e3d111f-72b8-4465-aac0-48d3116ace21`.

Vérification en base : une seule simulation, zéro transaction réelle, zéro tentative de dispatch et zéro observation ajoutée dans `accepted_prices`. Le test ne constitue pas une observation du marché ivoirien.

Le matching plomberie ne propose plus de menuisiers lorsque le métier demandé est absent. La base contient actuellement deux artisans disponibles, tous deux en menuiserie. Aucun artisan fictif ou faux KYC n’a été ajouté.

## Corrections

- Identité issue de la session pour créer le diagnostic ; vérification des écritures, sans diagnostic de remplacement inventé en cas d’erreur d’enregistrement.
- Fournitures du diagnostic enregistrées au format texte attendu par Postgres.
- Montant du paiement lu dans le devis enregistré côté serveur. Le paramètre de prix dans l’URL n’est pas la source du montant.
- Simulation isolée dans `payment_simulations`, idempotente et protégée par propriétaire, sans portefeuille ni transaction réelle, sans alimentation de l’apprentissage. Refus des accès anonymes et des montants incohérents.
- Reçu durable et copie du périmètre du devis au moment de la simulation.
- Notifications des fournitures sur le diagnostic, le choix du mode, la fenêtre de paiement et le reçu : comprises dans la référence, non comprises, partielles ou à confirmer. Ces mentions ne certifient pas un devis ivoirien définitif ; aucun ajout ou retrait arbitraire de fournitures.
- Suppression des remises de prix web non estimées et des prix de gamme inventés. Les prix restent en FCFA et conservent leur provenance et leur date.
- Déclarations de matériaux : montant observé, quantité, unité, date, justificatif ou fiche produit, disponibilité, auteur issu de la session. Chaque relevé est ajouté en attente de contrôle au lieu d’écraser un prix déjà validé.
- Modération réservée à l’administrateur. Un artisan ne peut plus s’auto-valider ni devenir contributeur anonyme pour contourner la revue. Écritures directes des comptes ordinaires révoquées sur le catalogue.
- Partenariat commercial distinct de l’identité d’un magasin et de la validation d’un prix. Enregistrement manuel d’un accord existant par l’administrateur avec référence interne ; aucun partenariat inventé ou contacté.

## Sources et données à reprendre

| Source demandée | Contrôle réalisé | Utilisation actuelle |
|---|---|---|
| jumia.ci | DNS résolu, HTTP 403 depuis l’environnement de contrôle | Source connue, collecte automatisée signalée bloquée ; aucun contournement mis en place |
| leroymerlin.ci | Échec de résolution DNS lors du contrôle | Piste enregistrée, non validée, aucun prix importé |
| aribat.ci | Échec de résolution DNS lors du contrôle | Piste enregistrée, non validée, aucun prix importé |

Les deux magasins physiques existants sont conservés. Aucun accord partenaire n’est enregistré à ce stade.

526 anciennes lignes de catalogue : aucune ne satisfait actuellement les nouveaux critères de date, de preuve et de validation/provenance. Elles sont conservées pour contrôle, et ne chiffrent plus automatiquement les fournitures. Les nouvelles observations devront être collectées réellement par les artisans, l’équipe ou les magasins confirmés.

## Validation et limites

56 tests hors ligne passent ; TypeScript et compilation Vercel réussis. Tests supplémentaires en transaction SQL, annulée : répétition d’une simulation, tentative de modification du montant, mauvais propriétaire, absence de transaction réelle. Les routes de paiement publiques refusent une requête non authentifiée (401).

Le parcours de démonstration s’arrête au reçu. Les paiements réels, le dispatch réel, la disponibilité opérationnelle des autres métiers, la négociation avec un prestataire et la réalisation des travaux ne sont pas certifiés par cet essai. Les espaces entreprises nécessitent leur propre vérification. Aucun apprentissage continu automatique n’est prétendu.
