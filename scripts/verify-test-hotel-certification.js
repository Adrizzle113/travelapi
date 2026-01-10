/**
 * Verify Test Hotel Mapping for ETG Certification
 * Checks if test hotel hid=8473727 or id="test_hotel_do_not_book" is accessible
 * 
 * ✅ CERTIFICATION REQUIREMENT: Map test hotel for certification verification
 */

import { WorldOTAService } from '../services/worldotaService.js';

const worldotaService = new WorldOTAService();

const TEST_HOTELS = [
  { hid: 8473727, description: 'hid = 8473727 (numeric ID)' },
  { id: 'test_hotel_do_not_book', description: 'id = "test_hotel_do_not_book" (string slug)' }
];

async function checkTestHotel(hotelId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 Testing: ${hotelId.description || JSON.stringify(hotelId)}`);
  console.log('='.repeat(70));

  const testDates = {
    checkin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    checkout: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };

  // Test 1: Static Info endpoint
  try {
    console.log('\n📚 Test 1: /hotel/info/ endpoint (static data)...');
    const hotelIdParam = hotelId.hid ? hotelId.hid.toString() : hotelId.id;
    
    // Try POST endpoint for static info
    const response = await fetch('https://travelapi-bg6t.onrender.com/api/ratehawk/hotel/static-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: hotelIdParam,
        language: 'en'
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        console.log(`✅ Static info accessible: ${data.data.name || 'Unknown'}`);
        console.log(`   HID: ${data.data.hid || 'N/A'}`);
        console.log(`   ID: ${data.data.id || 'N/A'}`);
        return { success: true, method: 'static-info', data: data.data };
      }
    }
    console.log(`❌ Static info endpoint failed: ${response.status}`);
  } catch (error) {
    console.log(`❌ Static info endpoint error: ${error.message}`);
  }

  // Test 2: Hotel Page endpoint (with rates)
  try {
    console.log('\n🏨 Test 2: /search/hp/ endpoint (hotel page with rates)...');
    const hotelIdParam = hotelId.hid ? hotelId.hid.toString() : hotelId.id;
    
    const result = await worldotaService.getHotelPage({
      hotelId: hotelIdParam,
      checkin: testDates.checkin,
      checkout: testDates.checkout,
      guests: [{ adults: 2, children: [] }],
      residency: 'US',
      language: 'en',
      currency: 'USD'
    });

    if (result && result.hotels && result.hotels.length > 0) {
      const hotel = result.hotels[0];
      console.log(`✅ Hotel page accessible: ${hotel.name || 'Unknown'}`);
      console.log(`   Rates found: ${hotel.rates?.length || 0}`);
      return { success: true, method: 'hotel-page', data: hotel };
    }
  } catch (error) {
    console.log(`❌ Hotel page endpoint error: ${error.message}`);
  }

  return { success: false };
}

async function main() {
  console.log('\n🧪 ============================================================');
  console.log('   ETG CERTIFICATION TEST HOTEL VERIFICATION');
  console.log('   ============================================================\n');
  console.log('✅ CERTIFICATION REQUIREMENT:');
  console.log('   Map test hotel: hid = 8473727 OR id = "test_hotel_do_not_book"');
  console.log('   (One of them is sufficient for certification)\n');

  let foundCount = 0;
  const results = [];

  for (const testHotel of TEST_HOTELS) {
    const result = await checkTestHotel(testHotel);
    results.push({ ...testHotel, ...result });
    
    if (result.success) {
      foundCount++;
      console.log(`\n✅ SUCCESS: ${testHotel.description} is accessible via ${result.method}`);
    } else {
      console.log(`\n❌ FAILED: ${testHotel.description} is not accessible`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`   Total test hotels checked: ${TEST_HOTELS.length}`);
  console.log(`   Accessible hotels: ${foundCount}`);
  console.log(`   Unavailable hotels: ${TEST_HOTELS.length - foundCount}\n`);

  if (foundCount > 0) {
    console.log('✅ CERTIFICATION STATUS: READY');
    console.log('   At least one test hotel is accessible and can be used for certification.\n');
    console.log('📋 For ETG Pre-Certification Checklist:');
    console.log('   ✅ Test hotels are mapped and accessible');
    console.log('   ✅ Can demonstrate access during certification');
    
    const workingHotels = results.filter(r => r.success);
    workingHotels.forEach(r => {
      console.log(`\n   Working hotel:`);
      if (r.hid) console.log(`      - hid: ${r.hid}`);
      if (r.id) console.log(`      - id: "${r.id}"`);
      console.log(`      - Accessible via: /${r.method}/`);
    });
  } else {
    console.log('⚠️  CERTIFICATION STATUS: NEEDS ATTENTION');
    console.log('   No test hotels are accessible. Please:');
    console.log('   1. Verify your API credentials have access to test hotels');
    console.log('   2. Check if test hotels exist in your test environment');
    console.log('   3. Contact ETG support: apisupport@ratehawk.com');
    console.log('   4. The requirement may be "one of", not "both"');
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('💥 Script error:', error);
  process.exit(1);
});

