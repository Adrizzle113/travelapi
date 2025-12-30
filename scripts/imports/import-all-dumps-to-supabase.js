/**
 * Import all dumps into Supabase database
 * This script imports:
 * - hotel_info_en.json -> HotelDumpData
 * - hotel_reviews_en.json -> HotelReview
 * - hotel_poi_en.json -> HotelPOI
 * - regions.json -> RegionData
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';
import { createReadStream } from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const DUMPS_DIR = './dumps';
const BATCH_SIZE = 1000;

// Helper: Extract amenity strings from amenity groups
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

// Helper: Extract description from description struct
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
 * Import Hotel Info (NDJSON format)
 */
async function importHotelInfo() {
  console.log('\n📚 === IMPORTING HOTEL INFO ===');
  
  const filePath = path.join(DUMPS_DIR, 'hotel_info_en.json');
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }
  
  const fileStream = createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let skipped = 0;
  let batch = [];

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const hotel = JSON.parse(line);
      const hotelId = hotel.id || hotel.hid;
      
      if (!hotelId) {
        skipped++;
        continue;
      }

      // Extract city and country from region if not directly available
      const city = hotel.city || hotel.region?.name || null;
      const country = hotel.country || hotel.region?.country_code || null;

      batch.push({
        hotel_id: String(hotelId),
        language: 'en',
        name: hotel.name || null,
        address: hotel.address || null,
        city: city,
        country: country,
        postal_code: hotel.postal_code || null,
        latitude: hotel.latitude ? parseFloat(hotel.latitude) : null,
        longitude: hotel.longitude ? parseFloat(hotel.longitude) : null,
        star_rating: hotel.star_rating ? parseInt(hotel.star_rating) : null,
        kind: hotel.kind || null,
        check_in_time: hotel.check_in_time || null,
        check_out_time: hotel.check_out_time || null,
        email: hotel.email || null,
        phone: hotel.phone || null,
        images: hotel.images || [],
        amenities: extractAmenityStrings(hotel.amenity_groups || []),
        amenity_groups: hotel.amenity_groups || [],
        description: extractDescription(hotel.description_struct),
        description_struct: hotel.description_struct || null,
        policy_struct: hotel.policy_struct || null,
        room_groups: hotel.room_groups || [],
        facts: hotel.facts || null,
        raw_data: hotel,
        dump_version: '1.0'
      });

      if (batch.length >= BATCH_SIZE) {
        try {
          const result = await prisma.hotelDumpData.createMany({
            data: batch,
            skipDuplicates: true
          });
          
          count += result.count;
          console.log(`   ✅ Imported ${count} hotels (${result.count} in this batch, ${skipped} skipped)`);
          batch = [];
          
          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`   ❌ Error inserting hotel batch: ${error.message}`);
          console.error(`   First record in batch:`, JSON.stringify(batch[0], null, 2).substring(0, 300));
          skipped += batch.length;
          batch = [];
        }
      }
    } catch (error) {
      skipped++;
      if (skipped % 1000 === 0) {
        console.log(`   ⚠️  Skipped ${skipped} invalid lines`);
      }
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    try {
      const result = await prisma.hotelDumpData.createMany({
        data: batch,
        skipDuplicates: true
      });
      count += result.count;
      console.log(`   ✅ Inserted final batch: ${result.count} hotels`);
    } catch (error) {
      console.error(`   ❌ Error inserting final hotel batch: ${error.message}`);
      skipped += batch.length;
    }
  }

  console.log(`✅ Hotel info import complete: ${count} hotels imported, ${skipped} skipped`);
  return { count, skipped };
}

/**
 * Import Hotel Reviews (JSON format - single JSON object with hotel IDs as keys)
 */
async function importReviews() {
  console.log('\n⭐ === IMPORTING HOTEL REVIEWS ===');
  
  const filePath = path.join(DUMPS_DIR, 'hotel_reviews_en.json');
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }

  console.log('   Reading reviews file...');
  // Read the entire file as JSON (it's a single JSON object, not NDJSON)
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(fileContent);

  let count = 0;
  let skipped = 0;
  let batch = [];

  console.log(`   Processing ${Object.keys(data).length} hotels with reviews...`);
  
  // The file contains objects with hotel IDs as keys
  for (const [hotelId, hotelData] of Object.entries(data)) {
    if (!hotelData.reviews || !Array.isArray(hotelData.reviews)) {
      continue;
    }

    for (const review of hotelData.reviews) {
      try {
        // Combine review text from multiple sources
        let reviewText = '';
        if (review.text) {
          reviewText = review.text;
        } else if (review.review_plus) {
          reviewText = review.review_plus;
        } else if (review.review_minus) {
          reviewText = review.review_minus;
        }
        
        // Ensure review_text is not empty (required field)
        if (!reviewText || reviewText.trim() === '') {
          skipped++;
          continue;
        }

        batch.push({
          hotel_id: hotelId,
          language: 'en',
          reviewer_name: review.author || null,
          rating: review.rating ? parseFloat(review.rating) : 0,
          review_text: reviewText,
          review_date: review.created ? new Date(review.created) : new Date(),
          helpful_count: review.helpful_count || 0,
          dump_version: '1.0'
        });

        if (batch.length >= BATCH_SIZE) {
          try {
            const result = await prisma.hotelReview.createMany({
              data: batch,
              skipDuplicates: true
            });
            
            count += result.count;
            console.log(`   ✅ Imported ${count} reviews (${result.count} in this batch)`);
            batch = [];
            
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`   ❌ Error inserting batch: ${error.message}`);
            console.error(`   First record in batch:`, JSON.stringify(batch[0], null, 2).substring(0, 300));
            skipped += batch.length;
            batch = [];
          }
        }
      } catch (error) {
        skipped++;
        if (skipped % 100 === 0) {
          console.log(`   ⚠️  Skipped ${skipped} reviews due to errors`);
        }
      }
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    try {
      const result = await prisma.hotelReview.createMany({
        data: batch,
        skipDuplicates: true
      });
      count += result.count;
      console.log(`   ✅ Inserted final batch: ${result.count} reviews`);
    } catch (error) {
      console.error(`   ❌ Error inserting final batch: ${error.message}`);
      skipped += batch.length;
    }
  }

  console.log(`✅ Reviews import complete: ${count} reviews imported, ${skipped} skipped`);
  return { count, skipped };
}

/**
 * Import POIs (NDJSON format)
 */
async function importPOIs() {
  console.log('\n🗺️  === IMPORTING POIs ===');
  
  const filePath = path.join(DUMPS_DIR, 'hotel_poi_en.json');
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }

  const fileStream = createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let skipped = 0;
  let batch = [];

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line);
      const hotelId = data.id || data.hotel_id;
      
      if (!hotelId || !data.pois || !Array.isArray(data.pois)) {
        skipped++;
        continue;
      }

      for (const poi of data.pois) {
        try {
          batch.push({
            hotel_id: String(hotelId),
            poi_name: poi.poi_name || '',
            poi_name_en: poi.poi_name_en || poi.poi_name || '',
            poi_type: poi.poi_type || 'Point of Interest',
            poi_subtype: poi.poi_subtype || 'unspecified',
            distance_m: poi.distance ? parseInt(poi.distance) : 0
          });

          if (batch.length >= BATCH_SIZE) {
            try {
              const result = await prisma.hotelPOI.createMany({
                data: batch,
                skipDuplicates: true
              });
              
              count += result.count;
              console.log(`   ✅ Imported ${count} POIs (${result.count} in this batch)`);
              batch = [];
              
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              console.error(`   ❌ Error inserting POI batch: ${error.message}`);
              console.error(`   First record in batch:`, JSON.stringify(batch[0], null, 2).substring(0, 300));
              skipped += batch.length;
              batch = [];
            }
          }
        } catch (error) {
          skipped++;
          if (skipped % 100 === 0) {
            console.log(`   ⚠️  Skipped ${skipped} POIs due to errors`);
          }
        }
      }
    } catch (error) {
      skipped++;
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    try {
      const result = await prisma.hotelPOI.createMany({
        data: batch,
        skipDuplicates: true
      });
      count += result.count;
      console.log(`   ✅ Inserted final batch: ${result.count} POIs`);
    } catch (error) {
      console.error(`   ❌ Error inserting final POI batch: ${error.message}`);
      skipped += batch.length;
    }
  }

  console.log(`✅ POIs import complete: ${count} POIs imported, ${skipped} skipped`);
  return { count, skipped };
}

/**
 * Import Regions (NDJSON format)
 */
async function importRegions() {
  console.log('\n🌍 === IMPORTING REGIONS ===');
  
  const filePath = path.join(DUMPS_DIR, 'regions.json');
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }

  const fileStream = createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let skipped = 0;
  let batch = [];

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const region = JSON.parse(line);
      const regionId = region.id;
      
      if (!regionId) {
        skipped++;
        continue;
      }

      // Extract name - could be an object with translations or a string
      let name = '';
      if (typeof region.name === 'string') {
        name = region.name;
      } else if (region.name && region.name.en) {
        name = region.name.en;
      } else if (region.country_name) {
        // Fallback to country name if available
        if (typeof region.country_name === 'string') {
          name = region.country_name;
        } else if (region.country_name.en) {
          name = region.country_name.en;
        }
      }

      batch.push({
        id: parseInt(regionId),
        name: name || 'Unknown',
        country_code: region.country_code || '',
        iata: region.iata || null,
        type: region.type || 'Unknown',
        parent_id: region.parent_id ? parseInt(region.parent_id) : null,
        dump_version: '1.0'
      });

      if (batch.length >= BATCH_SIZE) {
        try {
          const result = await prisma.regionData.createMany({
            data: batch,
            skipDuplicates: true
          });
          
          count += result.count;
          console.log(`   ✅ Imported ${count} regions (${result.count} in this batch)`);
          batch = [];
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`   ❌ Error inserting region batch: ${error.message}`);
          console.error(`   First record in batch:`, JSON.stringify(batch[0], null, 2).substring(0, 300));
          skipped += batch.length;
          batch = [];
        }
      }
    } catch (error) {
      skipped++;
      if (skipped % 100 === 0) {
        console.log(`   ⚠️  Skipped ${skipped} invalid lines: ${error.message}`);
      }
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    try {
      const result = await prisma.regionData.createMany({
        data: batch,
        skipDuplicates: true
      });
      count += result.count;
      console.log(`   ✅ Inserted final batch: ${result.count} regions`);
    } catch (error) {
      console.error(`   ❌ Error inserting final region batch: ${error.message}`);
      skipped += batch.length;
    }
  }

  console.log(`✅ Regions import complete: ${count} regions imported, ${skipped} skipped`);
  return { count, skipped };
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  
  try {
    console.log('🚀 === IMPORTING ALL DUMPS TO SUPABASE ===\n');
    console.log('This will import all dumps from the dumps/ directory into Supabase.');
    console.log('Make sure your DATABASE_URL is set correctly in .env\n');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Connected to database\n');

    const results = {
      hotels: { count: 0, skipped: 0 },
      reviews: { count: 0, skipped: 0 },
      pois: { count: 0, skipped: 0 },
      regions: { count: 0, skipped: 0 }
    };

    // Import all dumps
    try {
      results.hotels = await importHotelInfo();
    } catch (error) {
      console.error('❌ Error importing hotels:', error.message);
    }

    try {
      results.reviews = await importReviews();
    } catch (error) {
      console.error('❌ Error importing reviews:', error.message);
    }

    try {
      results.pois = await importPOIs();
    } catch (error) {
      console.error('❌ Error importing POIs:', error.message);
    }

    try {
      results.regions = await importRegions();
    } catch (error) {
      console.error('❌ Error importing regions:', error.message);
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('\n🎉 === IMPORT SUMMARY ===');
    console.log(`⏱️  Total time: ${duration} minutes`);
    console.log(`\n📊 Results:`);
    console.log(`   Hotels:  ${results.hotels.count || 0} imported, ${results.hotels.skipped || 0} skipped`);
    console.log(`   Reviews:  ${results.reviews.count || 0} imported, ${results.reviews.skipped || 0} skipped`);
    console.log(`   POIs:    ${results.pois.count || 0} imported, ${results.pois.skipped || 0} skipped`);
    console.log(`   Regions: ${results.regions.count || 0} imported, ${results.regions.skipped || 0} skipped`);
    console.log('\n✅ All imports complete!');

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

