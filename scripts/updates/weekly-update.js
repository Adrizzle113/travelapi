#!/usr/bin/env node

/**
 * Weekly Dump Update Script
 * Downloads and imports fresh RateHawk dumps
 * 
 * Usage: node scripts/updates/weekly-update.js
 * Schedule: Run every Sunday at 2 AM
 */

import { downloadHotelInfo, downloadHotelReviews, downloadPOI } from '../dumps/download-all-dumps.js';
import { importHotels } from '../imports/import-hotel-data.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function weeklyUpdate() {
  const startTime = Date.now();
  
  console.log('🔄 WEEKLY DUMP UPDATE');
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');
  
  try {
    // 1. Download latest dumps
    console.log('📥 Step 1: Downloading latest dumps...\n');
    
    const hotelDump = await downloadHotelInfo('en');
    console.log(`✅ Hotel dump downloaded: ${hotelDump.path}`);
    
    // Optional: Download reviews and POIs
    // const reviewsDump = await downloadHotelReviews('en');
    // const poiDump = await downloadPOI('en');
    
    // 2. Import into database
    console.log('\n💾 Step 2: Importing into database...\n');
    
    const dumpVersion = new Date().toISOString().split('T')[0];
    const stats = await importHotels(hotelDump.path, dumpVersion);
    
    // 3. Update metadata
    await prisma.dumpMetadata.upsert({
      where: { dump_type: 'hotel_info' },
      update: {
        last_update: new Date(),
        dump_version: dumpVersion,
        record_count: stats.success,
        status: 'success'
      },
      create: {
        dump_type: 'hotel_info',
        last_update: new Date(),
        last_download: new Date(),
        dump_version: dumpVersion,
        record_count: stats.success,
        status: 'success'
      }
    });
    
    const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ WEEKLY UPDATE COMPLETED');
    console.log('='.repeat(70));
    console.log(`Duration: ${totalDuration} minutes`);
    console.log(`Hotels updated: ${stats.success.toLocaleString()}`);
    console.log(`Completed: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ WEEKLY UPDATE FAILED');
    console.error('='.repeat(70));
    console.error(`Error: ${error.message}`);
    
    // Log failure to metadata
    await prisma.dumpMetadata.upsert({
      where: { dump_type: 'hotel_info' },
      update: {
        status: 'failed',
        error_message: error.message
      },
      create: {
        dump_type: 'hotel_info',
        last_update: new Date(),
        last_download: new Date(),
        dump_version: 'failed',
        record_count: 0,
        status: 'failed',
        error_message: error.message
      }
    });
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

weeklyUpdate();
