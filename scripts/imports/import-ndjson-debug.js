import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function importHotelInfo() {
  console.log('Importing hotel info (NDJSON format with debug)...');
  
  const fileStream = fs.createReadStream('./dumps/hotel_info_en.json');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let hotels = [];
  let count = 0;
  let skipped = 0;
  let lineNum = 0;
  let lastError = null;

  for await (const line of rl) {
    lineNum++;
    if (!line.trim()) continue;
    
    try {
      const hotel = JSON.parse(line);
      
      // Debug: Show first valid hotel
      if (count === 0 && hotels.length === 0) {
        console.log('First valid hotel found:', {
          id: hotel.id || hotel.hid,
          name: hotel.name,
          hasId: !!hotel.id,
          hasHid: !!hotel.hid
        });
      }
      
      const hotelId = hotel.id || hotel.hid;
      if (!hotelId) {
        skipped++;
        if (skipped <= 5) console.log('Skip: No hotel ID at line', lineNum);
        continue;
      }
      
      hotels.push({
        hotelId: String(hotelId),
        name: hotel.name?.substring(0, 255) || '',
        address: hotel.address?.substring(0, 500) || '',
        city: hotel.city?.substring(0, 100) || '',
        country: hotel.country?.substring(0, 100) || '',
        latitude: parseFloat(hotel.latitude) || 0,
        longitude: parseFloat(hotel.longitude) || 0,
        starRating: parseInt(hotel.star_rating) || 0,
        kind: hotel.kind?.substring(0, 50) || '',
        currency: hotel.currency?.substring(0, 10) || 'USD',
        checkInTime: hotel.check_in_time?.substring(0, 20) || '',
        checkOutTime: hotel.check_out_time?.substring(0, 20) || '',
        metapolicyStructId: hotel.metapolicy_struct_id || null,
        amenities: hotel.amenities ? JSON.stringify(hotel.amenities).substring(0, 5000) : '[]',
        factData: hotel.facts ? JSON.stringify(hotel.facts).substring(0, 5000) : '{}',
        hotelChain: hotel.hotel_chain?.substring(0, 100) || null
      });

      if (hotels.length >= BATCH_SIZE) {
        console.log('Attempting to insert batch of', hotels.length, 'hotels...');
        await prisma.hotelDumpData.createMany({
          data: hotels,
          skipDuplicates: true
        });
        
        count += hotels.length;
        console.log('SUCCESS! Processed ' + count + ' hotels, ' + skipped + ' skipped');
        hotels = [];
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      skipped++;
      lastError = error.message;
      if (skipped % 1000 === 0) {
        console.log('Skipped ' + skipped + ' invalid lines. Last error:', lastError);
      }
    }
  }

  if (hotels.length > 0) {
    console.log('Inserting final batch of', hotels.length, 'hotels...');
    await prisma.hotelDumpData.createMany({
      data: hotels,
      skipDuplicates: true
    });
    count += hotels.length;
  }

  console.log('DONE - Imported ' + count + ' hotels, skipped ' + skipped);
}

async function main() {
  console.log('HOTEL DATA IMPORT - DEBUG MODE');
  const startTime = Date.now();
  
  try {
    await importHotelInfo();
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('COMPLETE - Time: ' + duration + ' minutes');
  } catch (error) {
    console.error('Failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
