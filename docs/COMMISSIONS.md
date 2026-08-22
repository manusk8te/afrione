# Commissions — état constaté, non corrigé

*Relevé le 2026-08-21. Décision du 2026-08-22 : documenter, ne rien changer
tant que le modèle économique n'est pas figé.*

## Le décalage

La table `service_fees` définit une répartition à trois parts, cohérente —
chaque ligne totalise 100 % :

| catégorie | commission | assurance SAV | part artisan |
|---|---|---|---|
| `default` | 10 % | 2 % | 88 % |
| `urgence` | 12 % | 3 % | 85 % |
| `premium` | 8 % | 2 % | 90 % |

**Aucun fichier ne lit cette table.** Quatre endroits codent leur propre taux :

| Fichier | Taux appliqué | Part artisan effective |
|---|---|---|
| `src/app/api/payment/route.ts` | `PLATFORM_FEE_PCT = 0.10` | **90 %** |
| `src/app/api/wave-webhook/route.ts` | `0.12` | 88 % |
| `src/app/api/dispatch/simulate-pay/route.ts` | `0.15` | 85 % |
| `src/lib/pricing-agent.ts` | `0.10` + `0.02` | 88 % (affiché) |

## Ce que ça produit

`api/payment` est la route réellement empruntée par la War Room. Elle fait
`artisanAmount = amount − 10 %`, donc verse **90 %** à l'artisan. La table en
prévoit 88 % (85 % en urgent).

**L'assurance SAV n'est jamais prélevée**, sur aucun paiement. Et la table
`transactions` n'a pas de colonne pour l'accueillir : elle ne connaît que
`platform_fee` et `artisan_amount`, si bien que `amount = platform_fee +
artisan_amount` exactement. La répartition à trois parts n'a nulle part où
atterrir.

Mesuré sur les 23 transactions existantes au 2026-08-21 :

| mode | nb | encaissé | versé artisan | dû selon `service_fees` | écart |
|---|---|---|---|---|---|
| urgent | 18 | 447 272 | 386 873 | 380 181 (85 %) | +6 692 |
| default | 5 | 59 026 | 53 123 | 51 943 (88 %) | +1 180 |

**≈ 7 900 FCFA versés en trop**, et autant d'assurance jamais provisionnée.

Vérifiable en direct : `node scripts/test-negociation.mjs` affiche la
décomposition d'un paiement réel — sur 38 000 FCFA, commission 3 800 (10 %),
artisan 34 200 (90 %).

## Ce qu'il faudrait faire, le jour venu

1. Une colonne `assurance_fee` dans `transactions`
2. Un résolveur unique lisant `service_fees`, indexé sur `missions.mode`
3. Les quatre taux en dur rebranchés dessus
4. Décider du sort des 23 transactions passées — laisser ou régulariser

Rien de tout cela n'est fait. Les quatre fichiers portent un commentaire
renvoyant ici, pour qu'on ne modifie pas un taux sans voir les trois autres.
