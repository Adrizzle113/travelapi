// Test script for WorldOTA getHotelPage method
const { WorldOTAService } = require('./services/worldotaService.js');

async function testGetHotelPage() {
  console.log('🧪 Testing WorldOTA getHotelPage Method\n');
  
  const service = new WorldOTAService();
  
  // Test parameters - using a known hotel ID from previous searches
  // We'll use a hotel ID that we know exists
  const testParams = {
    hotelId: 'la_quinta_inn_amp_suites_inglewood', // From previous geo search test
    checkin: '2026-01-15',
    checkout: '2026-01-17',
    guests: [{ adults: 2, children: [] }],
    residency: 'gb',
    language: 'en',
    currency: 'EUR',
  };

  console.log('📍 Test: getHotelPage');
  console.log('='.repeat(60));
  console.log(`🏨 Hotel ID: ${testParams.hotelId}`);
  console.log(`📅 Check-in: ${testParams.checkin}`);
  console.log(`📅 Check-out: ${testParams.checkout}`);
  console.log(`👥 Guests: ${JSON.stringify(testParams.guests)}`);
  console.log(`🌍 Residency: ${testParams.residency}`);
  console.log(`💰 Currency: ${testParams.currency}\n`);
  
  try {
    const result = await service.getHotelPage(testParams);

    console.log('\n✅ getHotelPage Success!');
    console.log(`📊 Status: ${result.status || 'N/A'}`);
    console.log(`✅ Success: ${result.success}`);
    
    if (result.data?.hotel) {
      const hotel = result.data.hotel;
      console.log(`\n🏨 Hotel Details:`);
      console.log(`   Name: ${hotel.name || 'N/A'}`);
      console.log(`   ID: ${hotel.id || 'N/A'}`);
      console.log(`   Room groups: ${hotel.room_groups?.length || 0}`);
      console.log(`   Rates: ${hotel.rates?.length || 0}`);
      
      if (hotel.room_groups && hotel.room_groups.length > 0) {
        console.log(`\n📦 Room Groups (first 2):`);
        hotel.room_groups.slice(0, 2).forEach((group, idx) => {
          console.log(`   ${idx + 1}. ${group.name || group.group_name || 'Unnamed'}`);
          if (group.rates && group.rates.length > 0) {
            const rate = group.rates[0];
            const price = rate.payment_options?.payment_types?.[0]?.show_amount || 'N/A';
            const currency = rate.payment_options?.payment_types?.[0]?.show_currency_code || 'N/A';
            console.log(`      Price: ${price} ${currency}`);
          }
        });
      }
      
      if (hotel.rates && hotel.rates.length > 0) {
        console.log(`\n💰 Sample Rates (first 2):`);
        hotel.rates.slice(0, 2).forEach((rate, idx) => {
          const price = rate.payment_options?.payment_types?.[0]?.show_amount || 'N/A';
          const currency = rate.payment_options?.payment_types?.[0]?.show_currency_code || 'N/A';
          console.log(`   ${idx + 1}. ${rate.room_name || 'Room'} - ${price} ${currency}`);
        });
      }
    } else {
      console.log('\n⚠️  No hotel data in response');
      console.log('Response structure:', JSON.stringify(result, null, 2).substring(0, 500));
    }
    
    console.log(`\n📈 Source: ${result.source || 'N/A'}`);
    
  } catch (error) {
    console.error('\n❌ getHotelPage Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Testing complete!\n');
}

// Run tests
testGetHotelPage().catch(error => {
  console.error('💥 Test script error:', error);
  process.exit(1);
});

