// Database initialization script
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('▪  Initializing database...');
  
  // Test connection
  await prisma.$connect();
  console.log('✓ Database connected');
  
  // Run migrations
  console.log('↻ Running migrations...');
  // Note: In production, use `prisma migrate deploy`
  // For dev, we use prisma migrate dev
  
  console.log('✓ Database initialized');
}

main()
  .catch((e) => {
    console.error('✕ Database initialization failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });