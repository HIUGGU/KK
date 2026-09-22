import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Test connection
prisma.$connect()
  .then(() => {
    console.log('Connected to PostgreSQL database via Prisma');
  })
  .catch((error) => {
    console.error('Database connection error:', error);
  });

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
