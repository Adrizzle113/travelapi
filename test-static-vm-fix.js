/**
 * Test script to verify static_vm data preservation in cache
 * Tests both fresh API calls and cached results
 */

import { executeSearch } from './services/search/searchService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testStaticVmPreservation() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 Testing static_vm Data Preservation in Cache');
  console.log('='.repeat(80) + '\n');

  try {
    // Generate future dates dynamically
    const today = new Date();
    const checkinDate = new Date(today);
    checkinDate.setDate(today.getDate() + 30); // 30 days from now
    const checkoutDate = new Date(checkinDate);
    checkoutDate.setDate(checkinDate.getDate() + 2); // 2 nights

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Test parameters
    const searchParams = {
      region_id: 2114, // New York
      checkin: formatDate(checkinDate),
      checkout: formatDate(checkoutDate),
      guests: [{ adults: 2, children: [] }],
      currency: 'USD',
      residency: 'us'
    };

    console.log('📋 Test Parameters:');
    console.log(`   Region ID: ${searchParams.region_id}`);
    console.log(`   Dates: ${searchParams.checkin} → ${searchParams.checkout}`);
    console.log(`   Guests: ${JSON.stringify(searchParams.guests)}\n`);

    // Step 1: First search (fresh API call)
    console.log('🔍 STEP 1: Fresh API Call (cache miss expected)');
    console.log('-'.repeat(80));
    const firstSearch = await executeSearch(searchParams);

    console.log('\n📊 First Search Results:');
    console.log(`   Total Hotels: ${firstSearch.total_hotels}`);
    console.log(`   From Cache: ${firstSearch.from_cache}`);
    console.log(`   Search Signature: ${firstSearch.search_signature}`);

    // Analyze first search results
    const firstHotels = firstSearch.hotels || [];
    const firstWithStaticVm = firstHotels.filter(h => h.static_vm);
    const firstWithoutStaticVm = firstHotels.filter(h => !h.static_vm);

    console.log('\n🔬 First Search Data Analysis:');
    console.log(`   ✓ Hotels with static_vm: ${firstWithStaticVm.length}`);
    console.log(`   ⚠ Hotels without static_vm: ${firstWithoutStaticVm.length}`);

    if (firstWithStaticVm.length > 0) {
      const sampleHotel = firstWithStaticVm[0];
      console.log('\n   Sample hotel with static_vm:');
      console.log(`   - Hotel ID: ${sampleHotel.hotel_id}`);
      console.log(`   - Name: ${sampleHotel.name}`);
      console.log(`   - static_vm type: ${typeof sampleHotel.static_vm}`);
      console.log(`   - static_vm structure: ${JSON.stringify(sampleHotel.static_vm).substring(0, 100)}...`);
    }

    // Wait a moment to ensure cache is written
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Second search (cached result)
    console.log('\n\n🔍 STEP 2: Cached Result (cache hit expected)');
    console.log('-'.repeat(80));
    const secondSearch = await executeSearch(searchParams);

    console.log('\n📊 Second Search Results:');
    console.log(`   Total Hotels: ${secondSearch.total_hotels}`);
    console.log(`   From Cache: ${secondSearch.from_cache}`);
    console.log(`   Search Signature: ${secondSearch.search_signature}`);

    // Analyze second search results
    const secondHotels = secondSearch.hotels || [];
    const secondWithStaticVm = secondHotels.filter(h => h.static_vm);
    const secondWithoutStaticVm = secondHotels.filter(h => !h.static_vm);

    console.log('\n🔬 Second Search Data Analysis:');
    console.log(`   ✓ Hotels with static_vm: ${secondWithStaticVm.length}`);
    console.log(`   ⚠ Hotels without static_vm: ${secondWithoutStaticVm.length}`);

    if (secondWithStaticVm.length > 0) {
      const sampleHotel = secondWithStaticVm[0];
      console.log('\n   Sample hotel with static_vm:');
      console.log(`   - Hotel ID: ${sampleHotel.hotel_id}`);
      console.log(`   - Name: ${sampleHotel.name}`);
      console.log(`   - static_vm type: ${typeof sampleHotel.static_vm}`);
      console.log(`   - static_vm structure: ${JSON.stringify(sampleHotel.static_vm).substring(0, 100)}...`);
    }

    // Step 3: Compare results
    console.log('\n\n🔍 STEP 3: Comparison & Validation');
    console.log('-'.repeat(80));

    const testResults = {
      cacheWorking: secondSearch.from_cache === true,
      staticVmPreserved: secondWithStaticVm.length === firstWithStaticVm.length,
      hotelCountMatch: firstSearch.total_hotels === secondSearch.total_hotels,
      allTestsPassed: false
    };

    console.log('\n✅ Test Results:');
    console.log(`   Cache Hit: ${testResults.cacheWorking ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`   static_vm Preserved: ${testResults.staticVmPreserved ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`   Hotel Count Match: ${testResults.hotelCountMatch ? '✓ PASS' : '✗ FAIL'}`);

    testResults.allTestsPassed =
      testResults.cacheWorking &&
      testResults.staticVmPreserved &&
      testResults.hotelCountMatch;

    // Detailed comparison
    console.log('\n📊 Detailed Comparison:');
    console.log('   Metric                    | First Search | Cached Search | Match');
    console.log('   ' + '-'.repeat(72));
    console.log(`   Total Hotels              | ${firstSearch.total_hotels.toString().padEnd(12)} | ${secondSearch.total_hotels.toString().padEnd(13)} | ${firstSearch.total_hotels === secondSearch.total_hotels ? '✓' : '✗'}`);
    console.log(`   Hotels w/ static_vm       | ${firstWithStaticVm.length.toString().padEnd(12)} | ${secondWithStaticVm.length.toString().padEnd(13)} | ${firstWithStaticVm.length === secondWithStaticVm.length ? '✓' : '✗'}`);
    console.log(`   Hotels w/o static_vm      | ${firstWithoutStaticVm.length.toString().padEnd(12)} | ${secondWithoutStaticVm.length.toString().padEnd(13)} | ${firstWithoutStaticVm.length === secondWithoutStaticVm.length ? '✓' : '✗'}`);

    // Step 4: Verify cache database
    console.log('\n\n🔍 STEP 4: Cache Database Verification');
    console.log('-'.repeat(80));

    const cachedEntry = await prisma.searchCache.findUnique({
      where: { search_signature: firstSearch.search_signature }
    });

    if (cachedEntry) {
      console.log('\n✓ Cache entry found in database');
      console.log(`   Search Signature: ${cachedEntry.search_signature}`);
      console.log(`   Region ID: ${cachedEntry.region_id}`);
      console.log(`   Total Hotels: ${cachedEntry.total_hotels}`);
      console.log(`   Hit Count: ${cachedEntry.hit_count}`);
      console.log(`   Cached At: ${cachedEntry.cached_at}`);
      console.log(`   Expires At: ${cachedEntry.expires_at}`);

      // Check if rates_index contains complete hotel data
      const hotelIds = cachedEntry.hotel_ids || [];
      const ratesIndex = cachedEntry.rates_index || {};

      console.log(`\n   Hotel IDs in cache: ${hotelIds.length}`);

      if (hotelIds.length > 0) {
        const firstHotelId = hotelIds[0];
        const firstHotelData = ratesIndex[firstHotelId];

        if (firstHotelData) {
          console.log(`\n   Sample cached hotel data (${firstHotelId}):`);
          console.log(`   - Has hotel_id: ${!!firstHotelData.hotel_id}`);
          console.log(`   - Has name: ${!!firstHotelData.name}`);
          console.log(`   - Has static_vm: ${!!firstHotelData.static_vm}`);
          console.log(`   - Has rates: ${!!firstHotelData.rates}`);
          console.log(`   - Has images: ${!!firstHotelData.images}`);
          console.log(`   - Has address: ${!!firstHotelData.address}`);

          if (firstHotelData.static_vm) {
            console.log(`   - static_vm type: ${typeof firstHotelData.static_vm}`);
            console.log(`   - static_vm preview: ${JSON.stringify(firstHotelData.static_vm).substring(0, 100)}...`);
          }
        }
      }
    } else {
      console.log('\n✗ Cache entry NOT found in database');
      testResults.allTestsPassed = false;
    }

    // Final summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 FINAL SUMMARY');
    console.log('='.repeat(80));

    if (testResults.allTestsPassed) {
      console.log('\n✅ ALL TESTS PASSED!');
      console.log('\n✓ Cache is working correctly');
      console.log('✓ static_vm data is preserved in cache');
      console.log('✓ Hotel data integrity maintained');
    } else {
      console.log('\n❌ SOME TESTS FAILED');
      console.log('\nFailed checks:');
      if (!testResults.cacheWorking) {
        console.log('✗ Cache not returning cached results');
      }
      if (!testResults.staticVmPreserved) {
        console.log('✗ static_vm data not preserved (data loss detected)');
      }
      if (!testResults.hotelCountMatch) {
        console.log('✗ Hotel count mismatch between searches');
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');

    return testResults.allTestsPassed ? 0 : 1;

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\nError details:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testStaticVmPreservation()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
