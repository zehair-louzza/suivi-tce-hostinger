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
5. Sans réponse : relance du technicien après 15 min (dans l'application uniquement, jamais par e-mail), puis alerte au Planificateur ET à la direction 5 min après la relance (application + e-mail). Les relances partent jour et nuit, sauf le dimanche (réglable). Chaque action est écrite dans l'historique : « Automatique — … ».
6. Direction → Utilisateurs et accès → **Automatisations** : activer/désactiver, délai de relance, délai d'alerte, option « pas d'envoi le dimanche ». Désactivé : aucune nouvelle attente, aucune relance.
7. Téléphone du technicien : sur la fiche d'une mission « À confirmer », le bouton **✓ Accepter la mission** est collé en bas de l'écran (avec « Refuser »), et reste visible même quand le motif de refus est ouvert.
8. Isolation : un technicien d'une autre société ne reçoit rien et ne peut pas répondre.
