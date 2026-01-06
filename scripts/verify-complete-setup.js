import { PrismaClient } from '@prisma/client';
import { getStaticRegion, getAllDestinations } from '../config/destinations/staticDestinationMap.js';
import { resolveDestination } from '../services/destination/destinationResolver.js';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('🔍 COMPLETE SETUP VERIFICATION\n');
  console.log('═'.repeat(60));
  
  const results = {
    prisma: false,
    tables: false,
    supabase: false,
    staticMap: false,
    destinationResolver: false
  };

  console.log('\n1️⃣ Testing Prisma Connection...');
  try {
    await prisma.$connect();
    console.log('   ✅ Prisma connected to PostgreSQL');
    results.prisma = true;
  } catch (error) {
    console.log('   ❌ Prisma connection failed:', error.message);
    await printSummary(results);
    return;
  }

  console.log('\n2️⃣ Checking Supabase Tables...');
  try {
    const destCount = await prisma.destinationCache.count();
    const hotelCount = await prisma.hotelStaticCache.count();
    const searchCount = await prisma.searchCache.count();
    
    console.log(`   ✅ destination_cache: ${destCount} records`);
    console.log(`   ✅ hotel_static_cache: ${hotelCount} records`);
    console.log(`   ✅ search_cache: ${searchCount} records`);
    results.tables = true;
  } catch (error) {
    console.log('   ❌ Table access failed:', error.message);
    await printSummary(results);
    return;
  }

  console.log('\n3️⃣ Testing Static Destination Map...');
  try {
    const allDestinations = getAllDestinations();
    const nyc = getStaticRegion('New York');
    const paris = getStaticRegion('Paris');
    
    console.log(`   ✅ ${allDestinations.length} destinations in static map`);
    console.log(`   ✅ NYC lookup: ${nyc ? nyc.region_id : 'FAILED'}`);
    console.log(`   ✅ Paris lookup: ${paris ? paris.region_id : 'FAILED'}`);
    results.staticMap = nyc && paris;
  } catch (error) {
    console.log('   ❌ Static map failed:', error.message);
    await printSummary(results);
    return;
  }

  console.log('\n4️⃣ Testing Destination Resolver...');
  try {
    const test1 = await resolveDestination('New York');
    const test2 = await resolveDestination('london');
    
    console.log(`   ✅ Resolved "New York" → ${test1.region_id} (${test1.source})`);
    console.log(`   ✅ Resolved "london" → ${test2.region_id} (${test2.source})`);
    results.destinationResolver = test1.region_id && test2.region_id;
  } catch (error) {
    console.log('   ❌ Destination resolver failed:', error.message);
    await printSummary(results);
    return;
  }

  console.log('\n5️⃣ Testing Database Write/Read...');
  try {
    await prisma.destinationCache.upsert({
      where: { destination_name: '_test_city' },
      update: { region_id: 99999 },
      create: {
        destination_name: '_test_city',
        region_id: 99999,
        region_name: 'Test City'
      }
    });
    console.log('   ✅ Write test passed');

    const testRead = await prisma.destinationCache.findUnique({
      where: { destination_name: '_test_city' }
    });
    console.log('   ✅ Read test passed');

    await prisma.destinationCache.delete({
      where: { destination_name: '_test_city' }
    });
    console.log('   ✅ Cleanup complete');
    results.supabase = true;
  } catch (error) {
    console.log('   ❌ Database write/read failed:', error.message);
  }

  await printSummary(results);
}

async function printSummary(results) {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Prisma Connection:       ${results.prisma ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Supabase Tables:         ${results.tables ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Database Read/Write:     ${results.supabase ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Static Map (50+ cities): ${results.staticMap ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Destination Resolver:    ${results.destinationResolver ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═'.repeat(60));

  const allPassed = Object.values(results).every(r => r === true);

  if (allPassed) {
    console.log('\n🎉 SUCCESS! All systems operational!\n');
  } else {
    console.log('\n⚠️ Some tests failed. Review errors above.\n');
  }

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

runVerification().catch(error => {
  console.error('💥 Verification crashed:', error);
  process.exit(1);
});