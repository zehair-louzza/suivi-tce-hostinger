// Données d'exemple (fictives) inspirées du domaine ANELEC TCE — aucune connexion à la base réelle
export const TODAY_LABEL = 'Vendredi 6 novembre 2026';
export const NOW_HOUR = 10.6; // 10:36

export const COMPANY = {
  name: 'ANELEC GROUPE',
  address: '9 rue des Colonnes, 75002 Paris',
  siret: '933 108 607 00015',
};

export const ME = { name: 'Zehair Louzza', initials: 'ZL', role: 'Administrateur', email: 'zehair@anelecgroupe.com' };

export const CORPS = [
  'Électricité', 'Plomberie', 'CVC / Climatisation', 'Chauffage', 'Serrurerie', 'Menuiserie',
  'Peinture', 'Plâtrerie', 'Faux plafond', 'Revêtement de sol', 'Maçonnerie', 'Tous corps d’état',
];

export const TECHS = [
  { id: 'anouar', name: 'Anouar', initials: 'AN', color: '#2563EB', skills: ['Électricité', 'Plomberie', 'Serrurerie'], status: 'En intervention', since: '07:52', pos: [48.8722, 2.3172], load: 6.5, done: 1, total: 3 },
  { id: 'mohamed', name: 'Mohamed', initials: 'MO', color: '#16A34A', skills: ['Plomberie', 'CVC / Climatisation', 'Chauffage'], status: 'En route', since: '08:05', pos: [48.8815, 2.2805], load: 5.5, done: 0, total: 2 },
  { id: 'haitam', name: 'Haitam', initials: 'HA', color: '#D97706', skills: ['Électricité'], status: 'En intervention', since: '07:58', pos: [48.8921, 2.2862], load: 4, done: 0, total: 2 },
  { id: 'jamal', name: 'Jamal', initials: 'JA', color: '#DC2626', skills: ['Serrurerie', 'Menuiserie', 'Peinture', 'Plâtrerie'], status: 'Terminé — rapport envoyé', since: '07:40', pos: [48.8352, 2.2455], load: 5.5, done: 1, total: 2 },
  { id: 'manneh', name: 'Manneh', initials: 'MA', color: '#7C3AED', skills: ['Menuiserie', 'Revêtement de sol'], status: 'En intervention', since: '08:21', pos: [48.9125, 2.3555], load: 6, done: 0, total: 1 },
  { id: 'yankoubou', name: 'Yankoubou', initials: 'YA', color: '#0891B2', skills: ['Peinture', 'Faux plafond'], status: 'Non pointé', since: null, pos: [48.8745, 2.3150], load: 4.5, done: 0, total: 1 },
];
export const TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export const CLIENTS = [
  { id: 'presta', name: 'Presta maintenance', type: 'B2B', kind: 'Donneur d’ordre', contact: 'Service Travaux & Maintenance Bâtiment', role: 'Responsable opérations', emails: [{ label: 'Rapports', email: 'travaux@prestamaintenance.fr' }, { label: 'Comptabilité', email: 'compta@prestamaintenance.fr' }], phone: '01 42 68 55 00', address: '15 rue de Berri, 75008 Paris', siret: '812 345 678 00012', delay: 'Intervention sous 48 h', consignes: 'Validation contradictoire sur site. Rapport complet avec photos avant/après sous 48 h.', ca: 18400, jobs: 14, tva: 'Autoliquidation' },
  { id: 'cmulti', name: 'C-Multi-Serv', type: 'B2B', kind: 'Donneur d’ordre', contact: 'Cellule Conduite d’Activité Multi-Sites', role: 'Superviseur national', emails: [{ label: 'Dispatch', email: 'dispatch@c-multiserv.com' }], phone: '01 84 19 22 10', address: '28 boulevard Haussmann, 75009 Paris', siret: '790 112 334 00027', delay: 'Urgence sous 4 h', consignes: 'Photos avant et après obligatoires sur chaque tâche réalisée.', ca: 12700, jobs: 9, tva: 'TVA 20 %' },
  { id: 'gms', name: 'GMS', type: 'B2B', kind: 'Donneur d’ordre', contact: 'Direction technique', role: 'Chargé d’affaires', emails: [{ label: 'Rapports', email: 'technique@gms-services.fr' }], phone: '01 47 58 21 90', address: '15 rue Voltaire, 92300 Levallois-Perret', siret: '501 778 902 00041', delay: 'Sous 72 h', consignes: 'Badge d’accès à retirer à l’accueil.', ca: 9800, jobs: 7, tva: 'TVA 20 %' },
  { id: 'emalec', name: 'EMALEC', type: 'B2B', kind: 'Donneur d’ordre', contact: 'Pôle maintenance', role: 'Gestionnaire', emails: [{ label: 'Rapports', email: 'maintenance@emalec.fr' }, { label: 'Factures', email: 'factures@emalec.fr' }], phone: '01 46 05 33 12', address: '45 rue de Silly, 92100 Boulogne-Billancourt', siret: '434 901 556 00019', delay: 'Sous 5 jours', consignes: 'Bon d’intervention signé par le gardien.', ca: 8400, jobs: 6, tva: 'Autoliquidation' },
  { id: 'syndic', name: 'Syndic Paris 08', type: 'B2B', kind: 'Syndic', contact: 'Gestion copropriétés', role: 'Gestionnaire de copropriété', emails: [{ label: 'Gestion', email: 'gestion@syndicparis08.fr' }], phone: '01 53 76 44 20', address: '18 rue de Miromesnil, 75008 Paris', siret: '388 456 120 00033', delay: 'Sous 7 jours', consignes: 'Prévenir le conseil syndical 48 h avant.', ca: 7600, jobs: 5, tva: 'TVA 10 %' },
  { id: 'rochelle', name: 'Presta la Rochelle', type: 'B2B', kind: 'Donneur d’ordre', contact: 'Agence Île-de-France', role: 'Conducteur de travaux', emails: [{ label: 'Rapports', email: 'idf@presta-larochelle.fr' }], phone: '01 49 33 87 65', address: '12 rue du Landy, 93200 Saint-Denis', siret: '622 019 887 00058', delay: 'Sous 72 h', consignes: 'Accès chantier par le quai de livraison.', ca: 14500, jobs: 4, tva: 'Autoliquidation' },
  { id: 'martin', name: 'M. et Mme Martin', type: 'B2C', kind: 'Particulier', contact: 'Propriétaires', role: 'Particulier', emails: [{ label: 'Contact', email: 'famille.martin@email.fr' }], phone: '06 12 34 56 78', address: '12 avenue Victor Hugo, 75116 Paris', siret: null, delay: 'Sur rendez-vous', consignes: 'Disponibles après 17 h en semaine.', ca: 2990, jobs: 2, tva: 'TVA 10 %' },
];
export const CLIENT_BY_ID = Object.fromEntries(CLIENTS.map((c) => [c.id, c]));

export const DEVIS = [
  { ref: 'DEV-2026-001', client: 'presta', city: 'Paris 08', corps: 'Électricité', objet: 'Rénovation TGBT & armoires divisionnaires', resp: 'Zehair L.', ht: 8400, status: 'Accepté', visite: 'Réalisée', due: '12/11/2026', linked: 'INT-2026-001', created: '21/10/2026' },
  { ref: 'DEV-2026-002', client: 'cmulti', city: 'Neuilly-sur-Seine', corps: 'Plomberie', objet: 'Remplacement colonnes montantes', resp: 'Anouar', ht: 4200, status: 'Envoyé', visite: 'Non requise', due: '15/11/2026', linked: null, created: '28/10/2026' },
  { ref: 'DEV-2026-003', client: 'gms', city: 'Levallois', corps: 'Serrurerie', objet: 'Pose bloc-porte coupe-feu & ferme-porte', resp: 'Zehair L.', ht: 1850, status: 'Accepté', visite: 'Réalisée', due: '09/11/2026', linked: null, created: '25/10/2026' },
  { ref: 'DEV-2026-004', client: 'emalec', city: 'Boulogne', corps: 'Peinture', objet: 'Mise en peinture parties communes', resp: 'Sarah K.', ht: 6300, status: 'À préparer', visite: 'À affecter', due: '18/11/2026', linked: null, created: '04/11/2026' },
  { ref: 'DEV-2026-005', client: 'syndic', city: 'Paris 16', corps: 'Menuiserie', objet: 'Agencement menuiserie hall & boîtes aux lettres', resp: 'Zehair L.', ht: 5100, status: 'En négociation', visite: 'Planifiée 13:30', due: '20/11/2026', linked: null, created: '30/10/2026' },
  { ref: 'DEV-2026-006', client: 'rochelle', city: 'Saint-Denis', corps: 'Tous corps d’état', objet: 'Rénovation globale locaux techniques', resp: 'Najoua B.', ht: 14500, status: 'Accepté', visite: 'Réalisée', due: '30/11/2026', linked: 'INT-2026-005', created: '14/10/2026' },
  { ref: 'DEV-2026-007', client: 'syndic', city: 'Paris 08', corps: 'CVC / Climatisation', objet: 'Remplacement VMC collective', resp: 'Sarah K.', ht: 9800, status: 'À préparer', visite: 'Planifiée 13:30', due: '25/11/2026', linked: null, created: '05/11/2026' },
  { ref: 'DEV-2026-008', client: 'martin', city: 'Paris 16', corps: 'Plomberie', objet: 'Remplacement chauffe-eau 200 L', resp: 'Anouar', ht: 2350, status: 'Refusé', visite: 'Réalisée', due: '—', linked: null, created: '19/10/2026' },
];

export const INTERVENTIONS = [
  { ref: 'INT-2026-001', client: 'presta', addr: '8 rue de Penthièvre, 75008 Paris', pos: [48.8726, 2.3165], corps: 'Électricité', objet: 'Dépannage TGBT & diagnostic puissance', tech: 'anouar', date: '06/11/2026', start: 8.5, end: 11, status: 'En cours', photos: 2, rapport: 'À rédiger', facture: 'Non facturée', ht: 1200, kind: 'travaux' },
  { ref: 'INT-2026-002', client: 'cmulti', addr: '22 av. Charles de Gaulle, 92200 Neuilly', pos: [48.8846, 2.2697], corps: 'Plomberie', objet: 'Recherche de fuite & raccordement', tech: 'mohamed', date: '06/11/2026', start: 9, end: 11.5, status: 'Planifiée', photos: 0, rapport: '—', facture: 'Non facturée', ht: 850, kind: 'travaux' },
  { ref: 'INT-2026-007', client: 'gms', addr: '3 rue Anatole France, 92300 Levallois', pos: [48.8935, 2.2870], corps: 'Électricité', objet: 'Urgence : panne éclairage de sécurité', tech: 'haitam', date: '06/11/2026', start: 10, end: 12, status: 'En cours', photos: 1, rapport: 'À rédiger', facture: 'Non facturée', ht: 650, kind: 'urgence' },
  { ref: 'INT-2026-004', client: 'emalec', addr: '45 rue de Silly, 92100 Boulogne', pos: [48.8337, 2.2430], corps: 'Peinture', objet: 'Reprise enduits & peinture cage d’escalier', tech: 'jamal', date: '06/11/2026', start: 8, end: 10.5, status: 'Terminée — à valider', photos: 6, rapport: 'Reçu', facture: 'Non facturée', ht: 2100, kind: 'travaux' },
  { ref: 'INT-2026-005', client: 'rochelle', addr: '12 rue du Landy, 93200 Saint-Denis', pos: [48.9137, 2.3570], corps: 'Menuiserie', objet: 'Pose parquet & finitions', tech: 'manneh', date: '06/11/2026', start: 9.5, end: 15.5, status: 'En cours', photos: 4, rapport: 'À rédiger', facture: 'Non facturée', ht: 3400, kind: 'travaux' },
  { ref: 'INT-2026-003', client: 'gms', addr: '15 rue Voltaire, 92300 Levallois', pos: [48.8962, 2.2905], corps: 'Électricité', objet: 'Remplacement éclairage parking', tech: 'haitam', date: '06/11/2026', start: 14, end: 16, status: 'Planifiée', photos: 0, rapport: '—', facture: 'Non facturée', ht: 980, kind: 'travaux' },
  { ref: 'INT-2026-006', client: 'cmulti', addr: '40 bd Haussmann, 75009 Paris', pos: [48.8738, 2.3320], corps: 'Plomberie', objet: 'Remplacement mitigeurs sanitaires', tech: 'mohamed', date: '06/11/2026', start: 14, end: 17, status: 'Planifiée', photos: 0, rapport: '—', facture: 'Non facturée', ht: 1450, kind: 'travaux' },
  { ref: 'INT-2026-008', client: 'syndic', addr: '18 rue de Miromesnil, 75008 Paris', pos: [48.8742, 2.3168], corps: 'Peinture', objet: 'Peinture hall d’entrée', tech: 'yankoubou', date: '06/11/2026', start: 13, end: 17.5, status: 'Planifiée', photos: 0, rapport: '—', facture: 'Non facturée', ht: 2800, kind: 'travaux' },
  { ref: 'INT-2026-012', client: 'emalec', addr: '7 rue Gallieni, 92100 Boulogne', pos: [48.8402, 2.2380], corps: 'Électricité', objet: 'Mise en conformité tableau', tech: 'haitam', date: '04/11/2026', start: 9, end: 12, status: 'Non terminée', photos: 3, rapport: 'Pièce manquante', facture: 'Non facturée', ht: 1600, kind: 'travaux' },
  { ref: 'INT-2026-011', client: 'presta', addr: '5 rue de Rome, 75008 Paris', pos: [48.8770, 2.3240], corps: 'Serrurerie', objet: 'Remplacement cylindres parties communes', tech: 'anouar', date: '05/11/2026', start: 9, end: 11, status: 'Clôturée', photos: 5, rapport: 'Validé', facture: 'Facturée', ht: 2300, kind: 'travaux' },
  { ref: 'INT-2026-009', client: 'cmulti', addr: '40 bd Haussmann, 75009 Paris', pos: [48.8738, 2.3320], corps: 'CVC / Climatisation', objet: 'Entretien annuel climatisation', tech: null, date: '—', start: null, end: null, status: 'À planifier', photos: 0, rapport: '—', facture: 'Non facturée', ht: 780, kind: 'travaux' },
  { ref: 'INT-2026-010', client: 'presta', addr: '8 rue de Penthièvre, 75008 Paris', pos: [48.8726, 2.3165], corps: 'Plomberie', objet: 'Urgence : fuite sur colonne EU', tech: null, date: '—', start: null, end: null, status: 'À planifier', photos: 0, rapport: '—', facture: 'Non facturée', ht: 420, kind: 'urgence' },
];

// Blocs du planning du jour (un bloc = une mission planifiée)
export const BLOCKS = [
  { id: 'b1', tech: 'anouar', start: 8.5, end: 11, kind: 'travaux', ref: 'INT-2026-001', client: 'Presta maintenance', label: 'Dépannage TGBT' },
  { id: 'b2', tech: 'anouar', start: 13.5, end: 15.5, kind: 'visite', ref: 'DEV-2026-007', client: 'Syndic Paris 08', label: 'Visite VMC collective' },
  { id: 'b3', tech: 'anouar', start: 16.5, end: 17.5, kind: 'travaux', ref: 'INT-2026-013', client: 'Presta maintenance', label: 'Réglage ferme-porte' },
  { id: 'b4', tech: 'mohamed', start: 9, end: 11.5, kind: 'travaux', ref: 'INT-2026-002', client: 'C-Multi-Serv', label: 'Recherche de fuite' },
  { id: 'b5', tech: 'mohamed', start: 14, end: 17, kind: 'travaux', ref: 'INT-2026-006', client: 'C-Multi-Serv', label: 'Mitigeurs sanitaires' },
  { id: 'b6', tech: 'haitam', start: 10, end: 12, kind: 'urgence', ref: 'INT-2026-007', client: 'GMS', label: 'Éclairage de sécurité' },
  { id: 'b7', tech: 'haitam', start: 14, end: 16, kind: 'travaux', ref: 'INT-2026-003', client: 'GMS', label: 'Éclairage parking' },
  { id: 'b8', tech: 'jamal', start: 8, end: 10.5, kind: 'travaux', ref: 'INT-2026-004', client: 'EMALEC', label: 'Peinture cage d’escalier' },
  { id: 'b9', tech: 'jamal', start: 13.5, end: 15, kind: 'visite', ref: 'DEV-2026-005', client: 'Syndic Paris 08', label: 'Visite menuiserie hall' },
  { id: 'b10', tech: 'manneh', start: 9.5, end: 15.5, kind: 'travaux', ref: 'INT-2026-005', client: 'Presta la Rochelle', label: 'Pose parquet' },
  { id: 'b11', tech: 'yankoubou', start: 13, end: 17.5, kind: 'travaux', ref: 'INT-2026-008', client: 'Syndic Paris 08', label: 'Peinture hall' },
];

// Bourse de dispatch : missions à affecter
export const BOURSE = [
  { id: 'q1', ref: 'INT-2026-010', kind: 'urgence', client: 'Presta maintenance', label: 'Fuite sur colonne EU', corps: 'Plomberie', duration: 1, city: 'Paris 08', suggest: 'mohamed' },
  { id: 'q2', ref: 'DEV-2026-004', kind: 'visite', client: 'EMALEC', label: 'Visite peinture parties communes', corps: 'Peinture', duration: 1.5, city: 'Boulogne', suggest: 'jamal' },
  { id: 'q3', ref: 'INT-2026-009', kind: 'travaux', client: 'C-Multi-Serv', label: 'Entretien climatisation', corps: 'CVC / Climatisation', duration: 2, city: 'Paris 09', suggest: 'mohamed' },
];

export const HQ = { name: 'Siège ANELEC GROUPE', addr: '9 rue des Colonnes, 75002 Paris', pos: [48.8687, 2.3412] };

export const CA_MONTHS = [
  { m: 'Jan', ca: 31200, n: 22 }, { m: 'Fév', ca: 28400, n: 19 }, { m: 'Mar', ca: 36100, n: 26 },
  { m: 'Avr', ca: 34300, n: 24 }, { m: 'Mai', ca: 41200, n: 29 }, { m: 'Juin', ca: 39100, n: 27 },
  { m: 'Juil', ca: 30200, n: 21 }, { m: 'Août', ca: 22400, n: 15 }, { m: 'Sep', ca: 44300, n: 31 },
  { m: 'Oct', ca: 48700, n: 34 }, { m: 'Nov', ca: 14980, n: 11 },
];

export const CA_BY_CLIENT = CLIENTS.map((c) => ({ name: c.name, ca: c.ca }));

export const CORPS_STATS = [
  { corps: 'Électricité', actifs: 3, clotures: 9, devis: 2, ca: 14200, pct: 78 },
  { corps: 'Plomberie', actifs: 2, clotures: 6, devis: 2, ca: 8900, pct: 64 },
  { corps: 'Peinture', actifs: 2, clotures: 4, devis: 1, ca: 9400, pct: 55 },
  { corps: 'Menuiserie', actifs: 1, clotures: 3, devis: 1, ca: 7100, pct: 70 },
  { corps: 'Serrurerie', actifs: 0, clotures: 5, devis: 1, ca: 4150, pct: 92 },
  { corps: 'CVC / Climatisation', actifs: 0, clotures: 2, devis: 1, ca: 3200, pct: 40 },
];

export const FUNNEL = [
  { step: 'Devis & chiffrages', value: 8, hint: '2 visites requises' },
  { step: 'Ordonnancement', value: 3, hint: '3 missions à affecter' },
  { step: 'Terrain en direct', value: 4, hint: '4 techniciens sur site' },
  { step: 'Contrôle & rapports', value: 1, hint: 'à valider avant facture' },
  { step: 'Clôturées & facturées', value: 3, hint: '2 facturées (67 %)' },
];

export const FACTU = [
  { ref: 'INT-2026-013', client: 'gms', objet: 'Remplacement BAES parking', ht: 1750, tva: 20, bucket: 'a-facturer', type: 'B2B', date: '05/11/2026', note: 'Rapport validé, photos OK' },
  { ref: 'INT-2026-014', client: 'martin', objet: 'Remplacement mitigeur cuisine', ht: 640, tva: 10, bucket: 'a-facturer', type: 'B2C', date: '05/11/2026', note: 'Attestation TVA réduite signée' },
  { ref: 'INT-2026-004', client: 'emalec', objet: 'Peinture cage d’escalier', ht: 2100, tva: 0, bucket: 'a-verifier', type: 'B2B', date: '06/11/2026', note: 'Rapport reçu avec 6 photos — à valider' },
  { ref: 'INT-2026-001', client: 'presta', objet: 'Dépannage TGBT', ht: 1200, tva: 0, bucket: 'non-eligibles', type: 'B2B', date: '06/11/2026', note: 'Intervention en cours' },
  { ref: 'INT-2026-005', client: 'rochelle', objet: 'Pose parquet & finitions', ht: 3400, tva: 0, bucket: 'non-eligibles', type: 'B2B', date: '06/11/2026', note: 'Intervention en cours' },
  { ref: 'DEV-2026-005', client: 'syndic', objet: 'Visite menuiserie hall', ht: 0, tva: 10, bucket: 'non-eligibles', type: 'B2B', date: '06/11/2026', note: 'Visite devis — non facturable' },
  { ref: 'INT-2026-012', client: 'emalec', objet: 'Mise en conformité tableau', ht: 1600, tva: 0, bucket: 'retards', type: 'B2B', date: '04/11/2026', note: 'Pièce manquante : disjoncteur différentiel 63 A', cause: 'Approvisionnement', delay: '2 jours' },
  { ref: 'INT-2026-011', client: 'presta', objet: 'Remplacement cylindres', ht: 2300, tva: 0, bucket: 'facturees', type: 'B2B', date: '05/11/2026', note: 'Facture F-2026-0187 émise' },
  { ref: 'INT-2026-015', client: 'syndic', objet: 'Peinture local vélos', ht: 3900, tva: 10, bucket: 'facturees', type: 'B2B', date: '03/11/2026', note: 'Facture F-2026-0184 réglée' },
];

export const BUCKETS = [
  { id: 'a-facturer', label: 'À facturer', hint: 'Terminées, rapport validé', tone: 'green' },
  { id: 'a-verifier', label: 'À vérifier', hint: 'Rapport à valider', tone: 'amber' },
  { id: 'non-eligibles', label: 'Non éligibles', hint: 'En cours ou visites', tone: 'slate' },
  { id: 'retards', label: 'Retards & relances', hint: 'Causes identifiées', tone: 'red' },
  { id: 'facturees', label: 'Facturées', hint: 'B2B et B2C', tone: 'blue' },
];

export const RENTA = [
  { tech: 'haitam', missions: 4, prev: 9, reel: 8.5, ca: 4980 },
  { tech: 'anouar', missions: 4, prev: 14, reel: 13.5, ca: 4850 },
  { tech: 'jamal', missions: 3, prev: 12, reel: 12.5, ca: 3900 },
  { tech: 'yankoubou', missions: 2, prev: 9, reel: 9.5, ca: 2800 },
  { tech: 'manneh', missions: 2, prev: 12, reel: 12, ca: 3400 },
  { tech: 'mohamed', missions: 3, prev: 10, reel: 11, ca: 2300 },
];

export const USERS = [
  { name: 'Zehair Louzza', email: 'zehair@anelecgroupe.com', role: 'Administrateur', tech: null, rights: 11, status: 'Actif', last: 'Aujourd’hui 10:31' },
  { name: 'Najoua Boughrara', email: 'najoua@anelecgroupe.com', role: 'Direction', tech: null, rights: 11, status: 'Actif', last: 'Hier 18:02' },
  { name: 'Sarah Kaci', email: 'planning@anelecgroupe.com', role: 'Bureau', tech: null, rights: 6, status: 'Actif', last: 'Aujourd’hui 09:12' },
  { name: 'Anouar', email: 'anouar@anelecgroupe.com', role: 'Technicien', tech: 'anouar', rights: 2, status: 'Actif', last: 'Aujourd’hui 10:20' },
  { name: 'Mohamed', email: 'mohamed@anelecgroupe.com', role: 'Technicien', tech: 'mohamed', rights: 2, status: 'Actif', last: 'Aujourd’hui 08:05' },
  { name: 'Haitam', email: 'haitam@anelecgroupe.com', role: 'Technicien', tech: 'haitam', rights: 2, status: 'Actif', last: 'Aujourd’hui 10:02' },
  { name: 'Jamal', email: 'jamal@anelecgroupe.com', role: 'Technicien', tech: 'jamal', rights: 2, status: 'Actif', last: 'Aujourd’hui 10:34' },
  { name: 'Lina Haddad', email: 'lina.h@anelecgroupe.com', role: 'Bureau', tech: null, rights: 4, status: 'Invitation envoyée', last: '—' },
];

export const MODULES = ['Tableau de bord', 'Planning', 'Devis', 'Interventions', 'Carte & tournées', 'Facturation', 'Comptabilité', 'Donneurs d’ordre', 'Paramètres', 'Utilisateurs', 'App terrain'];
export const ROLE_RIGHTS = {
  Administrateur: MODULES.map(() => 'edit'),
  Bureau: ['view', 'edit', 'edit', 'edit', 'view', 'view', 'none', 'edit', 'none', 'none', 'view'],
  Technicien: ['none', 'none', 'none', 'view', 'none', 'none', 'none', 'none', 'none', 'none', 'edit'],
};

export const POINTAGES = [
  { tech: 'jamal', in: '07:40', out: null, missions: '1/2', state: 'ok' },
  { tech: 'anouar', in: '07:52', out: null, missions: '1/3', state: 'ok' },
  { tech: 'haitam', in: '07:58', out: null, missions: '0/2', state: 'ok' },
  { tech: 'mohamed', in: '08:05', out: null, missions: '0/2', state: 'ok' },
  { tech: 'manneh', in: '08:21', out: null, missions: '0/1', state: 'late' },
  { tech: 'yankoubou', in: null, out: null, missions: '0/1', state: 'missing' },
];

export const WEEK = [
  { d: 'Lun 2', in: '07:48', out: '17:32', h: 8.7 },
  { d: 'Mar 3', in: '07:55', out: '17:40', h: 8.8 },
  { d: 'Mer 4', in: '07:50', out: '16:58', h: 8.1 },
  { d: 'Jeu 5', in: '07:46', out: '17:15', h: 8.5 },
  { d: 'Ven 6', in: '07:52', out: null, h: 2.7 },
  { d: 'Sam 7', in: null, out: null, h: 0 },
  { d: 'Dim 8', in: null, out: null, h: 0 },
];

export const ACTIVITY = [
  { t: '10:34', who: 'Jamal', what: 'a envoyé le rapport de INT-2026-004 (6 photos)', tone: 'teal' },
  { t: '10:21', who: 'Haitam', what: 'a démarré l’urgence INT-2026-007 chez GMS', tone: 'red' },
  { t: '10:02', who: 'Sarah K.', what: 'a envoyé le devis DEV-2026-002 à C-Multi-Serv', tone: 'blue' },
  { t: '09:47', who: 'Manneh', what: 'est arrivé sur site — Saint-Denis', tone: 'indigo' },
  { t: '09:12', who: 'Système', what: 'Tournée de Mohamed recalculée : 2 étapes, 14 km', tone: 'slate' },
  { t: '08:21', who: 'Manneh', what: 'a pointé son arrivée (retard de 21 min)', tone: 'amber' },
];

export const SEARCH_INDEX = [
  ...DEVIS.map((d) => ({ kind: 'Devis', ref: d.ref, label: `${CLIENT_BY_ID[d.client].name} — ${d.objet}`, screen: 'devis' })),
  ...INTERVENTIONS.map((i) => ({ kind: 'Intervention', ref: i.ref, label: `${CLIENT_BY_ID[i.client].name} — ${i.objet}`, screen: 'interventions' })),
  ...CLIENTS.map((c) => ({ kind: 'Donneur d’ordre', ref: c.type, label: c.name, screen: 'donneurs-ordre' })),
  ...TECHS.map((t) => ({ kind: 'Technicien', ref: t.initials, label: `${t.name} — ${t.skills.join(', ')}`, screen: 'planning' })),
];

// Statuts → tonalités (système unifié)
export const STATUS_TONE = {
  'À préparer': 'slate', Envoyé: 'blue', 'En négociation': 'amber', Accepté: 'green', Refusé: 'red',
  'À planifier': 'slate', Planifiée: 'blue', 'En cours': 'indigo', 'Non terminée': 'amber', 'Terminée — à valider': 'teal', Clôturée: 'green',
  Actif: 'green', 'Invitation envoyée': 'amber', 'Non facturée': 'slate', Facturée: 'green',
};

export const KIND_LABEL = { travaux: 'Travaux', visite: 'Visite devis', urgence: 'Urgence' };

export const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
export const num = (n, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
export const hhmm = (h) => {
  if (h == null) return '—';
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
};
