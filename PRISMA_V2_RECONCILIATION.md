# Synchronisation Prisma V2

Cible unique : Suivi_ANELEC, qfhxptwsuotqnrihzhxw.
La migration anelec_metier_v2_expand a déjà été appliquée via Supabase. Le fichier Prisma versionné en reproduit les effets et ajoute une enveloppe transactionnelle pour les bases neuves. La contrainte datePlanifiee reste NOT NULL. Les noms d'index Prisma sont explicitement alignés sur les noms PostgreSQL minuscules des index créés sans guillemets.

IMPORTANT : ne pas lancer migrate deploy sur cette base avant rapprochement. La présence du fichier dans le dépôt ne marque PAS la migration comme appliquée dans _prisma_migrations. L'historique Supabase et l'historique Prisma sont distincts.

Procédure séparée, à exécuter avec une connexion serveur autorisée après validation de la cible et confirmation :
1. npm ci --include=dev
2. npx prisma validate
3. npx prisma generate
4. npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
5. Si et seulement si le diff est nul, examiner aussi les CHECK, le RLS et les privilèges de conversion_requests (Prisma ne décrit pas tout).
6. npx prisma migrate resolve --applied 20261104182000_anelec_metier_v2_expand
7. npx prisma migrate status

Ne pas changer la migration initiale ni fabriquer de ligne _prisma_migrations à la main. Ne jamais exécuter reset. Une différence de schéma bloque le rapprochement. Aucun de ces changements de registre n'est exécuté par ce commit ou au démarrage. scripts/migrate.mjs existant reste inchangé ; ne pas le lancer avant l'étape 6.

Ce lot ajoute les validateurs et le service lié, MAIS ne remplace pas encore la route ni le message frontend. Le prochain lot doit monter convertKeepingQuote et changer simultanément la confirmation qui annonce la suppression. Ne pas considérer la conversion publiée comme corrigée avant ce basculement.

Préconditions du nouveau service : devis commercial ACCEPTE, objet renseigné, date planifiée explicite. Les formulaires historiques ne renseignent pas encore tous ces champs : prévoir la qualification via API et les formulaires suivants ; ne pas inventer une acceptation depuis le statut TRAITE.

Le service conserve le devis, utilise une transaction Serializable, garde le propriétaire du devis, mémorise la réponse et refuse un payload différent avec la même clé. Une nouvelle clé peut volontairement créer une autre intervention. Les montants HT ne sont pas transformés en Float : amount copié reste le champ historique uniquement.

État des tests : les 84 tests du pack local précédent ne constituent PAS des tests de ces nouveaux modules TypeScript. Il reste à compiler le dépôt, ajouter les tests des modules intégrés et effectuer les tests PostgreSQL réels. Pas de nouvelle affirmation de validation complète.
