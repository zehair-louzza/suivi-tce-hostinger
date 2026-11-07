// Inventaire de tous les écrans du site + fenêtres (modales) maquettés
export const SCREENS = [
  {
    id: 'connexion',
    label: 'Connexion & création d’espace',
    group: 'Accès public',
    public: true,
    notes: [
      'Suppression des noms de concurrents (ServiceTitan, Jobber…) au profit de bénéfices concrets.',
      'Google 1-clic mis en avant, e-mail/mot de passe en second : un seul chemin principal.',
      'Création d’espace en 1 écran clair avec validation SIRET et confirmation d’activation explicite.',
    ],
  },
  {
    id: 'tableau-de-bord',
    label: 'Tableau de bord',
    group: 'Espace de travail',
    notes: [
      'Barre du haut allégée : recherche + un seul bouton « Nouveau » (fini les 3 boutons dupliqués).',
      'KPI avec tendance et lien d’action ; « À traiter » trié par impact en euros.',
      'Onglets Synthèse / Opérations / Analyse conservés mais hiérarchisés visuellement.',
    ],
  },
  {
    id: 'planning',
    label: 'Planning & dispatch',
    group: 'Espace de travail',
    notes: [
      'Libellés métier (« Planning ») au lieu du jargon (« Moteur Gantt 60 fps »).',
      'Bourse de dispatch en panneau latéral avec affectation 1-clic et « Auto-planifier ».',
      'Charge de chaque technicien visible en jauge, ligne « maintenant » très lisible.',
    ],
  },
  {
    id: 'devis',
    label: 'Devis',
    group: 'Espace de travail',
    notes: [
      '8 colonnes essentielles visibles, le reste dans la fiche latérale (plus de défilement horizontal).',
      'Une seule action principale par ligne, les autres dans le menu « … ».',
      'Statuts harmonisés (pastilles non coupées) et filtres rapides avec compteurs.',
    ],
  },
  {
    id: 'interventions',
    label: 'Interventions',
    group: 'Espace de travail',
    notes: [
      'En-tête de tableau clair (plus de bandeau noir), colonnes resserrées et lisibles.',
      'Fiche intervention en tiroir : résumé, photos avant/après, historique, envoi du rapport.',
      'Vue Kanban par statut pour suivre l’avancement d’un coup d’œil.',
    ],
  },
  {
    id: 'carte',
    label: 'Carte & tournées',
    group: 'Espace de travail',
    notes: [
      '« Optimisation de tournée » au lieu de « Algorithme TSP 2-Opt ».',
      'Choix Positions / Trajet restant / Les deux en un seul contrôle segmenté.',
      'Panneau d’avancement par technicien toujours visible, mode plein écran cockpit.',
    ],
  },
  {
    id: 'facturation',
    label: 'Facturation',
    group: 'Gestion',
    notes: [
      'Les 5 bacs sur une seule ligne (plus de carte orpheline 4 + 1), montants HT/TTC alignés.',
      'Diagnostic des retards et courrier client généré dans un tiroir dédié.',
      'Plus d’emojis : icônes professionnelles cohérentes.',
    ],
  },
  {
    id: 'comptabilite',
    label: 'Comptabilité & équipe',
    group: 'Gestion',
    notes: [
      'Simulateur de coût horaire chargé qui recalcule les marges en direct.',
      'Classement des techniciens lisible (barres) au lieu d’un tableau qui déborde.',
      'Une seule action d’export (« Copier la synthèse direction »).',
    ],
  },
  {
    id: 'donneurs-ordre',
    label: 'Profils & donneurs d’ordre',
    group: 'Gestion',
    notes: [
      'Fiches homogènes : type, contacts, e-mails d’envoi des rapports, CA de l’année.',
      'Fiche technique complète en tiroir (grille tarifaire, délais, historique).',
      'Recherche et filtres B2B / B2C en tête.',
    ],
  },
  {
    id: 'parametres',
    label: 'Paramètres métier',
    group: 'Administration',
    notes: [
      'Matrice des compétences en grille (techniciens × corps d’état) au lieu de lignes de puces.',
      'Référentiels regroupés par onglets, ajout rapide en ligne.',
      'Barèmes horaires par corps d’état éditables.',
    ],
  },
  {
    id: 'utilisateurs',
    label: 'Utilisateurs & accès',
    group: 'Administration',
    notes: [
      '« Console administrateur » au lieu de « Workstation Super-Admin ».',
      'Rôles en pastilles courtes, droits détaillés dans une matrice claire.',
      'Pointages, rapports à valider et diagnostic e-mail (SMTP) en onglets.',
    ],
  },
  {
    id: 'terrain',
    label: 'App mobile technicien',
    group: 'Espace terrain',
    notes: [
      'Bouton principal dans la zone du pouce, plus de rangées de boutons qui débordent.',
      'Pointage, missions, carte et profil en barre du bas dédiée au technicien.',
      'Clôture GPS obligatoire expliquée simplement, confirmation claire.',
    ],
  },
  {
    id: 'vitrine',
    label: 'Page vitrine & démo',
    group: 'Accès public',
    public: true,
    notes: [
      'Page publique orientée bénéfices : devis → intervention → facture.',
      'Preuves de confiance (hébergement France, RGPD, multi-entreprise) visibles.',
      'Vidéo de démonstration et FAQ intégrées.',
    ],
  },
];

// Fenêtres (modales) accessibles directement depuis le sélecteur d'écrans
export const MODAL_SCREENS = [
  { id: 'fenetre-excel', label: 'Fenêtre « Situation Excel »', group: 'Fenêtres', target: 'tableau-de-bord', modal: 'excel', notes: ['Plage de dates Du / Au avec raccourcis.', 'Sélection multi-donneurs d’ordre par cases à cocher.', 'Aperçu du contenu du fichier avant export.'] },
  { id: 'fenetre-rapport', label: 'Fenêtre « Envoi du rapport »', group: 'Fenêtres', target: 'interventions', modal: 'rapport', notes: ['Destinataires pré-remplis depuis la fiche du donneur d’ordre.', 'Aperçu du rapport PDF et des photos jointes.', 'Réservé à l’équipe bureau.'] },
  { id: 'fenetre-gps', label: 'Fenêtre « Clôture GPS »', group: 'Fenêtres', target: 'terrain', modal: 'gps', notes: ['Explication courte et rassurante.', 'Position verrouillée affichée avec précision.', 'Un seul bouton d’action dans la zone du pouce.'] },
];

export const ALL_SCREENS = [...SCREENS, ...MODAL_SCREENS];
export const SCREEN_BY_ID = Object.fromEntries(ALL_SCREENS.map((s) => [s.id, s]));

export function mockUrl(dirId, screenId) {
  const s = SCREEN_BY_ID[screenId] || SCREENS[1];
  if (s.target) return `/m/${dirId}/${s.target}?modal=${s.modal}`;
  return `/m/${dirId}/${s.id}`;
}
