# AFRIONE — Setup Guide

## 🚀 Démarrage rapide

### 1. Cloner et installer

```bash
npm install
```

### 2. Variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplir `.env.local` avec tes clés :
- **Supabase** → https://supabase.com (créer un projet)
- **OpenAI** → https://platform.openai.com
- **Twilio** → https://twilio.com (pour OTP SMS)
- **Google Maps** → https://console.cloud.google.com
- **Wave Business** → contact Wave CI pour l'API

### 3. Base de données Supabase

Dans le SQL Editor de Supabase, coller et exécuter :
```
database/schema.sql
```

Cela crée :
- 15 tables PostgreSQL + pgvector
- Indexes de performance
- Row Level Security (RLS)
- Données de seed (tarifs, matériaux)

### 4. Lancer en développement

```bash
npm run dev
```

→ http://localhost:3000

---

## 📁 Structure du projet

```
src/
├── app/
│   ├── page.tsx              # P1 — Landing Page
│   ├── auth/page.tsx         # P4 — Connexion OTP
│   ├── diagnostic/page.tsx   # P6 — Diagnostic IA ⭐
│   ├── artisans/
│   │   ├── page.tsx          # P2 — Liste artisans
│   │   └── [id]/page.tsx     # P3 — Profil artisan
│   ├── dashboard/page.tsx    # P12 — Dashboard client
│   ├── artisan-space/
│   │   ├── dashboard/page.tsx # P13-P18 — Espace artisan
│   │   └── register/page.tsx  # Inscription artisan
│   ├── admin/page.tsx        # P20 — Dashboard admin
│   └── api/
│       ├── diagnostic/route.ts  # API OpenAI GPT-4o
│       ├── matching/route.ts    # Algo matching artisans
│       ├── payment/route.ts     # Wave Business escrow
│       └── chat/route.ts        # Firebase RT DB
├── components/
│   ├── layout/Navbar.tsx
│   └── ui/
├── lib/
│   └── supabase.ts
└── types/
    └── database.ts           # 15 tables typées
```

## 🗄️ Base de données — 15 tables

| Table | Description |
|-------|-------------|
| `users` | Tous les utilisateurs (client/artisan/admin) |
| `artisan_pros` | Profils artisans étendus |
| `kyc_security` | Documents KYC |
| `price_materials` | Prix de référence matériaux (Adjamé/Treichville) |
| `labor_rates` | Tarifs horaires par métier |
| `service_fees` | Commissions plateforme |
| `missions` | Flux des missions (6 statuts) |
| `diagnostics` | Résultats IA + embeddings |
| `quotations` | Devis détaillés |
| `proof_of_work` | Photos avant/après |
| `chat_history` | War Room messages |
| `gps_tracking` | Suivi GPS temps réel |
| `transactions` | Paiements Wave + escrow |
| `wallets` | Portefeuilles artisans |
| `problem_embeddings` | Mémoire IA pgvector |
| `sentiment_logs` | Analyse sentiment |

## 🤖 Modules IA

| Module | Modèle | Usage |
|--------|--------|-------|
| **AfriOne-Brain Parser** | GPT-4o | Diagnostic + estimation prix |
| **Devis Formatter** | GPT-4o-mini | Génération devis structuré |
| **Sentiment Analysis** | GPT-4o + pgvector | Analyse litiges |
| **Smart Pricing** | Algo custom | Comparaison prix Adjamé/Treichville |
| **Algo Matcher** | GeoLib + Score | Distance × Ponctualité × Expertise |

## 🚢 Déploiement

```bash
# Vercel
npx vercel --prod

# Variables d'env sur Vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add OPENAI_API_KEY
# ... etc
```

## 📱 Pages à développer (roadmap)

- [ ] P3 — Profil artisan public détaillé
- [ ] P5 — Onboarding après inscription  
- [ ] P7 — Matching & sélection artisans
- [ ] P8 — War Room (chat temps réel Firebase)
- [ ] P9 — Paiement Wave + escrow
- [ ] P10 — Suivi GPS live
- [ ] P11 — Clôture & notation
- [ ] P16 — Saisie prestation artisan
- [ ] P17 — Photo fin de chantier
- [ ] P21 — Cockpit prix admin
- [ ] P22 — Validation KYC admin
- [ ] P23 — Litiges & arbitrage IA
