# Rapport — Agent IA de Pricing AfriOne

Date : 2026-07-29
Fichier concerné : `src/lib/pricing-agent.ts`
Stack : OpenAI Agents SDK (`@openai/agents` v0.11.4, JS), modèle `gpt-4o-mini`

---

## 1. Vue d'ensemble

L'agent `afrione` calcule le prix d'une mission (main d'œuvre + matériaux + transport + commission) à partir d'une description en langage naturel. Il s'appuie sur 4 tools qui vont chercher des données réelles en base plutôt que d'inventer des prix, puis rend un JSON structuré.

Entrée (`AgentPricingInput`) : catégorie, description, matériaux nécessaires, durée estimée, quartier, urgence, artisan_id (optionnel).

Sortie attendue : `{ total, fourchette: {min, max}, artisan_percoit, breakdown }`.

---

## 2. Architecture actuelle

### 2.1 Les 4 tools

| Tool | Rôle | Source de données |
|---|---|---|
| `get_pricing_data` | Taux horaire/journée réel par métier + zone | `pricing_reference` (moyenne pondérée par `nb_observations`, avec repli national) |
| `search_material_price` | Prix d'un matériau | `price_materials` → sinon Jumia CI live → sinon fallback statique |
| `get_artisan_rate` | Taux déclaré par l'artisan lui-même | `artisan_pros.tarif_min` (si `artisan_id` fourni et ≥ SMIG×2) → sinon `labor_rates` → sinon fallback statique |
| `calculate_final_price` | Calcule le total (dégressivité, urgence, commission 10%, assurance 2%) | Calcul pur, pas de DB |

### 2.2 Le prompt actuel (`instructions`, lignes 181-200)

```
Tu es l'agent de tarification AfriOne pour le marché informel d'Abidjan, Côte d'Ivoire.

Processus OBLIGATOIRE en 4 étapes :
1. Appelle get_pricing_data(metier, zone) → tarifs terrain réels
   - Si has_data=true : utilise taux_horaire comme référence principale
   - Si has_data=false : appelle get_artisan_rate(metier, artisan_id?) comme fallback
2. Pour chaque matériau, appelle search_material_price
3. Appelle calculate_final_price avec hours, hourly_rate, materials_total, urgency, quartier
4. Réponds UNIQUEMENT avec le JSON brut. Aucun texte, aucun markdown.

Règles absolues :
- Taux horaire minimum = 866 FCFA/h (SMIG × 2 Côte d'Ivoire)
- Les prix viennent toujours des outils, jamais inventés
- Répondre en JSON : { total, fourchette: {min, max}, artisan_percoit, breakdown, data_note? }
```

### 2.3 Boucle de feedback (pas du fine-tuning, de la calibration par données)

Déclenchée par `POST /api/accepted-price`, appelée quand un client **accepte** un prix :

1. **Enrichissement `pricing_reference`** — recalcule un taux horaire implicite (`main_oeuvre / hours`), l'insère si réaliste (800–15 000 FCFA/h). Alimente directement `get_pricing_data` au prochain run.
2. **Few-shot dans le prompt** (`pricing-agent.ts:269-289`) — les 5 derniers `accepted_prices` de la même catégorie sont injectés en texte dans le message envoyé au modèle ("calibre ton prix").

`agent_runs` loggue *tous* les runs (acceptés ou non) mais n'est jamais relu — c'est un journal d'observabilité pur, pas une source d'apprentissage. **Les devis refusés ne corrigent jamais l'agent.**

---

## 3. Problèmes identifiés

### P0 — Fiabilité de la sortie
- **Pas de sortie structurée.** Le format JSON est décrit en prose ; `runPricingAgent` fait un `JSON.parse` manuel sur `output_text` nettoyé (retrait des ```` ```json ````). En cas d'écart du modèle, fallback silencieux à `total: 0` — aucune alerte, la mission peut se retrouver avec un prix nul.
  → Le SDK supporte `outputType` (schéma zod) pour forcer le format côté API plutôt que de compter sur l'obéissance du prompt.

### P1 — Ambiguïtés dans les instructions
- **Mapping urgence non spécifié.** `input.urgency` arrive en texte libre depuis l'appelant, mais `calculate_final_price` attend un enum strict (`low|medium|high|emergency`). Le prompt ne dit jamais comment traduire — dépend entièrement du bon vouloir du modèle.
- **Priorité `get_artisan_rate` vs `get_pricing_data` floue quand `artisan_id` est fourni.** Le process en 4 étapes traite `get_artisan_rate` comme un simple fallback si `get_pricing_data` échoue, alors que la logique métier voudrait probablement qu'un tarif artisan déclaré prenne le pas sur une moyenne de zone. Lié au bug connu **C-08** (tarif jamais personnalisé).
- **Aucune instruction sur les données manquantes** : que faire si `search_material_price` ne trouve rien nulle part (fallback catégorie à 1500 FCFA) ou si `get_pricing_data.has_data=false` *et* qu'il n'y a pas d'`artisan_id` ? Le prompt ne dit pas d'expliciter ce cas dans `data_note`.

### P2 — Dette / incohérences de code (hors prompt, mais impactent la confiance dans les prix)
- Dict `TRANSPORT` local (lignes 22-27, ex. Cocody=1000) **mort** — le code utilise en réalité `getTransport()` importé de `./transport`. Confirme le bug **C-07** (incohérence 1000 vs 2500 FCFA Cocody) : c'est un résidu trompeur, pas la valeur active.

### P3 — Boucle d'apprentissage incomplète
- Le few-shot prend "les 5 derniers de la catégorie", pas "les plus pertinents/similaires" (par quartier, description, matériaux). Une recherche sémantique (RAG) ferait mieux.
- Seuls les prix **acceptés** nourrissent le système ; aucun signal des refus.
- pgvector est déjà activé dans le schéma (`database/schema.sql`, table `problem_embeddings`, `embedding vector(1536)`) mais **inutilisé nulle part dans le code** — infrastructure prête, jamais branchée.

---

## 4. Pistes pour retravailler le prompt

En gardant le principe "les prix viennent toujours des outils, jamais inventés" (à conserver, c'est la vraie garde-fou) :

1. **Séparer ce qui doit être garanti par le code de ce qui reste au jugement du modèle.** Le format de sortie et le mapping urgence ne devraient pas dépendre de la qualité de la formulation du prompt — schéma zod + mapping fait en TypeScript avant l'appel agent.
2. **Expliciter la priorité des sources de taux horaire** : artisan déclaré (si dispo et fiable) > données de zone > moyenne nationale > fallback statique — dans cet ordre, avec la raison à tracer dans `data_note`.
3. **Forcer une justification explicite quand une donnée manque**, pas seulement un chiffre — utile pour debug et pour futur signal d'entraînement.
4. **Ne pas confondre "prompt plus long" et "prompt plus fiable"** : les 3 vraies failles (sortie non structurée, mapping urgence, priorité artisan) sont des trous de spécification, pas un manque de mots.

---

## 5. Annexe — bugs connus liés (rapport du 2 juin 2026)

- **C-02** : le frontend appelle `/api/pricing-agent`, pas `/api/pricing` — le moteur Monte Carlo (`lib/pricing.ts`) n'est jamais utilisé.
- **C-07** : transport Cocody 1000 FCFA (`pricing-agent.ts`, dead code) vs 2500 FCFA (`lib/transport.ts`, code actif).
- **C-08** : `artisan_id` absent du calcul → tarif jamais réellement personnalisé.
