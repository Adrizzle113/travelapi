/**
 * Test importing a small batch to debug why rows aren't being added
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';
import { createReadStream } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const DUMPS_DIR = './dumps';

async function testSmallImport() {
  console.log('🧪 Testing Small Import...\n');

  try {
    await prisma.$connect();
    console.log('✅ Connected to database\n');

    // Test 1: Import 5 reviews
    console.log('1️⃣ Testing Reviews Import (5 records)...');
    const reviewsContent = fs.readFileSync(path.join(DUMPS_DIR, 'hotel_reviews_en.json'), 'utf-8');
    const reviewsData = JSON.parse(reviewsContent);
    
    const hotelIds = Object.keys(reviewsData).slice(0, 2); // Get first 2 hotels
    let reviewCount = 0;
    let batch = [];

    for (const hotelId of hotelIds) {
      const hotelData = reviewsData[hotelId];
      if (hotelData.reviews && Array.isArray(hotelData.reviews)) {
        for (const review of hotelData.reviews.slice(0, 3)) { // First 3 reviews per hotel
          try {
            const reviewData = {
              hotel_id: hotelId,
              language: 'en',
              reviewer_name: review.author || null,
              rating: review.rating ? parseFloat(review.rating) : 0,
              review_text: review.text || review.review_plus || review.review_minus || '',
              review_date: review.created ? new Date(review.created) : new Date(),
              helpful_count: review.helpful_count || 0,
              dump_version: '1.0'
            };
            
            console.log('   📝 Review data:', JSON.stringify(reviewData, null, 2).substring(0, 200));
            batch.push(reviewData);
            reviewCount++;
            
            if (reviewCount >= 5) break;
          } catch (error) {
            console.log('   ❌ Error processing review:', error.message);
          }
        }
      }
      if (reviewCount >= 5) break;
    }

    if (batch.length > 0) {
      console.log(`\n   Attempting to insert ${batch.length} reviews...`);
      try {
        const result = await prisma.hotelReview.createMany({
          data: batch,
          skipDuplicates: true
        });
        console.log(`   ✅ Inserted ${result.count} reviews`);
        
        // Verify
        const count = await prisma.hotelReview.count();
        console.log(`   ✅ Total reviews in database: ${count}`);
      } catch (error) {
        console.log('   ❌ Insert failed:', error.message);
        console.log('   Error details:', error);
      }
    }

    // Test 2: Import 5 POIs
    console.log('\n2️⃣ Testing POIs Import (5 records)...');
    const poiStream = createReadStream(path.join(DUMPS_DIR, 'hotel_poi_en.json'));
    const poiRL = readline.createInterface({
      input: poiStream,
      crlfDelay: Infinity
    });

    let poiBatch = [];
    let poiCount = 0;

    for await (const line of poiRL) {
      if (!line.trim()) continue;
      
      try {
        const data = JSON.parse(line);
        const hotelId = data.id || data.hotel_id;
        
        if (hotelId && data.pois && Array.isArray(data.pois) && data.pois.length > 0) {
          for (const poi of data.pois.slice(0, 2)) { // First 2 POIs per hotel
            const poiData = {
              hotel_id: String(hotelId),
              poi_name: poi.poi_name || '',
              poi_name_en: poi.poi_name_en || poi.poi_name || '',
              poi_type: poi.poi_type || 'Point of Interest',
              poi_subtype: poi.poi_subtype || 'unspecified',
              distance_m: poi.distance ? parseInt(poi.distance) : 0
            };
            
            console.log('   📝 POI data:', JSON.stringify(poiData, null, 2).substring(0, 200));
            poiBatch.push(poiData);
            poiCount++;
            
            if (poiCount >= 5) break;
          }
        }
        
        if (poiCount >= 5) break;
      } catch (error) {
        console.log('   ⚠️  Error parsing line:', error.message);
      }
    }
    
    poiRL.close();

    if (poiBatch.length > 0) {
      console.log(`\n   Attempting to insert ${poiBatch.length} POIs...`);
      try {
        const result = await prisma.hotelPOI.createMany({
          data: poiBatch,
          skipDuplicates: true
        });
        console.log(`   ✅ Inserted ${result.count} POIs`);
        
        // Verify
        const count = await prisma.hotelPOI.count();
        console.log(`   ✅ Total POIs in database: ${count}`);
      } catch (error) {
        console.log('   ❌ Insert failed:', error.message);
        console.log('   Error details:', error);
      }
    }

    // Test 3: Import 5 regions
    console.log('\n3️⃣ Testing Regions Import (5 records)...');
    const regionsStream = createReadStream(path.join(DUMPS_DIR, 'regions.json'));
    const regionsRL = readline.createInterface({
      input: regionsStream,
      crlfDelay: Infinity
    });

    let regionBatch = [];
    let regionCount = 0;

    for await (const line of regionsRL) {
      if (!line.trim()) continue;
      
      try {
        const region = JSON.parse(line);
        const regionId = region.id;
        
        if (regionId && regionCount < 5) {
          let name = '';
          if (typeof region.name === 'string') {
            name = region.name;
          } else if (region.name && region.name.en) {
            name = region.name.en;
          } else if (region.country_name) {
            if (typeof region.country_name === 'string') {
              name = region.country_name;
            } else if (region.country_name.en) {
              name = region.country_name.en;
            }
          }

          const regionData = {
            id: parseInt(regionId),
            name: name || 'Unknown',
            country_code: region.country_code || '',
            iata: region.iata || null,
            type: region.type || 'Unknown',
            parent_id: region.parent_id ? parseInt(region.parent_id) : null,
            dump_version: '1.0'
          };
          
          console.log('   📝 Region data:', JSON.stringify(regionData, null, 2).substring(0, 200));
          regionBatch.push(regionData);
          regionCount++;
        }
        
        if (regionCount >= 5) break;
      } catch (error) {
        console.log('   ⚠️  Error parsing line:', error.message);
      }
    }
    
    regionsRL.close();

    if (regionBatch.length > 0) {
      console.log(`\n   Attempting to insert ${regionBatch.length} regions...`);
      try {
        const result = await prisma.regionData.createMany({
          data: regionBatch,
          skipDuplicates: true
        });
        console.log(`   ✅ Inserted ${result.count} regions`);
        
        // Verify
        const count = await prisma.regionData.count();
        console.log(`   ✅ Total regions in database: ${count}`);
      } catch (error) {
        console.log('   ❌ Insert failed:', error.message);
        console.log('   Error details:', error);
      }
    }

    await prisma.$disconnect();
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testSmallImport();

