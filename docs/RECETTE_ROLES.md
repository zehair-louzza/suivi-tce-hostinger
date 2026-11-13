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
