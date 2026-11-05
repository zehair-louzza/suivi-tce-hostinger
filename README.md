# ANELEC GROUPE — Plateforme de Suivi TCE & Dispatch Terrain

Application d'entreprise complète de gestion des devis, interventions tous corps d'état (TCE), planning Gantt d'équipes et application mobile pour techniciens terrain avec horodatage certifié, prise de photos optimisées et rédaction de rapports officiels.

![ANELEC GROUPE](client/public/brand/anelec-logo.png)

---

## Sommaire

1. [Vue d'Ensemble & Architecture](#vue-densemble--architecture)
2. [Identité Visuelle & Thème Glass Bubbles](#identité-visuelle--thème-glass-bubbles)
3. [Fonctionnalités Principales](#fonctionnalités-principales)
   - [Centre de Pilotage ("Aujourd'hui")](#1-centre-de-pilotage-aujourdhui)
   - [Pipeline Devis (22 colonnes & Visites)](#2-pipeline-devis-22-colonnes--visites)
   - [Interventions TCE (23 colonnes & Facturation)](#3-interventions-tce-23-colonnes--facturation)
   - [Planning Gantt & Dispatch d'Équipes Multi-Techniciens](#4-planning-gantt--dispatch-déquipes-multi-techniciens)
   - [Application Mobile Technicien PWA](#5-application-mobile-technicien-pwa)
   - [Optimisation Stricte du Stockage des Photos (< 75 Ko)](#6-optimisation-stricte-du-stockage-des-photos--75-ko)
   - [Centre des Rapports, Visionneuse Lightbox & Validation Admin](#7-centre-des-rapports-visionneuse-lightbox--validation-admin)
   - [Workstation Super-Admin & Droits Utilisateurs](#8-workstation-super-admin--droits-utilisateurs)
4. [Installation de l'Application Mobile (PWA)](#installation-de-lapplication-mobile-pwa)
5. [Stack Technique & Déploiement](#stack-technique--déploiement)
   - [Variables d'Environnement](#variables-denvironnement)
   - [Base de Données Supabase & Migrations Prisma](#base-de-données-supabase--migrations-prisma)
   - [Déploiement Hostinger Cloud](#déploiement-hostinger-cloud)
6. [Documentation & Artefacts Associés](#documentation--artefacts-associés)

---

## Vue d'Ensemble & Architecture

La plateforme ANELEC GROUPE interconnecte en temps réel le bureau d'études, les coordinateurs de travaux, les conducteurs d'opérations et les techniciens sur site.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      ANELEC GROUPE CLOUD ECOSYSTEM                     │
└────────────────────────────────────────────────────────────────────────┘
                 │                                        │
    [ POSTE BUREAU / DIRECTION ]             [ APPLICATION MOBILE TERRAIN ]
    • Centre de pilotage (KPIs)              • Pointage arrivée/départ certifié
    • Dispatching & Planning Gantt           • Actions pré-remplies par corps d'état
    • Chiffrage devis (22 colonnes)          • Photos compressées (< 75 Ko)
    • Validation rapports & facturation      • Éléments de chiffrage & compte-rendu
                 │                                        │
                 ▼                                        ▼
    ┌──────────────────────────────────────────────────────────┐
    │       Serveur Express API + WebSockets (Hostinger)       │
    └──────────────────────────────────────────────────────────┘
                                 │
                                 ▼
    ┌──────────────────────────────────────────────────────────┐
    │        PostgreSQL Supabase (Session Pooler SSL)          │
    │        Tables : users, devis, interventions, pointages   │
    └──────────────────────────────────────────────────────────┘
```

---

## Identité Visuelle & Thème Glass Bubbles

L'application intègre la charte graphique officielle **ANELEC GROUPE** :
- **Logotype officiel** : Maison stylisée tricolore (Jaune, Vert, Rouge) et typographie noire/blanche épurée.
- **Thème Glass Bubbles** :
  - Texture papier d'art texturée en arrière-plan (`paper-texture`).
  - Bulles et halos lumineux doux et animés (`BubbleBackdrop.tsx`).
  - Cartes et panneaux à effet de verre dépoli (*frosted glass* / `backdrop-filter: blur`).
  - Bordures subtiles, ombrages élégants et contraste certifié pour le confort visuel sur écran de bureau comme en plein soleil sur smartphone.

---

## Fonctionnalités Principales

### 1. Centre de Pilotage ("Aujourd'hui")
- **Bandeau de KPIs en temps réel** :
  - *Devis à relancer* (relances prévues ou échues).
  - *Échéances / Réponses en retard* (suivi des dates limites clients).
  - *Devis acceptés à convertir* (devis signés sans intervention liée).
  - *Missions à planifier* (visites techniques devis + interventions travaux).
  - *📷 Rapports & Photos reçus* (déclarations des techniciens en attente de vérification).
  - *Interventions en retard* (dépassements de délais opérationnels).
  - *Terminées à facturer* (dossiers clôturés prêts pour émission de facture).
- **Bannière d'alerte instantanée** dès qu'un technicien enregistre un compte-rendu ou télécharge des photos depuis le chantier.
- **Jauge de capacité et d'affectation des techniciens** en temps réel.

### 2. Pipeline Devis (22 colonnes & Visites)
- **Tableur interactif 22 colonnes** et mode Kanban commercial (Nouveau, Visite à planifier, Chiffrage en cours, Envoyé, En négociation, Accepté, Refusé, Sans suite).
- **Visites techniques devis intégrées** : affectation d'un technicien, synchronisation sur le calendrier et report des éléments relevés par le technicien dans la fiche chiffrage.
- **Conversion intelligente** : transformation d'un devis accepté en fiche d'intervention travaux tout en préservant l'historique et la référence devis d'origine.

### 3. Interventions TCE (23 colonnes & Facturation)
- **Tableau complet 23 colonnes** couvrant tout le cycle de vie de l'intervention :
  - Données contractuelles : Référence (`INT-2026-XXX`), Client, Chantier, Contact, Corps d'état, Objet des travaux.
  - Planification : Technicien affecté, Date, Créneau horaire prévu (`heureDebut`, `heureFin`).
  - Suivi opérationnel : Statut (À planifier, Planifiée, En cours, Suspendue, Terminée - à valider, Clôturée).
  - **Photos & Rapport** : Nombre de photos transmises, badge d'actions réalisées et état du rapport (`🔔 Reçu à valider`, `✅ Validé`, `À rédiger`).
  - Facturation : Statut facture (Non facturée, Facturée, En litige), Numéro de facture, Montant HT.
- **Tiroir inspecteur latéral** permettant de consulter et d'éditer l'intégralité du dossier en 4 onglets :
  1. *Affectation & Créneau*
  2. *Dossier Terrain & Photos*
  3. *Facturation*
  4. *Alertes & Devis lié*

### 4. Planning Gantt & Dispatch d'Équipes Multi-Techniciens
- **Timeline journalière et hebdomadaire** avec vue par technicien.
- **Formation d'équipes journalières modulables** :
  - Regroupement de 2, 3 individus ou plus pour intervenir ensemble sur un même chantier.
  - Affectation à la journée, sur une plage de dates ou sur des plages horaires spécifiques.
  - Déplacement et ajustement des créneaux par glisser-déposer (*drag-and-drop*).
- **Matrice des compétences métiers** : contrôle automatique de l'adéquation entre le corps d'état requis (Électricité, Plomberie, Peinture, Serrurerie, CVC, Maçonnerie...) et les qualifications du technicien.

### 5. Application Mobile Technicien PWA
- **Isolation stricte des profils techniciens** :
  - Chaque technicien accède exclusivement à ses propres missions et à sa propre journée.
  - Suppression de tout sélecteur d'usurpation : le compte connecté est verrouillé sur l'intervenant désigné par le super-administrateur.
  - L'accès aux dossiers des collègues et aux paramètres d'administration est strictement bloqué.
- **Pointage certifié infalsifiable** :
  - Horodatage strict calculé par le serveur lors de la pression sur les boutons **☀️ Arrivée bureau / site** et **🌙 Fin d'intervention / journée**.
  - Remplacement de la saisie manuelle libre d'heure : l'heure réelle de Paris est verrouillée et infalsifiable.
- **Déclarations terrain simplifiées** :
  - Actions pré-remplies cochables en 1 clic par corps d'état.
  - Relevé d'éléments pour création de devis complémentaire.
  - Saisie vocale ou dictée du compte-rendu terrain.
  - Prise de photos via l'appareil photo du smartphone ou la galerie.

### 6. Optimisation Stricte du Stockage des Photos (< 75 Ko)
Pour garantir que la base de données PostgreSQL / Supabase ne soit **jamais saturée**, l'application embarque le moteur d'optimisation [`imageOptimizer.ts`](client/src/lib/imageOptimizer.ts) :
- **Conversion et compression automatique avant l'envoi** :
  - Les photos prises par les smartphones (fichiers bruts de 3 à 12 Mo en 12 à 48 Mpx) sont automatiquement redimensionnées (max 820 px) avec lissage bicubique haute fidélité.
  - Conversion systématique en JPEG optimisé avec purge des métadonnées EXIF volumineuses.
  - **Poids garanti entre 40 Ko et 75 Ko par photo** (réduction de plus de 95 % de l'espace disque).
  - La netteté des compteurs, numéros de série et étiquettes de disjoncteurs reste parfaitement lisible.
- **Plafond de sécurité** : 10 photos maximum par intervention.
- **Assainissement serveur** ([`interventions.ts`](server/routes/interventions.ts)) : validation et filtrage strict des données pour empêcher tout dépassement de quota.

### 7. Centre des Rapports, Visionneuse Lightbox & Validation Admin
- **Notification visuelle permanente** :
  - Badge rouge sur l'onglet **Workstation Admin** du menu latéral.
  - Compteur d'attente sur le sous-onglet *Déclarations & Rédaction Rapports*.
- **Dossier Terrain interactif** :
  - Affichage des horaires réels pointés par le technicien.
  - Liste des actions réalisées sur site.
  - Compte-rendu et éléments de devis relevés par l'intervenant.
- **Visionneuse plein écran haute résolution ([`PhotoLightbox.tsx`](client/src/components/PhotoLightbox.tsx))** :
  - Cliquez sur n'importe quelle photo pour l'agrandir en plein écran.
  - Boutons de zoom interactif (🔍+ / 🔍- / 100%).
  - Bouton **⬇ Télécharger** pour exporter l'image sur l'ordinateur.
  - Navigation aisée au clavier (Flèches gauche/droite et touche Échap).
- **Génération & Validation officielle en 1 clic** :
  - Bouton *« ⚡ Générer depuis les données terrain »* pour fusionner automatiquement les actions, les horaires, les photos et les constatations dans le rapport officiel ANELEC.
  - Passage en statut `Validé & Clôturé` et bascule automatique en `Prêt à facturer`.

### 8. Workstation Super-Admin & Droits Utilisateurs
- **Gestion granulaire des utilisateurs et permissions** :
  - Création de comptes avec attribution de rôle : `SUPER_ADMIN`, `ADMIN`, `CHIFFRAGE_DEVIS`, `CONDUCTEUR_TRAVAUX`, `TECHNICIEN`, `VIEWER`.
  - Matrice de permissions fines : gestion des utilisateurs, édition devis, vue des montants financiers HT, modification des interventions, rédaction des rapports, facturation, mode mobile exclusif.
  - Liaison directe entre un compte utilisateur et un nom de technicien dans les référentiels.
- **Tableau de suivi des pointages** matin et soir de l'ensemble de la flotte de techniciens avec calcul automatique de l'amplitude journalière de travail.

---

## Installation de l'Application Mobile (PWA)

L'application est conçue selon les standards Progressive Web App (PWA) avec Service Worker, manifest officiel et icônes adaptatives ANELEC.

Un bouton d'installation **« 📲 Télécharger l'App »** est intégré dans l'interface et guide l'utilisateur pas-à-pas selon son téléphone :

### Sur iPhone / iPad (iOS Safari)
1. Ouvrez `https://suivi.anelecgroupe.com` dans le navigateur **Safari**.
2. Appuyez sur le bouton **Partager** (icône rectangle avec une flèche vers le haut ⎋ en bas de l'écran).
3. Faites défiler vers le bas et sélectionnez **« Sur l'écran d'accueil »** (+).
4. Confirmez en appuyant sur **Ajouter** en haut à droite.
5. L'icône ANELEC GROUPE apparaît sur votre écran d'accueil et s'ouvre en plein écran comme une application native de l'App Store.

### Sur Android (Google Chrome / Samsung Internet)
1. Ouvrez `https://suivi.anelecgroupe.com` dans **Google Chrome**.
2. Appuyez sur le menu **Options** (les 3 points verticaux ⋮ en haut à droite).
3. Appuyez sur **« Installer l'application »** ou **« Ajouter à l'écran d'accueil »**.
4. Validez l'installation. L'application est installée directement sur le téléphone.

---

## Stack Technique & Déploiement

| Composant | Technologie |
| --- | --- |
| **Frontend** | React 18, TypeScript, Vite, TanStack React Query, React Router DOM, React Hot Toast |
| **Backend** | Node.js (>=20), Express, Socket.IO, JWT, bcryptjs |
| **ORM & Base** | Prisma ORM, PostgreSQL Supabase (Session Pooler avec SSL) |
| **PWA** | Web App Manifest, Service Worker Cache First / Network Fallback, Icônes Masquables |
| **Production** | Hostinger Cloud Node.js Application, Domaine `suivi.anelecgroupe.com` |

### Scripts du Projet

```sh
# Installation des dépendances
npm ci --include=dev

# Lancement en développement (Vite + Serveur Express)
npm run dev

# Compilation de production
npm run build:client   # Compile le frontend React dans dist/client
npm run build:server   # Compile le backend Express dans dist/server
npm run build          # Compile frontend et backend

# Démarrage en production (Hostinger)
npm start              # Exécute scripts/start.mjs
```

### Variables d'Environnement

Définies dans le panneau Hostinger Cloud (et `.env` local) :

```ini
NODE_ENV=production
PORT=3000
NPM_CONFIG_INCLUDE=dev

# URI PostgreSQL Supabase (Session Pooler port 5432 avec SSL)
DATABASE_URL="postgresql://postgres.qfhxptwsuotqnrihzhxw:[MOT_DE_PASSE]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=require"

# Sécurité & CORS
CORS_ORIGIN=https://suivi.anelecgroupe.com
SOCKET_CORS_ORIGIN=https://suivi.anelecgroupe.com
JWT_SECRET=votre_cle_jwt_aleatoire_tres_longue
COOKIE_SECRET=votre_cle_cookie_aleatoire_tres_longue
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
```

### Base de Données Supabase & Migrations Prisma

Le schéma de données se trouve dans [`prisma/schema.prisma`](prisma/schema.prisma).

Pour appliquer les migrations en toute sécurité :
```sh
node scripts/migrate.mjs
```

> **Attention** : Ne jamais utiliser `prisma migrate reset` ou `--force-reset` sur la base de production. Les migrations sont versionnées et appliquées de manière incrémentale.

---

## Documentation & Artefacts Associés

| Document / Artefact | Description |
| --- | --- |
| [`client/src/lib/imageOptimizer.ts`](client/src/lib/imageOptimizer.ts) | Moteur d'optimisation et compression d'images terrain (< 75 Ko) |
| [`client/src/components/PhotoLightbox.tsx`](client/src/components/PhotoLightbox.tsx) | Visionneuse plein écran de photos avec zoom et téléchargement |
| [`client/src/components/AdminWorkstation.tsx`](client/src/components/AdminWorkstation.tsx) | Poste de commandement super-admin, matrice de droits et rédaction de rapports |
| [`client/src/components/TechnicianMobileView.tsx`](client/src/components/TechnicianMobileView.tsx) | Interface smartphone isolée avec pointage certifié et déclarations terrain |
| [`client/src/components/InstallAppButton.tsx`](client/src/components/InstallAppButton.tsx) | Composant d'installation PWA avec guide interactif iOS et Android |
| [`client/public/manifest.webmanifest`](client/public/manifest.webmanifest) | Manifeste PWA officiel ANELEC GROUPE |
| [`client/public/sw.js`](client/public/sw.js) | Service Worker pour le fonctionnement hors ligne et les performances |
| [`client/public/brand/`](client/public/brand/) | Logos et icônes officielles haute définition ANELEC GROUPE |
| [`DEPLOIEMENT_HOSTINGER_CONVERSION.md`](DEPLOIEMENT_HOSTINGER_CONVERSION.md) | Guide technique de conversion devis et architecture Hostinger |
| [`DEPLOY_SUPABASE.md`](DEPLOY_SUPABASE.md) | Procédure de déploiement et configuration PostgreSQL Supabase |
| [`FIX_INTERVENTIONS.md`](FIX_INTERVENTIONS.md) | Historique des résolutions et fiabilisation des routes interventions |
| [`PRISMA_V2_RECONCILIATION.md`](PRISMA_V2_RECONCILIATION.md) | Réconciliation du schéma Prisma v2 et types TypeScript |

---

## Licence & Propriété

© ANELEC GROUPE — Tous droits réservés.
Application développée sur mesure pour le suivi technique, opérationnel et financier TCE.
