// Test script for WorldOTA Geo Search methods
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
  console.log('=' .repeat(60));
  try {
    // Using coordinates for The Forum in Inglewood, CA
    const geoResults = await service.searchHotelsByGeo({
      latitude: 33.9581,
      longitude: -118.3387,
      radius: 5000, // 5km radius
      ...testParams,
    });

    console.log('\n✅ Geo Search Success!');
    console.log(`📊 Hotels found: ${geoResults.totalHotels || 0}`);
    console.log(`🏨 Hotels with data: ${geoResults.hotels?.length || 0}`);
    
    if (geoResults.hotels && geoResults.hotels.length > 0) {
      console.log('\n📋 Sample hotel:');
      const sampleHotel = geoResults.hotels[0];
      console.log(`   ID: ${sampleHotel.id}`);
      console.log(`   Name: ${sampleHotel.name}`);
      console.log(`   Price: ${sampleHotel.price?.amount} ${sampleHotel.price?.currency}`);
      console.log(`   Room types: ${sampleHotel.uniqueRoomCount || 0}`);
    }
  } catch (error) {
    console.error('❌ Geo Search Error:', error.message);
  }

  console.log('\n');

  // Test 2: searchHotelsByPOI (if Mapbox token is available)
  console.log('🔍 Test 2: searchHotelsByPOI (POI Name)');
  console.log('=' .repeat(60));
  
  if (!process.env.MAPBOX_TOKEN) {
    console.log('⚠️  MAPBOX_TOKEN not set - skipping POI search test');
    console.log('   To test POI search, set MAPBOX_TOKEN environment variable');
  } else {
    try {
      const poiResults = await service.searchHotelsByPOI({
        poiName: 'The Forum in Inglewood',
        radius: 5000,
        ...testParams,
      });

      console.log('\n✅ POI Search Success!');
      console.log(`📊 Hotels found: ${poiResults.totalHotels || 0}`);
      console.log(`🏨 Hotels with data: ${poiResults.hotels?.length || 0}`);
      
      if (poiResults.hotels && poiResults.hotels.length > 0) {
        console.log('\n📋 Sample hotel:');
        const sampleHotel = poiResults.hotels[0];
        console.log(`   ID: ${sampleHotel.id}`);
        console.log(`   Name: ${sampleHotel.name}`);
        console.log(`   Price: ${sampleHotel.price?.amount} ${sampleHotel.price?.currency}`);
        console.log(`   Room types: ${sampleHotel.uniqueRoomCount || 0}`);
      }
    } catch (error) {
      console.error('❌ POI Search Error:', error.message);
    }
  }

  console.log('\n✅ Testing complete!\n');
}

// Run tests
testGeoSearch().catch(error => {
  console.error('💥 Test script error:', error);
  process.exit(1);
});

