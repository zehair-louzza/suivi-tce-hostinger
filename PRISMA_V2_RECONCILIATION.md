# Rapprochement Prisma — Suivi_ANELEC

Projet unique : qfhxptwsuotqnrihzhxw. Pas de branche Supabase payante.
La migration de structure anelec_metier_v2_expand est déjà appliquée via Supabase. Le dépôt contient sa version Prisma 20261104182000_anelec_metier_v2_expand. Les historiques Supabase et Prisma restent distincts : publier le fichier ne remplit pas _prisma_migrations.

## Procédure depuis un terminal du projet
Utiliser le checkout main à jour et l'URL PostgreSQL serveur de CE projet, chargée dans DATABASE_URL sans l'afficher ni la committer. Vérifier le hostname db.qfhxptwsuotqnrihzhxw.supabase.co ou, avec le pooler, l'identifiant postgres.qfhxptwsuotqnrihzhxw. Ne pas utiliser l'URL HTTP ni une clé API Supabase.

1. npm ci --include=dev
2. npx --no-install prisma validate
3. npx --no-install prisma generate
4. npx --no-install prisma migrate status
   Une migration en attente est attendue ; ce statut seul ne vérifie pas le schéma.
5. Avec Prisma 5 du projet :
   npx --no-install prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
   Code 0 = aucun écart décrit par Prisma ; code 2 = différences, arrêter ; code 1 = erreur, arrêter.
6. Examiner aussi RLS, privilèges, contraintes CHECK et historique de la migration initiale. migrate diff ne couvre pas toutes les fonctions PostgreSQL. Ne pas modifier la migration initiale.
7. Seulement après conformité et autorisation d'écriture du registre :
   npx --no-install prisma migrate resolve --applied 20261104182000_anelec_metier_v2_expand
8. npx --no-install prisma migrate status
   Les deux migrations doivent être reconnues appliquées. Ne pas annoncer le rapprochement réussi sans ce résultat.
9. npm run build

resolve --applied enregistre la migration sans rejouer les ALTER TABLE. Ne PAS lancer migrate deploy/scripts/migrate.mjs avant le rapprochement sur la base déjà modifiée. Pas de reset, db push, suppression de dossier migrations ou INSERT manuel dans _prisma_migrations. Ne pas exécuter cette procédure contre l'autre projet. Aucun rapprochement n'est effectué automatiquement par ce commit.

## Basculement conversion
La route /api/devis/:id/convert appelle maintenant convertKeepingQuote ; elle exige une date réelle choisie et l'en-tête Idempotency-Key. Le devis commercial doit être ACCEPTE et son objet renseigné. L'éditeur devis permet de renseigner ces deux champs ; TRAITE n'est pas assimilé à ACCEPTE.
La boîte de dialogue indique que le devis reste présent. Une tentative mémorisée conserve clé et date dans sessionStorage, y compris après une réponse incertaine. Le bouton de relance rejoue cette tentative. Une réussite confirmée efface la tentative ; une demande volontaire suivante peut créer une autre intervention.
La route ne publie plus d'événement de suppression du devis. La suppression explicite d'un devis lié est refusée. Les dates planifiées restent obligatoires dans cette étape. Le montant historique copié n'est pas le nouveau montantHt.

## Vérifications
Le workflow GitHub Actions compile le dépôt, exécute les deux migrations sur un PostgreSQL 17 éphémère local et teste le service intégré. Il n'utilise aucun secret Supabase et ne migre PAS la base qfhxptwsuotqnrihzhxw. Les rôles anon/authenticated y sont des rôles NOLOGIN de simulation. Les tests refusent les hôtes autres que localhost/127.0.0.1 et les bases autres que anelec_ci.
La suite vérifie conservation du devis, lien/propriétaire, permissions, rejeu, collision de payload, concurrence avec retry borné et reconnexion. Une erreur temporaire 409 concurrente est tolérée si aucune duplication ne se produit ; le client doit relancer avec la même clé.
Résultats CI à consulter après publication. Ces tests ne valident pas les cookies/JWT, le navigateur, les rooms Socket.io, les droits du compte Prisma Supabase ni le déploiement Hostinger. Les 84 tests d'un ancien pack ne sont pas une validation de ce commit. Compléter par un essai navigateur après build réussi et rapprochement.
