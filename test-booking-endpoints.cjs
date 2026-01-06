// Test script for WorldOTA Booking Endpoints
const { WorldOTAService } = require('./services/worldotaService.js');
const { v4: uuidv4 } = require('uuid');

async function testBookingEndpoints() {
  console.log('🧪 Testing WorldOTA Booking Endpoints\n');
  
  const service = new WorldOTAService();
  
  // Test 1: Create Booking Form
  console.log('📝 Test 1: createBookingForm');
  console.log('='.repeat(60));
  
  try {
    // Use a book_hash from a previous search (we'll get one from getHotelPage)
    console.log('Step 1a: Getting hotel page to obtain book_hash...');
    
    const hotelPage = await service.getHotelPage({
      hotelId: 'la_quinta_inn_amp_suites_inglewood',
      checkin: '2026-01-15',
      checkout: '2026-01-17',
      guests: [{ adults: 2, children: [] }],
      residency: 'gb',
      language: 'en',
      currency: 'EUR'
    });
    
    if (!hotelPage.hotel || !hotelPage.hotel.rates || hotelPage.hotel.rates.length === 0) {
      throw new Error('No rates found in hotel page response');
    }
    
    const bookHash = hotelPage.hotel.rates[0].book_hash;
    console.log(`✅ Found book_hash: ${bookHash}`);
    
    // Now test createBookingForm
    console.log('\nStep 1b: Creating booking form...');
    const partnerOrderId = `partner-${uuidv4()}`;
    
    const bookingForm = await service.createBookingForm({
      bookHash: bookHash,
      partnerOrderId: partnerOrderId,
      language: 'en',
      userIp: '127.0.0.1'
    });
    
    console.log('\n✅ createBookingForm Success!');
    console.log(`📋 Order ID: ${bookingForm.data.order_id || 'N/A'}`);
    console.log(`🆔 Partner Order ID: ${partnerOrderId}`);
    console.log(`💳 Payment types: ${bookingForm.data.payment_types?.length || 0}`);
    
    if (bookingForm.data.payment_types && bookingForm.data.payment_types.length > 0) {
      const paymentType = bookingForm.data.payment_types[0];
      console.log(`\n💰 Payment Info:`);
      console.log(`   Type: ${paymentType.type || 'N/A'}`);
      console.log(`   Amount: ${paymentType.show_amount || paymentType.amount || 'N/A'} ${paymentType.show_currency_code || paymentType.currency_code || ''}`);
      console.log(`   Needs CC data: ${paymentType.is_need_credit_card_data || false}`);
      console.log(`   Needs CVC: ${paymentType.is_need_cvc || false}`);
    }
    
    console.log(`\n📊 Status: ${bookingForm.status || 'N/A'}`);
    
    // Store order ID for next tests
    const orderId = bookingForm.data.order_id;
    
    if (orderId) {
      console.log('\n' + '='.repeat(60));
      console.log('📝 Test 2: checkBookingProcess');
      console.log('='.repeat(60));
      
      try {
        const checkResult = await service.checkBookingProcess({
          orderId: orderId,
          partnerOrderId: partnerOrderId
        });
        
        console.log('\n✅ checkBookingProcess Success!');
        console.log(`📊 Booking Status: ${checkResult.bookingStatus || 'N/A'}`);
        console.log(`📋 Order ID: ${checkResult.data?.order_id || 'N/A'}`);
        console.log(`📈 Status: ${checkResult.status || 'N/A'}`);
        
        if (checkResult.data) {
          console.log('\n📋 Booking Details:');
          console.log(JSON.stringify(checkResult.data, null, 2).substring(0, 500));
        }
      } catch (error) {
        console.error('\n❌ checkBookingProcess Error:', error.message);
        if (error.stack) {
          console.error(error.stack.split('\n').slice(0, 3).join('\n'));
        }
      }
    } else {
      console.log('\n⚠️  No order ID returned, skipping checkBookingProcess test');
    }
    
  } catch (error) {
    console.error('\n❌ createBookingForm Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Testing complete!\n');
  console.log('Note: startBookingProcess and createCreditCardToken require');
  console.log('      actual booking data and should be tested with real bookings.\n');
}

// Run tests
testBookingEndpoints().catch(error => {
  console.error('💥 Test script error:', error);
  process.exit(1);
});

