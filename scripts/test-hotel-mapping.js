/**
 * Test Script: Verify Test Hotel Mapping Works
 * 
 * This script tests that test hotels are properly mapped and accessible:
 * 1. Checks database for test hotels
 * 2. Tests /hotel/info/ endpoint access
 * 3. Tests /search/hp/ endpoint access
 * 4. Verifies booking flow can start (prebook)
 * 
 * Usage:
 *   node scripts/test-hotel-mapping.js
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const TEST_HOTEL_IDS = ['8473727', 'test_hotel_do_not_book'];
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test dates (30 days from now)
const getTestDates = () => {
  const checkin = new Date();
  checkin.setDate(checkin.getDate() + 30);
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + 2);
  
  return {
    checkin: checkin.toISOString().split('T')[0],
    checkout: checkout.toISOString().split('T')[0]
  };
};

/**
 * Test 1: Check database
 */
async function testDatabase() {
  console.log('\n📊 TEST 1: Database Check');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const hotelId of TEST_HOTEL_IDS) {
    try {
      const hotel = await prisma.hotelDumpData.findUnique({
        where: { hotel_id: hotelId },
        select: {
          hotel_id: true,
          name: true,
          city: true,
          country: true,
          star_rating: true
        }
      });
      
      if (hotel) {
        console.log(`✅ ${hotelId}: Found in database`);
        console.log(`   Name: ${hotel.name || 'N/A'}`);
        console.log(`   Location: ${hotel.city || 'N/A'}, ${hotel.country || 'N/A'}`);
        results.push({ hotelId, status: 'found', hotel });
      } else {
        console.log(`❌ ${hotelId}: NOT found in database`);
        results.push({ hotelId, status: 'missing' });
      }
    } catch (error) {
      console.log(`❌ ${hotelId}: Error - ${error.message}`);
      results.push({ hotelId, status: 'error', error: error.message });
    }
  }
  
  return results;
}

/**
 * Test 2: Test /hotel/static-info endpoint
 */
async function testStaticInfo(hotelId) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/ratehawk/hotel/static-info`,
      { hotelId, language: 'en' },
      { timeout: 10000 }
    );
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data };
    }
    return { success: false, error: 'Invalid response format' };
  } catch (error) {
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message ||
                     'Unknown error';
    const statusCode = error.response?.status;
    const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND';
    
    return { 
      success: false, 
      error: isConnectionError ? `Server not running (${error.code})` : errorMsg,
      statusCode,
      connectionError: isConnectionError
    };
  }
}

/**
 * Test 3: Test /hotel/details endpoint (with rates)
 */
async function testHotelDetails(hotelId) {
  const dates = getTestDates();
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/ratehawk/hotel/details`,
      {
        hotelId,
        checkin: dates.checkin,
        checkout: dates.checkout,
        guests: [{ adults: 2, children: [] }],
        residency: 'US',
        language: 'en',
        currency: 'USD'
      },
      { timeout: 30000 }
    );
    
    if (response.data && response.data.success) {
      const hotel = response.data.hotel || response.data.data;
      return { 
        success: true, 
        data: hotel,
        ratesCount: hotel?.rates?.length || 0
      };
    }
    return { success: false, error: 'Invalid response format' };
  } catch (error) {
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message ||
                     'Unknown error';
    const statusCode = error.response?.status;
    const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND';
    
    return { 
      success: false, 
      error: isConnectionError ? `Server not running (${error.code})` : errorMsg,
      statusCode,
      connectionError: isConnectionError
    };
  }
}

/**
 * Test 4: Test prebook (booking flow start)
 */
async function testPrebook(hotelId) {
  const dates = getTestDates();
  
  try {
    // First get hotel details to get a book_hash
    const detailsResult = await testHotelDetails(hotelId);
    if (!detailsResult.success || !detailsResult.data?.rates?.length) {
      return { 
        success: false, 
        error: 'No rates available to test prebook',
        skipped: true 
      };
    }
    
    // Get first rate's book_hash
    const firstRate = detailsResult.data.rates[0];
    const bookHash = firstRate.book_hash || firstRate.hash;
    
    if (!bookHash) {
      return { 
        success: false, 
        error: 'No book_hash found in rate',
        skipped: true 
      };
    }
    
    // Test prebook
    const response = await axios.post(
      `${API_BASE_URL}/api/ratehawk/prebook`,
      {
        hash: bookHash,
        guests: [{ adults: 2, children: [] }],
        residency: 'US',
        language: 'en'
      },
      { timeout: 30000 }
    );
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data,
        bookingHash: response.data.booking_hash || response.data.prebooked_hash
      };
    }
    return { success: false, error: 'Invalid response format' };
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    // sandbox_restriction is expected for test hotels
    if (errorMsg.includes('sandbox_restriction')) {
      return { 
        success: true, 
        skipped: true,
        note: 'Prebook endpoint accessible (sandbox_restriction expected with test API key)'
      };
    }
    return { 
      success: false, 
      error: errorMsg,
      statusCode: error.response?.status
    };
  }
}

/**
 * Run all tests for a hotel
 */
async function runTestsForHotel(hotelId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Hotel: ${hotelId}`);
  console.log('='.repeat(60));
  
  const results = {
    hotelId,
    database: null,
    staticInfo: null,
    hotelDetails: null,
    prebook: null
  };
  
  // Test 2: Static Info
  console.log('\n📚 TEST 2: Static Info Endpoint');
  console.log('-'.repeat(60));
  const staticResult = await testStaticInfo(hotelId);
  results.staticInfo = staticResult;
  if (staticResult.success) {
    console.log(`✅ Static info accessible`);
    console.log(`   Hotel: ${staticResult.data?.name || 'N/A'}`);
  } else {
    console.log(`❌ Static info failed: ${staticResult.error}`);
    if (staticResult.statusCode) {
      console.log(`   HTTP Status: ${staticResult.statusCode}`);
    }
    if (staticResult.connectionError) {
      console.log(`   💡 Tip: Make sure your server is running: npm start`);
    }
  }
  
  // Test 3: Hotel Details with Rates
  console.log('\n🏨 TEST 3: Hotel Details with Rates');
  console.log('-'.repeat(60));
  const dates = getTestDates();
  console.log(`   Test dates: ${dates.checkin} to ${dates.checkout}`);
  const detailsResult = await testHotelDetails(hotelId);
  results.hotelDetails = detailsResult;
  if (detailsResult.success) {
    console.log(`✅ Hotel details accessible`);
    console.log(`   Rates found: ${detailsResult.ratesCount}`);
    if (detailsResult.ratesCount === 0) {
      console.log(`   ⚠️  No rates available for test dates (this may be normal for test hotels)`);
    }
  } else {
    console.log(`❌ Hotel details failed: ${detailsResult.error}`);
    if (detailsResult.statusCode) {
      console.log(`   HTTP Status: ${detailsResult.statusCode}`);
    }
    if (detailsResult.connectionError) {
      console.log(`   💡 Tip: Make sure your server is running: npm start`);
    }
  }
  
  // Test 4: Prebook (if rates available)
  if (detailsResult.success && detailsResult.ratesCount > 0) {
    console.log('\n🔒 TEST 4: Prebook Endpoint');
    console.log('-'.repeat(60));
    const prebookResult = await testPrebook(hotelId);
    results.prebook = prebookResult;
    if (prebookResult.success) {
      if (prebookResult.skipped) {
        console.log(`⚠️  ${prebookResult.note || 'Prebook skipped'}`);
      } else {
        console.log(`✅ Prebook successful`);
        console.log(`   Booking hash: ${prebookResult.bookingHash?.substring(0, 30)}...`);
      }
    } else {
      if (prebookResult.skipped) {
        console.log(`⚠️  ${prebookResult.error}`);
      } else {
        console.log(`❌ Prebook failed: ${prebookResult.error}`);
      }
    }
  } else {
    console.log('\n🔒 TEST 4: Prebook Endpoint');
    console.log('-'.repeat(60));
    console.log(`⏭️  Skipped (no rates available)`);
    results.prebook = { skipped: true, reason: 'No rates available' };
  }
  
  return results;
}

/**
 * Main test function
 */
async function runAllTests() {
  console.log('🧪 === TEST HOTEL MAPPING VERIFICATION ===');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Dates: ${getTestDates().checkin} to ${getTestDates().checkout}`);
  
  // Test 1: Database
  const dbResults = await testDatabase();
  
  // Summary
  const foundInDb = dbResults.filter(r => r.status === 'found');
  const missingFromDb = dbResults.filter(r => r.status === 'missing');
  
  if (missingFromDb.length > 0) {
    console.log('\n⚠️  Some test hotels are missing from database!');
    console.log('   Run: node scripts/map-test-hotel.js');
    console.log('');
  }
  
  // Test API endpoints for hotels found in database
  const allResults = [];
  for (const dbResult of foundInDb) {
    const apiResults = await runTestsForHotel(dbResult.hotelId);
    allResults.push({
      ...dbResult,
      api: apiResults
    });
  }
  
  // Final Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n✅ Database: ${foundInDb.length}/${TEST_HOTEL_IDS.length} hotels found`);
  
  for (const result of allResults) {
    console.log(`\n🏨 ${result.hotelId}:`);
    console.log(`   Database: ✅ Found`);
    if (result.api) {
      console.log(`   Static Info: ${result.api.staticInfo?.success ? '✅' : '❌'}`);
      console.log(`   Hotel Details: ${result.api.hotelDetails?.success ? '✅' : '❌'}`);
      if (result.api.hotelDetails?.ratesCount > 0) {
        console.log(`   Prebook: ${result.api.prebook?.success || result.api.prebook?.skipped ? '✅' : '❌'}`);
      } else {
        console.log(`   Prebook: ⏭️  (no rates)`);
      }
    }
  }
  
  console.log('\n📝 Certification Status:');
  const allWorking = allResults.every(r => 
    r.api?.staticInfo?.success && 
    r.api?.hotelDetails?.success
  );
  
  if (allWorking && foundInDb.length === TEST_HOTEL_IDS.length) {
    console.log('✅ All test hotels are properly mapped and accessible!');
    console.log('   Ready for ETG certification verification.');
  } else {
    console.log('⚠️  Some issues detected. Review the tests above.');
  }
  
  console.log('');
  
  return { dbResults, apiResults: allResults };
}

/**
 * Run tests
 */
async function main() {
  try {
    await runAllTests();
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure your API server is running:');
      console.error('   npm start');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runAllTests, testDatabase, testStaticInfo, testHotelDetails, testPrebook };

