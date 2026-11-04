// Database seed script with sample data
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.intervention.deleteMany();
  await prisma.devis.deleteMany();
  await prisma.user.deleteMany();

  // Create demo user
  const passwordHash = await bcrypt.hash('demo1234', 12);
  
  const user = await prisma.user.create({
    data: {
      email: 'demo@suivi-tce.fr',
      password: passwordHash,
      name: 'Utilisateur Demo',
      role: 'USER',
    },
  });

  console.log('✅ Created demo user:', user.email);

  // Sample data
  const today = new Date();
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

  // Sample devis
  const devisData = [
    {
      client: 'Mairie de Lyon - Rénovation école',
      amount: 45000,
      dateCreated: subDays(60),
      echeance: addDays(30),
      status: 'TRAITE',
      notes: 'Devis accepté le 20/09',
      userId: user.id,
    },
    {
      client: 'Hôpital Saint-Louis - Extension',
      amount: 120000,
      dateCreated: subDays(30),
      echeance: addDays(60),
      status: 'EN_COURS',
      notes: 'En négociation',
      userId: user.id,
    },
    {
      client: "Bureau d'études Atlas - Siège social",
      amount: 78000,
      dateCreated: subDays(5),
      echeance: addDays(25),
      status: 'A_TRAITER',
      notes: '',
      userId: user.id,
    },
    {
      client: 'Collège Victor Hugo - Réfection toiture',
      amount: 95000,
      dateCreated: subDays(15),
      echeance: addDays(15),
      status: 'EN_ATTENTE',
      notes: 'En attente validation DREAL',
      userId: user.id,
    },
    {
      client: 'Ehpad Les Jardins - Mise aux normes',
      amount: 156000,
      dateCreated: subDays(45),
      echeance: subDays(5),
      status: 'BLOQUE',
      notes: 'PB fournisseur PAC - délai 8 semaines',
      userId: user.id,
    },
  ];

  for (const d of devisData) {
    await prisma.devis.create({ data: d });
  }
  console.log(`✅ Created ${devisData.length} devis`);

  // Sample interventions
  const interventionsData = [
    {
      chantier: 'Lycée Victor Hugo - Lot 03 Maçonnerie',
      entreprise: 'SARL Dubois',
      amount: 380000,
      datePlanifiee: subDays(40),
      dateReelle: subDays(38),
      status: 'TRAITE',
      notes: 'Reçu sans réserve',
      userId: user.id,
    },
    {
      chantier: 'Collège Marie Curie - Lot 05 Menuiseries',
      entreprise: 'Menuiseries Martin',
      amount: 156000,
      datePlanifiee: addDays(10),
      dateReelle: null,
      status: 'EN_COURS',
      notes: 'En cours de pose - semaine 2/4',
      userId: user.id,
    },
    {
      chantier: 'Ehpad Les Jardins - Lot 11 Plomberie',
      entreprise: 'Plomberie Sud',
      amount: 89000,
      datePlanifiee: addDays(35),
      dateReelle: null,
      status: 'A_TRAITER',
      notes: 'En attente validation planning',
      userId: user.id,
    },
    {
      chantier: 'Mairie Annecy - Lot 12 Chauffage',
      entreprise: 'Chauffage Pro',
      amount: 234000,
      datePlanifiee: subDays(60),
      dateReelle: null,
      status: 'BLOQUE',
      notes: 'PB fournisseur PAC - délai 8 semaines',
      userId: user.id,
    },
    {
      chantier: 'ZAC Plateau - Lot 04 Couverture',
      entreprise: 'Toitures Alpines',
      amount: 412000,
      datePlanifiee: subDays(35),
      dateReelle: subDays(35),
      status: 'TRAITE',
      notes: 'Étanchéité validée - PV réception signé',
      userId: user.id,
    },
  ];

  for (const i of interventionsData) {
    await prisma.intervention.create({ data: i });
  }
  console.log(`✅ Created ${interventionsData.length} interventions`);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });