/**
 * Test Script: Hotel Static Info Enrichment
 *
 * Tests that search results now include static_vm data with:
 * - Hotel names
 * - Images
 * - Descriptions
 * - Amenities
 * - Coordinates
 */

import axios from 'axios';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

async function testEnrichment() {
  console.log('🧪 Testing Hotel Static Info Enrichment\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Execute a search for London
    console.log('\n📍 Test 1: Search for hotels in London');
    console.log('-'.repeat(60));

    const searchParams = {
      region_id: 2114,
      checkin: '2025-07-15',
      checkout: '2025-07-17',
      guests: [{ adults: 2, children: [] }],
      currency: 'USD'
    };

    console.log(`Request: POST ${API_BASE}/api/ratehawk/search`);
    console.log(`Params:`, JSON.stringify(searchParams, null, 2));

    const startTime = Date.now();
    const response = await axios.post(
      `${API_BASE}/api/ratehawk/search`,
      searchParams,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      }
    );
    const duration = Date.now() - startTime;

    console.log(`\n✅ Response received in ${duration}ms`);
    console.log(`Status: ${response.status}`);

    const data = response.data;
    console.log(`\n📊 Results Summary:`);
    console.log(`  Total hotels: ${data.total_hotels}`);
    console.log(`  From cache: ${data.from_cache}`);
    console.log(`  Hotels returned: ${data.hotels?.length || 0}`);

    // Test 2: Verify static_vm exists
    console.log('\n🔍 Test 2: Verify static_vm field presence');
    console.log('-'.repeat(60));

    if (!data.hotels || data.hotels.length === 0) {
      console.error('❌ No hotels in response!');
      return;
    }

    const hotel = data.hotels[0];
    console.log(`\nFirst hotel ID: ${hotel.hotel_id || hotel.id}`);

    if (!hotel.static_vm) {
      console.error('❌ FAILED: static_vm field is missing!');
      console.log('Hotel object keys:', Object.keys(hotel));
      return;
    }

    console.log('✅ static_vm field exists');

    // Test 3: Verify static_vm contents
    console.log('\n📋 Test 3: Verify static_vm contents');
    console.log('-'.repeat(60));

    const staticVm = hotel.static_vm;
    const checks = [
      { field: 'name', value: staticVm.name, expected: 'string' },
      { field: 'address', value: staticVm.address, expected: 'string' },
      { field: 'city', value: staticVm.city, expected: 'string' },
      { field: 'country', value: staticVm.country, expected: 'string' },
      { field: 'star_rating', value: staticVm.star_rating, expected: 'number' },
      { field: 'latitude', value: staticVm.latitude, expected: 'number' },
      { field: 'longitude', value: staticVm.longitude, expected: 'number' },
      { field: 'images', value: staticVm.images, expected: 'array' },
      { field: 'amenity_groups', value: staticVm.amenity_groups, expected: 'array' },
      { field: 'description_struct', value: staticVm.description_struct, expected: 'array' }
    ];

    let passedChecks = 0;
    checks.forEach(check => {
      const type = Array.isArray(check.value) ? 'array' : typeof check.value;
      const passed = type === check.expected && check.value !== null && check.value !== undefined;

      if (passed) {
        passedChecks++;
        console.log(`  ✅ ${check.field}: ${type}`);

        // Show sample values
        if (check.field === 'name') {
          console.log(`      → "${check.value}"`);
        } else if (check.field === 'star_rating') {
          console.log(`      → ${check.value} (${check.value / 10} stars)`);
        } else if (check.field === 'images' && Array.isArray(check.value)) {
          console.log(`      → ${check.value.length} images`);
        } else if (check.field === 'amenity_groups' && Array.isArray(check.value)) {
          console.log(`      → ${check.value.length} amenity groups`);
        }
      } else {
        console.log(`  ⚠️ ${check.field}: ${type} (expected ${check.expected})`);
      }
    });

    console.log(`\n📊 Passed: ${passedChecks}/${checks.length} checks`);

    // Test 4: Show sample hotel card data
    console.log('\n🎨 Test 4: Sample Hotel Card Data');
    console.log('-'.repeat(60));

    console.log(`Hotel Name: ${staticVm.name || 'N/A'}`);
    console.log(`Address: ${staticVm.address || 'N/A'}`);
    console.log(`City: ${staticVm.city || 'N/A'}, ${staticVm.country || 'N/A'}`);
    console.log(`Star Rating: ${staticVm.star_rating ? (staticVm.star_rating / 10) : 'N/A'} stars`);
    console.log(`Location: ${staticVm.latitude}, ${staticVm.longitude}`);
    console.log(`Images: ${staticVm.images?.length || 0} available`);

    if (staticVm.images && staticVm.images.length > 0) {
      const firstImage = staticVm.images[0];
      const imageUrl = firstImage.tmpl?.replace('{size}', '1024x768') || firstImage.url || 'N/A';
      console.log(`  First image: ${imageUrl}`);
    }

    // Test 5: Check enrichment across all hotels
    console.log('\n🔢 Test 5: Enrichment Coverage');
    console.log('-'.repeat(60));

    const totalHotels = data.hotels.length;
    const enrichedHotels = data.hotels.filter(h => h.static_vm).length;
    const coverage = (enrichedHotels / totalHotels * 100).toFixed(1);

    console.log(`Total hotels: ${totalHotels}`);
    console.log(`Enriched with static_vm: ${enrichedHotels}`);
    console.log(`Coverage: ${coverage}%`);

    if (coverage >= 90) {
      console.log('✅ Excellent enrichment coverage!');
    } else if (coverage >= 70) {
      console.log('⚠️ Good coverage, but some hotels missing static info');
    } else {
      console.log('❌ Low enrichment coverage - investigation needed');
    }

    // Test 6: Test cache hit (second search)
    console.log('\n🔄 Test 6: Test Cache Hit (Second Search)');
    console.log('-'.repeat(60));

    console.log('Making second identical search request...');
    const cacheStartTime = Date.now();
    const cacheResponse = await axios.post(
      `${API_BASE}/api/ratehawk/search`,
      searchParams,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      }
    );
    const cacheDuration = Date.now() - cacheStartTime;

    console.log(`✅ Response received in ${cacheDuration}ms`);
    console.log(`From cache: ${cacheResponse.data.from_cache}`);

    if (cacheResponse.data.from_cache) {
      console.log(`⚡ Cache speedup: ${(duration / cacheDuration).toFixed(1)}x faster`);

      // Verify cached results also have static_vm
      const cachedHotel = cacheResponse.data.hotels[0];
      if (cachedHotel.static_vm) {
        console.log('✅ Cached results also include static_vm');
      } else {
        console.log('❌ WARNING: Cached results missing static_vm!');
      }
    } else {
      console.log('⚠️ Result was not from cache (unexpected)');
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS COMPLETED');
    console.log('='.repeat(60));

    if (passedChecks >= 8 && coverage >= 90) {
      console.log('✅ Status: PASSED - Enrichment working correctly!');
      console.log('\nNext steps:');
      console.log('1. Deploy to production');
      console.log('2. Test frontend displays hotel info correctly');
      console.log('3. Monitor enrichment success rate in logs');
    } else {
      console.log('⚠️ Status: PARTIAL - Some issues detected');
      console.log('\nRecommendations:');
      console.log('1. Review logs for enrichment failures');
      console.log('2. Check RateHawk API credentials');
      console.log('3. Verify database connectivity');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure the server is running on port 3001');
      console.error('   Run: npm start');
    }
  }
}

// Run the test
testEnrichment();
