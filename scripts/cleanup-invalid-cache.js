import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupInvalidCache() {
  console.log('🧹 Starting cache cleanup...\n');

  try {
    console.log('1. Cleaning up destination_cache table...');
    const destinationResult = await prisma.destinationCache.deleteMany({
      where: {
        OR: [
          {
            AND: [
              { destination_name: { contains: 'Los Angeles', mode: 'insensitive' } },
              { region_id: 1555 }
            ]
          },
          {
            AND: [
              { destination_name: { contains: 'Las Vegas', mode: 'insensitive' } },
              { region_id: 2007 }
            ]
          }
        ]
      }
    });
    console.log(`   ✅ Removed ${destinationResult.count} invalid destination cache entries`);

    console.log('\n2. Cleaning up search_cache table...');
    const searchResult = await prisma.searchCache.deleteMany({
      where: {
        OR: [
          { region_id: 1555 },
          { region_id: 2007 }
        ]
      }
    });
    console.log(`   ✅ Removed ${searchResult.count} search cache entries (will be regenerated with correct region_ids)`);

    console.log('\n3. Verifying cleanup...');
    const remainingInvalid = await prisma.destinationCache.count({
      where: {
        AND: [
          { destination_name: { contains: 'Los Angeles', mode: 'insensitive' } },
          { region_id: 1555 }
        ]
      }
    });

    if (remainingInvalid === 0) {
      console.log('   ✅ All invalid entries cleaned up successfully');
    } else {
      console.warn(`   ⚠️ Warning: ${remainingInvalid} invalid entries still remain`);
    }

    console.log('\n📊 Summary:');
    console.log(`   - Destination cache entries removed: ${destinationResult.count}`);
    console.log(`   - Search cache entries removed: ${searchResult.count}`);
    console.log(`   - Total entries cleaned: ${destinationResult.count + searchResult.count}`);
    console.log('\n✅ Cache cleanup complete!');
    console.log('\nℹ️  Note: New searches will now use the correct region_ids:');
    console.log('   - Los Angeles: 2007 (corrected from 1555)');
    console.log('   - Las Vegas: 1555 (corrected from 2007)');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupInvalidCache()
  .then(() => {
    console.log('\n🎉 Cleanup script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup script failed:', error);
    process.exit(1);
  });
