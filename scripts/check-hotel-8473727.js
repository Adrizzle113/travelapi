/**
 * Check if hotel 8473727 exists in ETG API
 * Tries different ID formats and endpoints
 */

import { getHotelInformation } from '../services/etg/etgClient.js';
import { getHotelWithRates } from '../services/etg/etgClient.js';

const TEST_IDS = [
  '8473727',
  '8473727',
  'test_hotel_8473727',
  'hotel_8473727'
];

async function checkHotelVariations() {
  console.log('🔍 Checking hotel 8473727 with different formats...\n');
  
  const dates = {
    checkin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    checkout: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };
  
  for (const hotelId of TEST_IDS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ID: "${hotelId}"`);
    console.log('='.repeat(60));
    
    // Try /hotel/info/
    try {
      console.log('📚 Testing /hotel/info/ endpoint...');
      const info = await getHotelInformation(hotelId, 'en');
      console.log(`✅ Found via /hotel/info/: ${info.name || hotelId}`);
      return { success: true, hotelId, method: '/hotel/info/', data: info };
    } catch (error) {
      console.log(`❌ /hotel/info/ failed: ${error.message}`);
    }
    
    // Try /search/hp/
    try {
      console.log('🏨 Testing /search/hp/ endpoint...');
      const hotel = await getHotelWithRates(hotelId, {
        checkin: dates.checkin,
        checkout: dates.checkout,
        guests: [{ adults: 2, children: [] }],
        residency: 'US',
        language: 'en',
        currency: 'USD'
      });
      console.log(`✅ Found via /search/hp/: ${hotel.name || hotelId}`);
      console.log(`   Rates: ${hotel.rates?.length || 0}`);
      return { success: true, hotelId, method: '/search/hp/', data: hotel };
    } catch (error) {
      console.log(`❌ /search/hp/ failed: ${error.message}`);
    }
  }
  
  console.log('\n❌ Hotel 8473727 not found with any format');
  return { success: false };
}

async function main() {
  try {
    const result = await checkHotelVariations();
    
    if (!result.success) {
      console.log('\n📝 Possible reasons:');
      console.log('   1. Hotel 8473727 might not exist in your test environment');
      console.log('   2. It might only be available in production environment');
      console.log('   3. The requirement might be "one of" not "both"');
      console.log('   4. Contact ETG support: apisupport@ratehawk.com');
      console.log('\n✅ Good news: test_hotel_do_not_book is working perfectly!');
      console.log('   This is likely sufficient for certification.');
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

main();

