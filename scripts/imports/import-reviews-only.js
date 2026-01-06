/**
 * Import only reviews to test and debug
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const DUMPS_DIR = './dumps';
const BATCH_SIZE = 100;

async function importReviews() {
  console.log('⭐ === IMPORTING HOTEL REVIEWS ===\n');
  
  const filePath = path.join(DUMPS_DIR, 'hotel_reviews_en.json');
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }

  console.log('   Reading reviews file...');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(fileContent);

  let count = 0;
  let skipped = 0;
  let batch = [];
  let totalProcessed = 0;

  const hotelKeys = Object.keys(data);
  console.log(`   Found ${hotelKeys.length} hotels with reviews\n`);
  
  for (const [hotelId, hotelData] of Object.entries(data)) {
    totalProcessed++;
    
    if (totalProcessed % 1000 === 0) {
      console.log(`   Processing hotel ${totalProcessed}/${hotelKeys.length}...`);
    }
    
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

        const reviewData = {
          hotel_id: hotelId,
          language: 'en',
          reviewer_name: review.author || null,
          rating: review.rating ? parseFloat(review.rating) : 0,
          review_text: reviewText,
          review_date: review.created ? new Date(review.created) : new Date(),
          helpful_count: review.helpful_count || 0,
          dump_version: '1.0'
        };

        batch.push(reviewData);

        if (batch.length >= BATCH_SIZE) {
          try {
            const result = await prisma.hotelReview.createMany({
              data: batch,
              skipDuplicates: true
            });
            
            count += result.count;
            console.log(`   ✅ Imported ${count} reviews (${result.count} new, ${batch.length - result.count} duplicates skipped)`);
            batch = [];
            
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (error) {
            console.error(`   ❌ Error inserting batch: ${error.message}`);
            if (error.code) {
              console.error(`   Error code: ${error.code}`);
            }
            console.error(`   First record sample:`, {
              hotel_id: batch[0].hotel_id,
              rating: batch[0].rating,
              review_text_length: batch[0].review_text?.length,
              review_date: batch[0].review_date
            });
            skipped += batch.length;
            batch = [];
          }
        }
      } catch (error) {
        skipped++;
        if (skipped % 100 === 0) {
          console.log(`   ⚠️  Skipped ${skipped} reviews due to parsing errors`);
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

  console.log(`\n✅ Reviews import complete: ${count} reviews imported, ${skipped} skipped`);
  
  // Verify
  const finalCount = await prisma.hotelReview.count();
  console.log(`📊 Total reviews in database: ${finalCount}`);
  
  return { count, skipped };
}

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to database\n');
    
    await importReviews();
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

