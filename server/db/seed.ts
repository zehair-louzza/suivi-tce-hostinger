// Database seed script with realistic ANELEC Groupe data (Devis, Interventions, Visites Devis, Planning Techniciens)
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_REFERENTIELS } from '../../shared/types.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initialisation des données métier ANELEC...');

  await prisma.conversionRequest.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.devis.deleteMany();
  await prisma.referentiel.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('demo1234', 12);
  const user = await prisma.user.create({
    data: {
      email: 'demo@suivi-tce.fr',
      password: passwordHash,
      name: 'Zehair — Coordination ANELEC',
      role: 'ADMIN',
    },
  });

  for (const [categorie, valeurs] of Object.entries(DEFAULT_REFERENTIELS)) {
    await prisma.referentiel.create({
      data: {
        categorie,
        valeurs: JSON.stringify(valeurs),
      },
    });
  }

  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const dayOfCurrentWeek = (offsetFromMonday: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offsetFromMonday);
    return d;
  };

  const addDays = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d;
  };
  const subDays = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d;
  };

  const devis1 = await prisma.devis.create({
    data: {
      referenceMetier: 'DEV-2026-001',
      client: 'EMALEC',
      siteAdresse: 'Agence BNP Paribas — 14 rue de la République, Orléans',
      objet: 'Remplacement tableau divisionnaire TGBT + éclairage sécurité BAES',
      corpsEtat: 'Électricité',
      origine: "Donneur d'ordre",
      dateCreated: subDays(18),
      dateDemande: subDays(18),
      echeance: subDays(4),
      dateLimite: subDays(4),
      dateEnvoi: subDays(12),
      statutCommercial: 'Accepté',
      traitement: 'En attente fournisseur',
      status: 'EN_ATTENTE',
      amount: 14850,
      montantHt: 14850,
      validiteJours: 30,
      prochaineAction: 'Planifier après accord',
      dateRelance: addDays(2),
      responsable: 'Zehair',
      priorite: 'Haute',
      refInterventionTexte: 'INT-2026-001',
      notes: 'Accord signé reçu. Disjoncteurs Schneider en livraison chez Rexel.',
      commentaires: 'Accord signé reçu. Disjoncteurs Schneider en livraison chez Rexel.',
      visiteNecessaire: false,
      historiqueJson: JSON.stringify([
        { id: 'h1', date: subDays(2).toISOString(), auteur: 'Zehair', action: 'Accord client enregistré', details: 'Bon pour accord EMALEC #44912' },
        { id: 'h2', date: subDays(12).toISOString(), auteur: 'Najoua', action: 'Devis envoyé au client', details: 'Montant 14 850 € HT (validité 30j)' },
      ]),
      userId: user.id,
    },
  });

  const devis2 = await prisma.devis.create({
    data: {
      referenceMetier: 'DEV-2026-002',
      client: 'GMS',
      siteAdresse: 'Supermarché Carrefour Market — Saran',
      objet: 'Relevé et chiffrage reprise groupe froid + gaines CVC réserve',
      corpsEtat: 'CVC / Climatisation',
      origine: 'Contrat de maintenance',
      dateCreated: subDays(6),
      dateDemande: subDays(6),
      echeance: addDays(3),
      dateLimite: addDays(3),
      dateEnvoi: null,
      statutCommercial: 'À préparer',
      traitement: 'En attente technicien',
      status: 'EN_ATTENTE',
      amount: 0,
      montantHt: null,
      validiteJours: 30,
      prochaineAction: 'Chiffrer',
      dateRelance: addDays(1),
      responsable: 'Anouar',
      priorite: 'Urgente',
      refInterventionTexte: 'VIS-2026-002',
      notes: 'Nécessite une visite technique sur site par Mohamed pour relever les côtes de gaines avant chiffrage.',
      commentaires: 'Nécessite une visite technique sur site par Mohamed pour relever les côtes de gaines avant chiffrage.',
      visiteNecessaire: true,
      visiteTechnicien: 'Mohamed',
      visiteDate: dayOfCurrentWeek(1),
      visiteHeureDebut: '08:30',
      visiteHeureFin: '11:00',
      visiteStatut: 'Planifiée',
      userId: user.id,
    },
  });

  await prisma.devis.create({
    data: {
      referenceMetier: 'DEV-2026-003',
      client: 'C-Multi-Serv',
      siteAdresse: 'Boutique Fabio Salsa — Centre Commercial Place d’Arc, Orléans',
      objet: 'Rénovation plomberie bacs à shampoing + ballon thermodynamique 300L',
      corpsEtat: 'Plomberie',
      origine: 'Client',
      dateCreated: subDays(14),
      dateDemande: subDays(14),
      echeance: subDays(3),
      dateLimite: subDays(3),
      dateEnvoi: subDays(8),
      statutCommercial: 'Envoyé au client',
      traitement: 'En attente client',
      status: 'EN_ATTENTE',
      amount: 6420,
      montantHt: 6420,
      validiteJours: 30,
      prochaineAction: 'Relancer le client',
      dateRelance: subDays(2),
      responsable: 'Najoua',
      priorite: 'Haute',
      notes: 'Devis envoyé à la responsable régionale. Relancer pour validation avant commande ballon.',
      userId: user.id,
    },
  });

  await prisma.intervention.create({
    data: {
      referenceMetier: 'INT-2026-001',
      refDevisTexte: 'DEV-2026-001',
      client: 'EMALEC',
      chantier: 'Agence BNP Paribas — 14 rue de la République, Orléans',
      siteAdresse: 'Agence BNP Paribas — 14 rue de la République, Orléans',
      objet: 'Remplacement tableau divisionnaire TGBT + éclairage sécurité BAES',
      origine: "Donneur d'ordre",
      typeIntervention: 'Mise en conformité',
      modePlanification: 'Planifiée',
      corpsEtat: 'Électricité',
      priorite: 'Haute',
      dateDemande: subDays(5),
      datePlanifiee: dayOfCurrentWeek(0),
      statutOperationnel: 'Planifiée',
      traitement: 'En cours de traitement',
      status: 'EN_COURS',
      entreprise: 'Anouar',
      technicien: 'Anouar',
      heureDebut: '08:00',
      heureFin: '12:30',
      isVisiteDevis: false,
      amount: 14850,
      dateEcheance: dayOfCurrentWeek(2),
      statutFacture: 'Non facturée',
      origineDevisId: devis1.id,
      origineDevisClient: devis1.client,
      origineDevisDate: devis1.dateCreated,
      devisId: devis1.id,
      userId: user.id,
    },
  });

  await prisma.intervention.create({
    data: {
      referenceMetier: 'VIS-2026-002',
      refDevisTexte: 'DEV-2026-002',
      client: 'GMS',
      chantier: 'Supermarché Carrefour Market — Saran',
      siteAdresse: 'Supermarché Carrefour Market — Saran',
      objet: '[Visite Devis] Relevé et chiffrage reprise groupe froid + gaines CVC réserve',
      origine: 'Contrat de maintenance',
      typeIntervention: 'Visite technique devis',
      modePlanification: 'Planifiée',
      corpsEtat: 'CVC / Climatisation',
      priorite: 'Urgente',
      dateDemande: subDays(6),
      datePlanifiee: dayOfCurrentWeek(1),
      statutOperationnel: 'Planifiée',
      traitement: 'En cours de traitement',
      status: 'EN_COURS',
      entreprise: 'Mohamed',
      technicien: 'Mohamed',
      heureDebut: '08:30',
      heureFin: '11:00',
      isVisiteDevis: true,
      amount: 0,
      dateEcheance: dayOfCurrentWeek(2),
      statutFacture: 'Non facturée',
      origineDevisId: devis2.id,
      origineDevisClient: devis2.client,
      origineDevisDate: devis2.dateCreated,
      devisId: devis2.id,
      userId: user.id,
    },
  });

  console.log('✅ Seed ANELEC terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
