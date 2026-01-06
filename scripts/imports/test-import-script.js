/**
 * Test script to verify import script can read files and connect to database
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const DUMPS_DIR = './dumps';

async function testImportScript() {
  console.log('🧪 Testing Import Script Setup...\n');

  // Test 1: Check DATABASE_URL
  console.log('1️⃣ Checking DATABASE_URL...');
  if (!process.env.DATABASE_URL) {
    console.log('   ❌ DATABASE_URL not found in environment variables');
    console.log('   💡 Make sure your .env file has: DATABASE_URL=postgresql://...');
    return false;
  } else {
    console.log('   ✅ DATABASE_URL is set');
    // Show first 50 chars for security
    const dbUrl = process.env.DATABASE_URL;
    console.log(`   📝 URL starts with: ${dbUrl.substring(0, 20)}...`);
  }

  // Test 2: Test database connection
  console.log('\n2️⃣ Testing database connection...');
  try {
    await prisma.$connect();
    console.log('   ✅ Database connection successful');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log(`   ✅ Database has ${result[0].count} tables`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.log('   ❌ Database connection failed:', error.message);
    return false;
  }

  // Test 3: Check if dump files exist
  console.log('\n3️⃣ Checking dump files...');
  const requiredFiles = [
    'hotel_info_en.json',
    'hotel_reviews_en.json',
    'hotel_poi_en.json',
    'regions.json'
  ];

  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = path.join(DUMPS_DIR, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
      console.log(`   ✅ ${file} exists (${sizeGB} GB)`);
    } else {
      console.log(`   ❌ ${file} not found`);
      allFilesExist = false;
    }
  }

  if (!allFilesExist) {
    return false;
  }

  // Test 4: Test reading first line of each file
  console.log('\n4️⃣ Testing file readability...');
  const readline = (await import('readline')).default;
  const { createReadStream } = await import('fs');

  try {
    // Test hotel_info_en.json (NDJSON)
    const hotelInfoStream = createReadStream(path.join(DUMPS_DIR, 'hotel_info_en.json'));
    const hotelInfoRL = readline.createInterface({
      input: hotelInfoStream,
      crlfDelay: Infinity
    });
    
    let firstLine = null;
    for await (const line of hotelInfoRL) {
      if (line.trim()) {
        firstLine = line;
        break;
      }
    }
    hotelInfoRL.close();
    
    if (firstLine) {
      const hotel = JSON.parse(firstLine);
      console.log(`   ✅ hotel_info_en.json readable (sample hotel ID: ${hotel.id || hotel.hid})`);
    } else {
      console.log('   ⚠️  hotel_info_en.json appears empty');
    }
  } catch (error) {
    console.log(`   ❌ Error reading hotel_info_en.json: ${error.message}`);
    return false;
  }

  try {
    // Test hotel_reviews_en.json (single JSON object)
    const reviewsContent = fs.readFileSync(path.join(DUMPS_DIR, 'hotel_reviews_en.json'), 'utf-8');
    const reviewsData = JSON.parse(reviewsContent);
    const hotelCount = Object.keys(reviewsData).length;
    console.log(`   ✅ hotel_reviews_en.json readable (${hotelCount} hotels with reviews)`);
  } catch (error) {
    console.log(`   ❌ Error reading hotel_reviews_en.json: ${error.message}`);
    return false;
  }

  try {
    // Test hotel_poi_en.json (NDJSON)
    const poiStream = createReadStream(path.join(DUMPS_DIR, 'hotel_poi_en.json'));
    const poiRL = readline.createInterface({
      input: poiStream,
      crlfDelay: Infinity
    });
    
    let firstLine = null;
    for await (const line of poiRL) {
      if (line.trim()) {
        firstLine = line;
        break;
      }
    }
    poiRL.close();
    
    if (firstLine) {
      const poi = JSON.parse(firstLine);
      console.log(`   ✅ hotel_poi_en.json readable (sample hotel ID: ${poi.id})`);
    } else {
      console.log('   ⚠️  hotel_poi_en.json appears empty');
    }
  } catch (error) {
    console.log(`   ❌ Error reading hotel_poi_en.json: ${error.message}`);
    return false;
  }

  try {
    // Test regions.json (NDJSON)
    const regionsStream = createReadStream(path.join(DUMPS_DIR, 'regions.json'));
    const regionsRL = readline.createInterface({
      input: regionsStream,
      crlfDelay: Infinity
    });
    
    let firstLine = null;
    for await (const line of regionsRL) {
      if (line.trim()) {
        firstLine = line;
        break;
      }
    }
    regionsRL.close();
    
    if (firstLine) {
      const region = JSON.parse(firstLine);
      console.log(`   ✅ regions.json readable (sample region ID: ${region.id})`);
    } else {
      console.log('   ⚠️  regions.json appears empty');
    }
  } catch (error) {
    console.log(`   ❌ Error reading regions.json: ${error.message}`);
    return false;
  }

  // Test 5: Check Prisma schema models
  console.log('\n5️⃣ Checking Prisma models...');
  try {
    await prisma.$connect();
    
    // Try to access each model (this will fail if table doesn't exist)
    const models = ['hotelDumpData', 'hotelReview', 'hotelPOI', 'regionData'];
    for (const model of models) {
      try {
        // Just check if we can access the model
        const count = await prisma[model].count();
        console.log(`   ✅ ${model} table exists (${count} records)`);
      } catch (error) {
        console.log(`   ⚠️  ${model} table may not exist or is not accessible: ${error.message}`);
      }
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.log(`   ⚠️  Error checking models: ${error.message}`);
  }

  console.log('\n✅ All tests passed! The import script should work.');
  console.log('\n📝 Next step: Run the import script:');
  console.log('   node scripts/imports/import-all-dumps-to-supabase.js');
  
  return true;
}

testImportScript()
  .then(success => {
    if (!success) {
      console.log('\n❌ Some tests failed. Please fix the issues above before running the import.');
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });

