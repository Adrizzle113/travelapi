/**
 * Complete RateHawk Dump Downloader
 * Downloads all available dumps for optimal performance
 */

import axios from 'axios';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import readline from 'readline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RATEHAWK_CREDENTIALS = {
  username: process.env.RATEHAWK_USERNAME || "11606",
  password: process.env.RATEHAWK_PASSWORD || "ff9702bb-ba93-4996-a31e-547983c51530",
};

const DUMPS_DIR = './dumps';

// Ensure dumps directory exists
if (!fs.existsSync(DUMPS_DIR)) {
  fs.mkdirSync(DUMPS_DIR, { recursive: true });
}

/**
 * Request dump URL from RateHawk
 */
async function requestDumpUrl(endpoint, payload = {}) {
  console.log(`📥 Requesting dump: ${endpoint}`);
  
  const response = await axios.post(
    `https://api.worldota.net/api/b2b/v3/${endpoint}`,
    payload,
    {
      auth: RATEHAWK_CREDENTIALS,
      headers: { 'Content-Type': 'application/json' }
    }
  );

  if (response.data.error === 'dump_not_ready') {
    throw new Error('Dump is being updated. Try again in a few hours.');
  }

  const { url, last_update } = response.data.data;
  console.log(`✅ Dump URL received`);
  console.log(`   Last update: ${last_update}`);

  return { url, last_update };
}

/**
 * Download dump file
 */
async function downloadFile(url, outputPath) {
  console.log(`⬇️  Downloading to ${outputPath}...`);
  
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream'
  });

  const writer = createWriteStream(outputPath);
  await pipeline(response.data, writer);

  console.log(`✅ Download complete`);
}

/**
 * Decompress .zst file
 */
async function decompressZst(compressedPath, decompressedPath) {
  console.log(`📦 Decompressing ${compressedPath}...`);
  
  const { decompress } = await import('@mongodb-js/zstd');
  
  const compressed = fs.readFileSync(compressedPath);
  const decompressed = await decompress(compressed);
  
  fs.writeFileSync(decompressedPath, decompressed);
  
  console.log(`✅ Decompression complete`);
}

/**
 * Decompress .gz file
 */
async function decompressGz(compressedPath, decompressedPath) {
  console.log(`📦 Decompressing ${compressedPath}...`);
  
  const zlib = await import('zlib');
  const gunzip = zlib.createGunzip();
  
  const input = createReadStream(compressedPath);
  const output = createWriteStream(decompressedPath);
  
  await pipeline(input, gunzip, output);
  
  console.log(`✅ Decompression complete`);
}

/**
 * DUMP 1: Hotel Info
 */
async function downloadHotelInfo(language = 'en') {
  console.log('\n📚 === HOTEL INFO DUMP ===');
  
  const { url, last_update } = await requestDumpUrl('hotel/info/dump/', {
    inventory: 'all',
    language: language
  });
  
  const compressedPath = `${DUMPS_DIR}/hotel_info_${language}.json.zst`;
  const decompressedPath = `${DUMPS_DIR}/hotel_info_${language}.json`;
  
  await downloadFile(url, compressedPath);
  await decompressZst(compressedPath, decompressedPath);
  
  console.log(`✅ Hotel info dump ready: ${decompressedPath}`);
  console.log(`   Import this into HotelStaticData table`);
  
  // Cleanup compressed file
  fs.unlinkSync(compressedPath);
  
  return { path: decompressedPath, last_update };
}

/**
 * DUMP 2: Hotel Reviews
 */
async function downloadHotelReviews(language = 'en') {
  console.log('\n⭐ === HOTEL REVIEWS DUMP ===');
  
  const { url, last_update } = await requestDumpUrl('hotel/reviews/dump/', {
    language: language
  });
  
  const compressedPath = `${DUMPS_DIR}/hotel_reviews_${language}.json.gz`;
  const decompressedPath = `${DUMPS_DIR}/hotel_reviews_${language}.json`;
  
  await downloadFile(url, compressedPath);
  await decompressGz(compressedPath, decompressedPath);
  
  console.log(`✅ Hotel reviews dump ready: ${decompressedPath}`);
  console.log(`   Import this into HotelReviews table`);
  
  // Cleanup compressed file
  fs.unlinkSync(compressedPath);
  
  return { path: decompressedPath, last_update };
}

/**
 * DUMP 3: POI (Points of Interest)
 */
async function downloadPOI(language = 'en') {
  console.log('\n🗺️  === POI DUMP ===');
  
  const { url, last_update } = await requestDumpUrl('hotel/poi/dump', {
    language: language
  });
  
  const compressedPath = `${DUMPS_DIR}/hotel_poi_${language}.json.zst`;
  const decompressedPath = `${DUMPS_DIR}/hotel_poi_${language}.json`;
  
  await downloadFile(url, compressedPath);
  await decompressZst(compressedPath, decompressedPath);
  
  console.log(`✅ POI dump ready: ${decompressedPath}`);
  console.log(`   Import this into HotelPOIs table`);
  console.log(`   🎉 This replaces your Mapbox POI calls!`);
  
  // Cleanup compressed file
  fs.unlinkSync(compressedPath);
  
  return { path: decompressedPath, last_update };
}

/**
 * DUMP 4: Regions
 */
async function downloadRegions() {
  console.log('\n🌍 === REGIONS DUMP ===');
  
  const { url, last_update } = await requestDumpUrl('hotel/region/dump/');
  
  const compressedPath = `${DUMPS_DIR}/regions.json.zst`;
  const decompressedPath = `${DUMPS_DIR}/regions.json`;
  
  await downloadFile(url, compressedPath);
  await decompressZst(compressedPath, decompressedPath);
  
  console.log(`✅ Regions dump ready: ${decompressedPath}`);
  console.log(`   Import this into Regions table`);
  
  // Cleanup compressed file
  fs.unlinkSync(compressedPath);
  
  return { path: decompressedPath, last_update };
}

/**
 * DUMP 5: Static Data (translations)
 */
async function downloadStaticData() {
  console.log('\n📋 === STATIC DATA DUMP ===');
  
  const response = await axios.get(
    'https://api.worldota.net/api/b2b/v3/hotel/static/',
    {
      auth: RATEHAWK_CREDENTIALS,
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  const outputPath = `${DUMPS_DIR}/static_data.json`;
  fs.writeFileSync(outputPath, JSON.stringify(response.data.data, null, 2));
  
  console.log(`✅ Static data dump ready: ${outputPath}`);
  console.log(`   Import this into StaticData table`);
  
  return { path: outputPath };
}

/**
 * Import Hotel Info JSON into database
 */
async function importHotelInfo(jsonPath) {
  console.log(`\n💾 Importing hotel info from ${jsonPath}...`);
  
  const fileStream = createReadStream(jsonPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let batch = [];
  const BATCH_SIZE = 1000;

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const hotel = JSON.parse(line);
      
      batch.push({
        hotel_id: hotel.id,
        language: 'en',
        name: hotel.name,
        address: hotel.address,
        postal_code: hotel.postal_code,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        star_rating: hotel.star_rating,
        kind: hotel.kind,
        check_in_time: hotel.check_in_time,
        check_out_time: hotel.check_out_time,
        email: hotel.email,
        phone: hotel.phone,
        images: hotel.images || [],
        amenities: extractAmenityStrings(hotel.amenity_groups || []),
        amenity_groups: hotel.amenity_groups || [],
        description: extractDescription(hotel.description_struct),
        description_struct: hotel.description_struct,
        policy_struct: hotel.policy_struct,
        room_groups: hotel.room_groups || [],
        facts: hotel.facts,
        raw_data: hotel
      });

      if (batch.length >= BATCH_SIZE) {
        await insertHotelBatch(batch);
        count += batch.length;
        console.log(`   Imported ${count} hotels...`);
        batch = [];
      }

    } catch (error) {
      console.error(`Error parsing line: ${error.message}`);
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await insertHotelBatch(batch);
    count += batch.length;
  }

  console.log(`✅ Import complete: ${count} hotels imported`);
}

/**
 * Import Reviews JSON into database
 */
async function importReviews(jsonPath) {
  console.log(`\n💾 Importing reviews from ${jsonPath}...`);
  
  const fileStream = createReadStream(jsonPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let batch = [];
  const BATCH_SIZE = 1000;

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const review = JSON.parse(line);
      
      batch.push({
        hotel_id: review.hotel_id,
        language: 'en',
        reviewer_name: review.author,
        rating: review.rating,
        review_text: review.text,
        review_date: new Date(review.date),
        helpful_count: review.helpful_count || 0
      });

      if (batch.length >= BATCH_SIZE) {
        await insertReviewBatch(batch);
        count += batch.length;
        console.log(`   Imported ${count} reviews...`);
        batch = [];
      }

    } catch (error) {
      console.error(`Error parsing review: ${error.message}`);
    }
  }

  if (batch.length > 0) {
    await insertReviewBatch(batch);
    count += batch.length;
  }

  console.log(`✅ Import complete: ${count} reviews imported`);
}

/**
 * Import POI JSON into database
 */
async function importPOIs(jsonPath) {
  console.log(`\n💾 Importing POIs from ${jsonPath}...`);
  
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  let count = 0;
  let batch = [];
  const BATCH_SIZE = 1000;

  for (const hotel of data) {
    for (const poi of hotel.pois || []) {
      batch.push({
        hotel_id: hotel.id,
        poi_name: poi.poi_name,
        poi_name_en: poi.poi_name_en,
        poi_type: poi.poi_type,
        poi_subtype: poi.poi_subtype,
        distance_m: poi.distance
      });

      if (batch.length >= BATCH_SIZE) {
        await insertPOIBatch(batch);
        count += batch.length;
        console.log(`   Imported ${count} POIs...`);
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    await insertPOIBatch(batch);
    count += batch.length;
  }

  console.log(`✅ Import complete: ${count} POIs imported`);
}

/**
 * Helper: Insert hotel batch
 */
async function insertHotelBatch(hotels) {
  const promises = hotels.map(hotel =>
    prisma.hotelStaticData.upsert({
      where: { hotel_id: hotel.hotel_id },
      update: hotel,
      create: hotel
    })
  );

  await Promise.all(promises);
}

/**
 * Helper: Insert review batch
 */
async function insertReviewBatch(reviews) {
  await prisma.hotelReview.createMany({
    data: reviews,
    skipDuplicates: true
  });
}

/**
 * Helper: Insert POI batch
 */
async function insertPOIBatch(pois) {
  await prisma.hotelPOI.createMany({
    data: pois,
    skipDuplicates: true
  });
}

/**
 * Helper: Extract amenity strings
 */
function extractAmenityStrings(amenityGroups) {
  const amenities = [];
  
  if (!Array.isArray(amenityGroups)) return amenities;
  
  amenityGroups.forEach(group => {
    if (group.amenities && Array.isArray(group.amenities)) {
      amenities.push(...group.amenities);
    }
  });
  
  return amenities;
}

/**
 * Helper: Extract description
 */
function extractDescription(descriptionStruct) {
  if (!descriptionStruct) return '';
  
  const parts = [];
  
  if (Array.isArray(descriptionStruct)) {
    descriptionStruct.forEach(section => {
      if (section.paragraphs && Array.isArray(section.paragraphs)) {
        section.paragraphs.forEach(p => {
          if (typeof p === 'string') parts.push(p);
        });
      }
    });
  }
  
  return parts.join('\n\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 === RATEHAWK DUMP DOWNLOADER ===\n');
    console.log('This will download and import all available dumps.');
    console.log('Estimated time: 1-2 hours\n');
    
    const language = 'en';
    
    // Download all dumps
    console.log('📥 STEP 1: Downloading dumps...\n');
    
    const hotelInfo = await downloadHotelInfo(language);
    const reviews = await downloadHotelReviews(language);
    const pois = await downloadPOI(language);
    const regions = await downloadRegions();
    const staticData = await downloadStaticData();
    
    console.log('\n✅ All dumps downloaded!\n');
    
    // Import into database
    console.log('💾 STEP 2: Importing into database...\n');
    
    await importHotelInfo(hotelInfo.path);
    await importReviews(reviews.path);
    await importPOIs(pois.path);
    // TODO: Add importRegions() and importStaticData()
    
    console.log('\n🎉 === ALL IMPORTS COMPLETE! ===\n');
    console.log('Summary:');
    console.log('✅ Hotel static data imported');
    console.log('✅ Reviews imported');
    console.log('✅ POIs imported (replaces Mapbox!)');
    console.log('✅ Regions downloaded');
    console.log('✅ Static data downloaded');
    console.log('\nYour backend is now ready for blazing-fast searches! 🚀');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
