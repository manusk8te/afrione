# Tester AfriOne

## Avant toute session — 30 secondes

```bash
node scripts/qa-liberer-artisans.mjs   # qui est bloqué ?  --apply pour libérer
node scripts/qa-inventory.mjs          # qui peut faire quoi ?
```

**Si tu ne fais qu'une chose, fais la première.**

## Le piège

`idx_artisan_single_active_mission` (migrations/003) interdit à un artisan
d'accepter quoi que ce soit tant qu'il traîne **une** mission en `en_route` ou
`en_cours`. L'erreur Postgres ne remonte pas à l'écran : le bouton
« Accepter » échoue **en silence**.

Il y a deux comptes artisans. Deux missions oubliées paralysent donc la
totalité des tests. C'est arrivé du 13 au 21 août 2026 — huit jours à croire
que l'acceptation était cassée alors que la base refusait simplement une
seconde mission active.

Une mission de test se termine ou s'annule. Elle ne se ferme jamais en
laissant l'onglet.

## Ce dont tu disposes réellement

| | |
|---|---|
| Comptes | 5 — 3 clients, 2 artisans |
| Métiers couverts | **Menuiserie uniquement** |
| Matériaux au catalogue | 526, dont 94 % scrapés de Jumia CI |

**Conséquence à connaître.** Une mission urgente dans un métier non couvert
part quand même : le fallback de `findAllCandidates` (src/lib/dispatch.ts)
diffuse à *tous* les artisans disponibles, quel que soit leur corps de métier.
Tu ne testes donc pas le vrai matching — c'est le bug C-06, connu, ouvert.

## Les outils

| Script | Ce qu'il fait |
|---|---|
| `qa-liberer-artisans.mjs` | libère les artisans bloqués, rembourse l'escrow. Dry-run par défaut |
| `qa-inventory.mjs` | comptes, métiers couverts, éligibilité au broadcast urgent. Lecture seule |
| `repro-accept.mjs` | monte l'état d'avant-clic et appelle l'API déployée — **seul moyen de lire la vraie erreur Postgres** |
| `test-warroom-rbac.mjs` | permissions War Room, provisionne ses propres comptes jetables |
| `watch-urgent.mjs` | suit un broadcast urgent en direct |
| `cleanup-stuck-dispatch.mjs` | missions figées en `dispatching` |
| `check-permissions.mjs` | matrice de rôles ↔ interface (`npm run check:perms`) |
| `sql.mjs` | SQL arbitraire sur la base via l'API Management |

## Lire la base directement

```bash
node scripts/sql.mjs "select status, count(*) from missions group by 1"
node scripts/sql.mjs -f migrations/010_xxx.sql
```

Demande `SUPABASE_ACCESS_TOKEN` (jeton `sbp_…`) dans `.env.local`.
Il n'y a ni `DATABASE_URL`, ni `psql`, ni CLI Supabase : la clé `service_role`
touche les données mais jamais le schéma. L'API Management est la seule voie
pour le DDL.

**Tester un garde sans toucher aux données** — le rôle s'usurpe en
transaction annulée :

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid-utilisateur>"}';
-- la requête à éprouver
rollback;
```

## Deux réflexes qui auraient fait gagner des semaines

**Un échec silencieux n'est pas un succès.** Trois pannes de ce projet se
présentaient comme des réussites : RLS sans policy UPDATE ne refuse pas, il ne
modifie rien (223 accusés de lecture perdus) ; le scraper Jumia rendait un job
vert depuis onze semaines sans écrire une ligne ; le bouton « Accepter »
échouait sans message. Quand une opération « marche » mais que rien ne change,
compte les lignes touchées.

**Vérifier la base avant de croire un fichier.** La migration 007 supposait une
policy qui n'existait plus. La jouer à l'aveugle aurait créé des doublons.
Lire d'abord, appliquer ensuite.
