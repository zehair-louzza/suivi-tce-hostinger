# Suivi TCE — Devis et interventions

Application React/TypeScript avec API Express, Prisma, PostgreSQL Supabase et Socket.io. Configuration actuelle : application web Node.js sur Hostinger Cloud, et non VPS avec SQLite. Les anciennes instructions SQLite, Nginx et PM2 ne s'appliquent pas a ce deploiement.

## Trois vues distinctes

| Route | Titre | Contenu |
| --- | --- | --- |
| / | Tableau de bord | Vue combinee des devis et interventions, compteurs et legende |
| /devis | Devis | Uniquement les devis, recherche et actions devis |
| /interventions | Interventions | Uniquement les interventions, recherche et actions interventions |

App.tsx choisit explicitement le mode de DashboardPage. Les panneaux et le formulaire sont partages et montes conditionnellement, pas caches par CSS. Les requetes de liste/statistiques sont activees uniquement pour les familles visibles. Le Layout partage la navigation, les connexions temps reel et le titre adapte a la route. Les changements de route reinitialisent les formulaires ouverts. L'heure affichee dans l'en-tete est une horloge locale, pas une preuve de synchronisation des donnees.

## Structure utile

- client/src/App.tsx : routes protegees et modes de vue.
- client/src/pages/DashboardPage.tsx : panneaux, recherches, formulaire et actions partages.
- client/src/components/Layout.tsx : navigation et titres.
- client/src/lib/api.ts : client HTTP avec cookies.
- client/src/styles/design-tokens.css, global.css, layout.css : theme et mise en page responsive.
- server/routes/auth.ts : authentification JWT.
- server/routes/interventions.ts : validation normalisee et gestion async des interventions.
- server/routes/devis.ts : devis et conversion ; voir limites ci-dessous.
- prisma/schema.prisma, prisma/migrations : schema PostgreSQL et migrations versionnees.
- scripts/start.mjs : demarrage sans migration bloquante.
- scripts/migrate.mjs : application des migrations dans une etape separee.

## Installation locale

Node.js >=20, npm. Installer avec npm ci en incluant les devDependencies. Creer un fichier .env prive depuis .env.example et remplacer imperativement l'ancienne URL SQLite par une URL PostgreSQL de developpement. Ne jamais utiliser la base de production pour des essais de schema.

```sh
npm ci --include=dev
npx prisma generate
node scripts/migrate.mjs
npm run dev
```

Le fichier .env.example historique peut encore contenir des exemples SQLite/developpement ; les reglages ci-dessous sont ceux du deploiement PostgreSQL actuel. Ne committer aucun secret.

## Hostinger Cloud

- Framework Express ; branche main ; repertoire racine ./.
- Compilation npm run build ; entree scripts/start.mjs.
- NODE_ENV=production ; PORT=3000 ; NPM_CONFIG_INCLUDE=dev.
- DATABASE_URL : URI PostgreSQL Supabase Session pooler port 5432, avec mot de passe correctement encode et TLS (sslmode=require), conservee uniquement dans les variables serveur. Preserver les parametres deja presents dans l'URI.
- CORS_ORIGIN et SOCKET_CORS_ORIGIN : https://suivi.anelecgroupe.com.
- JWT_SECRET et COOKIE_SECRET : valeurs longues aleatoires distinctes.
- JWT_EXPIRES_IN=7d ; JWT_REFRESH_EXPIRES_IN=30d.
- COOKIE_MAX_AGE=604800000 est une variable historique ; les routes auth fixent actuellement directement les durees des cookies (7 et 30 jours).
- RATE_LIMIT_WINDOW_MS=900000 ; RATE_LIMIT_MAX=100.

SUPABASE_URL et SUPABASE_API_KEY ne sont pas necessaires a Prisma. L'application garde sa propre authentification Express/JWT ; les comptes ne sont pas automatiquement des utilisateurs Supabase Auth. Aucun compte demo n'est cree par les migrations.

## Base et migrations

La migration initiale PostgreSQL cree users, devis et interventions avec index et relations. Elle active RLS sans politique publique ; la connexion backend doit avoir les permissions appropriees. Garder les identifiants PostgreSQL exclusivement cote serveur.

Les migrations ne sont pas executees au demarrage car un acces reseau prealable retardait listen() au-dela du delai observe chez Hostinger. Pour une evolution de schema : sauvegarder, examiner le SQL, puis appliquer les migrations dans une etape controlee avant le code qui en depend :

```sh
node scripts/migrate.mjs
```

Ne pas utiliser migrate reset, force-reset ou accept-data-loss en production. Ne pas modifier une migration deja appliquee. Les donnees SQLite historiques ne sont pas transferees automatiquement. Consulter DEPLOY_SUPABASE.md et FIX_INTERVENTIONS.md pour le contexte des corrections precedentes.

## Actions et limites connues

Les panneaux proposent creation, lecture, modification, suppression et conversion devis vers intervention. La conversion existante cree une intervention puis supprime le devis ; elle demande confirmation et conserve un badge d'origine. Son traitement serveur n'est pas rendu transactionnel par la separation des vues : tester sur donnees fictives avant utilisation metier.

Les listes affichent au maximum les 100 derniers elements ; la recherche du tableau porte sur les elements charges, pas toute la base. Les comptes USER voient leurs donnees selon les controles serveur ; ADMIN peut voir plus largement. Les roles ne doivent pas etre consideres comme un audit complet des autorisations : les permissions VIEWER restent a verifier.

Les erreurs async des routes auth et interventions sont prises en charge. Les routes devis n'ont pas encore recu le meme durcissement serveur. Le formulaire partage convertit montant, statut et dates facultatives avant envoi, mais cela ne remplace pas la validation et la gestion d'erreurs serveur a completer pour les devis. Les connexions Socket.io existantes sont conservees ; leur mutualisation reste hors de ce correctif.

Des vulnerabilites de dependances ont ete signalees par npm audit : examiner et tester les mises a jour sans lancer audit fix --force aveuglement.

## Validation de la separation

Ce changement est prepare par inspection ; sa compilation et son rendu doivent encore etre verifies.

1. npm run build doit reussir dans Hostinger.
2. Ouvrir directement /, /devis et /interventions, puis recharger chaque URL.
3. Verifier titre, menu actif et panneaux : deux sur /, un seul sur chaque page dediee.
4. Tester la navigation avant/arriere et une session non authentifiee.
5. Verifier les appels de listes/statistiques et l'absence de 503.
6. Creer/modifier une intervention fictive, verifier POST 201/PATCH 200 et persistance apres rechargement.
7. Verifier les fonctions devis et conversion sur donnees fictives, compte tenu des limites serveur ci-dessus.
8. Verifier les recherches, erreurs affichees et navigation mobile.

Licence : MIT, selon la documentation initiale du projet.
