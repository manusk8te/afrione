# Discussion et accord client/prestataire

Livraison : choix explicite de discussion, confirmation du périmètre, rectificatifs motivés/versionnés, réponse client et actualisation atomique du prix de prestation, historique privé aux participants. Les produits facturés séparément restent séparés ; un rectificatif fournitures comprises ne peut être accepté tant que des produits sont marqués en supplément.

Un refus conserve le périmètre et le tarif précédents : il ne force pas le prestataire à réaliser un supplément. Le paiement simulé est bloqué si un rectificatif est en attente. Après paiement ou sortie de négociation, les accords sont verrouillés. Les avenants en cours de chantier nécessitent un parcours distinct ; cette livraison ne les facture pas implicitement.

Messages : API authentifiée, rôle déduit du serveur, texte limité à 4000 caractères, dédoublonnage récent et limitation à 12 messages/minute par émetteur et mission. Déclencheur SQL couvre aussi les insertions directes, sérialise sur la mission et vérifie les rôles. Le mode sans discussion bloque les textes libres, mais garde devis/rectificatifs. Relecture toutes les 10 secondes et retour réseau/focus pour rattraper des événements temps réel perdus ; fenêtre de 500 messages récents à la réouverture, sans pagination historique exhaustive.

Modération : rappels déterministes élémentaires, symétriques client/prestataire, sans appel IA. Suppression des anciennes fourchettes marché fixes et des promesses de garantie financière. Ce n’est pas une certification de normes techniques ou une détection exhaustive des abus.

Validation : compilation TypeScript. Pas de nouvelle session de diagnostic IA, de notification de prestataire ou d’essai de paiement pendant cette livraison. Recette navigateur, doubles comptes et concurrence réelle restent à réaliser avec le client.
