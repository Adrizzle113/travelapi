/**
 * Direct Test: Import and validate searchService enrichment functions
 */

import { executeSearch } from './services/search/searchService.js';

async function testDirect() {
  console.log('🧪 Direct Test: Search Service Enrichment\n');

  try {
    console.log('✅ Successfully imported searchService');
    console.log('✅ executeSearch function is available');

    console.log('\n📋 Test Parameters:');
    const searchParams = {
      region_id: 2114,
      checkin: '2025-07-15',
      checkout: '2025-07-17',
      guests: [{ adults: 2, children: [] }],
      currency: 'USD'
    };

    console.log(JSON.stringify(searchParams, null, 2));

    console.log('\n🔍 Executing search with enrichment...\n');

    const results = await executeSearch(searchParams);

    console.log('\n✅ Search completed successfully!');
    console.log(`\n📊 Results:`);
    console.log(`  Total hotels: ${results.total_hotels}`);
    console.log(`  Hotels returned: ${results.hotels?.length || 0}`);
    console.log(`  From cache: ${results.from_cache}`);

    if (results.hotels && results.hotels.length > 0) {
      const firstHotel = results.hotels[0];
      console.log(`\n🏨 First Hotel:`);
      console.log(`  ID: ${firstHotel.hotel_id || firstHotel.id}`);
      console.log(`  Has static_vm: ${!!firstHotel.static_vm ? '✅' : '❌'}`);

      if (firstHotel.static_vm) {
        console.log(`\n📋 Static VM Data:`);
        console.log(`  Name: ${firstHotel.static_vm.name || 'N/A'}`);
        console.log(`  City: ${firstHotel.static_vm.city || 'N/A'}`);
        console.log(`  Star Rating: ${firstHotel.static_vm.star_rating || 'N/A'}`);
        console.log(`  Images: ${firstHotel.static_vm.images?.length || 0}`);
        console.log(`  Latitude: ${firstHotel.static_vm.latitude || 'N/A'}`);
        console.log(`  Longitude: ${firstHotel.static_vm.longitude || 'N/A'}`);

        console.log('\n✅ SUCCESS: Enrichment is working!');
      } else {
        console.log('\n⚠️ WARNING: static_vm is missing from results');
      }

      const enrichedCount = results.hotels.filter(h => h.static_vm).length;
      const coverage = (enrichedCount / results.hotels.length * 100).toFixed(1);
      console.log(`\n📊 Enrichment Coverage: ${enrichedCount}/${results.hotels.length} (${coverage}%)`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);

    if (error.message.includes('region_id')) {
      console.log('\n💡 This error is expected without RateHawk API access');
    }
  }
}

testDirect();
