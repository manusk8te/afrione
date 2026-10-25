# AfriOne — nos études dans l’agent existant

Version de travail du 25 octobre 2026. Copie de l’application issue du commit `411119d`. Les estimations restent expérimentales ; le déploiement et les vérifications réelles sont consignés séparément dans le bilan de mise en ligne.

## Reprise validée : comprendre la prestation, contextualiser son prix

La nouvelle fonction V4 utilise les références France/Sénégal, normalisées par PPA, et une correction commune apprise sur les réponses ivoiriennes. Le nom de la tâche n’est pas une variable de régression. Les correspondances de références et les contrôles de couverture restent nécessaires ; ils ne constituent pas un classificateur statistique de missions.

Outils du même agent :

1. `search_price_reference(query)` : retrouver un prix publié avec ses caractéristiques et sa source.
2. `contextualize_reference_price(reference_id, hours)` : calculer le contexte ivoirien et la correction D apprise.
3. Les outils antérieurs restent disponibles pour audit, matériaux et devis historique.

Le moteur V4 applique :

```text
R = médiane des prix sources normalisés par PPA
Contexte central = R × [0,05236651 + 0,71657825 × log(1 + heures)]
Proposition basse = contexte central × 0,29380599
D = 70,6194 %
```

D est global faute de données suffisantes. Il est appris sur des prédictions hors apprentissage, pas imposé comme remise commerciale. L’estimation finale utilise une pénalité de 0,01. La validation réestime la pénalité et D sans le prestataire testé. Les 50 références françaises et 5 sénégalaises couvrent dix métiers dans le catalogue, mais la calibration ne couvre que 14 réponses, six prestataires, cinq tâches et sept références. Les autres références donnent un contexte normalisé sans prix ivoirien appris.

Résultat : 12 propositions inférieures et 2 supérieures sur 14 tests. La réduction est forte et les périmètres restent incertains. La méthode locale simple conserve une meilleure perte quantile. Ce modèle n’est pas validé comme tarif fiable ou rentable.

Le champ `price_context` est ajouté à la réponse et au journal du run. L’agent choisit une référence, le code calcule les montants : aucun prix source ni coefficient ne vient de la réponse du LLM. Le champ `applied_estimator` reste `legacy_hourly` pour le devis historique ; les résultats V4 ne sont pas injectés dans sa main-d’œuvre.

Pour essayer uniquement le contexte, sans appel OpenAI, `POST /api/pricing-agent` accepte :

```json
{"pricing_mode":"context_preview","reference_id":"FR002","hours":0.5}
```

La normalisation PPA exprime directement le prix en XOF par unité source. Ne pas multiplier encore par le change EUR/XOF. Les effets indépendants PIB, salaire minimum et PPA n’ont pas été estimés avec seulement quelques pays.

Réestimer à partir des fichiers d’étude existants, puis importer :

```sh
python /chemin/etude/outputs/afrione_contextualisation_v4.py
python scripts/import-pricing-studies.py /chemin/etude
node --test scripts/test-pricing-studies.mjs scripts/test-pricing-sdk.cjs scripts/test-contextualizer.mjs
```

Les nouvelles observations réelles devront conserver les unités, quantités, fournitures et prix effectivement déclarés/acceptés/payés séparément. Cette version ne collecte pas automatiquement ces données et ne déclenche pas d’apprentissage à chaque devis. Toute nouvelle version doit repasser les validations avant activation.

## Ce qui est réellement réutilisé

| Résultat existant | Utilisation dans cette intégration |
|---|---|
| `afrione_estimateur.json` | Médianes des neuf missions, coefficients OLS exportés, domaines de durée, erreurs de validation |
| `afrione_estimateur.mjs` | Moteur local original importé sans modification |
| `AfriOne_Transfert_Quantile_Modele.json` | Coefficients exacts du transfert quantile, références Bénin/Sénégal, facteurs PPA et réserves de comparabilité |
| `selection-resultats.json` | Résultats comparatifs des procédures Ridge, Lasso, OLS et méthodes simples |
| `quantile-resultats.json` | Scores sur les 14 réponses, domaines des cinq missions et quantile local de comparaison |
| `econometrie-resultats.json` | Diagnostics économétriques antérieurs, conservés pour audit |

Les coefficients ne sont pas réestimés pendant un devis. Les quatre artefacts copiés à l’identique possèdent une empreinte SHA-256. Les graphiques restent dans les rapports d’étude ; le serveur utilise les nombres, domaines et diagnostics qui les sous-tendent.

Ridge et Lasso ne sont pas additionnés au devis. Ils sont conservés comme procédures comparées : cette étude n’a pas exporté pour eux de modèles finaux autonomes. Les deux échantillons de validation (24 réponses V2 et 14 réponses V3) restent distincts. Aucun gain artificiel n’est déduit en comparant leurs MAE directement.

## Branchement effectué

```text
Demande client
  → agent SDK « afrione » existant
  → outil estimate_service_price
  → moteur des études : médiane / OLS / quantile local / transfert quantile
  → résultats + sources + versions + erreurs + limites
```

Le même agent conserve ses outils matériaux et calcul de devis. Son résultat comporte désormais `study` et `applied_estimator`. Les résultats statistiques sont aussi enregistrés avec le run dans le journal existant. Si l’agent omet de consulter les études ou la contextualisation, le run échoue explicitement.

La durée, le taux horaire, l’urgence et le quartier résolus côté serveur sont verrouillés : l’agent ne peut pas prendre un montant total statistique et le passer comme nouveau taux horaire.

## Pourquoi le total statistique est encore bloqué

Les observations de départ comprennent parfois les fournitures, sans séparation fiable. L’estimation de 5 773 FCFA issue du transfert pour « Remplacement robinet » n’est donc pas un tarif de main-d’œuvre de mitigeur de cuisine. Lui ajouter le prix d’un robinet pourrait compter le matériel deux fois.

Le moteur renvoie les estimations expérimentales, mais `production_allowed=false` et `can_add_materials=false`. Un devis fondé sur l’étude renvoie donc `total:null` et `status:devis_requis`. Un montant manquant n’est pas remplacé par zéro.

Le parcours historique renvoie encore son devis horaire, explicitement identifié `applied_estimator:legacy_hourly`. Il ne doit pas être présenté comme un devis issu des nouveaux modèles. Ses fallbacks et son intervalle commercial ±8 % restent historiques, non validés par notre étude. L’interface existante n’a pas encore été adaptée pour afficher les comparaisons.

## Matériaux et fournitures

Le mode de simulation lit les produits choisis par identifiant dans `price_materials`. Il exige quantité, unité identique, justificatif source et date exploitable. Les articles artisans restent soumis au filtre d’admission existant.

Pour Jumia, il utilise `web_price`, le prix affiché, plutôt que l’ancien prix diminué arbitrairement de 12 %. Les nouvelles collectes conservent désormais le montant affiché, sans réduction ni faux intervalle bas. Les anciens enregistrements ne sont pas réécrits. Les prix terrain exigent une confirmation et un justificatif.

Une limite de fraîcheur de 30 jours est un réglage de gestion explicite du prototype, pas un résultat statistique. Prix manquant, périmé, unité différente ou source insuffisante : demande de prix. Pour l’iroko, il faut choisir une référence qui précise essence, dimensions/volume, qualité et état du bois. Aucune conversion entre une planche et un m³ ni aucun taux de perte n’est inventé. Livraison et course d’achat ne sont pas incluses dans le prix produit.

## Essayer le moteur sans appel OpenAI

Depuis le dossier de cette copie :

```sh
node scripts/demo-pricing-studies.mjs
node --test scripts/test-pricing-studies.mjs scripts/test-pricing-sdk.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Les tests SDK remplacent la réponse du Runner, puis exécutent le véritable outil de l’agent. Ils vérifient le raccordement hors ligne ; ils ne prouvent pas qu’un modèle OpenAI choisira toujours la bonne mission en conversation réelle. Les prix fictifs dans les tests sont des fixtures logicielles séparées, jamais importées dans les références métier.

Le mode de simulation est aussi branché sur `POST /api/pricing-agent` :

```json
{
  "pricing_mode": "study_preview",
  "mission": "Remplacement robinet",
  "hours": 0.5,
  "materials": []
}
```

Chaque matériau éventuel exige un véritable `material_id` du catalogue, un nom, une quantité et une unité. Aucun prix envoyé par le navigateur n’est accepté par ce mode. Cet exemple sans matériaux teste seulement l’étude ; il ne signifie pas qu’un robinet est gratuit.

## Actualiser les résultats

```sh
python scripts/import-pricing-studies.py /chemin/vers/le/dossier/de/letude
```

Cela importe les nouveaux exports existants ; cela ne lance aucun ajustement. Pour réentraîner, utiliser les programmes Python de l’étude d’origine, puis refaire les contrôles et l’import. Ne pas entraîner sur les prix générés par le modèle.

Pour appliquer un prix statistique à la main-d’œuvre, il reste à confirmer le contenu des observations, exporter un estimateur avec un périmètre explicite et le valider sur ce même périmètre. Les fournitures pourront alors être ajoutées sans double comptage.
