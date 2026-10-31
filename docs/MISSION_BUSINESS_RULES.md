# Règles des missions AfriOne

Version 2 : nouvelles missions. Les anciennes missions avancées nécessitent une vérification administrative ; aucune confirmation historique n'est inventée.

1. Client et prestataire sont deux personnes distinctes, même si le client est administrateur ou possède aussi un profil artisan.
2. Un prestataire approuvé, disponible et du bon métier doit accepter la demande. Refuser rend la mission disponible pour un autre prestataire.
3. Le client confirme le périmètre et choisit discussion ou absence de discussion. Une discussion ne constitue jamais une acceptation de prix.
4. Le prestataire propose un prix, le périmètre et l'inclusion des fournitures. Le client peut refuser ou contre-proposer. Après accord du prestataire sur une contre-proposition, le client confirme le devis final.
5. Le devis est versionné. Une modification rend une ancienne confirmation de paiement inutilisable. Le prix payé ne peut pas être modifié en place.
6. Le client programme l'intervention ; seul le prestataire déclare son départ. Le prestataire signale son arrivée ; le client confirme la présence pour commencer.
7. Le GPS est écrit par le prestataire uniquement pendant le trajet ou les travaux. Une photo stockée pour cette mission et un compte rendu sont nécessaires pour demander la réception.
8. Le prestataire ne peut pas réceptionner ses propres travaux. Le client valide ou ouvre un litige motivé. Un litige bloque la réception normale et demande une décision administrative motivée.
9. Une validation ne prouve pas un versement bancaire. Les demandes de versement/remboursement sont distinctes et uniques. Le paiement réel et son rapprochement restent à connecter au prestataire de paiement.
10. Les missions de test sont explicitement séparées. Elles n'utilisent que des prestataires de test masqués du répertoire public ; aucun argent réel ne bouge.

Protections : contrôles côté serveur et base de données, verrouillage transactionnel, versions des devis, journal des actions, unicité des réservations et des instructions financières. Les boutons de l'interface ne sont pas la barrière de sécurité.

## Vérification reproductible

`scripts/test-mission-business-rules.sql` : 29 assertions sur trois missions et cinq identités distinctes, dans une transaction annulée. Couvre négociation, contre-proposition, hausse refusée, devis périmé, départ/arrivée, preuves, clôture idempotente, litige, décision administrative, refus, annulation, accès tiers et impossibilité de s'attribuer sa propre mission.

Ce test SQL ne prouve pas à lui seul le parcours navigateur ni le bon fonctionnement d'un prestataire de paiement externe.
