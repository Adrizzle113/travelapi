/**
 * Verify Test Hotel Mapping (Database Only)
 * 
 * This script checks if test hotels are already mapped in the database.
 * It does NOT call the ETG API - use map-test-hotel.js for that.
 * 
 * Run this first to see current status:
 * node scripts/verify-test-hotel-mapping.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_HOTEL_IDS = ['8473727', 'test_hotel_do_not_book'];

async function verifyTestHotelMapping() {
  console.log('🔍 === VERIFYING TEST HOTEL MAPPING ===\n');

  const results = {
    found: [],
    missing: []
  };

  for (const hotelId of TEST_HOTEL_IDS) {
    try {
      const hotel = await prisma.hotelDumpData.findUnique({
        where: { hotel_id: hotelId },
        select: {
          hotel_id: true,
          name: true,
          city: true,
          country: true,
          star_rating: true,
          imported_at: true,
          updated_at: true
        }
      });

      if (hotel) {
        console.log(`✅ Test Hotel Found: ${hotelId}`);
        console.log(`   Name: ${hotel.name || 'N/A'}`);
        console.log(`   Location: ${hotel.city || 'N/A'}, ${hotel.country || 'N/A'}`);
        console.log(`   Star Rating: ${hotel.star_rating || 'N/A'}`);
        console.log(`   Imported: ${hotel.imported_at?.toISOString().split('T')[0] || 'N/A'}`);
        console.log(`   Updated: ${hotel.updated_at?.toISOString().split('T')[0] || 'N/A'}`);
        results.found.push(hotelId);
      } else {
        console.log(`❌ Test Hotel Missing: ${hotelId}`);
        console.log(`   Action: Run 'node scripts/map-test-hotel.js' to fetch and store it`);
        results.missing.push(hotelId);
      }
      console.log('');
    } catch (error) {
      console.error(`❌ Error checking ${hotelId}:`, error.message);
      results.missing.push(hotelId);
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Found in database: ${results.found.length}/${TEST_HOTEL_IDS.length}`);
  if (results.found.length > 0) {
    console.log(`   Hotels: ${results.found.join(', ')}`);
  }
  
  console.log(`\n❌ Missing from database: ${results.missing.length}/${TEST_HOTEL_IDS.length}`);
  if (results.missing.length > 0) {
    console.log(`   Hotels: ${results.missing.join(', ')}`);
    console.log(`\n📝 Next Steps:`);
    console.log(`   1. Install dependencies: npm install`);
    console.log(`   2. Run mapping script: node scripts/map-test-hotel.js`);
    console.log(`   3. This will fetch missing hotels from ETG API and store them\n`);
  } else {
    console.log(`\n✅ All test hotels are mapped!`);
    console.log(`   You're ready for ETG certification verification.\n`);
  }

  return results;
}

async function main() {
  try {
    await verifyTestHotelMapping();
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    if (error.message.includes('PrismaClient')) {
      console.error('\n💡 Tip: Make sure you have:');
      console.error('   1. Installed dependencies: npm install');
      console.error('   2. Generated Prisma client: npx prisma generate');
      console.error('   3. Configured DATABASE_URL in .env\n');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { verifyTestHotelMapping };

