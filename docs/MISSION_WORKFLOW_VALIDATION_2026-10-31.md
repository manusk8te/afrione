# Validation des missions — 31 octobre 2026

## Version

Code métier : commit 254724a. Déploiement Vercel préparé et activé : dpl_6hSVfkNL6pfuecWPUovDxCr9hXak, projet afrione. Les deux migrations 202610300001 et 202610300002 sont appliquées sur la base AfriOne bfvziiajxhjoqfefkwwm. Les bases des autres applications ne sont pas concernées.

## Résultats acquis

- Vérification TypeScript réussie.
- Compilation Next.js complète réussie avec la configuration AfriOne, en local et sur Vercel.
- Test SQL transactionnel : 29 assertions réussies, trois missions, cinq identités. Transaction annulée.
- Test HTTP sur le serveur compilé local : 19 contrôles réussis, quatre vrais comptes authentifiés temporaires, trois missions. Comptes, missions et photo fictive supprimés.

- Test HTTP sur https://afrione-sepia.vercel.app après activation : les mêmes 19 contrôles réussis sur trois missions ; nettoyage terminé.

## Scénarios

1. Demande de plomberie, blocage de l'auto-réservation et d'un tiers, acceptation du prestataire, messages échangés et relus, devis à 45 000 FCFA, contre-proposition à 38 000, accord du prestataire puis confirmation du client. Une hausse à 42 000 refusée conserve le devis à 38 000. Un paiement avec devis périmé est refusé. Après paiement fictif : programmation, départ déclaré par le prestataire, arrivée confirmée par le client, photo et compte rendu, demande de réception et validation du client. Deux validations ne produisent qu'une instruction de versement simulée.
2. Mission sans discussion libre, devis à 12 000 FCFA, paiement fictif, départ puis litige motivé. La réception normale est bloquée. Un administrateur distinct prend une décision motivée de remboursement simulé.
3. Refus par le prestataire, retour à la recherche, annulation par le client. Une mission annulée ne peut pas être réattribuée.

## Limites précises

Les tests HTTP valident l'authentification, les routes serveur, les règles de base et le stockage de preuve ; ils ne remplacent pas une recette visuelle de tous les boutons sur mobile. La photo de test est explicitement fictive et ne prouve aucun travail réel.

Le prestataire de paiement réel et le rapprochement de ses confirmations ne sont pas intégrés par cette mise à jour. Les nouvelles simulations sont réservées aux missions et prestataires de test : aucune validation ne doit être présentée comme un versement bancaire réel. Les anciennes missions avancées ne reçoivent pas de confirmations artificielles ; elles exigent une vérification administrative.
