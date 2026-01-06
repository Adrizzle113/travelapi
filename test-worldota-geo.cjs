// Test script for WorldOTA Geo Search methods
const { WorldOTAService } = require('./services/worldotaService.js');

async function testGeoSearch() {
  console.log('🧪 Testing WorldOTA Geo Search Methods\n');
  
  const service = new WorldOTAService();
  
  // Test parameters
  const testParams = {
    checkin: '2026-01-15',
    checkout: '2026-01-17',
    guests: [{ adults: 2, children: [] }],
    residency: 'gb',
    language: 'en',
    currency: 'EUR',
  };

  // Test 1: searchHotelsByGeo (direct coordinates)
  console.log('📍 Test 1: searchHotelsByGeo (Direct Coordinates)');
  console.log('='.repeat(60));
  console.log('Testing with coordinates: 33.9581, -118.3387 (The Forum, Inglewood)');
  console.log('Radius: 5000m (5km)\n');
  
  try {
    const geoResults = await service.searchHotelsByGeo({
      latitude: 33.9581,
      longitude: -118.3387,
      radius: 5000,
      ...testParams,
    });

    console.log('\n✅ Geo Search Success!');
    console.log(`📊 Total hotels: ${geoResults.totalHotels || 0}`);
    console.log(`🏨 Hotels with data: ${geoResults.hotels?.length || 0}`);
    console.log(`📈 Source: ${geoResults.source || 'unknown'}`);
    
    if (geoResults.metadata) {
      console.log(`\n📊 Metadata:`);
      console.log(`   Hotels with multiple rates: ${geoResults.metadata.hotelsWithMultipleRates || 0}`);
      console.log(`   Total room types: ${geoResults.metadata.totalRoomTypes || 0}`);
    }
    
    if (geoResults.hotels && geoResults.hotels.length > 0) {
      console.log('\n📋 Sample hotels:');
      geoResults.hotels.slice(0, 3).forEach((hotel, idx) => {
        console.log(`\n   ${idx + 1}. ${hotel.name || hotel.id}`);
        console.log(`      ID: ${hotel.id}`);
        console.log(`      Price: ${hotel.price?.amount || 'N/A'} ${hotel.price?.currency || ''}`);
        console.log(`      Room types available: ${hotel.uniqueRoomCount || 0}`);
        if (hotel.roomGroupsWithPricing && hotel.roomGroupsWithPricing.length > 0) {
          console.log(`      Room groups:`);
          hotel.roomGroupsWithPricing.slice(0, 2).forEach(room => {
            console.log(`        - ${room.roomType}: ${room.price} ${room.currency}`);
          });
        }
      });
    } else {
      console.log('\n⚠️  No hotels found in the specified area');
    }
  } catch (error) {
    console.error('\n❌ Geo Search Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: searchHotelsByPOI (if Mapbox token is available)
  console.log('🔍 Test 2: searchHotelsByPOI (POI Name)');
  console.log('='.repeat(60));
  
  if (!process.env.MAPBOX_TOKEN) {
    console.log('⚠️  MAPBOX_TOKEN not set - skipping POI search test');
    console.log('   To test POI search, set MAPBOX_TOKEN environment variable');
    console.log('   Example: export MAPBOX_TOKEN=your_token_here');
  } else {
    console.log('Testing with POI: "The Forum in Inglewood"');
    console.log('Radius: 5000m (5km)\n');
    
    try {
      const poiResults = await service.searchHotelsByPOI({
        poiName: 'The Forum in Inglewood',
        radius: 5000,
        ...testParams,
      });

      console.log('\n✅ POI Search Success!');
      console.log(`📊 Total hotels: ${poiResults.totalHotels || 0}`);
      console.log(`🏨 Hotels with data: ${poiResults.hotels?.length || 0}`);
      console.log(`📈 Source: ${poiResults.source || 'unknown'}`);
      
      if (poiResults.hotels && poiResults.hotels.length > 0) {
        console.log('\n📋 Sample hotels:');
        poiResults.hotels.slice(0, 3).forEach((hotel, idx) => {
          console.log(`\n   ${idx + 1}. ${hotel.name || hotel.id}`);
          console.log(`      ID: ${hotel.id}`);
          console.log(`      Price: ${hotel.price?.amount || 'N/A'} ${hotel.price?.currency || ''}`);
          console.log(`      Room types available: ${hotel.uniqueRoomCount || 0}`);
        });
      }
    } catch (error) {
      console.error('\n❌ POI Search Error:', error.message);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack.split('\n').slice(0, 5).join('\n'));
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Testing complete!\n');
}

// Run tests
testGeoSearch().catch(error => {
  console.error('💥 Test script error:', error);
  process.exit(1);
});
