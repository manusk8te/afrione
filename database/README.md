# `database/` — schémas historiques

Ces fichiers précèdent `migrations/`. Il y a donc **deux dossiers de SQL** dans
ce dépôt, sans numérotation commune ni table de suivi : rien n'indique ce qui
est appliqué. C'est ainsi que trois schémas sont restés lettre morte pendant
des mois pendant que le code interrogeait les tables correspondantes.

**Toute nouvelle migration va dans `migrations/`, numérotée.** Ce dossier-ci
n'est gardé que pour l'historique.

## État au 2026-08-21

Vérifié table par table contre la base de production. Tout est appliqué,
`agent_runs`, `entreprise_requests`, `pricing_test_cases` et
`shadow_test_results` l'ayant été ce jour-là — elles manquaient depuis le
début, et le code les interrogeait déjà :

| Fichier | Table | État |
|---|---|---|
| `agent_runs.sql` | `agent_runs` | appliqué le 2026-08-21 |
| `shadow_test.sql` | `pricing_test_cases`, `shadow_test_results` | appliqué le 2026-08-21 |
| `migration_entreprise_requests.sql` | `entreprise_requests` | appliqué le 2026-08-21 |
| les autres | — | appliqués antérieurement |

`node scripts/check-schema.mjs` refait ce contrôle et sort en erreur si une
table interrogée par le code manque en base.

## ⚠️ `pricing_reference.SEED-NON-VERIFIE.sql`

Ce fichier crée `pricing_reference` **et l'accompagne de 56 lignes de tarifs**
— 8 métiers × 7 quartiers d'Abidjan, avec des `nb_observations` détaillés —
présentées en commentaire comme « enquête juin 2026 ».

**Ces données n'ont pas été chargées, et ne doivent pas l'être sans
vérification.** Leur origine n'est pas établie, et elles arriveraient en base
avec `source = 'terrain'`, donc indiscernables d'un vrai relevé.

L'enjeu n'est pas théorique : `resolveHourlyRate`
(`src/lib/pricing-agent.ts`) lit `pricing_reference` **en priorité**, avant le
repli `labor_rates`. Ces 56 lignes deviendraient immédiatement la base de tous
les prix proposés aux clients et aux artisans.

La table elle-même a été créée par `migrations/010_donnees_terrain.sql`, vide,
en attente des relevés réels.

Si ces chiffres proviennent d'une vraie enquête, il suffit de les charger :

```bash
node scripts/sql.mjs -f database/pricing_reference.SEED-NON-VERIFIE.sql
```

Sinon, supprimer le fichier.
