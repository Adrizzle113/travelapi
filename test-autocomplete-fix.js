import { searchDestinations } from './services/destination/autocompleteService.js';

console.log('🧪 Testing autocomplete service...\n');

async function testAutocomplete() {
  try {
    console.log('Test 1: Searching for "paris"...');
    const result1 = await searchDestinations('paris', 'en', 10);
    console.log(`✅ Result: ${result1.total} destinations found`);
    console.log(`   From cache: ${result1.from_cache}`);
    console.log(`   Duration: ${result1.duration_ms}ms`);

    if (result1.results.length > 0) {
      console.log(`   Sample result:`, result1.results[0]);
    } else {
      console.warn('⚠️ No results returned!');
    }

    console.log('\nTest 2: Searching for "paris" again (should be cached)...');
    const result2 = await searchDestinations('paris', 'en', 10);
    console.log(`✅ Result: ${result2.total} destinations found`);
    console.log(`   From cache: ${result2.from_cache}`);
    console.log(`   Duration: ${result2.duration_ms}ms`);

    console.log('\nTest 3: Searching for "los angeles"...');
    const result3 = await searchDestinations('los angeles', 'en', 10);
    console.log(`✅ Result: ${result3.total} destinations found`);
    console.log(`   From cache: ${result3.from_cache}`);
    console.log(`   Duration: ${result3.duration_ms}ms`);

    if (result3.results.length > 0) {
      console.log(`   Sample result:`, result3.results[0]);
    } else {
      console.warn('⚠️ No results returned!');
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testAutocomplete();
