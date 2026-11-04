# Correction des interventions

## Portee

Le serveur accepte les montants numeriques ou les chaines decimales positives issues des formulaires (point ou virgule). Un montant vide devient 0 ; null, booleens, nombres negatifs et textes invalides sont rejetes. Les statuts sont normalises en majuscules avec underscores puis valides. Les dates facultatives vides deviennent null ; les dates obligatoires restent obligatoires. Les dates impossibles sont rejetees.

Creation et modification convertissent les dates en Date Prisma. Une date reelle peut etre effacee avec null ou une chaine vide. Les PATCH absents ne remplacent pas les champs par des valeurs par defaut.

Toutes les routes interventions utilisent asyncHandler pour transmettre leurs erreurs au gestionnaire Express existant. Celui-ci renvoie les ZodError en JSON 400 avec details par champ, plutot qu'un rejet async non traite. Les droits USER/ADMIN sont conserves. Les relations devis sont controlees avant ecriture. Les echecs de notification Socket.io sont journalises sans transformer une ecriture deja reussie en erreur de creation.

## Aucun changement de base

Aucune migration, aucun secret, aucun compte ni aucune donnee existante n'est modifie par ce commit. Les tentatives precedemment rejetees avant insertion ne sont pas recuperees automatiquement. Les routes devis ont le meme probleme de format mais ne sont pas modifiees ici ; leur correction, notamment la conversion, doit etre preparee separement.

## Validation Hostinger

Garder scripts/start.mjs comme entree, NODE_ENV=production et NPM_CONFIG_INCLUDE=dev. Apres deploiement, creer une seule intervention fictive : montant 1200, statut a traiter, date planifiee valide, date reelle vide. Attendre POST 201 avec id, puis GET de liste contenant cet id. Recharger et verifier que la ligne reste presente. Modifier montant/statut, renseigner puis effacer la date reelle. Un montant invalide ou une date impossible doit produire un JSON 400 sans redemarrage. Verifier les logs et les droits entre comptes distincts. La liste reste paginee a 100 maximum.

Le correctif est prepare par inspection du code, sans execution TypeScript ni test PostgreSQL dans cet environnement. Le gestionnaire existant renvoie deja les details de validation ; le toast du frontend peut encore n'afficher que Donnees invalides. Consulter Response pour les details. Aucun changement d'interface n'est inclus.
