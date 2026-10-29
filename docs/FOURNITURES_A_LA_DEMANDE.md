# Fournitures à la demande — 29 octobre 2026

Le diagnostic, l’outil Agents SDK `search_material_price` et `/api/materials` consultent les fournisseurs publics. Aucune écriture dans `price_materials` par cette recherche. Les anciennes fonctions Jumia sont des ponts de compatibilité, sans proxy payant ni sauvegarde de résultats.

Sources testées : ProduitBat (recherche et fiche produit du catalogue public), Sogep Africa, Quincaillerie Konaté & Frères, IvoirElite. ProduitBat publie les données de sa boutique dans le document HTML rendu côté client. Seuls les champs publics nécessaires au prix sont renvoyés ; pas de métadonnées de session, de coût interne ni de description libre transmise à l’agent.

Cache Next Data Cache : résultat par recherche normalisée, renouvellement 1 heure, date originale conservée. Aucune offre de plus d’une heure présentée. Après expiration, le premier résultat peut rester sans prix pendant le renouvellement ; on ne présente pas une observation périmée. Les échecs peuvent être réutilisés pendant cette heure. Jusqu’à quatre fournitures par appel HTTP et trois fiches par fournisseur et par fourniture, délai global réseau de 12 secondes. Pages limitées à 2 Mo, redirections non suivies. Aucun URL fourni par un client n’est récupéré. Les liens produits proviennent des sources configurées.

Prix nuls, devises non établies, variantes et promotions ProduitBat non prises en charge, absence de prix principal ou montants incohérents exclus. Les mots de la recherche doivent correspondre au titre ; ce filtre n’est pas une garantie de compatibilité technique. Aucun prix médian entre articles différents, aucune remise arbitraire. Conditionnement conservé explicitement quand établi, sinon « article vendu (conditionnement à confirmer) ». Pas de multiplication automatique par une quantité dans une unité différente.

Les offres et leurs liens s’affichent séparément de la prestation V4. Elles n’augmentent pas automatiquement un prix dont le périmètre fournitures est variable. La sélection et l’achat de fournitures ne sont pas effectués. La lecture du catalogue interne reste disponible pour les relevés contrôlés.

## Iroko et comparaison internationale

Annonce Alibaba fournie par le client : https://french.alibaba.com/product-detail/Premium-West-African-Iroko-Sawn-Timber-12000002758386.html
Contrôle navigateur 29/10/2026 : minimum 20 m³, origine indiquée Cameroun, vendeur ET BUSINESS LTD au Royaume-Uni, transport à négocier. Affichage du prix et du sous-total incohérent : aucun montant exploitable retenu, aucun prix ivoirien déduit.

Fournisseur local : https://bdci-ci.com/product/iroko/ — fiche espèce et implantation Abidjan, sans prix public constaté. La recherche iroko présente ces pistes à confirmer même sans offre numérique utilisable. Les données de l’annonce ne sont pas actualisées automatiquement par un adaptateur Alibaba.

Avant de comparer : essence, sciage/grume, séchage, qualité, dimensions, volume, unité, quantité minimale, devise/date de change, Incoterm, taxes, transport et prix effectivement négocié. Un prix export ou une mercuriale douanière ne constitue pas un prix de détail ivoirien. Une décote « achat local » ou « négociation » doit être estimée avec des devis locaux comparables ; pas de coefficient inventé.
