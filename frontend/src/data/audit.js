// Diagnostic expert de l'interface actuelle (lu dans le code et les captures du repo)
export const AUDIT = [
  {
    sev: 'Élevé',
    title: 'Barre du haut surchargée',
    what: 'Recherche, horloge, « + Devis », « + Nouvelle intervention », « Installer l’app » et thème cohabitent ; le bouton « Nouvelle intervention » est en plus dupliqué dans chaque en-tête de page.',
    fix: 'Une barre utilitaire minimale et un seul bouton « Nouveau » (menu Devis / Intervention).',
  },
  {
    sev: 'Élevé',
    title: 'Jargon technique visible',
    what: '« Workstation Super-Admin », « Moteur Gantt 60 fps », « Algorithme TSP 2-Opt », « Tableau Synthétique (8 col) »… parlent au développeur, pas au client.',
    fix: 'Libellés métier courts : Console administrateur, Planning, Optimisation de tournée.',
  },
  {
    sev: 'Élevé',
    title: 'Tableaux trop larges',
    what: 'En-têtes noirs massifs, 8 à 10 colonnes visibles, boutons d’action serrés et défilement horizontal (colonne « Actions » coupée).',
    fix: 'En-tête clair, colonnes essentielles, une action principale + menu « … », détail en tiroir.',
  },
  {
    sev: 'Moyen',
    title: 'Emojis mélangés aux icônes',
    what: 'Pastilles de couleur, trophées, cibles et voitures en emoji côtoient des icônes vectorielles : rendu variable selon l’appareil et peu professionnel.',
    fix: 'Une seule famille d’icônes vectorielles cohérente.',
  },
  {
    sev: 'Moyen',
    title: 'Grilles de KPI déséquilibrées',
    what: 'Cartes orphelines (5 bacs de facturation en 4 + 1, « Top rentabilité » seul sur sa ligne), grands vides et chiffres sans tendance.',
    fix: 'Grilles équilibrées, chiffres accompagnés d’une tendance et d’une action.',
  },
  {
    sev: 'Moyen',
    title: 'Pastilles et badges incohérents',
    what: 'Rôles sur 3 lignes dans des pastilles (« Technicien Terrain (App Mobile Dédiée) »), couleurs de statut différentes d’un module à l’autre.',
    fix: 'Un système de statuts unique, libellés courts, jamais coupés.',
  },
  {
    sev: 'Moyen',
    title: 'App technicien encombrée',
    what: 'Rangées de boutons qui débordent de l’écran (« Non terminée (Replanifi… »), menu admin en bas visible par le technicien, emojis.',
    fix: 'Une carte mission = un bouton principal dans la zone du pouce, navigation dédiée au terrain.',
  },
  {
    sev: 'Faible',
    title: 'Identité visuelle peu affirmée',
    what: 'Vert générique, typographie unique, logo multicolore sous-exploité ; page de connexion qui cite des concurrents.',
    fix: 'Une direction artistique assumée (5 propositions ci-dessous).',
  },
];

export const PRINCIPLES = [
  { title: 'Un seul bouton principal par écran', text: 'Toujours au même endroit, dans l’en-tête de page.' },
  { title: 'Des mots métier, pas techniques', text: 'Devis, Planning, Tournée, Facturation, Console administrateur.' },
  { title: 'Statuts unifiés', text: 'Mêmes couleurs et libellés du devis à la facture.' },
  { title: 'Tableaux respirants', text: '8 colonnes max, détail en tiroir, actions dans « … ».' },
  { title: 'Mobile d’abord pour le terrain', text: 'Zone du pouce, gros boutons, aucune ligne qui déborde.' },
  { title: 'Accessibilité AA', text: 'Contrastes vérifiés, focus visible, cibles tactiles de 44 px.' },
];
