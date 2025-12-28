/**
 * Test script to verify static_vm preservation in hotel details endpoint
 * This is where static_vm data actually comes from
 */

import { getHotelInformation } from './services/hotel/hotelInfoService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testHotelDetailsStaticVm() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 Testing static_vm Data in Hotel Details');
  console.log('='.repeat(80) + '\n');

  try {
    // Test with a known hotel ID - we'll use one from New York
    const testHotelId = '14040698'; // Example hotel ID
    const language = 'en';

    console.log('📋 Test Parameters:');
    console.log(`   Hotel ID: ${testHotelId}`);
    console.log(`   Language: ${language}\n`);

    // Step 1: First call (fresh API call)
    console.log('🔍 STEP 1: Fresh API Call (cache miss expected)');
    console.log('-'.repeat(80));

    const firstCall = await getHotelInformation(testHotelId, language);

    console.log('\n📊 First Call Results:');
    console.log(`   Hotel Name: ${firstCall.name || 'N/A'}`);
    console.log(`   From Cache: ${firstCall.from_cache || false}`);
    console.log(`   Has static_vm: ${!!firstCall.static_vm}`);

    if (firstCall.static_vm) {
      console.log('\n   ✓ static_vm found in fresh API response');
      console.log(`   - static_vm type: ${typeof firstCall.static_vm}`);
      const vmPreview = JSON.stringify(firstCall.static_vm).substring(0, 150);
      console.log(`   - static_vm preview: ${vmPreview}...`);
    } else {
      console.warn('\n   ⚠️ static_vm NOT found in fresh API response');
    }

    // Wait for cache to be written
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Second call (cached result)
    console.log('\n\n🔍 STEP 2: Cached Result (cache hit expected)');
    console.log('-'.repeat(80));

    const secondCall = await getHotelInformation(testHotelId, language);

    console.log('\n📊 Second Call Results:');
    console.log(`   Hotel Name: ${secondCall.name || 'N/A'}`);
    console.log(`   From Cache: ${secondCall.from_cache || false}`);
    console.log(`   Has static_vm: ${!!secondCall.static_vm}`);

    if (secondCall.static_vm) {
      console.log('\n   ✓ static_vm found in cached response');
      console.log(`   - static_vm type: ${typeof secondCall.static_vm}`);
      const vmPreview = JSON.stringify(secondCall.static_vm).substring(0, 150);
      console.log(`   - static_vm preview: ${vmPreview}...`);
    } else {
      console.warn('\n   ⚠️ static_vm NOT found in cached response (DATA LOSS!)');
    }

    // Step 3: Comparison
    console.log('\n\n🔍 STEP 3: Comparison & Validation');
    console.log('-'.repeat(80));

    const testResults = {
      cacheWorking: secondCall.from_cache === true,
      staticVmInFresh: !!firstCall.static_vm,
      staticVmInCache: !!secondCall.static_vm,
      staticVmPreserved: (!!firstCall.static_vm) === (!!secondCall.static_vm),
      allTestsPassed: false
    };

    console.log('\n✅ Test Results:');
    console.log(`   Cache Hit: ${testResults.cacheWorking ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`   static_vm in Fresh Call: ${testResults.staticVmInFresh ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`   static_vm in Cached Call: ${testResults.staticVmInCache ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`   static_vm Preserved: ${testResults.staticVmPreserved ? '✓ PASS' : '✗ FAIL'}`);

    testResults.allTestsPassed =
      testResults.cacheWorking &&
      testResults.staticVmPreserved;

    // Step 4: Verify cache database
    console.log('\n\n🔍 STEP 4: Cache Database Verification');
    console.log('-'.repeat(80));

    const cachedEntry = await prisma.hotelStaticCache.findUnique({
      where: {
        hotel_id_language: {
          hotel_id: testHotelId,
          language: language
        }
      }
    });

    if (cachedEntry) {
      console.log('\n✓ Cache entry found in database');
      console.log(`   Hotel ID: ${cachedEntry.hotel_id}`);
      console.log(`   Name: ${cachedEntry.name}`);
      console.log(`   Language: ${cachedEntry.language}`);
      console.log(`   Cached At: ${cachedEntry.cached_at}`);
      console.log(`   Expires At: ${cachedEntry.expires_at}`);

      // Check raw_data
      if (cachedEntry.raw_data) {
        const hasStaticVm = !!cachedEntry.raw_data.static_vm;
        console.log(`\n   Raw Data Analysis:`);
        console.log(`   - Has static_vm: ${hasStaticVm}`);

        if (hasStaticVm) {
          console.log(`   - static_vm type: ${typeof cachedEntry.raw_data.static_vm}`);
          const vmKeys = Object.keys(cachedEntry.raw_data.static_vm || {});
          console.log(`   - static_vm keys: ${vmKeys.slice(0, 5).join(', ')}${vmKeys.length > 5 ? '...' : ''}`);
        } else {
          console.warn(`   ⚠️ raw_data exists but static_vm is missing`);
          testResults.allTestsPassed = false;
        }
      } else {
        console.warn(`   ⚠️ raw_data is missing from cache`);
        testResults.allTestsPassed = false;
      }
    } else {
      console.log('\n✗ Cache entry NOT found in database');
      testResults.allTestsPassed = false;
    }

    // Final summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 FINAL SUMMARY');
    console.log('='.repeat(80));

    if (testResults.allTestsPassed) {
      console.log('\n✅ ALL TESTS PASSED!');
      console.log('\n✓ Cache is working correctly');
      console.log('✓ static_vm data is preserved in cache');
      console.log('✓ Hotel details integrity maintained');
    } else {
      console.log('\n❌ SOME TESTS FAILED');
      console.log('\nFailed checks:');
      if (!testResults.cacheWorking) {
        console.log('✗ Cache not returning cached results');
      }
      if (testResults.staticVmInFresh && !testResults.staticVmInCache) {
        console.log('✗ static_vm data lost in cache (critical issue)');
      }
      if (!testResults.staticVmInFresh) {
        console.log('ℹ️ ETG API did not return static_vm (may be API limitation)');
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');

    return testResults.allTestsPassed ? 0 : 1;

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\nError details:');
    console.error(`   Message: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
    }
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testHotelDetailsStaticVm()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
