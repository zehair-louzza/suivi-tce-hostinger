import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const artifactDir = 'C:/Users/Zeh/.gemini/antigravity/brain/d2fd77b6-f5a7-44a6-956a-412bdfedd8dd';

const SCREENS = [
  { id: 'synthese', path: '/', mockScreen: 'tableau-de-bord' },
  { id: 'planning', path: '/planning', mockScreen: 'planning' },
  { id: 'devis', path: '/devis', mockScreen: 'devis' },
  { id: 'interventions', path: '/interventions', mockScreen: 'interventions' },
  { id: 'carte', path: '/carte', mockScreen: 'carte' },
  { id: 'facturation', path: '/facturation', mockScreen: 'facturation' },
  { id: 'comptabilite', path: '/rentabilite', mockScreen: 'comptabilite' },
  { id: 'clients', path: '/clients', mockScreen: 'donneurs-ordre' },
  { id: 'parametres', path: '/referentiels', mockScreen: 'parametres' },
  { id: 'utilisateurs', path: '/admin', mockScreen: 'utilisateurs' },
  { id: 'terrain', path: '/mobile', mockScreen: 'terrain' },
];

const MOCK_DEVIS = [
  {
    id: 1,
    reference: 'DEV-2026-001',
    numeroDevis: 'DEV-2026-001',
    clientNom: 'Presta maintenance',
    clientEmail: 'travaux@prestamaintenance.fr',
    clientTelephone: '01 42 68 55 00',
    clientAdresse: '8 rue de Penthièvre, 75008 Paris',
    titre: 'Rénovation TGBT & armoires divisionnaires',
    corpsDetat: 'Électricité',
    montantHt: 8400,
    montantTtc: 10080,
    statut: 'ACCEPTE',
    statutCommercial: 'ACCEPTE',
    traitementAdmin: 'A_CONVERTIR',
    visiteTechniqueRequise: true,
    visiteStatut: 'REALISEE',
    dateEcheance: '2026-11-12',
    chargeAffaires: 'Zehair Louzza',
    hasIntervention: true,
  },
  {
    id: 2,
    reference: 'DEV-2026-002',
    numeroDevis: 'DEV-2026-002',
    clientNom: 'C-Multi-Serv',
    clientEmail: 'dispatch@c-multiserv.com',
    clientAdresse: '22 av. Charles de Gaulle, Neuilly',
    titre: 'Remplacement colonnes montantes',
    corpsDetat: 'Plomberie',
    montantHt: 4200,
    montantTtc: 5040,
    statut: 'ENVOYE',
    statutCommercial: 'ENVOYE',
    visiteTechniqueRequise: false,
    dateEcheance: '2026-11-15',
    chargeAffaires: 'Anouar',
  },
  {
    id: 3,
    reference: 'DEV-2026-003',
    numeroDevis: 'DEV-2026-003',
    clientNom: 'GMS Services',
    clientEmail: 'technique@gms-services.fr',
    clientAdresse: '3 rue Anatole France, Levallois',
    titre: 'Pose bloc-porte coupe-feu & ferme-porte',
    corpsDetat: 'Serrurerie',
    montantHt: 1850,
    montantTtc: 2220,
    statut: 'ACCEPTE',
    statutCommercial: 'ACCEPTE',
    visiteTechniqueRequise: true,
    visiteStatut: 'REALISEE',
    dateEcheance: '2026-11-09',
    chargeAffaires: 'Zehair Louzza',
  },
  {
    id: 4,
    reference: 'DEV-2026-004',
    numeroDevis: 'DEV-2026-004',
    clientNom: 'EMALEC',
    clientEmail: 'maintenance@emalec.fr',
    clientAdresse: '45 rue de Silly, Boulogne',
    titre: 'Mise en peinture parties communes',
    corpsDetat: 'Peinture',
    montantHt: 6300,
    montantTtc: 7560,
    statut: 'A_PREPARER',
    statutCommercial: 'A_PREPARER',
    visiteTechniqueRequise: true,
    visiteStatut: 'A_AFFECTER',
    dateEcheance: '2026-11-18',
    chargeAffaires: 'Sarah K.',
  },
  {
    id: 5,
    reference: 'DEV-2026-005',
    numeroDevis: 'DEV-2026-005',
    clientNom: 'Syndic Paris 08',
    clientEmail: 'gestion@syndicparis08.fr',
    clientAdresse: '18 rue de Miromesnil, Paris',
    titre: 'Agencement menuiserie hall & boîtes aux lettres',
    corpsDetat: 'Menuiserie',
    montantHt: 5100,
    montantTtc: 6120,
    statut: 'EN_NEGOCIATION',
    statutCommercial: 'ENVOYE',
    visiteTechniqueRequise: true,
    visiteStatut: 'PLANIFIEE',
    dateEcheance: '2026-11-20',
    chargeAffaires: 'Zehair Louzza',
  },
  {
    id: 6,
    reference: 'DEV-2026-006',
    numeroDevis: 'DEV-2026-006',
    clientNom: 'Presta la Rochelle',
    clientEmail: 'idf@presta-larochelle.fr',
    clientAdresse: '12 rue du Landy, Saint-Denis',
    titre: 'Rénovation globale locaux techniques',
    corpsDetat: 'Tous corps d’état',
    montantHt: 14500,
    montantTtc: 17400,
    statut: 'ACCEPTE',
    statutCommercial: 'ACCEPTE',
    visiteTechniqueRequise: true,
    visiteStatut: 'REALISEE',
    dateEcheance: '2026-11-30',
    chargeAffaires: 'Najoua B.',
    hasIntervention: true,
  },
];

const MOCK_INTERVENTIONS = [
  {
    id: 1,
    reference: 'INT-2026-001',
    numeroIntervention: 'INT-2026-001',
    clientNom: 'Presta maintenance',
    clientEmail: 'travaux@prestamaintenance.fr',
    adresse: '8 rue de Penthièvre, 75008 Paris',
    corpsDetat: 'Électricité',
    titre: 'Dépannage TGBT & diagnostic puissance',
    technicienNom: 'Anouar',
    datePlanifiee: '2026-11-06T08:30:00.000Z',
    heureDebut: '08:30',
    heureFin: '11:00',
    statut: 'EN_COURS',
    statutOperationnel: 'EN_COURS',
    rapportStatut: 'A_REDIGER',
    statutFacture: 'NON_FACTUREE',
    montantHt: 1200,
    devisAmount: 1200,
    priorite: 'HAUTE',
    photosCount: 2,
    rapportRecu: false,
  },
  {
    id: 2,
    reference: 'INT-2026-002',
    numeroIntervention: 'INT-2026-002',
    clientNom: 'C-Multi-Serv',
    adresse: '22 av. Charles de Gaulle, 92200 Neuilly',
    corpsDetat: 'Plomberie',
    titre: 'Recherche de fuite & raccordement',
    technicienNom: 'Mohamed',
    datePlanifiee: '2026-11-06T09:00:00.000Z',
    heureDebut: '09:00',
    heureFin: '11:30',
    statut: 'PLANIFIEE',
    statutOperationnel: 'PLANIFIEE',
    statutFacture: 'NON_FACTUREE',
    montantHt: 850,
    devisAmount: 850,
    priorite: 'NORMALE',
  },
  {
    id: 3,
    reference: 'INT-2026-007',
    numeroIntervention: 'INT-2026-007',
    clientNom: 'GMS Services',
    adresse: '3 rue Anatole France, 92300 Levallois',
    corpsDetat: 'Électricité',
    titre: 'Urgence : panne éclairage de sécurité',
    technicienNom: 'Haitam',
    datePlanifiee: '2026-11-06T10:00:00.000Z',
    heureDebut: '10:00',
    heureFin: '12:00',
    statut: 'EN_COURS',
    statutOperationnel: 'EN_COURS',
    rapportStatut: 'A_REDIGER',
    statutFacture: 'NON_FACTUREE',
    montantHt: 650,
    devisAmount: 650,
    priorite: 'URGENTE',
    photosCount: 1,
  },
  {
    id: 4,
    reference: 'INT-2026-004',
    numeroIntervention: 'INT-2026-004',
    clientNom: 'EMALEC',
    adresse: '45 rue de Silly, 92100 Boulogne',
    corpsDetat: 'Peinture',
    titre: 'Reprise enduits & peinture cage d’escalier',
    technicienNom: 'Jamal',
    datePlanifiee: '2026-11-06T08:00:00.000Z',
    heureDebut: '08:00',
    heureFin: '10:30',
    statut: 'TERMINEE',
    statutOperationnel: 'TERMINEE',
    rapportStatut: 'RECU',
    rapportRecu: true,
    statutFacture: 'NON_FACTUREE',
    montantHt: 2100,
    devisAmount: 2100,
    priorite: 'NORMALE',
    photosCount: 6,
  },
  {
    id: 5,
    reference: 'INT-2026-005',
    numeroIntervention: 'INT-2026-005',
    clientNom: 'Presta la Rochelle',
    adresse: '12 rue du Landy, 93200 Saint-Denis',
    corpsDetat: 'Menuiserie',
    titre: 'Pose parquet & finitions',
    technicienNom: 'Manneh',
    datePlanifiee: '2026-11-06T09:30:00.000Z',
    heureDebut: '09:30',
    heureFin: '15:30',
    statut: 'EN_COURS',
    statutOperationnel: 'EN_COURS',
    rapportStatut: 'A_REDIGER',
    statutFacture: 'NON_FACTUREE',
    montantHt: 3400,
    devisAmount: 3400,
    priorite: 'NORMALE',
    photosCount: 4,
  },
  {
    id: 6,
    reference: 'INT-2026-011',
    numeroIntervention: 'INT-2026-011',
    clientNom: 'Presta maintenance',
    adresse: '5 rue de Rome, 75008 Paris',
    corpsDetat: 'Serrurerie',
    titre: 'Remplacement cylindres parties communes',
    technicienNom: 'Anouar',
    datePlanifiee: '2026-11-05T09:00:00.000Z',
    heureDebut: '09:00',
    heureFin: '11:00',
    statut: 'CLOTUREE',
    statutOperationnel: 'CLOTUREE',
    rapportStatut: 'VALIDE',
    rapportRecu: true,
    statutFacture: 'FACTUREE',
    montantHt: 2300,
    devisAmount: 2300,
    priorite: 'NORMALE',
    photosCount: 5,
  },
];

async function main() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/auth/me')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          user: {
            id: 1,
            name: 'Zehair Louzza',
            email: 'louzza.zehair@gmail.com',
            role: 'ADMIN',
            companyId: 1,
            permissions: ['ALL'],
            theme: { companyDefault: 'craft', allowOverride: true, userPref: 'craft', resolved: 'craft' }
          }
        })
      });
    } else if (url.includes('/api/auth/refresh')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ accessToken: 'valid_mock_token' })
      });
    } else if (url.includes('/api/devis')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ data: MOCK_DEVIS, total: MOCK_DEVIS.length })
      });
    } else if (url.includes('/api/interventions')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ data: MOCK_INTERVENTIONS, total: MOCK_INTERVENTIONS.length })
      });
    } else if (url.includes('/api/referentiels')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          data: {
            METIERS: ['Électricité', 'Plomberie', 'CVC / Climatisation', 'Chauffage', 'Serrurerie', 'Menuiserie', 'Peinture', 'Tous corps d’état'],
            TECHNICIENS: ['Anouar', 'Mohamed', 'Haitam', 'Jamal', 'Manneh', 'Yankoubou']
          }
        })
      });
    } else if (url.includes('/api/admin/appearance')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ defaultTheme: 'craft', allowThemeOverride: true })
      });
    } else if (url.includes('/api/')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ data: [] })
      });
    } else {
      req.continue();
    }
  });

  // Set Craft theme in local storage
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const authStorage = {
      state: {
        user: {
          id: 1,
          name: 'Zehair Louzza',
          email: 'louzza.zehair@gmail.com',
          role: 'ADMIN',
          permissions: ['ALL'],
          companyName: 'ANELEC GROUPE',
        },
        accessToken: 'dummy_token',
        isAuthenticated: true,
        isLoading: false,
      },
      version: 0,
    };
    localStorage.setItem('auth-storage', JSON.stringify(authStorage));
    localStorage.setItem('app_theme', 'craft');
    document.documentElement.setAttribute('data-theme', 'craft');
    document.documentElement.setAttribute('data-dir', 'craft');
  });

  for (const s of SCREENS) {
    console.log(`Capturing Craft App screen: ${s.id}...`);
    try {
      await page.goto(`http://localhost:5173${s.path}`, { waitUntil: 'networkidle2', timeout: 12000 });
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'craft');
        document.documentElement.setAttribute('data-dir', 'craft');
      });
      await new Promise(r => setTimeout(r, 1200));
      const appFile = path.join(artifactDir, `craft-app-${s.id}.png`);
      await page.screenshot({ path: appFile });
      const stats = fs.statSync(appFile);
      console.log(`Saved Craft App: ${s.id} (${stats.size} bytes)`);
    } catch (e) {
      console.error(`Error capturing craft app ${s.id}:`, e.message);
    }

    console.log(`Capturing Craft Mock screen: ${s.mockScreen}...`);
    try {
      await page.goto(`http://localhost:3000/m/craft/${s.mockScreen}`, { waitUntil: 'networkidle2', timeout: 12000 });
      await new Promise(r => setTimeout(r, 1200));
      const mockFile = path.join(artifactDir, `craft-mock-${s.id}.png`);
      await page.screenshot({ path: mockFile });
      const stats = fs.statSync(mockFile);
      console.log(`Saved Craft Mock: ${s.id} (${stats.size} bytes)`);
    } catch (e) {
      console.error(`Error capturing craft mock ${s.mockScreen}:`, e.message);
    }
  }

  await browser.close();
  console.log('All Craft Warmth screen comparisons captured successfully!');
}

main().catch(console.error);
