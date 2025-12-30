import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import StreamJsonPkg from 'stream-json';
import StreamArrayPkg from 'stream-json/streamers/StreamArray.js';

const { parser } = StreamJsonPkg;
const { streamArray } = StreamArrayPkg;

const prisma = new PrismaClient();

const DUMPS_DIR = './dumps';
const BATCH_SIZE = 500;

async function importHotelInfoStreaming() {
  const hotelInfoFile = path.join(DUMPS_DIR, 'hotel_info_en.json');
  
  console.log('📊 Importing hotel info (streaming)...');
  
  let hotels = [];
  let count = 0;
  let skipped = 0;
  
  const stream = fs.createReadStream(hotelInfoFile);
  const jsonStream = stream.pipe(parser()).pipe(streamArray());
  
  for await (const { value: hotel } of jsonStream) {
    try {
      hotels.push({
        hotelId: hotel.id || hotel.hotel_id,
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
        await prisma.hotelDumpData.createMany({
          data: hotels,
          skipDuplicates: true
        });
        
        count += hotels.length;
        console.log(`   ✅ Processed ${count} hotels (${skipped} skipped)...`);
        
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

  console.log(`✅ Imported ${count} hotels (${skipped} skipped)`);
}

async function importReviews() {
  const reviewsFile = path.join(DUMPS_DIR, 'hotel_reviews_en.json');
  
  if (!fs.existsSync(reviewsFile)) {
    console.log('⚠️  Reviews file not found, skipping...');
    return;
  }

  console.log('📊 Importing reviews...');
  
  let reviews = [];
  let count = 0;
  
  const stream = fs.createReadStream(reviewsFile);
  const jsonStream = stream.pipe(parser()).pipe(streamArray());

  for await (const { value: review } of jsonStream) {
    try {
      reviews.push({
        hotelId: review.hotel_id,
        text: review.text?.substring(0, 2000) || '',
        rating: parseFloat(review.rating) || 0,
        author: review.author?.substring(0, 100) || '',
        date: review.date ? new Date(review.date) : null,
        language: 'en'
      });

      if (reviews.length >= BATCH_SIZE) {
        await prisma.hotelReview.createMany({
          data: reviews,
          skipDuplicates: true
        });
        
        count += reviews.length;
        console.log(`   ✅ Processed ${count} reviews...`);
        reviews = [];
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      // Skip
    }
  }

  if (reviews.length > 0) {
    await prisma.hotelReview.createMany({
      data: reviews,
      skipDuplicates: true
    });
    count += reviews.length;
  }

  console.log(`✅ Imported ${count} reviews`);
}

async function importPOI() {
  const poiFile = path.join(DUMPS_DIR, 'hotel_poi_en.json');
  
  if (!fs.existsSync(poiFile)) {
    console.log('⚠️  POI file not found, skipping...');
    return;
  }

  console.log('📊 Importing POI data...');
  
  let pois = [];
  let count = 0;
  
  const stream = fs.createReadStream(poiFile);
  const jsonStream = stream.pipe(parser()).pipe(streamArray());

  for await (const { value: poi } of jsonStream) {
    try {
      pois.push({
        hotelId: poi.hotel_id,
        poiName: poi.name?.substring(0, 200) || '',
        distance: parseFloat(poi.distance) || 0,
        poiType: poi.type?.substring(0, 50) || '',
        latitude: parseFloat(poi.latitude) || 0,
        longitude: parseFloat(poi.longitude) || 0
      });

      if (pois.length >= BATCH_SIZE) {
        await prisma.hotelPOI.createMany({
          data: pois,
          skipDuplicates: true
        });
        
        count += pois.length;
        console.log(`   ✅ Processed ${count} POIs...`);
        pois = [];
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      // Skip
    }
  }

  if (pois.length > 0) {
    await prisma.hotelPOI.createMany({
      data: pois,
      skipDuplicates: true
    });
    count += pois.length;
  }

  console.log(`✅ Imported ${count} POIs`);
}

async function importRegions() {
  const regionsFile = path.join(DUMPS_DIR, 'regions.json');
  
  if (!fs.existsSync(regionsFile)) {
    console.log('⚠️  Regions file not found, skipping...');
    return;
  }

  console.log('📊 Importing regions...');
  
  let regions = [];
  let count = 0;
  
  const stream = fs.createReadStream(regionsFile);
  const jsonStream = stream.pipe(parser()).pipe(streamArray());

  for await (const { value: region } of jsonStream) {
    try {
      regions.push({
        id: region.id,
        name: region.name?.substring(0, 200) || '',
        countryCode: region.country_code?.substring(0, 10) || '',
        type: region.type?.substring(0, 50) || '',
        latitude: parseFloat(region.latitude) || 0,
        longitude: parseFloat(region.longitude) || 0
      });

      if (regions.length >= BATCH_SIZE) {
        await prisma.regionData.createMany({
          data: regions,
          skipDuplicates: true
        });
        
        count += regions.length;
        console.log(`   ✅ Processed ${count} regions...`);
        regions = [];
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      // Skip
    }
  }

  if (regions.length > 0) {
    await prisma.regionData.createMany({
      data: regions,
      skipDuplicates: true
    });
    count += regions.length;
  }

  console.log(`✅ Imported ${count} regions`);
}

async function main() {
  console.log('🚀 === STREAMING HOTEL DATA IMPORT ===\n');
  
  const startTime = Date.now();
  
  try {
    await importHotelInfoStreaming();
    await importReviews();
    await importPOI();
    await importRegions();
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n✅ === IMPORT COMPLETE ===');
    console.log(`⏱️  Total time: ${duration} minutes`);
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();