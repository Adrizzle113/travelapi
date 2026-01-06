/**
 * Test Pagination Implementation
 * Verifies that the backend correctly handles pagination parameters
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Test data
const testSearchParams = {
  region_id: 2011, // Los Angeles
  checkin: '2025-01-15',
  checkout: '2025-01-20',
  guests: [{ adults: 2, children: [] }],
  currency: 'USD',
  residency: 'us',
};

async function testPaginationEndpoint() {
  console.log('=== Testing Backend Pagination Implementation ===\n');

  try {
    // Test 1: Default pagination (page 1, limit 100)
    console.log('Test 1: Default pagination parameters...');
    const response1 = await axios.post(`${BASE_URL}/api/ratehawk/search`, testSearchParams);

    console.log('Response structure:', {
      success: response1.data.success,
      hotels_count: response1.data.hotels?.length,
      total: response1.data.total,
      page: response1.data.page,
      limit: response1.data.limit,
      hasMore: response1.data.hasMore,
      returned: response1.data.returned,
    });

    if (!response1.data.page || !response1.data.limit || response1.data.hasMore === undefined) {
      console.error('❌ FAILED: Missing pagination fields in response');
      return;
    }
    console.log('✅ PASSED: Default pagination\n');

    // Test 2: Custom page and limit
    console.log('Test 2: Custom pagination (page=2, limit=20)...');
    const response2 = await axios.post(`${BASE_URL}/api/ratehawk/search`, {
      ...testSearchParams,
      page: 2,
      limit: 20,
    });

    console.log('Response structure:', {
      success: response2.data.success,
      hotels_count: response2.data.hotels?.length,
      total: response2.data.total,
      page: response2.data.page,
      limit: response2.data.limit,
      hasMore: response2.data.hasMore,
      returned: response2.data.returned,
    });

    if (response2.data.page !== 2 || response2.data.limit !== 20) {
      console.error('❌ FAILED: Incorrect page or limit values');
      return;
    }
    console.log('✅ PASSED: Custom pagination\n');

    // Test 3: Verify hasMore logic
    console.log('Test 3: hasMore logic...');
    const totalHotels = response1.data.total;
    const expectedHasMore = (2 * 20) < totalHotels;

    if (response2.data.hasMore !== expectedHasMore) {
      console.error(`❌ FAILED: hasMore should be ${expectedHasMore}, got ${response2.data.hasMore}`);
      return;
    }
    console.log('✅ PASSED: hasMore logic\n');

    // Test 4: Verify returned count matches hotels array length
    console.log('Test 4: Returned count accuracy...');
    if (response2.data.returned !== response2.data.hotels?.length) {
      console.error('❌ FAILED: returned count does not match hotels array length');
      return;
    }
    console.log('✅ PASSED: Returned count\n');

    // Test 5: Test boundary values (max limit)
    console.log('Test 5: Max limit boundary (limit=150, should cap at 100)...');
    const response3 = await axios.post(`${BASE_URL}/api/ratehawk/search`, {
      ...testSearchParams,
      page: 1,
      limit: 150, // Should be capped at 100
    });

    if (response3.data.limit !== 100) {
      console.error(`❌ FAILED: Limit should be capped at 100, got ${response3.data.limit}`);
      return;
    }
    console.log('✅ PASSED: Max limit boundary\n');

    // Test 6: Test boundary values (min limit)
    console.log('Test 6: Min limit boundary (limit=5, should increase to 10)...');
    const response4 = await axios.post(`${BASE_URL}/api/ratehawk/search`, {
      ...testSearchParams,
      page: 1,
      limit: 5, // Should be increased to 10
    });

    if (response4.data.limit !== 10) {
      console.error(`❌ FAILED: Limit should be at least 10, got ${response4.data.limit}`);
      return;
    }
    console.log('✅ PASSED: Min limit boundary\n');

    // Test 7: GET endpoint pagination
    console.log('Test 7: GET endpoint pagination...');
    const getParams = new URLSearchParams({
      destination: 'Los Angeles',
      checkin: testSearchParams.checkin,
      checkout: testSearchParams.checkout,
      guests: JSON.stringify(testSearchParams.guests),
      page: 1,
      limit: 50,
    });

    const response5 = await axios.get(`${BASE_URL}/api/ratehawk/search?${getParams.toString()}`);

    if (!response5.data.page || !response5.data.limit || response5.data.hasMore === undefined) {
      console.error('❌ FAILED: GET endpoint missing pagination fields');
      return;
    }
    console.log('✅ PASSED: GET endpoint pagination\n');

    console.log('=== ALL TESTS PASSED ===');
    console.log('\n📊 Summary:');
    console.log(`- Total hotels available: ${totalHotels}`);
    console.log(`- Default pagination: page=${response1.data.page}, limit=${response1.data.limit}`);
    console.log(`- Custom pagination works correctly`);
    console.log(`- Boundary validation working`);
    console.log(`- Both GET and POST endpoints support pagination`);

  } catch (error) {
    console.error('❌ Test failed with error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run tests
testPaginationEndpoint();
