# Sources de fournitures — pilote du 29 octobre 2026

Trois alternatives ont répondu en HTTP 200 lors des contrôles publics :

| Source | Fiches du pilote | Périmètre |
|---|---:|---|
| https://quincaillerie.ci/ | 6 | Sanitaire, ciment, fer, bois |
| https://quincaillerie-kf.com/ | 4 | Petites fournitures de plomberie |
| https://quinkashop.com/ | 1 | Carrelage au m² |

Les onze prix ont été lus sur les fiches publiques. Exemples : robinet de douche 3 500 FCFA, ciment SOCIMAT 42,5R 87 000 FCFA la tonne, carrelage 5 500 FCFA/m². La fiche, la date de lecture, l’unité, le prix intégral et la source sont conservés. Le bois relevé est du fromager ; aucune assimilation à de l’iroko.

Il s’agit de prix affichés par ces sites, sans vérification d’achat, d’identité commerciale, de livraison, de taxes ou de disponibilité effective. Les partenariats restent à `false`. Les onze relevés sont en attente de contrôle ; aucun n’est automatiquement confirmé ou introduit comme observation de prestation dans l’apprentissage.

## Solution opérationnelle

Dans `/admin/sources`, l’actualisation de ces trois sources déclenche un petit collecteur dédié aux fiches du pilote. Ce n’est pas une indexation de l’ensemble de leurs catalogues.

1. Origines et fiches autorisées explicitement ; aucun URL arbitraire, login, proxy payant ou contournement de protection.
2. Vérification du titre produit, de la devise XOF et du prix visible. Offres/variantes ambiguës, échecs HTTP ou unités incohérentes : fiche écartée, sans inventer de prix de remplacement.
3. Chaque changement de prix devient un relevé daté en attente de revue. Même prix, même fiche et relevé de moins de 24 h : pas de doublon.
4. Un administrateur contrôle produit, unité, conditionnement et preuve avant confirmation. Les relevés validés et récents sont disponibles dans la base matériaux et dans l’outil de recherche de fournitures de l’agent.
5. Les prix de fournitures demeurent séparés du calcul V4 de prestation. Aucune addition automatique à un tarif dont les inclusions restent ambiguës.

Les formulaires artisans/magasins restent le complément pour les fournisseurs sans catalogue exploitable. Les relevés physiques ou devis réels passent par la même revue. Aucun fournisseur n’a été contacté et aucun accord commercial n’a été supposé.

## Vérification

65 tests hors ligne passent, dont extraction de prix/devises/unités, refus des prix masqués, préservation du statut de revue, absence de doublons et utilisation par l’agent d’un relevé récent contrôlé au lieu d’une ancienne ligne non vérifiée. TypeScript vérifié. Les onze observations du pilote ont été enregistrées dans AfriOne ; la collecte complète des catalogues n’est pas annoncée.
