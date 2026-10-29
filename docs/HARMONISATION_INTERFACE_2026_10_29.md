# Harmonisation de l’interface

Référence conservée : orange AfriOne, grands fonds en dégradé animé, symbole orange transparent, cartes claires, navigation admin sombre et couleurs de statut.

- Base commune : surfaces, textes, bordures et ombres centralisés en variables CSS, sans modifier les palettes de statut ni les données.
- Boutons : classe commune, rayon 8 px, sans dégradé animé, ombre bombée ou déplacement au survol ; texte Inter 600, focus visible, état désactivé. Les contrôles d’icône conservent leurs dimensions compactes.
- Formulaires : champs arrondis à 8 px et focus commun ; cases, radios, fichiers et sliders conservent leurs types et leur comportement.
- Administration : menu sombre lisible sur toutes les pages, navigation mobile et logo cohérents, gouttières mobiles communes.
- Discussion : mêmes contrôles, titre/périmètre espacé, formulaire d’accord structuré et confirmations principales orange.
- Historique : titre sous l’en-tête fixe, cartes lisibles et action principale visible.
- Devis et reçu : hiérarchie des montants, liens et espacements communs.
- Accueil et connexion : composition, grands fonds et animations de fond conservés ; signature du pied de page alignée sur l’en-tête.

Périmètre : pages client, artisan, entreprise, admin, discussion, connexion/récupération et bientôt. Les routes de redirection sans interface restent inchangées.

Validation : TypeScript et construction Vercel. Contrôle visuel représentatif sur accueil, administration, discussion et reçu ; pas de nouvelle génération IA ni paiement pendant cette harmonisation. Les parcours métier, requêtes, rôles et règles de prix ne sont pas modifiés.
