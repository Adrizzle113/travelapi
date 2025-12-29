/**
 * Test Hotel Enrichment Feature
 * Tests hotel information caching and enrichment with static data
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${colors.bold}${colors.blue}=== ${name} ===${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function testHealthCheck() {
  logTest('Health Check');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();

    if (data.status === 'healthy') {
      logSuccess('Server is healthy');
      logInfo(`Database: ${data.services.database.status}`);
      logInfo(`ETG API: ${data.services.etg_api.status}`);
      return true;
    } else {
      logError('Server is unhealthy');
      return false;
    }
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    return false;
  }
}

async function testHotelSearch() {
  logTest('Hotel Search (To Get Real Hotel IDs)');
  try {
    const searchData = {
      region_id: "4898", // Las Vegas
      checkin: "2025-03-15",
      checkout: "2025-03-17",
      guests: [{ adults: 2, children: [] }],
      currency: "USD",
      language: "en"
    };

    logInfo('Searching for hotels in Las Vegas...');
    const response = await fetch(`${BASE_URL}/ratehawk/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchData)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const hotelCount = data.data?.hotels?.length || 0;
      logSuccess(`Found ${hotelCount} hotels`);

      if (hotelCount > 0) {
        const hotel = data.data.hotels[0];
        logInfo(`First hotel: ${hotel.name} (ID: ${hotel.id})`);
        return {
          success: true,
          hotelId: hotel.id,
          hotelName: hotel.name
        };
      } else {
        logWarning('No hotels found in search results');
        return { success: false };
      }
    } else {
      logError(`Search failed: ${data.error || 'Unknown error'}`);
      logWarning('This might be due to ETG API issues');
      return { success: false };
    }
  } catch (error) {
    logError(`Search test failed: ${error.message}`);
    return { success: false };
  }
}

async function testHotelDetailsEnrichment(hotelId, hotelName) {
  logTest('Hotel Details Enrichment Test');

  try {
    const detailsData = {
      hotelId: hotelId,
      checkin: "2025-03-15",
      checkout: "2025-03-17",
      guests: [{ adults: 2, children: [] }],
      language: "en"
    };

    logInfo(`Fetching details for: ${hotelName} (${hotelId})`);
    logInfo('First call - should fetch from ETG API...');

    const startTime1 = Date.now();
    const response1 = await fetch(`${BASE_URL}/ratehawk/hotel/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detailsData)
    });
    const duration1 = Date.now() - startTime1;
    const data1 = await response1.json();

    if (response1.ok && data1.success) {
      logSuccess(`First call completed in ${duration1}ms`);
      logInfo(`From cache: ${data1.from_cache ? 'YES' : 'NO'}`);
      logInfo(`Hotel: ${data1.data.hotel.name}`);
      logInfo(`Address: ${data1.data.hotel.address || 'N/A'}`);
      logInfo(`Rating: ${data1.data.hotel.star_rating || 'N/A'} stars`);
      logInfo(`Images: ${data1.data.hotel.images?.length || 0} images`);
      logInfo(`Amenities: ${data1.data.hotel.amenities?.length || 0} amenities`);
      logInfo(`Rates available: ${data1.data.hotel.rates?.length || 0}`);

      // Test cache by making second call
      logInfo('\nSecond call - should use cache...');
      const startTime2 = Date.now();
      const response2 = await fetch(`${BASE_URL}/ratehawk/hotel/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detailsData)
      });
      const duration2 = Date.now() - startTime2;
      const data2 = await response2.json();

      if (response2.ok && data2.success) {
        logSuccess(`Second call completed in ${duration2}ms`);
        logInfo(`From cache: ${data2.from_cache ? 'YES' : 'NO'}`);

        const speedup = Math.round((duration1 / duration2) * 100) / 100;
        if (data2.from_cache) {
          logSuccess(`Cache is working! ${speedup}x faster`);
        } else {
          logWarning('Cache might not be working - both calls hit API');
        }

        // Show enrichment details
        logInfo('\n📊 Enrichment Data:');
        if (data2.data.hotel.description) {
          logInfo(`- Description: ${data2.data.hotel.description.substring(0, 100)}...`);
        }
        if (data2.data.hotel.coordinates) {
          logInfo(`- Coordinates: ${JSON.stringify(data2.data.hotel.coordinates)}`);
        }
        if (data2.hotelDetails?.bookingOptions?.length > 0) {
          logInfo(`- Booking options: ${data2.hotelDetails.bookingOptions.length} available`);
          const option = data2.hotelDetails.bookingOptions[0];
          logInfo(`  • ${option.roomName}: ${option.currency} ${option.price}`);
        }

        return true;
      }
    } else {
      logError(`Hotel details failed: ${data1.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logError(`Enrichment test failed: ${error.message}`);
    return false;
  }
}

async function testAutocomplete() {
  logTest('Autocomplete Test');

  try {
    logInfo('Testing autocomplete for "Las Vegas"...');
    const response = await fetch(`${BASE_URL}/destinations/autocomplete?query=las%20vegas`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (response.ok) {
      const results = data.results || data.data || [];
      logSuccess(`Found ${results.length} results`);

      if (results.length > 0) {
        results.slice(0, 3).forEach((result, idx) => {
          logInfo(`${idx + 1}. ${result.name || result.label} (${result.type || 'unknown'})`);
          logInfo(`   ID: ${result.id || result.region_id || 'N/A'}`);
        });
        return true;
      } else {
        logWarning('No autocomplete results found');
        return false;
      }
    } else {
      logError(`Autocomplete failed: ${data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logError(`Autocomplete test failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`\n${colors.bold}${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║  Hotel Enrichment Feature Test Suite  ║${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚════════════════════════════════════════╝${colors.reset}\n`);

  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Test 1: Health Check
  results.total++;
  if (await testHealthCheck()) {
    results.passed++;
  } else {
    results.failed++;
    logError('Cannot proceed without healthy server');
    return;
  }

  // Test 2: Autocomplete
  results.total++;
  if (await testAutocomplete()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 3: Search
  results.total++;
  const searchResult = await testHotelSearch();
  if (searchResult.success) {
    results.passed++;

    // Test 4: Hotel Details Enrichment (only if search succeeded)
    results.total++;
    if (await testHotelDetailsEnrichment(searchResult.hotelId, searchResult.hotelName)) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    results.failed++;
    logWarning('Skipping hotel details test due to search failure');
  }

  // Summary
  console.log(`\n${colors.bold}${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║          Test Summary                  ║${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚════════════════════════════════════════╝${colors.reset}\n`);

  log(`Total Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');

  const successRate = Math.round((results.passed / results.total) * 100);
  if (successRate === 100) {
    log(`\n🎉 All tests passed! Success rate: ${successRate}%`, 'green');
  } else if (successRate >= 75) {
    log(`\n⚠️  Most tests passed. Success rate: ${successRate}%`, 'yellow');
  } else {
    log(`\n❌ Many tests failed. Success rate: ${successRate}%`, 'red');
  }

  console.log('');
}

// Run tests
runTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  process.exit(1);
});
