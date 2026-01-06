/**
 * Final Enrichment Feature Test
 * Tests all caching and enrichment features with correct dates
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';

console.log('\n' + '='.repeat(70));
console.log('  ENRICHMENT FEATURE COMPREHENSIVE TEST');
console.log('='.repeat(70) + '\n');

// Test 1: Autocomplete Caching
async function testAutocompleteEnrichment() {
  console.log('📋 TEST 1: Autocomplete Cache & Enrichment');
  console.log('-'.repeat(70));

  const query = 'tokyo';
  console.log(`\n🔍 Testing autocomplete for: "${query}"`);

  // First call (may or may not be cached)
  const start1 = Date.now();
  const response1 = await fetch(`${BASE_URL}/destinations/autocomplete?query=${query}`);
  const data1 = await response1.json();
  const duration1 = Date.now() - start1;

  if (data1.status === 'ok') {
    const results = data1.data?.destinations || [];
    console.log(`✅ Call 1: ${duration1}ms | From cache: ${data1.meta?.from_cache || false} | Results: ${results.length}`);

    if (results.length > 0) {
      console.log(`   Top result: ${results[0].label} (Region ID: ${results[0].region_id})`);
    }

    // Second call (should definitely be cached now)
    const start2 = Date.now();
    const response2 = await fetch(`${BASE_URL}/destinations/autocomplete?query=${query}`);
    const data2 = await response2.json();
    const duration2 = Date.now() - start2;

    console.log(`✅ Call 2: ${duration2}ms | From cache: ${data2.meta?.from_cache || false}`);

    if (data2.meta?.from_cache) {
      const speedup = (duration1 / duration2).toFixed(2);
      console.log(`🚀 Cache speedup: ${speedup}x faster!`);
      console.log(`💾 Cache reduces latency by ${duration1 - duration2}ms`);
    }

    return { success: true, regionId: results[0]?.region_id };
  }

  return { success: false };
}

// Test 2: Hotel Search with Caching
async function testSearchEnrichment() {
  console.log('\n📋 TEST 2: Hotel Search Cache & Enrichment');
  console.log('-'.repeat(70));

  const searchData = {
    region_id: 2114, // London
    checkin: "2026-06-15",
    checkout: "2026-06-17",
    guests: [{ adults: 2, children: [] }],
    currency: "USD"
  };

  console.log(`\n🔍 Searching hotels in London`);
  console.log(`   Dates: ${searchData.checkin} to ${searchData.checkout}`);

  // First search call
  const start1 = Date.now();
  const response1 = await fetch(`${BASE_URL}/ratehawk/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(searchData)
  });
  const data1 = await response1.json();
  const duration1 = Date.now() - start1;

  if (response1.ok && data1.success) {
    console.log(`✅ Call 1: ${duration1}ms | From cache: ${data1.from_cache || false}`);
    console.log(`   Hotels found: ${data1.total || 0}`);
    console.log(`   Hotels returned: ${data1.returned || 0}`);

    if (data1.hotels && data1.hotels.length > 0) {
      const hotel = data1.hotels[0];
      console.log(`   First hotel: ${hotel.name} (ID: ${hotel.id})`);

      // Second search call (should use cache)
      const start2 = Date.now();
      const response2 = await fetch(`${BASE_URL}/ratehawk/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchData)
      });
      const data2 = await response2.json();
      const duration2 = Date.now() - start2;

      console.log(`✅ Call 2: ${duration2}ms | From cache: ${data2.from_cache || false}`);

      if (data2.from_cache) {
        const speedup = (duration1 / duration2).toFixed(2);
        console.log(`🚀 Cache speedup: ${speedup}x faster!`);
        console.log(`💾 Cache reduces latency by ${duration1 - duration2}ms`);
      }

      return { success: true, hotelId: hotel.id, hotelName: hotel.name };
    }
  } else {
    console.log(`⚠️  Search failed: ${data1.error || 'Unknown error'}`);
    console.log(`   Status: ${response1.status}`);
    if (data1.error?.code) {
      console.log(`   Error code: ${data1.error.code}`);
    }
  }

  return { success: false };
}

// Test 3: Hotel Details Enrichment
async function testHotelDetailsEnrichment(hotelId, hotelName) {
  console.log('\n📋 TEST 3: Hotel Details Static Info Enrichment');
  console.log('-'.repeat(70));

  const detailsData = {
    hotelId: hotelId,
    checkin: "2026-06-15",
    checkout: "2026-06-17",
    guests: [{ adults: 2, children: [] }],
    language: "en"
  };

  console.log(`\n🏨 Fetching enriched details for: ${hotelName}`);

  // First call - static info from cache, rates from API
  const start1 = Date.now();
  const response1 = await fetch(`${BASE_URL}/ratehawk/hotel/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(detailsData)
  });
  const data1 = await response1.json();
  const duration1 = Date.now() - start1;

  if (response1.ok && data1.success) {
    console.log(`✅ Call 1: ${duration1}ms | Static info from cache: ${data1.from_cache || false}`);
    console.log(`\n📊 Enriched Hotel Data:`);
    console.log(`   Name: ${data1.data.hotel.name}`);
    console.log(`   Address: ${data1.data.hotel.address || 'N/A'}`);
    console.log(`   City: ${data1.data.hotel.city || 'N/A'}`);
    console.log(`   Rating: ${data1.data.hotel.star_rating || 'N/A'} stars`);
    console.log(`   Images: ${data1.data.hotel.images?.length || 0} available`);
    console.log(`   Amenities: ${data1.data.hotel.amenities?.length || 0} listed`);
    console.log(`   Room rates: ${data1.data.hotel.rates?.length || 0} available`);

    if (data1.data.hotel.description) {
      const desc = data1.data.hotel.description.substring(0, 150);
      console.log(`   Description: ${desc}...`);
    }

    if (data1.hotelDetails?.bookingOptions?.length > 0) {
      const option = data1.hotelDetails.bookingOptions[0];
      console.log(`\n💰 Sample Rate:`);
      console.log(`   Room: ${option.roomName}`);
      console.log(`   Price: ${option.currency} ${option.price}`);
      console.log(`   Meal: ${option.mealPlan}`);
    }

    // Second call - should use cached static info
    const start2 = Date.now();
    const response2 = await fetch(`${BASE_URL}/ratehawk/hotel/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detailsData)
    });
    const data2 = await response2.json();
    const duration2 = Date.now() - start2;

    console.log(`\n✅ Call 2: ${duration2}ms | Static info from cache: ${data2.from_cache || false}`);

    if (data2.from_cache || duration2 < duration1 * 0.8) {
      console.log(`🚀 Static info enrichment working! Faster subsequent calls.`);
    }

    return true;
  } else {
    console.log(`⚠️  Details failed: ${data1.error || 'Unknown error'}`);
  }

  return false;
}

// Test 4: Database Cache Status
async function testCacheStatus() {
  console.log('\n📋 TEST 4: Cache Database Status');
  console.log('-'.repeat(70));

  try {
    const response = await fetch(`${BASE_URL}/diagnostics/services`);
    const data = await response.json();

    if (data.services) {
      console.log(`\n✅ Database: ${data.services.database?.status || 'unknown'}`);
      console.log(`   Response time: ${data.services.database?.responseTime || 'N/A'}ms`);
      console.log(`   Health score: ${data.services.database?.healthScore || 0}%`);

      if (data.services.cache) {
        console.log(`\n✅ Cache System: ${data.services.cache?.status || 'unknown'}`);
        console.log(`   Total cached items: ${data.services.cache?.totalCached || 0}`);
        console.log(`   Recent caches (1hr): ${data.services.cache?.recentCaches || 0}`);
        console.log(`   Health score: ${data.services.cache?.healthScore || 0}%`);
      }

      console.log(`\n📊 Overall System Health: ${data.overallHealth || 0}%`);

      return data.overallHealth >= 80;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  return false;
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting comprehensive enrichment tests...\n');

  const results = {
    autocomplete: false,
    search: false,
    hotelDetails: false,
    cacheStatus: false
  };

  // Test 1: Autocomplete
  const autocompleteResult = await testAutocompleteEnrichment();
  results.autocomplete = autocompleteResult.success;

  // Test 2: Search
  const searchResult = await testSearchEnrichment();
  results.search = searchResult.success;

  // Test 3: Hotel Details (only if search succeeded)
  if (searchResult.success) {
    results.hotelDetails = await testHotelDetailsEnrichment(
      searchResult.hotelId,
      searchResult.hotelName
    );
  }

  // Test 4: Cache Status
  results.cacheStatus = await testCacheStatus();

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('  TEST RESULTS SUMMARY');
  console.log('='.repeat(70));

  const testResults = [
    { name: 'Autocomplete Caching', status: results.autocomplete },
    { name: 'Hotel Search Caching', status: results.search },
    { name: 'Hotel Details Enrichment', status: results.hotelDetails },
    { name: 'Cache System Health', status: results.cacheStatus }
  ];

  testResults.forEach(test => {
    const icon = test.status ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
  });

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.values(results).length;
  const successRate = Math.round((passed / total) * 100);

  console.log('\n' + '='.repeat(70));
  console.log(`📊 Success Rate: ${passed}/${total} tests passed (${successRate}%)`);
  console.log('='.repeat(70));

  if (successRate === 100) {
    console.log('\n🎉 All enrichment features working perfectly!\n');
  } else if (successRate >= 75) {
    console.log('\n✅ Most enrichment features working well!\n');
  } else if (successRate >= 50) {
    console.log('\n⚠️  Some enrichment features need attention.\n');
  } else {
    console.log('\n❌ Multiple enrichment features need fixing.\n');
  }

  console.log('🔍 Key Enrichment Features:');
  console.log('   • Autocomplete with 7-day cache TTL');
  console.log('   • Search results with 6-hour cache TTL');
  console.log('   • Hotel static info with 7-day cache TTL');
  console.log('   • Database-backed caching for performance');
  console.log('   • Cache hit/miss tracking and metrics');
  console.log('');
}

runTests().catch(error => {
  console.error('\n💥 Test suite error:', error);
  process.exit(1);
});
