# Architecture Technique — ANELEC SUIVI TCE

Documentation technique de référence de la plateforme **ANELEC SUIVI TCE** (`https://suivi.anelecgroupe.com`), progiciel SaaS multi-entreprises dédié au chiffrage de devis, à l'automatisation métier et au suivi opérationnel des chantiers Tous Corps d'État (TCE).

---

## 1. Vue d'Ensemble de la Stack

| Couche | Technologies | Rôle |
| :--- | :--- | :--- |
| **Frontend (SPA + PWA)** | React 18, TypeScript, Vite 5, TanStack Query, Zustand, React Router 6 | Interface bureau multi-modules et application mobile terrain hors-ligne |
| **Visualisation & Cartographie** | Recharts, Leaflet / CartoDB, Lucide React | Tableau de bord KPI, graphiques de rentabilité, suivi GPS & tournées |
| **Backend API & Temps Réel** | Node.js, Express 4, TypeScript, Socket.IO 4, Zod, Helmet | API REST validée, contrôle d'accès RBAC serveur, notifications temps réel |
| **ORM & Base de Données** | Prisma 5.22, PostgreSQL 17 (Supabase `eu-west-3`) | Modèle multi-tenant isolé par `companyId`, migrations versionnées |
| **Moteur PDF & Traitement Images** | `pdf-lib`, `sharp` (libvips / MozJPEG) | Génération PDF charte ANELEC Vague-Nuage, compression PDF et photos terrain |
| **Messagerie & Identité** | Nodemailer (SMTP tenant chiffré AES + relais global), Google OAuth 2.0, JWT + bcrypt (12 rounds) | E-mails transactionnels isolés par société, liens clients signés, SSO Google |
| **Qualité & Tests** | `node:test` + `tsx`, base simulée (`fakePrisma`) + PostgreSQL CI | Tests unitaires métier et suite E2E d'isolation des rôles & multi-entreprises |

---

## 2. Organisation du Dépôt

```text
suivi-tce-hostinger/
├── client/                     # Application Frontend React + Vite + PWA
│   ├── index.html              # En-tête SEO/GEO, JSON-LD @graph & pré-rendu sémantique
│   ├── public/                 # Actifs statiques (robots.txt, sitemap.xml, llms*.txt, icônes PWA, manifeste)
│   └── src/
│       ├── components/         # Modules métiers (Devis, Interventions, Planning, Carte, Facturation, Mobile, Admin)
│       ├── lib/                # Client API, optimiseur d'images client, géocodage, export Excel
│       ├── pages/              # Pages routées (Dashboard, Connexion, Liens clients publics, Invitation)
│       ├── stores/             # État d'authentification Zustand & préférences
│       └── styles/             # Thèmes & Design System (Atlas Clarity, Craft Warmth, Bento Modular, etc.)
├── server/                     # Backend Express + Socket.IO
│   ├── config.ts               # Chargement strict des variables d'environnement
│   ├── index.ts                # Entrée Express, CORS, Helmet, en-têtes SEO/AI, SPA fallback
│   ├── lib/                    # Prisma client, RBAC (access.ts / guard.ts), créateur (platformCreator.ts), compression photos
│   ├── domain/                 # Règles pures métier (devisClient, rapportClient, technicianResponse, tenantIsolation)
│   ├── routes/                 # Contrôleurs Express (auth, admin, devis, demandes, interventions, referentiels, liens publics)
│   ├── services/               # Génération & compression PDF, automatisation, conversion idempotente, SMTP
│   └── socket/                 # Diffusion WebSocket cloisonnée par entreprise
├── shared/                     # Contrats partagés Client/Serveur (types.ts, passwordPolicy.ts)
├── prisma/                     # Schéma Prisma & migrations SQL PostgreSQL versionnées
├── scripts/                    # Lanceur production (start.mjs), migrations (migrate.mjs), utilitaires assets/PDF
├── test/                       # Suites de tests unitaires et E2E rôles / multi-tenant / automatisations
└── docs/                       # Documentation technique, exploitation, recette et captures officielles
```

---

## 3. Architecture Multi-Tenant, Multi-Entreprises & Créateur

### 3.1 Isolation Multi-Tenant par `companyId`
- Chaque espace entreprise correspond à un enregistrement dans `companies` (nom, SIRET/SIREN normalisés, adresse siège/dépôt, réglages d'automatisation).
- Chaque jeton JWT signé embarque `{ userId, email, role, companyId }`.
- L'ensemble des requêtes Prisma métier (`devis`, `interventions`, `demandes`, `pointages_techniciens`, `referentiels`, `notifications`, `company_mail_settings`) filtre systématiquement par `companyId = requireCompanyId(req.user?.companyId)`.

### 3.2 Un Même E-mail sur Plusieurs Entreprises
- L'unicité des utilisateurs s'applique au couple **`(LOWER(email), companyId)`** (migration `20261114090000_utilisateur_multi_entreprises`).
- Une même adresse e-mail peut administrer ou collaborer sur plusieurs entreprises cloisonnées, avec rôle, mot de passe et données totalement indépendants.
- Lors de la connexion classique ou Google, si plusieurs comptes valides correspondent au même e-mail, un écran de sélection d'entreprise (`Nom + SIRET/SIREN`) est présenté **uniquement après validation de l'identité**.

### 3.3 Identité Créateur Signée en Dur (`platform_creator`)
- Les constantes canoniques du fondateur (`PLATFORM_CREATOR` : `louzza.zehair@gmail.com`, `+33628618628`) sont définies dans `shared/types.ts` et persistées dans la table PostgreSQL `platform_creator` (protégée par Row-Level Security et `REVOKE ALL FROM PUBLIC, anon, authenticated` — migration `20261114150000_platform_creator`).
- La reconnaissance (`isPlatformCreatorIdentity`) s'appuie sur l'e-mail normalisé ou le numéro de téléphone français normalisé E.164 (`normaliserTelephoneFr`), **indépendamment de l'`id` numérique attribué en base**.

---

## 4. Contrôle d'Accès RBAC (« Deny by Default »)

Le contrôle d'accès est appliqué côté serveur sur **chaque route** via `server/lib/guard.ts` et les fonctions pures de `server/lib/access.ts` (relisant l'utilisateur en base) :

| Code Rôle | Intitulé | Périmètre Opérationnel | Restrictions Strictes |
| :--- | :--- | :--- | :--- |
| `ADMIN` | Direction | Gouvernance complète de sa société (utilisateurs, SMTP, facturation, rentabilité, suppressions) | Cloisonné à sa propre société |
| `CHIFFRAGE_DEVIS` | Chargé d'études (chiffrage) | Devis complets, visites de chiffrage, conversion devis → intervention | Pas de planning global, pas de rapports finaux ni facturation |
| `CONDUCTEUR_TRAVAUX` | Planificateur | Demandes, planning Gantt, affectation techniciens, interventions, clôture | Pas de création/chiffrage de devis ni de facturation |
| `REDACTEUR_RAPPORTS` | Rapports et facturation | Relecture terrain, validation/envoi rapports clients, facturation B2B/B2C | Pas de devis, planning ni réaffectation technicien |
| `TECHNICIEN` | Technicien terrain | Application mobile PWA, ses propres missions, pointage GPS, photos & compte-rendu | Aucun montant, aucune facturation, aucune mission tiers |

---

## 5. Moteur PDF ANELEC & Compression Haute Qualité

### 5.1 Charte Graphique Vague-Nuage (`server/services/pdfLayout.ts`)
- Trois gabarits PDF officiels générés nativement côté serveur avec `pdf-lib` :
  - **Devis Client** (`devisPdf.ts`)
  - **Rapport d'Intervention Officiel** (`rapportPdf.ts`)
  - **Visite Technique Préalable — Usage Interne** (`visiteTechniquePdf.ts`, destiné à préparer et fiabiliser le chiffrage de devis sans divulgation client)
- En-tête identitaire en courbe vague-nuage bleu/ardoise, logotype blanc vectorisé sur fond transparent, et mention canonique `https://suivi.anelecgroupe.com` cadrée dans l'en-tête et le pied de page.

### 5.2 Pipeline de Compression PDF & Photos Terrain
- **Compression des flux PDF** (`server/services/pdfCompression.ts`) : réencodage adaptatif et compactage des objets graphiques lors de la génération et du dépôt de PDF (`preparerPdfDeposeCompresse`) afin de minimiser l'empreinte disque tout en préservant la netteté typographique.
- **Optimisation des photos de chantier** (`client/src/lib/imageOptimizer.ts` + `server/lib/terrainPhotos.ts`) : redimensionnement intelligent et compression **MozJPEG** côté client avant upload puis assainissement/optimisation côté serveur via `sharp` avec conservation fidèle des détails techniques.

---

## 6. Workflows d'Automatisation & Liens Clients Sécurisés

1. **Conversion Devis → Intervention Idempotente (`linkedConversion.ts`)** : conserve le devis d'origine, exige un devis au statut commercial `Accepté` avec objet renseigné et un en-tête `Idempotency-Key` pour garantir l'absence de doublons en cas de double-clic ou reprise réseau.
2. **Automatisation A — Réponse Technicien (`technicianAutomation.ts`)** : confirmation ou refus motivé sur mobile, relance in-app après délai paramétrable, escalade vers Planificateur & Direction, option de pause week-end (samedi 17 h – lundi 6 h).
3. **Automatisation B — Devis Client par Lien Sécurisé (`devisClient.ts`)** : jeton HMAC signé à usage unique (validité 30 jours), sélection contrôlée des destinataires depuis la fiche client, relances J+3 / J+7 en heures ouvrées, révocation automatique en cas de modification substantielle.
4. **Automatisation C — Rapport Client par Lien Sécurisé (`rapportClient.ts`)** : réservée aux rapports validés en interne, choix individuel des photos transmissibles, validation ou émission de réserves obligatoirement motivées par le client (aucune validation tacite après expiration).

---

## 7. Référencement Web & IA (SEO + GEO / AIO)

- **Indexation universelle** ([`client/public/robots.txt`](../client/public/robots.txt)) : ouverture explicite aux robots web (`Googlebot`, `Bingbot`, `Qwantbot`, `DuckDuckBot`, `YandexBot`, `Baiduspider`, `Applebot`, `Slurp`) et aux moteurs IA (`GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `ClaudeBot`, `Claude-SearchBot`, `anthropic-ai`, `Google-Extended`, `GoogleOther`, `meta-externalagent`, `DuckAssistBot`, `YouBot`, `MistralAI-User`, `xAI-Bot`, `GrokBot`, `CCBot`), avec exclusion stricte des routes privées (`/api/`, `/devis-client/`, `/rapport-client/`, `/invitation`).
- **Ressources dédiées aux modèles IA** : `/llms.txt`, `/llms-full.txt`, `/.well-known/ai-plugin.json`, en-tête HTTP `Link: <https://suivi.anelecgroupe.com/llms.txt>; rel="alternate"; type="text/markdown"`, et en-têtes `X-Robots-Tag` configurés dans [`server/index.ts`](../server/index.ts).
- **Données structurées & pré-rendu** ([`client/index.html`](../client/index.html)) : graphe Schema.org `@graph` (`WebSite`, `Organization`, `SoftwareApplication`, `FAQPage`) et contenu HTML sémantique dans `#root` pour l'indexation sans exécution JavaScript.

---

## 8. Stratégie de Tests

| Suite | Commande | Périmètre |
| :--- | :--- | :--- |
| **Compilation & Typage** | `npm run build` | Vérification TypeScript client + bundle Vite + compilation TypeScript serveur (`tsconfig.server.json`) |
| **E2E Rôles & Isolation** | `npm run test:roles` | 57 scénarios : droits RBAC, isolation multi-tenant, automatisations A/B/C, multi-entreprises, fiches clients |
| **Tests Unitaires Métier** | `npx tsx --test test/creatorIdentity.test.ts test/accessRules.test.ts test/devisClient.test.ts test/rapportClient.test.ts test/workflowAutomation.test.ts test/passwordPolicy.test.ts` | Identité créateur, règles d'accès pures, devis/rapports clients, formules workflows, politique mots de passe |
