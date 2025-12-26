import dotenv from 'dotenv';
dotenv.config();

import { executeSearch } from '../services/search/searchService.js';
import { getHotelInformation } from '../services/hotel/hotelInfoService.js';
import { resolveDestination } from '../services/destination/destinationResolver.js';

console.log('�� === TESTING ETG API INTEGRATION ===\n');

// Generate future dates
const today = new Date();
const checkinDate = new Date(today);
checkinDate.setDate(today.getDate() + 30); // 30 days from now
const checkoutDate = new Date(checkinDate);
checkoutDate.setDate(checkinDate.getDate() + 2); // 2 nights

const checkin = checkinDate.toISOString().split('T')[0];
const checkout = checkoutDate.toISOString().split('T')[0];

console.log(`📅 Using dates: ${checkin} → ${checkout}\n`);

async function runTests() {
  try {
    // Test 1: Destination Resolution
    console.log('1️⃣ Testing Destination Resolver...');
    const destination = await resolveDestination('New York');
    console.log(`✅ Resolved: ${destination.region_name} (ID: ${destination.region_id})\n`);

    // Test 2: ETG Search API
    console.log('2️⃣ Testing ETG Search API...');
    const searchResult = await executeSearch({
      destination: 'New York',
      checkin,
      checkout,
      guests: [{ adults: 2, children: [] }],
      currency: 'USD',
      residency: 'us'
    });

    console.log(`✅ Search successful!`);
    console.log(`   Hotels found: ${searchResult.total_hotels || searchResult.hotels?.length || 0}`);
    console.log(`   From cache: ${searchResult.from_cache ? 'YES' : 'NO'}`);
    console.log(`   Search signature: ${searchResult.search_signature}\n`);

    // Test 3: Cache Test (run same search again)
    console.log('3️⃣ Testing Search Cache...');
    const cachedResult = await executeSearch({
      destination: 'New York',
      checkin,
      checkout,
      guests: [{ adults: 2, children: [] }],
      currency: 'USD',
      residency: 'us'
    });

    console.log(`✅ Cache test complete!`);
    console.log(`   From cache: ${cachedResult.from_cache ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Cache age: ${cachedResult.cache_age_ms ? Math.round(cachedResult.cache_age_ms / 1000) + 's' : 'N/A'}\n`);

    // Test 4: Hotel Info (if we got hotels)
    if (searchResult.hotels && searchResult.hotels.length > 0) {
      console.log('4️⃣ Testing Hotel Info Service...');
      const firstHotel = searchResult.hotels[0];
      const hotelId = firstHotel.hotel_id || firstHotel.id;
      
      if (hotelId) {
        console.log(`   Fetching info for hotel ID: ${hotelId}...`);
        try {
          const hotelInfo = await getHotelInformation(hotelId);
          console.log(`✅ Hotel info retrieved!`);
          console.log(`   Name: ${hotelInfo.name || 'N/A'}`);
          console.log(`   From cache: ${hotelInfo.from_cache ? 'YES' : 'NO'}\n`);
        } catch (hotelError) {
          console.log(`⚠️ Hotel info fetch failed: ${hotelError.message}\n`);
        }
      }
    }

    // Summary
    console.log('═'.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log('✅ Destination Resolution: PASS');
    console.log('✅ ETG Search API: PASS');
    console.log(`${cachedResult.from_cache ? '✅' : '⚠️'} Search Caching: ${cachedResult.from_cache ? 'PASS' : 'PARTIAL'}`);
    console.log('═'.repeat(60));
    console.log('\n🎉 Integration test complete!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runTests();
