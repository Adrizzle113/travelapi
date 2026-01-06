import axios from 'axios';

const API_BASE = 'http://localhost:3001';

async function testAutocompleteFlow() {
  console.log('🧪 Testing Autocomplete and Search Flow\n');
  console.log('=' .repeat(60));

  try {
    console.log('\n1️⃣ Testing Autocomplete API');
    console.log('-'.repeat(60));

    const autocompleteResponse = await axios.get(`${API_BASE}/api/destinations/autocomplete`, {
      params: { query: 'los angeles', limit: 5 }
    });

    console.log('✅ Autocomplete Response Status:', autocompleteResponse.status);
    console.log('📊 Response Data:', JSON.stringify(autocompleteResponse.data, null, 2));

    const destinations = autocompleteResponse.data?.data?.destinations || [];
    if (destinations.length === 0) {
      console.log('⚠️ No destinations found');
      return;
    }

    console.log(`\n✅ Found ${destinations.length} destinations`);
    destinations.forEach((dest, idx) => {
      console.log(`   ${idx + 1}. ${dest.label} (region_id: ${dest.region_id}, type: ${dest.type})`);
    });

    const selectedDestination = destinations[0];
    console.log(`\n🎯 Selected destination: ${selectedDestination.label}`);
    console.log(`   Region ID: ${selectedDestination.region_id}`);
    console.log(`   Type: ${selectedDestination.type}`);

    console.log('\n2️⃣ Testing Search API with region_id');
    console.log('-'.repeat(60));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checkin = tomorrow.toISOString().split('T')[0];

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 3);
    const checkout = dayAfter.toISOString().split('T')[0];

    console.log(`📅 Check-in: ${checkin}`);
    console.log(`📅 Check-out: ${checkout}`);

    const searchPayload = {
      region_id: selectedDestination.region_id,
      destination_label: selectedDestination.label,
      checkin,
      checkout,
      guests: [{ adults: 2, children: [] }],
      currency: 'USD',
      residency: 'us'
    };

    console.log('\n📤 Search Payload:', JSON.stringify(searchPayload, null, 2));

    const searchResponse = await axios.post(`${API_BASE}/api/ratehawk/search`, searchPayload);

    console.log('\n✅ Search Response Status:', searchResponse.status);
    console.log('📊 Hotels Found:', searchResponse.data?.totalHotels || 0);
    console.log('💾 From Cache:', searchResponse.data?.from_cache || false);
    console.log('🔑 Search Signature:', searchResponse.data?.search_signature);

    if (searchResponse.data?._deprecated) {
      console.warn('⚠️ DEPRECATED PARAMS USED:', searchResponse.data._deprecated);
    }

    if (searchResponse.data?.hotels && searchResponse.data.hotels.length > 0) {
      console.log('\n🏨 Sample Hotels (first 3):');
      searchResponse.data.hotels.slice(0, 3).forEach((hotel, idx) => {
        console.log(`   ${idx + 1}. ${hotel.name || hotel.hotel_id}`);
        if (hotel.min_rate) {
          console.log(`      Rate: $${hotel.min_rate.amount} ${hotel.min_rate.currency}`);
        }
      });
    }

    console.log('\n3️⃣ Testing Backward Compatibility (destination string)');
    console.log('-'.repeat(60));

    const legacyPayload = {
      destination: 'Los Angeles',
      checkin,
      checkout,
      guests: [{ adults: 2, children: [] }],
      currency: 'USD',
      residency: 'us'
    };

    console.log('📤 Legacy Payload:', JSON.stringify(legacyPayload, null, 2));

    const legacyResponse = await axios.post(`${API_BASE}/api/ratehawk/search`, legacyPayload);

    console.log('\n✅ Legacy Search Response Status:', legacyResponse.status);
    console.log('📊 Hotels Found:', legacyResponse.data?.totalHotels || 0);
    console.log('💾 From Cache:', legacyResponse.data?.from_cache || false);

    if (legacyResponse.data?._deprecated) {
      console.log('⚠️ Deprecated warning shown:', legacyResponse.data._deprecated.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testAutocompleteFlow()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
