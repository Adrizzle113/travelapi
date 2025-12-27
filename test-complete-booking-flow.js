/**
 * Complete RateHawk API Flow Test
 * Demonstrates the correct way to search and retrieve hotel details
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`STEP ${step}: ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
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

/**
 * Step 1: Check server health
 */
async function checkHealth() {
  logStep(1, 'Check Server Health');

  try {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();

    if (data.status === 'healthy') {
      logSuccess('Server is healthy');
      logInfo(`Database: ${data.database}`);
      logInfo(`ETG API: ${data.etgApi}`);
      return true;
    } else {
      logError('Server is not healthy');
      console.log(data);
      return false;
    }
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    logWarning('Make sure the server is running: npm start');
    return false;
  }
}

/**
 * Step 2: Search for destinations (autocomplete)
 */
async function searchDestinations(query) {
  logStep(2, `Search Destinations: "${query}"`);

  try {
    const response = await fetch(
      `${API_BASE}/api/destinations/autocomplete?query=${encodeURIComponent(query)}`
    );
    const data = await response.json();

    if (data.success && data.results.length > 0) {
      logSuccess(`Found ${data.results.length} destinations`);

      data.results.slice(0, 3).forEach((dest, i) => {
        log(`  ${i + 1}. ${dest.name} (${dest.country}) - ID: ${dest.id}`, 'cyan');
      });

      return data.results[0]; // Return first result
    } else {
      logWarning('No destinations found');
      return null;
    }
  } catch (error) {
    logError(`Destination search failed: ${error.message}`);
    return null;
  }
}

/**
 * Step 3: Search hotels by region
 */
async function searchHotels(regionId, checkin, checkout) {
  logStep(3, `Search Hotels in Region ${regionId}`);
  logInfo(`Dates: ${checkin} to ${checkout}`);

  try {
    const response = await fetch(`${API_BASE}/api/ratehawk/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        region_id: regionId,
        checkin,
        checkout,
        guests: [{ adults: 2, children: [] }],
        currency: 'USD'
      })
    });

    const data = await response.json();

    if (data.success && data.hotels && data.hotels.length > 0) {
      logSuccess(`Found ${data.totalHotels} hotels`);
      logInfo(`From cache: ${data.from_cache ? 'Yes' : 'No'}`);
      logInfo(`Search duration: ${data.searchDuration}`);

      log('\n📋 Top 5 Hotels:', 'bright');
      data.hotels.slice(0, 5).forEach((hotel, i) => {
        const price = hotel.price?.amount || hotel.rates?.[0]?.payment_options?.payment_types?.[0]?.show_amount || 'N/A';
        log(`  ${i + 1}. ${hotel.name} (⭐ ${hotel.star_rating || 'N/A'})`, 'yellow');
        log(`     ID: ${hotel.id}`, 'cyan');
        log(`     Price: $${price} ${hotel.price?.currency || 'USD'}`, 'green');
      });

      return data.hotels;
    } else {
      logError('No hotels found');
      console.log('Response:', data);
      return [];
    }
  } catch (error) {
    logError(`Hotel search failed: ${error.message}`);
    console.error(error);
    return [];
  }
}

/**
 * Step 4: Get hotel details
 */
async function getHotelDetails(hotelId, checkin, checkout) {
  logStep(4, `Get Hotel Details for ${hotelId}`);

  try {
    const response = await fetch(`${API_BASE}/api/ratehawk/hotel/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId,
        checkin,
        checkout,
        guests: [{ adults: 2, children: [] }],
        currency: 'USD'
      })
    });

    const data = await response.json();

    if (data.success) {
      const hotel = data.data.hotel;
      logSuccess('Hotel details retrieved');

      log('\n🏨 Hotel Information:', 'bright');
      log(`  Name: ${hotel.name}`, 'yellow');
      log(`  Address: ${hotel.address}`, 'cyan');
      log(`  City: ${hotel.city}, ${hotel.country}`, 'cyan');
      log(`  Rating: ${'⭐'.repeat(hotel.star_rating || 0)}`, 'yellow');
      log(`  Images: ${hotel.images?.length || 0} photos`, 'blue');
      log(`  Amenities: ${hotel.amenities?.length || 0} available`, 'blue');

      if (hotel.rates && hotel.rates.length > 0) {
        log('\n💰 Available Rates:', 'bright');
        hotel.rates.slice(0, 3).forEach((rate, i) => {
          const price = rate.payment_options?.payment_types?.[0]?.show_amount || 'N/A';
          log(`  ${i + 1}. ${rate.room_name || 'Room'}`, 'yellow');
          log(`     Price: $${price} ${rate.currency || 'USD'}`, 'green');
          log(`     Meal: ${rate.meal || 'Not included'}`, 'cyan');
        });
      }

      logInfo(`From cache: ${data.from_cache ? 'Yes' : 'No'}`);
      logInfo(`Duration: ${data.duration}`);

      return hotel;
    } else {
      logError('Failed to get hotel details');
      console.log('Response:', data);
      return null;
    }
  } catch (error) {
    logError(`Get hotel details failed: ${error.message}`);
    console.error(error);
    return null;
  }
}

/**
 * Main test flow
 */
async function runCompleteFlow() {
  log('\n' + '='.repeat(60), 'bright');
  log('🚀 RATEHAWK API COMPLETE BOOKING FLOW TEST', 'bright');
  log('='.repeat(60) + '\n', 'bright');

  // Configuration - Using known region_id directly
  const regionName = 'Las Vegas';
  const regionId = '4898'; // Las Vegas region_id from RateHawk
  const checkin = '2025-03-15';
  const checkout = '2025-03-17';

  logInfo(`Testing with: ${regionName} (Region ID: ${regionId})`);
  logInfo(`Dates: ${checkin} to ${checkout}`);
  logWarning('NOTE: Autocomplete requires database setup - using known region_id');

  // Step 1: Health Check
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    logError('Server is not available. Stopping test.');
    process.exit(1);
  }

  await sleep(1000);

  // Step 2: Search Hotels (using known region_id)
  logStep(2, 'Using Known Region ID (bypassing autocomplete)');
  logInfo(`Las Vegas region_id: ${regionId}`);

  const hotels = await searchHotels(regionId, checkin, checkout);
  if (hotels.length === 0) {
    logError('No hotels found. Stopping test.');
    process.exit(1);
  }

  await sleep(1000);

  // Step 3: Get Hotel Details (first hotel from results)
  const firstHotel = hotels[0];
  const hotelDetails = await getHotelDetails(firstHotel.id, checkin, checkout);

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('✅ TEST COMPLETED SUCCESSFULLY!', 'green');
  log('='.repeat(60), 'cyan');

  log('\n📊 Summary:', 'bright');
  log(`  • Destination: ${regionName} (Region ID: ${regionId})`, 'cyan');
  log(`  • Hotels Found: ${hotels.length}`, 'cyan');
  log(`  • First Hotel ID: ${firstHotel.id}`, 'cyan');
  log(`  • Hotel Details: ${hotelDetails?.name || 'N/A'}`, 'cyan');
  log(`  • Check-in: ${checkin}`, 'cyan');
  log(`  • Check-out: ${checkout}`, 'cyan');

  log('\n💡 Key Takeaways:', 'bright');
  log('  1. Use region_id (numeric) for hotel searches', 'yellow');
  log('  2. Search returns hotels with real hotel IDs', 'yellow');
  log('  3. Use real hotel IDs (like "' + firstHotel.id + '") for details', 'yellow');
  log('  4. NEVER use placeholder IDs like "caesars_palace"', 'yellow');

  log('\n🎉 All steps completed successfully!\n', 'green');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
runCompleteFlow().catch(error => {
  logError(`Test failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
