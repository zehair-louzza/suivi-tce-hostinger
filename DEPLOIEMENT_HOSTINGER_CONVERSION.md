# Préparation Hostinger — conversion conservant le devis

## Résumé du lot
- Healthcheck PostgreSQL CI explicite : hôte 127.0.0.1, rôle postgres, base anelec_ci. Ne pas créer de rôle root.
- Les tests PostgreSQL précédents sont conservés ; une suite supplémentaire couvre les refus métier, validations, droits ADMIN, clés distinctes, conflits entre devis, réponse mémorisée et changement de droits/lien.
- Rapports migrations, compilation, tests et logs PostgreSQL conservés 7 jours dans un artifact lié au SHA du commit. La collecte utilise pipefail pour ne pas masquer un échec. Un message role root does not exist fait échouer le contrôle dédié.
- Aucun changement de schéma, de code métier de production, de dépendances ou de secrets dans ce lot.

## Résultats à vérifier après publication
Les résultats de l'ancien commit 6719ca9ad9c940e991a0ee41f1f6a2b73180ee86 étaient positifs (compilation et 8 tests comptés avec le test parent). Ils ne valident pas automatiquement ce nouveau lot.
Dans Actions, choisir le run du SHA exact de ce commit et vérifier : prisma validate/generate, migrations, build client/serveur, les deux suites, puis le contrôle des logs PostgreSQL. Télécharger conversion-SHA pour lire reports/build.log, reports/conversion.tap et reports/postgres.log. Le nombre total de tests comprend les tests parents ; ne pas le confondre avec le nombre de scénarios.
Ne pas annoncer les nouveaux tests réussis avant de lire le résultat du nouveau run. Les tests restent sur PostgreSQL CI local ; conversion_requests de Suivi_ANELEC n'est pas alimentée par eux. Aucune preuve de test navigateur/cookies/JWT/RLS Supabase n'en découle.

## Cible de production
Dépôt zehair-louzza/suivi-tce-hostinger, branche main. Projet Supabase unique qfhxptwsuotqnrihzhxw (Suivi_ANELEC). Ne pas utiliser l'autre projet.
Entrée existante scripts/start.mjs, qui importe dist/server/index.js sans migration au démarrage. Compilation npm run build ; installer les devDependencies nécessaires à Prisma et TypeScript. Préserver le port et les paramètres fonctionnels déjà configurés chez Hostinger ; ne pas recréer l'application ou changer de plateforme.

## Avant un déploiement validé
1. Conserver le SHA actuellement déployé et une sauvegarde/export de la base, même si ses données sont fictives.
2. Lire le run CI du commit candidat et ne pas promouvoir un run échoué. Une connexion Git main/Hostinger peut déjà déclencher un build indépendamment de la CI : ce workflow ne bloque pas à lui seul un déploiement Hostinger automatique. Vérifier le comportement dans hPanel.
3. Vérifier DATABASE_URL côté serveur : projet qfhxptwsuotqnrihzhxw, TLS et compte autorisé pour Prisma. Ne jamais afficher/committer la valeur. CORS_ORIGIN doit être exactement l'origine HTTPS utilisée dans le navigateur, car la conversion contrôle Origin. Préserver JWT_SECRET, COOKIE_SECRET et SOCKET_CORS_ORIGIN existants.
4. Rapprocher l'historique Prisma selon PRISMA_V2_RECONCILIATION.md. La migration est déjà appliquée via Supabase ; NE PAS lancer migrate deploy/scripts/migrate.mjs en premier. Diff nul et vérification des CHECK/RLS/privilèges avant migrate resolve --applied, puis migrate status. Ne pas modifier la table d'historique à la main ni exécuter reset/db push.
5. Vérifier npx --no-install prisma generate et npm run build sur le commit candidat.
6. Déployer/redémarrer via le mécanisme Hostinger existant, sans nouvelle migration automatique. Cette étape n'est pas exécutée par ce document.

## Recette navigateur sur données fictives
- Vérifier /api/health puis connexion et les pages /, /devis, /interventions.
- Créer un devis fictif avec objet renseigné et statut commercial Accepté. Le statut simplifié Traité ne remplace pas Accepté.
- Ouvrir Créer une intervention liée, choisir la date réelle et confirmer : réponse 201 attendue, devis toujours visible, intervention liée et date correcte.
- Vérifier un reçu conversion_requests ; sa réponse contient des données métier et ne doit pas être exposée à anon/authenticated.
- Rejouer exactement la même requête avec la même clé : 200 avec replayed=true, pas d'intervention supplémentaire. Ne pas modifier manuellement la clé pour tester un rejeu. Une nouvelle clé correspond à une autre demande volontaire.
- Vérifier les messages de refus (non accepté, objet absent), les droits utilisateur et l'absence d'erreur Origin.
- Vérifier après rechargement. Un navigateur privé/stockage bloqué ne doit pas conduire à relancer avec une clé inconnue.

## Retour arrière
Ne pas revenir directement à un ancien commit contenant la conversion destructive. En cas d'incident, désactiver temporairement la conversion et corriger en avant, ou préparer un rollback explicitement revu qui conserve le devis et la structure additionnelle. Ne pas supprimer conversion_requests ni ses reçus pour faire disparaître une erreur. Les autres données et la migration restent conservées.

## Points ouverts séparés
- L'audit npm fourni précédemment signalait 20 vulnérabilités (12 modérées, 8 élevées). Analyse dédiée requise ; pas de npm audit fix --force ou mise à niveau majeure Prisma automatique.
- Les avertissements de runtime des actions GitHub sont distincts de la version Node de l'application ; leur modernisation reste hors de ce correctif ciblé.
- Aucun accès aux paramètres Hostinger, aucun déploiement manuel et aucun rapprochement du registre Prisma ne sont effectués par ce commit.
