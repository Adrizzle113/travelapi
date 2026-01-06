import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function importHotelInfo() {
  console.log('Starting import with error handling...');
  
  const fileStream = fs.createReadStream('./dumps/hotel_info_en.json');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let hotels = [];
  let count = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    
    try {
      const hotel = JSON.parse(line);
      const hotelId = hotel.id || hotel.hid;
      
      if (!hotelId) {
        skipped++;
        continue;
      }
      
      hotels.push({
        hotel_id: String(hotelId),
        name: hotel.name?.substring(0, 255) || '',
        address: hotel.address?.substring(0, 500) || '',
        city: hotel.city?.substring(0, 100) || '',
        country: hotel.country?.substring(0, 100) || '',
        latitude: parseFloat(hotel.latitude) || 0,
        longitude: parseFloat(hotel.longitude) || 0,
        star_rating: parseInt(hotel.star_rating) || 0,
        kind: hotel.kind?.substring(0, 50) || '',
        check_in_time: hotel.check_in_time?.substring(0, 20) || '',
        check_out_time: hotel.check_out_time?.substring(0, 20) || '',
        email: hotel.email?.substring(0, 255) || null,
        phone: hotel.phone?.substring(0, 50) || null,
        postal_code: hotel.postal_code?.substring(0, 20) || null
      });

      if (hotels.length >= BATCH_SIZE) {
        console.log('Attempting insert of', hotels.length, 'hotels...');
        
        try {
          const result = await prisma.hotelDumpData.createMany({
            data: hotels,
            skipDuplicates: true
          });
          
          count += hotels.length;
          console.log('SUCCESS! Inserted', result.count, 'hotels. Total:', count);
          
        } catch (dbError) {
          console.error('DATABASE ERROR:', dbError.message);
          console.error('Sample hotel data:', JSON.stringify(hotels[0], null, 2));
          throw dbError;
        }
        
        hotels = [];
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      skipped++;
    }
  }

  if (hotels.length > 0) {
    await prisma.hotelDumpData.createMany({
      data: hotels,
      skipDuplicates: true
    });
    count += hotels.length;
  }

  console.log('DONE - Imported', count, 'hotels, skipped', skipped);
}

async function main() {
  console.log('HOTEL DATA IMPORT - WITH ERROR HANDLING');
  const startTime = Date.now();
  
  try {
    await importHotelInfo();
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('COMPLETE - Time:', duration, 'minutes');
  } catch (error) {
    console.error('FATAL ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
