import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function ensureUUIDExtension() {
  try {
    console.log('🔧 Checking UUID extension...');

    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'uuid-ossp'
      ) as extension_exists
    `;

    if (result[0].extension_exists) {
      console.log('✅ uuid-ossp extension is already enabled');
    } else {
      console.log('⚠️ uuid-ossp extension not found, attempting to enable...');

      try {
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
        console.log('✅ uuid-ossp extension enabled successfully');
      } catch (error) {
        console.error('❌ Failed to enable uuid-ossp extension:', error.message);
        console.error('   This extension may need to be enabled by a database administrator');
        console.error('   Run this SQL command in your Supabase dashboard:');
        console.error('   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error checking UUID extension:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

ensureUUIDExtension();
