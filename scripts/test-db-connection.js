import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);

  try {
    await prisma.$connect();
    console.log('\n✅ Connected successfully!\n');

    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Query successful:', result);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
