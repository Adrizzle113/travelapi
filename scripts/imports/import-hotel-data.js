#!/usr/bin/env node

/**
 * Hotel Data Importer
 * Imports hotel info dump into database
 * 
 * Usage: node scripts/imports/import-hotel-data.js
 */

import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import readline from 'readline';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DUMPS_DIR = path.join(process.cwd(), 'dumps');
const BATCH_SIZE = 1000; // Insert 1000 hotels at a time

/**
 * Extract amenity strings from amenity_groups structure
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
 * Extract description from description_struct
 */
function extractDescription(descriptionStruct) {
  if (!descriptionStruct) return '';
  
  const parts = [];
  
  if (Array.isArray(descriptionStruct)) {
    descriptionStruct.forEach(section => {
      if (section.title) {
        parts.push(`**${section.title}**`);
      }
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
 * Insert batch of hotels using upsert
 */
async function insertHotelBatch(batch) {
  const promises = batch.map(hotel =>
    prisma.hotelDumpData.upsert({
      where: { hotel_id: hotel.hotel_id },
      update: hotel,
      create: hotel
    }).catch(error => {
      console.error(`   ⚠️  Failed to insert ${hotel.hotel_id}: ${error.message}`);
      return null;
    })
  );

  const results = await Promise.all(promises);
  const successful = results.filter(r => r !== null).length;
  return successful;
}

/**
 * Import hotels from JSON dump file
 */
async function importHotels(jsonFilePath, dumpVersion) {
  console.log('\n📦 Importing hotels from dump...');
  console.log(`   File: ${jsonFilePath}`);
  console.log(`   Batch size: ${BATCH_SIZE} hotels`);
  
  if (!fs.existsSync(jsonFilePath)) {
    throw new Error(`File not found: ${jsonFilePath}`);
  }
  
  const fileStream = createReadStream(jsonFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let totalCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let batch = [];
  
  const startTime = Date.now();
  let lastLog = Date.now();

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const hotel = JSON.parse(line);
      
      // Prepare hotel data
      const hotelData = {
        hotel_id: hotel.id,
        language: 'en',
        name: hotel.name || null,
        address: hotel.address || null,
        city: hotel.city || null,
        country: hotel.country || null,
        postal_code: hotel.postal_code || null,
        latitude: hotel.latitude || null,
        longitude: hotel.longitude || null,
        star_rating: hotel.star_rating || null,
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
        dump_version: dumpVersion
      };

      batch.push(hotelData);
      totalCount++;

      // Insert batch when full
      if (batch.length >= BATCH_SIZE) {
        const inserted = await insertHotelBatch(batch);
        successCount += inserted;
        errorCount += (batch.length - inserted);
        batch = [];
        
        // Log progress every 5 seconds
        const now = Date.now();
        if (now - lastLog > 5000) {
          const duration = ((now - startTime) / 1000).toFixed(1);
          const rate = (successCount / duration).toFixed(0);
          console.log(`   Progress: ${successCount.toLocaleString()} hotels imported (${rate}/sec, ${errorCount} errors)`);
          lastLog = now;
        }
      }

    } catch (error) {
      errorCount++;
      console.error(`   ⚠️  Error parsing line ${totalCount}: ${error.message}`);
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    const inserted = await insertHotelBatch(batch);
    successCount += inserted;
    errorCount += (batch.length - inserted);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n✅ Import complete!');
  console.log(`   Total processed: ${totalCount.toLocaleString()}`);
  console.log(`   Successfully imported: ${successCount.toLocaleString()}`);
  console.log(`   Errors: ${errorCount.toLocaleString()}`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Rate: ${(successCount / duration).toFixed(0)} hotels/sec`);
  
  return {
    total: totalCount,
    success: successCount,
    errors: errorCount,
    duration: duration
  };
}

/**
 * Update dump metadata
 */
async function updateMetadata(stats, dumpVersion) {
  console.log('\n💾 Updating metadata...');
  
  await prisma.dumpMetadata.upsert({
    where: { dump_type: 'hotel_info' },
    update: {
      last_update: new Date(),
      last_download: new Date(),
      dump_version: dumpVersion,
      record_count: stats.success,
      status: stats.errors > stats.success / 10 ? 'partial' : 'success',
      error_message: stats.errors > 0 ? `${stats.errors} errors during import` : null
    },
    create: {
      dump_type: 'hotel_info',
      last_update: new Date(),
      last_download: new Date(),
      dump_version: dumpVersion,
      record_count: stats.success,
      status: stats.errors > stats.success / 10 ? 'partial' : 'success',
      error_message: stats.errors > 0 ? `${stats.errors} errors during import` : null
    }
  });
  
  console.log('✅ Metadata updated');
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  
  console.log('🚀 HOTEL DATA IMPORTER');
  console.log('='.repeat(70));
  
  try {
    // Find the hotel info dump file
    const dumpFile = path.join(DUMPS_DIR, 'hotel_info_en.json');
    
    if (!fs.existsSync(dumpFile)) {
      throw new Error(`Dump file not found: ${dumpFile}\n\nPlease run: node scripts/dumps/download-all-dumps.js first`);
    }
    
    const fileStats = fs.statSync(dumpFile);
    console.log(`📁 File: ${dumpFile}`);
    console.log(`📊 Size: ${(fileStats.size / 1024 / 1024).toFixed(1)} MB`);
    
    const dumpVersion = new Date().toISOString().split('T')[0];
    
    // Import hotels
    const stats = await importHotels(dumpFile, dumpVersion);
    
    // Update metadata
    await updateMetadata(stats, dumpVersion);
    
    const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ IMPORT COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log(`⏱️  Total time: ${totalDuration} minutes`);
    console.log(`📊 ${stats.success.toLocaleString()} hotels in database`);
    console.log('\n📋 Next steps:');
    console.log('   1. Update your search service to use database enrichment');
    console.log('   2. Test search performance');
    console.log('   3. Deploy to production');
    
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ IMPORT FAILED');
    console.error('='.repeat(70));
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { importHotels };
