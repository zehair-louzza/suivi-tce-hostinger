# Dossier PDF téléchargeable — Galerie UI/UX ANELEC

> Fonctionnalité intégrée à la **galerie de maquettes** de refonte UI/UX (`/app/frontend`).
> Elle permet à vos décideurs non connectés à la plateforme de recevoir, par e-mail ou via un partage de fichier, un dossier professionnel complet présentant les 5 directions de design proposées.

---

## 1. À quoi sert ce dossier

Les directions proposées sont **cliquables en ligne** via la galerie interactive, mais tous les décideurs n'ont pas forcément un ordinateur sous la main ou un accès à l'aperçu.

Ce **dossier PDF téléchargeable d'un clic** répond à ce besoin : il se partage par e-mail, se consulte hors-ligne, s'imprime, et sert de support à toute réunion de validation.

Cas d'usage principaux :

- Envoi à un président / directeur général pour arbitrage final.
- Pièce jointe à un comité de direction ou à un conseil d'administration.
- Impression pour un atelier en présentiel.
- Archivage dans l'espace documentaire de l'entreprise.

---

## 2. Comment le télécharger

Trois points d'entrée mènent au même dossier :

| Point d'entrée | Emplacement |
|---|---|
| **Bouton principal** | Page d'accueil de la galerie — CTA « Télécharger le dossier PDF » sous le titre d'intro. |
| **Barre de navigation** | Lien « Dossier PDF » dans le header de la galerie (coin haut droit). |
| **Depuis une maquette** | Icône dédiée dans la barre d'outils du viewer d'écran (`/viewer`). |

En cliquant sur l'un de ces boutons, l'utilisateur arrive sur la route `/dossier`, qui affiche directement une prévisualisation **page par page** du dossier. Un bouton « Télécharger le dossier PDF » lance la génération et déclenche le téléchargement du fichier.

Le fichier généré s'appelle : `ANELEC-TCE-Dossier-maquettes-AAAA-MM-JJ.pdf` (date automatique du jour de téléchargement).

---

## 3. Contenu du dossier

Format **A4 portrait** · **9 pages** · taille moyenne **~2,6 Mo**.

### Page 1 — Couverture

- Bandeau de marque **ANELEC GROUPE** (logo + mention « Suivi TCE »).
- Éyebrow `DOSSIER DE REFONTE UI/UX`.
- Titre principal : « 5 directions de design pour une plateforme plus professionnelle ».
- Paragraphe d'introduction résumant la finalité du dossier.
- Bloc de **4 chiffres clés** :
  - **5** directions distinctes
  - **13** écrans + 3 fenêtres couverts
  - **Ordinateur + mobile** (icônes)
  - **0 ligne modifiée** dans l'application existante
- Pied de page : date de préparation + adresse ANELEC.

### Page 2 — Diagnostic

- Éyebrow `01 · DIAGNOSTIC`.
- Titre : « Ce qui freine aujourd'hui l'image professionnelle ».
- Grille de **8 cartes** décrivant les constats relevés dans l'application existante, chacune avec :
  - Niveau de sévérité (Élevé / Moyen / Faible)
  - Description du problème
  - Recommandation de correction
- Encart sombre « Principes communs aux 5 directions » listant les 6 fondamentaux respectés par toutes les propositions (tokens, accessibilité AA, mobile-first, densité contrôlée, hiérarchie, cohérence).

### Pages 3 à 7 — Une page par direction

Chaque direction occupe exactement **une page A4** avec une maquette type cohérente :

1. **En-tête** : numéro, nom de la direction, tagline.
2. **Pour qui ?** — une phrase explicative.
3. **Mini-aperçus visuels côte à côte** :
   - Aperçu **desktop** (tableau de bord stylisé dans la direction).
   - Aperçu **mobile** (téléphone symbolique avec le thème appliqué).
4. **Palette** — grille de 5 teintes principales avec codes HEX lisibles.
5. **Typographie** — 3 blocs présentant les polices (titres / corps / code mono) avec échantillons représentatifs.
6. **Métadonnées** — navigation bureau, navigation mobile, densité, ambiance, références visuelles.
7. **Avantages / Points d'attention** — deux listes côte à côte.
8. **Pied de page** paginé.

Les 5 directions documentées :

| № | Nom | Mood | Idéal pour |
|:-:|---|---|---|
| 01 | **Atlas Clarity** | Clair | Entreprise sérieuse type Linear/Stripe |
| 02 | **Craft Warmth** | Clair | Image chaleureuse et artisan |
| 03 | **Signal Command** | Sombre | Cockpit de dispatchers, longues sessions |
| 04 | **Editorial Swiss** | Clair | Image premium typographique |
| 05 | **Bento Modular** | Clair | Expression de la marque ANELEC |

La direction « Signal Command » apparaît sur **fond sombre** pour illustrer l'ambiance du mode cockpit.

### Page 8 — Tableau comparatif

- Éyebrow `03 · COMPARATIF`.
- Titre : « Comment choisir en un coup d'œil ».
- Table synthétique **5 lignes × 6 colonnes** :
  - Direction (numéro + nom + tagline)
  - Ambiance
  - Densité
  - Navigation bureau
  - Palette dominante (pastilles colorées)
  - Idéal pour (tags)
- Sous-section « Écrans couverts par chaque direction » listant les 13 écrans + 3 fenêtres regroupés par espace (Public, Espace de travail, Gestion, Administration, Terrain, Fenêtres).

### Page 9 — Prochaines étapes

- Fond sombre bleu nuit, cyan en accent.
- Éyebrow `04 · PROCHAINES ÉTAPES`.
- Titre : « Comment avancer après ce dossier ».
- Liste numérotée de **3 étapes concrètes** :
  1. Choisir une direction préférée (idéalement via la galerie interactive).
  2. Lister les ajustements souhaités (couleurs secondaires, logo, écrans prioritaires).
  3. Lancer la refonte progressive écran par écran.
- Encart de contact / revue avec rappel du lien vers la galerie interactive.

---

## 4. Points forts du rendu

- **Pas d'iframes** — toutes les illustrations sont rendues en **HTML/CSS synthétique**, elles sont donc **nettes à l'impression** et dans tout lecteur PDF.
- **Vectoriel partout** où c'est possible (SVG pour les graphiques, bordures et pastilles en CSS).
- **Pagination automatique** avec saut de page propre entre chaque section.
- **Typographies incluses** : les polices utilisées par chaque direction (Space Grotesk, Merriweather Sans, IBM Plex Sans, Manrope, Sora, Figtree, etc.) sont préchargées côté galerie, donc fidèlement capturées.
- **Mode clair/sombre** respecté : la direction Signal Command est rendue sur fond sombre, la page des « Prochaines étapes » également pour tenir le style.

---

## 5. Comment le partager

Après le téléchargement, le fichier est un **PDF standard** compatible :

- Pièce jointe e-mail (≈2,6 Mo, en-dessous de la plupart des limites).
- Partage WhatsApp / Signal / Telegram (fichiers PDF).
- Dépôt sur un espace documentaire type Google Drive / OneDrive / Dropbox.
- Impression sur imprimante bureau standard (format A4).

Il est **auto-portant** : aucune connexion à la galerie n'est nécessaire pour le consulter.

---

## 6. Notes techniques (pour l'équipe de développement)

- **Route** : `/dossier` dans la galerie (`/app/frontend/src/gallery/Dossier.jsx`).
- **CSS dédié** : `/app/frontend/src/styles/dossier.css`.
- **Librairies** : `jspdf` 2.5.2 + `html2canvas` 1.4.1 (toutes deux **chargées dynamiquement** à l'appui du bouton, donc **zéro impact** sur le poids initial de la galerie).
- **Génération** : parcours séquentiel des `.dos-page`, capture html2canvas (échelle × 2 pour la netteté), composition dans un PDF A4 via jsPDF, puis `pdf.save(...)`.
- **Performance** : ~3 à 6 secondes selon la machine, avec un indicateur de progression en direct (`Génération… 42 %`).
- **Nom de fichier** : `ANELEC-TCE-Dossier-maquettes-${date}.pdf`.
- **Non-régression** : aucune modification apportée à `/app/client` ni à `/app/server` — la fonctionnalité est **cantonnée à la galerie**.

---

## 7. Résultat attendu

> Un dossier professionnel, lisible, imprimable, partageable par simple pièce jointe,
> qui permet à **n'importe quel décideur** — même sans accès à la plateforme — de comprendre
> les 5 directions proposées, leurs palettes, leurs typographies et leurs forces respectives,
> et de **choisir en toute connaissance de cause** celle qui conviendra le mieux à ANELEC GROUPE.
