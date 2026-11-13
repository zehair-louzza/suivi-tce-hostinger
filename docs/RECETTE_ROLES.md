# Recette du cloisonnement par rôle (à faire sur le site réel)

Créer 5 comptes de test dans UNE société de test (Utilisateurs et accès) : un par profil. Se connecter avec chacun.

| Profil | Doit voir | Ne doit PAS voir / faire |
|---|---|---|
| Technicien | Uniquement l'espace mobile ; ses missions ; client, adresse, contact | Aucun montant, aucune facture ; mission d'un autre ; menus bureau |
| Chargé d'études | Devis (tout), Planning, Carte, Interventions liées à ses devis (lecture) | Facturation, rapports, espace technicien ; modifier une intervention hors visite |
| Planificateur | Planning, Interventions, Carte, Devis acceptés (lecture) | Créer un devis, facturation ; montants si le droit Montants est retiré |
| Rapports et facturation | Interventions, Facturation, Clients ; « Mon travail » (rapports à valider, à facturer) | Planning, carte, devis, créer une intervention, changer date/technicien |
| Direction | Tout, tableaux de bord, supervision des autres « Mon travail » | — |

Tests de refus : se connecter en technicien et tenter de modifier un montant (message « Vous n'avez pas le droit de modifier les montants… Peuvent la modifier : … ») ;
en rapports, changer une date (refus + liste des profils) mais clôturer et facturer (accepté).
Tests automatiques : `npm run test:roles` (vraies routes, base simulée, 2 sociétés).

## Automatisation A — réponse du technicien à son affectation

À essayer avec un compte Planificateur et un compte Technicien (dont le nom de technicien correspond à celui affecté) :

1. Le Planificateur affecte une intervention à ce technicien → la cloche du technicien affiche 1 notification, la mission porte « À confirmer ».
2. Le technicien ouvre la mission : carte « Mission à confirmer » avec **Accepter** / **Refuser…** (motif obligatoire).
3. Refus → la mission retourne dans « À planifier » sans technicien ; Planificateur et Direction reçoivent une notification avec le motif et des remplaçants suggérés ; bloc « Réponses des techniciens » dans Mon travail.
4. Acceptation → statut « Affectée » ; le Planificateur est prévenu. Démarrer la mission sans répondre vaut acceptation.
5. Sans réponse : relance du technicien après 15 min (dans l'application uniquement, jamais par e-mail), puis alerte au Planificateur ET à la direction 5 min après la relance (application + e-mail). Les relances partent jour et nuit, sauf pause de fin de semaine du samedi 17 h au lundi 6 h : une mission affectée le samedi à partir de 17 h est relancée le lundi à 6 h (réglable). Chaque action est écrite dans l'historique : « Automatique — … ».
6. Direction → Utilisateurs et accès → **Automatisations** : activer/désactiver, délai de relance, délai d'alerte, option « pause de fin de semaine ». Désactivé : aucune nouvelle attente, aucune relance.
7. Téléphone du technicien : sur la fiche d'une mission « À confirmer », le bouton **✓ Accepter la mission** est collé en bas de l'écran (avec « Refuser »), et reste visible même quand le motif de refus est ouvert.
8. Isolation : un technicien d'une autre société ne reçoit rien et ne peut pas répondre.

## Automatisation B — devis client par lien sécurisé

1. Chargé d'études (ou Direction) → Devis → ouvrir un devis → onglet **3. Suivi & Relances** → bloc **Envoi au client** → **Déposer le PDF du devis** (PDF réel, 8 Mo maximum). Planificateur, Rapports et Technicien : pas de dépôt ni d'envoi.
2. **Envoyer au client** : les adresses viennent de la **fiche client** (Profils & donneurs d'ordre). Une seule adresse → envoi direct à cette adresse. Plusieurs → il faut confirmer celle(s) à utiliser (les services « reçoit les devis » sont présélectionnés). Aucune adresse ou aucune fiche → l'envoi est refusé et on renvoie vers la fiche. Case de confirmation obligatoire : rien ne part tout seul.
3. Le client reçoit un e-mail avec un lien personnel (30 jours) → page sans compte : consulter le PDF, **accepter**, **refuser** (motif) ou **demander une modification** (message). Son nom est obligatoire. Réponse à usage unique.
4. Réponse : le devis passe à « Accepté » / « Refusé » / « En négociation » ; l'équipe est notifiée dans la cloche ; accepté → le Planificateur reçoit « à transformer en intervention » (aucune intervention créée automatiquement).
5. Sans réponse : relance J+3 puis J+7 (mêmes adresses, même lien), du lundi au samedi de 8 h à 19 h ; à 30 jours le devis passe à « Expiré », le lien est fermé, rien n'est supprimé. Chaque action est écrite dans l'historique : « Automatique — … ».
6. Devis modifié après envoi (montant, objet, client, site, corps d'état, TVA) ou nouveau PDF déposé → lien révoqué ; renvoyer le devis crée un nouveau lien et révoque l'ancien. Une note interne ne révoque rien.
7. Direction → Automatisations → « Devis envoyés aux clients » : coche pour activer/désactiver les relances et l'expiration (l'envoi initial reste toujours manuel).
8. Isolation : le lien est lié à une société et à un devis ; un jeton falsifié, ou d'une autre société, n'ouvre rien.

## Un même e-mail dans plusieurs entreprises

Un compte = **e-mail + entreprise**. La même adresse peut avoir un compte dans « Sirène » et un autre dans « Sirette » : deux comptes distincts, avec chacun son mot de passe, son rôle et ses données. Rien n'est partagé entre les deux.

À vérifier avec une adresse qui existe dans deux entreprises :
1. **Connexion, mots de passe différents** : le mot de passe saisi ouvre l'entreprise correspondante, directement.
2. **Connexion, même mot de passe dans les deux** : après le mot de passe, l'écran propose la liste « nom de l'entreprise + SIRET/SIREN » ; un clic ouvre l'entreprise choisie. Un mauvais mot de passe ne montre jamais cette liste.
3. **En-tête / menu profil** : le nom de l'entreprise s'affiche à côté du nom et du rôle.
4. **Mot de passe oublié** : un e-mail par entreprise (chacun nomme l'entreprise) ; changer le mot de passe d'une entreprise ne change pas l'autre.
5. **Invitation** : inviter une adresse qui a déjà un compte ailleurs fonctionne ; l'e-mail précise que ce nouvel accès est distinct. Inviter une adresse déjà présente **dans la même entreprise** est refusé.
6. **Création d'utilisateur par la direction** : même règle (doublon refusé seulement dans sa propre entreprise).
7. **Création d'un espace** avec une adresse déjà utilisée ailleurs : acceptée, le nouvel espace a son propre mot de passe (confirmation par code envoyé à cette adresse).
8. **Google** : un seul compte → connexion directe ; plusieurs → même écran de choix d'entreprise.
9. **Isolation** : connecté à Sirène, aucune donnée, aucun utilisateur ni aucune notification de Sirette n'est visible (et inversement).

Base de données : l'unicité globale de `users.email` a été remplacée par une unicité (e-mail sans tenir compte de la casse, entreprise) — migration `20261114090000_utilisateur_multi_entreprises`.
