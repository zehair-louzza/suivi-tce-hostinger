# plan.md — Galerie de maquettes UI/UX (refonte visuelle) pour ANELEC TCE

## 1) Objectives
- Proposer **5 directions de design** radicalement différentes (palette, typo, UI kit, densité) pour rendre l’app plus professionnelle.
- Couvrir **tous les écrans** existants (desktop + mobile), avec **pages cliquables** (navigation + interactions simulées) **sans toucher au produit**.
- Livrer une **galerie isolée** dans `/app/frontend` (amovible), qui permet :
  - explorer par direction / écran
  - basculer desktop/mobile
  - comparer côte-à-côte (5 directions sur un même écran)
  - conserver des deep-links (URL partageables)
- Inclure un **audit UI/UX** synthétique + recommandations actionnables.

**Statut objectif : atteint.**
- Galerie servie sur l’URL d’aperçu (remplace temporairement l’aperçu du produit).
- 5 directions livrées : **Atlas Clarity / Craft Warmth / Signal Command / Editorial Swiss / Bento Modular**.
- Couverture complète : login, dashboard, planning, devis, interventions, carte, facturation, comptabilité, donneurs d’ordre, paramètres, utilisateurs, terrain (mobile technicien), vitrine + 3 fenêtres (Excel, rapport e-mail, GPS).
- Interactions clés : navigation interne, modales, tiroirs, palette de commande (Ctrl+K), compare, bascule desktop/mobile.
- Build OK (`yarn build`) et tests QA : **98%**, **0 bug critique**.
- Produit existant **inchangé** (`/app/client`, `/app/server`) — `git status` confirme uniquement des ajouts (`frontend/`, `plan.md`, `design_guidelines.md`, `.emergent/`).

---

## 2) Implementation Steps

### Phase 1 — POC (core workflow isolé : galerie cliquable + device toggle + compare)
**User stories (ciblées)**
1. En tant que décideur, je peux ouvrir une galerie et comprendre en 30s les 5 directions.
2. En tant que décideur, je peux basculer un écran en **desktop/mobile** et conserver le contexte.
3. En tant que décideur, je peux **naviguer** (sidebar/topbar/rail) comme dans une vraie app.
4. En tant que décideur, je peux ouvrir un **modal** (ex: Situation Excel) pour juger la qualité UI.
5. En tant que décideur, je peux **comparer** le même écran sur 5 directions en grille.

**Steps (réalisés)**
- Créer `/app/frontend` (Vite + React) **en JS/JSX uniquement** (aucun impact sur le client TS).
- Routing interne galerie :
  - `/` (audit + overview)
  - `/viewer?dir=…&screen=…&device=desktop|mobile`
  - `/compare?screen=…&device=desktop|mobile`
  - `/m/:dir/:screen` (maquettes cliquables)
- Implémenter les frames (desktop + téléphone) + toolbar (direction switcher, screen picker, device toggle).
- Définir dataset de démo (fictif) + premiers écrans.
- Implémenter compare.

**Checkpoint POC : validé**
- Galerie navigable + compare fonctionnel, sans backend.

**Statut : COMPLETED** ✅

---

### Phase 2 — V1 App Development (tous les écrans + 5 directions complètes)
**User stories (ciblées)**
1. En tant que décideur, je peux parcourir **tous les modules**.
2. En tant que décideur, je peux tester les **patterns clés** (tables, filtres, badges, drawers, modals).
3. En tant que décideur, je peux voir la cohérence **desktop + mobile**.
4. En tant que décideur, je peux juger la lisibilité sur des écrans **denses**.
5. En tant que décideur, je peux partager une URL d’un écran précis (deep link).

**Steps (réalisés)**
- Inventaire d’écrans (aligné sur l’app existante) + notes UX par écran dans `/app/frontend/src/data/screens.js`.
- Maquettes des écrans (couverture complète) :
  - Connexion / création d’espace
  - Tableau de bord (Synthèse / Opérations / Analyse)
  - Planning & dispatch
  - Devis
  - Interventions
  - Carte & tournées (Leaflet)
  - Facturation
  - Comptabilité & équipe
  - Donneurs d’ordre
  - Paramètres métier
  - Utilisateurs & accès
  - App mobile technicien
  - Vitrine (page publique)
  - Fenêtres (modales) : Situation Excel, Envoi rapport e-mail, Clôture GPS
- Implémenter un système de theming via `[data-dir="..."]` + variables CSS.
- Construire une librairie de composants mock (Button, Input, Badge/Pill, Table, Tabs, Modal, Drawer, Card, SubNav, Dropdown, Toast, etc.).
- Interactions : navigation interne (sidebar/top nav/rail/mobile), drawers, modales, palette (Ctrl+K), filtres, vues (table/kanban), bascule mobile.
- Map tiles : passage à des tuiles publiques OSM/Stadia (pour éviter les placeholders « API key required »).

**Statut : COMPLETED** ✅

> Note : les 5 directions initiales du plan ont évolué vers une version “réaliste et marketing-ready” :
> 1) Atlas Clarity (enterprise) 2) Craft Warmth (humain/terrain) 3) Signal Command (cockpit sombre) 4) Editorial Swiss (premium typographique) 5) Bento Modular (moderne identitaire ANELEC).

---

### Phase 3 — Finitions (polish, accessibilité, partage, export visuel)
**User stories (ciblées)**
1. En tant que décideur, je peux lire rapidement les +/− de chaque direction.
2. En tant que décideur, je peux activer des notes par écran (panneau "Ce qui change").
3. En tant que décideur, je peux comparer un écran (desktop/mobile) sur 5 directions.
4. En tant que décideur, je peux tester les flows clés (Excel, rapport, GPS, Ctrl+K).
5. En tant que décideur, je peux reviewer sur mobile (terrain) et desktop.

**Steps (réalisés)**
- Chrome neutre de galerie + navigation par écrans + notes UX par écran (viewer).
- Compare view (desktop + mobile) avec zoom.
- Tests `yarn build` OK.
- QA via testing agent : **98%**, **0 bug critique**.
- Corrections mineures :
  - cohérence de `data-testid` (terrain)
  - styles tokens par direction (base + 5 thèmes)

**Statut : COMPLETED** ✅

---

## 3) Next Actions
- Mettre à jour ce `plan.md` avec le statut final (fait par cette révision).
- (Optionnel) Harmoniser 1–2 `data-testid` low-priority restants signalés par QA (sans urgence).
- (Optionnel) Réduire la taille du bundle (code-splitting), si nécessaire pour un usage long.
- Démarrer la revue :
  1) Ouvrir `/` (overview)
  2) Utiliser `/compare` pour trancher entre directions
  3) Marquer une direction “préférée”
  4) Décider quelle direction retenir pour une future implémentation dans le produit (hors scope ici).

---

## 4) Success Criteria
- `/app/client` et `/app/server` **inchangés** (galerie isolée dans `/app/frontend`). ✅
- 5 directions accessibles, chacune avec **tous les écrans** en desktop + mobile. ✅
- Navigation cliquable + modals clés (Excel, e-mail report, GPS) fonctionnels en mock. ✅
- Page Compare opérationnelle (même écran sur 5 directions). ✅
- Audit UI/UX + principes + notes par écran disponibles dans la galerie. ✅
- Build OK + QA sans bug critique. ✅
