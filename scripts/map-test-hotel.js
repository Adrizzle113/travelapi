/**
 * Map Test Hotel for ETG Certification
 * 
 * This script:
 * 1. Checks if test hotels exist in the database
 * 2. Fetches them from ETG API if missing
 * 3. Stores them in the database with all required fields
 * 4. Verifies they can be accessed via hotel details endpoint
 * 
 * Test Hotel IDs:
 * - hid = 8473727
 * - id = "test_hotel_do_not_book"
 */

import { PrismaClient } from '@prisma/client';
import { getHotelInformation } from '../services/etg/etgClient.js';
import { getHotelWithRates } from '../services/etg/etgClient.js';

const prisma = new PrismaClient();

const TEST_HOTEL_IDS = ['8473727', 'test_hotel_do_not_book'];

/**
 * Transform ETG API hotel data to database schema format
 */
function transformHotelData(hotelData, hotelId) {
  // Handle both single hotel object and array response
  const hotel = Array.isArray(hotelData) ? hotelData[0] : hotelData;
  
  if (!hotel) {
    throw new Error('No hotel data received from API');
  }

  return {
    hotel_id: String(hotelId),
    language: 'en',
    name: hotel.name?.substring(0, 500) || `Test Hotel ${hotelId}`,
    address: hotel.address?.substring(0, 10000) || null,
    city: hotel.city?.substring(0, 255) || null,
    country: hotel.country?.substring(0, 100) || null,
    postal_code: hotel.postal_code?.substring(0, 50) || null,
    latitude: hotel.latitude ? parseFloat(hotel.latitude) : null,
    longitude: hotel.longitude ? parseFloat(hotel.longitude) : null,
    star_rating: hotel.star_rating ? parseInt(hotel.star_rating) : null,
    kind: hotel.kind?.substring(0, 50) || null,
    check_in_time: hotel.check_in_time?.substring(0, 50) || null,
    check_out_time: hotel.check_out_time?.substring(0, 50) || null,
    email: hotel.email?.substring(0, 255) || null,
    phone: hotel.phone?.substring(0, 100) || null,
    images: hotel.images || [],
    amenities: hotel.amenities || [],
    amenity_groups: hotel.amenity_groups || [],
    description: hotel.description || null,
    description_struct: hotel.description_struct || null,
    policy_struct: hotel.policy_struct || null,
    room_groups: hotel.room_groups || [],
    facts: hotel.facts || null,
    raw_data: hotel, // Store full API response
    dump_version: 'test_hotel_manual'
  };
}

/**
 * Check if test hotel exists in database
 */
async function checkHotelExists(hotelId) {
  const hotel = await prisma.hotelDumpData.findUnique({
    where: { hotel_id: hotelId }
  });
  
  return hotel !== null;
}

/**
 * Fetch and store test hotel from ETG API
 */
async function fetchAndStoreTestHotel(hotelId) {
  console.log(`\n📥 Fetching test hotel from ETG API: ${hotelId}`);
  
  try {
    // Fetch hotel static info
    const hotelData = await getHotelInformation(hotelId, 'en');
    
    if (!hotelData) {
      throw new Error(`Hotel ${hotelId} not found in ETG API`);
    }

    console.log(`✅ Fetched hotel data: ${hotelData.name || hotelId}`);

    // Transform to database format
    const transformedData = transformHotelData(hotelData, hotelId);

    // Store in database (upsert to handle updates)
    const result = await prisma.hotelDumpData.upsert({
      where: { hotel_id: hotelId },
      update: {
        ...transformedData,
        updated_at: new Date()
      },
      create: transformedData
    });

    console.log(`✅ Test hotel ${hotelId} stored in database`);
    console.log(`   Name: ${result.name}`);
    console.log(`   City: ${result.city || 'N/A'}`);
    console.log(`   Country: ${result.country || 'N/A'}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Failed to fetch/store test hotel ${hotelId}:`, error.message);
    throw error;
  }
}

/**
 * Verify test hotel can be accessed via hotel details endpoint
 */
async function verifyHotelAccess(hotelId) {
  console.log(`\n🔍 Verifying test hotel access: ${hotelId}`);
  
  try {
    // Use future dates for testing
    const checkin = new Date();
    checkin.setDate(checkin.getDate() + 30);
    const checkout = new Date(checkin);
    checkout.setDate(checkout.getDate() + 2);

    const hotel = await getHotelWithRates(hotelId, {
      checkin: checkin.toISOString().split('T')[0],
      checkout: checkout.toISOString().split('T')[0],
      guests: [{ adults: 2, children: [] }],
      residency: 'US',
      language: 'en',
      currency: 'USD'
    });

    console.log(`✅ Test hotel accessible via /search/hp/ endpoint`);
    console.log(`   Hotel Name: ${hotel.name || 'N/A'}`);
    console.log(`   Rates Available: ${hotel.rates?.length || 0}`);
    console.log(`   Room Groups: ${hotel.room_groups?.length || 0}`);
    
    if (hotel.rates && hotel.rates.length > 0) {
      console.log(`   ⚠️  NOTE: This is a TEST hotel - do not complete bookings!`);
    } else {
      console.log(`   ℹ️  No rates available for test dates (this is normal for test hotels)`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Failed to verify hotel access:`, error.message);
    // Don't throw - hotel might exist but not have rates for test dates
    return false;
  }
}

/**
 * Main function to map all test hotels
 */
async function mapTestHotels() {
  console.log('🗺️  === MAPPING TEST HOTELS FOR ETG CERTIFICATION ===\n');
  
  const results = {
    mapped: [],
    failed: [],
    verified: []
  };

  for (const hotelId of TEST_HOTEL_IDS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing Test Hotel: ${hotelId}`);
    console.log('='.repeat(60));

    try {
      // Step 1: Check if hotel exists in database
      const exists = await checkHotelExists(hotelId);
      
      if (exists) {
        console.log(`✅ Test hotel ${hotelId} already exists in database`);
        const hotel = await prisma.hotelDumpData.findUnique({
          where: { hotel_id: hotelId },
          select: { name: true, city: true, country: true }
        });
        console.log(`   Name: ${hotel?.name || 'N/A'}`);
        console.log(`   Location: ${hotel?.city || 'N/A'}, ${hotel?.country || 'N/A'}`);
      } else {
        console.log(`⚠️  Test hotel ${hotelId} not found in database`);
        console.log(`   Fetching from ETG API...`);
        await fetchAndStoreTestHotel(hotelId);
      }

      // Step 2: Verify hotel can be accessed
      const verified = await verifyHotelAccess(hotelId);
      
      if (verified) {
        results.verified.push(hotelId);
      }
      
      results.mapped.push(hotelId);
      
    } catch (error) {
      console.error(`\n❌ Failed to map test hotel ${hotelId}:`, error.message);
      results.failed.push({ hotelId, error: error.message });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 MAPPING SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully mapped: ${results.mapped.length}/${TEST_HOTEL_IDS.length}`);
  console.log(`   Hotels: ${results.mapped.join(', ')}`);
  
  if (results.verified.length > 0) {
    console.log(`\n✅ Verified accessible: ${results.verified.length}/${TEST_HOTEL_IDS.length}`);
    console.log(`   Hotels: ${results.verified.join(', ')}`);
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed to map: ${results.failed.length}`);
    results.failed.forEach(({ hotelId, error }) => {
      console.log(`   - ${hotelId}: ${error}`);
    });
  }

  console.log(`\n📝 Next Steps:`);
  console.log(`   1. Test hotels are now mapped in your database`);
  console.log(`   2. ETG can verify them during certification`);
  console.log(`   3. ⚠️  DO NOT complete actual bookings with test hotels!`);
  console.log(`   4. Use test hotels only for flow verification\n`);

  return results;
}

/**
 * Run the script
 */
async function main() {
  try {
    await mapTestHotels();
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { mapTestHotels, checkHotelExists, fetchAndStoreTestHotel, verifyHotelAccess };

