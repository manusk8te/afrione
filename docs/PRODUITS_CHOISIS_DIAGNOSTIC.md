# Produits choisis dans le diagnostic — 29 octobre 2026

Le diagnostic affiche des offres ciblées avec lien externe, prix par article/conditionnement publié, date de consultation et source. Le client peut préciser sa recherche, ajouter une référence ou retirer son choix. Une référence sélectionnée par besoin est conservée : une nouvelle sélection remplace la précédente pour ce besoin, sans doublonner.

Le composant est indépendant du calcul de prestation : une estimation de main-d’œuvre indisponible n’empêche pas la consultation des produits. Une référence trop imprécise ne reçoit pas un produit arbitraire. Les références internationales non chiffrables restent des liens de comparaison, sans bouton de sélection automatique.

L’API vérifie l’identité, la propriété de la mission et son état, la présence du besoin dans le diagnostic, l’appartenance de la recherche à ce besoin et la présence du lien dans les offres publiques récentes. Le client ne transmet aucun prix accepté par le serveur. Le prix, l’unité et la preuve sont repris du résultat de recherche. Le snapshot conserve le prix au moment du choix ; il ne garantit pas le stock ni le prix futur du magasin.

La table diagnostic_product_selections est privée, sans accès direct anon/authenticated, et ne modifie pas price_materials. La sélection correspond à une référence d’article vendu ; les quantités de chantier et la compatibilité finale restent à confirmer. Ni achat, ni notification, ni ajout au total V4. Les choix figurent dans l’API de devis et la fiche technique de mission accessible aux participants autorisés.

Tests : montant du navigateur refusé ; prix repris de l’offre ; propriétaire/état contrôlés ; offre hors besoin ou périmée refusée ; lecture/retrait limités à la mission. Compilation TypeScript et tests de simulation de paiement.
