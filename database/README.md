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

## `pricing_reference` — seed supprimé le 2026-08-22

Ce dossier contenait un `pricing_reference.sql` accompagné de **56 lignes de
tarifs** — 8 métiers × 7 quartiers d'Abidjan, `nb_observations` détaillés —
présentées en commentaire comme « enquête juin 2026 ».

Ces chiffres ne provenaient d'aucune enquête réelle. Le fichier a été
supprimé, et les données n'ont **jamais été chargées**.

L'enjeu n'était pas théorique : `resolveHourlyRate`
(`src/lib/pricing-agent.ts`) lit `pricing_reference` **en priorité**, avant le
repli `labor_rates`. Ces 56 lignes seraient devenues instantanément la base de
tous les prix proposés aux clients et aux artisans — et, insérées avec
`source = 'terrain'`, indiscernables des vrais relevés à venir.

La table existe, créée vide par `migrations/010_donnees_terrain.sql`, en
attente des relevés terrain réels.
