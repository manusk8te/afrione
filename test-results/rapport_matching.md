# Rapport de Test Matching — AfriOne

**Généré le :** 05/06/2026 13:13:17
**Missions testées :** 40
**Anomalies :** 0 erreurs, 1 avertissements, 0 infos

---

## Résumé global

| Indicateur | Valeur |
|---|---|
| Missions testées | 40 |
| Avec matching standard | 39 |
| Avec test urgent | 0 |
| Race conditions testées | 40 |
| Race conditions OK | 0 |
| Anomalies critiques (ERREUR) | 0 |
| Avertissements (WARNING) | 1 |

---

## Tableau des anomalies

| N° | Sévérité | Type | Catégorie | Quartier | Détail |
|---|---|---|---|---|---|
| 3 | ATTENTION | NO_RESULTS | Climatisation | Plateau | Aucun artisan retourné pour la catégorie "Climatisation" |

---

## Détail par mission

### Mission 1 — Plomberie | Cocody | urgent

**Matching standard :**
- Artisans retournés : 4
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `84f3d55b...` (Plomberie, rating: 4.9, quartier: N/A)

### Mission 2 — Électricité | Yopougon | urgent

**Matching standard :**
- Artisans retournés : 3
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `4c06e750...` (Électricité, rating: 4.8, quartier: N/A)

### Mission 3 — Climatisation | Plateau | urgent

**Matching standard :**
- Artisans retournés : 0
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI

**Anomalies :**
- [ATTENTION] NO_RESULTS: Aucun artisan retourné pour la catégorie "Climatisation"

### Mission 4 — Maçonnerie | Marcory | urgent

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 5 — Électricité | Adjamé | urgent

**Matching standard :**
- Artisans retournés : 3
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `4c06e750...` (Électricité, rating: 4.8, quartier: N/A)

### Mission 6 — Plomberie | Abobo | urgent

**Matching standard :**
- Artisans retournés : 4
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `84f3d55b...` (Plomberie, rating: 4.9, quartier: N/A)

### Mission 7 — Électricité | Treichville | urgent

**Matching standard :**
- Artisans retournés : 3
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `4c06e750...` (Électricité, rating: 4.8, quartier: N/A)

### Mission 8 — Plomberie | Koumassi | urgent

**Matching standard :**
- Artisans retournés : 4
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `84f3d55b...` (Plomberie, rating: 4.9, quartier: N/A)

### Mission 9 — Plomberie | Cocody | hesitant

**Matching standard :**
- Artisans retournés : 4
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `84f3d55b...` (Plomberie, rating: 4.9, quartier: N/A)

### Mission 10 — Maçonnerie | Bingerville | hesitant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 11 — Maçonnerie | Riviera | hesitant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 12 — Maçonnerie | Marcory | hesitant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 13 — Maçonnerie | Yopougon | hesitant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 14 — Maçonnerie | Abobo | hesitant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 15 — Maçonnerie | Treichville | hesitant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 16 — Maçonnerie | Koumassi | hesitant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 17 — Maçonnerie | Plateau | entreprise

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 18 — Maçonnerie | Cocody | entreprise

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 19 — Maçonnerie | Marcory | entreprise

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 20 — Maçonnerie | Zone 4 | entreprise

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 21 — Maçonnerie | Adjamé | entreprise

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 22 — Maçonnerie | Yopougon | entreprise

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 23 — Maçonnerie | Treichville | entreprise

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 24 — Maçonnerie | Koumassi | entreprise

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 25 — Maçonnerie | Abobo | vague

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 26 — Maçonnerie | Yopougon | vague

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 27 — Maçonnerie | Adjamé | vague

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 28 — Maçonnerie | Treichville | vague

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 29 — Maçonnerie | Koumassi | vague

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 30 — Maçonnerie | Marcory | vague

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 31 — Maçonnerie | Cocody | vague

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 32 — Maçonnerie | Bingerville | vague

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 33 — Maçonnerie | Cocody | exigeant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 34 — Maçonnerie | Riviera | exigeant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 35 — Maçonnerie | Deux-Plateaux | exigeant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 36 — Maçonnerie | Angré | exigeant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 37 — Maçonnerie | Marcory | exigeant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 38 — Maçonnerie | Plateau | exigeant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 39 — Maçonnerie | Zone 4 | exigeant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)

### Mission 40 — Maçonnerie | Bingerville | exigeant

**Matching standard :**
- Artisans retournés : 2
- Ordre correct (rating DESC) : OUI
- Aucun indisponible : OUI
- Métier correct : OUI
- Artisan optimal : `d0f6bb9d...` (Maçonnerie, rating: 4.3, quartier: N/A)
