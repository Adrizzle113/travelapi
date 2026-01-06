/**
 * Test Filter Values Endpoint
 * 
 * Tests the /api/ratehawk/filter-values endpoint
 * 
 * Usage:
 *   1. Make sure your server is running: npm start
 *   2. Run this script: node scripts/test-filter-values.js
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

async function testFilterValues() {
  console.log('🧪 === TESTING FILTER VALUES ENDPOINT ===\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  try {
    console.log('📡 Sending GET request to /api/ratehawk/filter-values...\n');
    
    const response = await axios.get(`${API_BASE_URL}/api/ratehawk/filter-values`, {
      timeout: 10000
    });

    console.log('✅ Response received!\n');
    console.log('📊 Response Status:', response.status);
    console.log('📦 Response Structure:');
    console.log('   - success:', response.data.success);
    console.log('   - has data:', !!response.data.data);
    console.log('   - from_cache:', response.data.meta?.from_cache);
    console.log('   - cache_age_hours:', response.data.meta?.cache_age_hours);
    console.log('   - duration:', response.data.meta?.duration);

    if (response.data.data) {
      const data = response.data.data;
      console.log('\n📋 Filter Values Summary:');
      console.log(`   - Languages: ${data.language?.length || 0} options`);
      console.log(`   - Countries: ${data.country?.length || 0} options`);
      console.log(`   - SERP Filters: ${data.serp_filter?.length || 0} options`);
      console.log(`   - Star Ratings: ${data.star_rating?.length || 0} options`);
      console.log(`   - Hotel Kinds: ${data.kind?.length || 0} options`);

      // Show sample data
      if (data.language && data.language.length > 0) {
        console.log('\n🌐 Sample Languages (first 5):');
        data.language.slice(0, 5).forEach(lang => {
          console.log(`   - ${lang.value}: ${lang.desc}`);
        });
      }

      if (data.serp_filter && data.serp_filter.length > 0) {
        console.log('\n🔍 Sample SERP Filters (first 5):');
        data.serp_filter.slice(0, 5).forEach(filter => {
          console.log(`   - ${filter.value}: ${filter.desc}`);
        });
      }

      if (data.star_rating && data.star_rating.length > 0) {
        console.log('\n⭐ Star Ratings:');
        console.log(`   - ${data.star_rating.join(', ')}`);
      }

      if (data.kind && data.kind.length > 0) {
        console.log('\n🏨 Sample Hotel Kinds (first 5):');
        data.kind.slice(0, 5).forEach(kind => {
          console.log(`   - ${kind}`);
        });
      }
    }

    console.log('\n✅ Test PASSED - Filter values endpoint is working!\n');
    return true;

  } catch (error) {
    console.error('\n❌ Test FAILED\n');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Server is not running!');
      console.error(`   Expected server at: ${API_BASE_URL}`);
      console.error('\n   To fix this:');
      console.error('   1. Open a new terminal');
      console.error('   2. Run: npm start');
      console.error('   3. Wait for server to start');
      console.error('   4. Run this test script again');
    } else if (error.response) {
      console.error('📡 Server responded with error:');
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.error?.message || error.response.data?.message || 'Unknown error'}`);
      console.error('\n   Full error response:');
      console.error(JSON.stringify(error.response.data, null, 2).substring(0, 500));
    } else if (error.message) {
      console.error('❌ Error:', error.message);
    } else {
      console.error('❌ Unknown error:', error);
    }

    console.error('\n');
    return false;
  }
}

// Run the test
testFilterValues()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

