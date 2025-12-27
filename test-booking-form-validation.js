import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function testBookingFormValidation() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 BOOKING FORM VALIDATION TEST SUITE');
  console.log('='.repeat(60) + '\n');

  const validHotelData = {
    hotel_id: 'test-hotel-123',
    name: 'Test Hotel',
    address: '123 Test St'
  };

  const tests = [
    {
      name: 'Valid booking form request',
      payload: {
        book_hashs: ['hash1', 'hash2'],
        hotelData: validHotelData
      },
      expectSuccess: true
    },
    {
      name: 'Missing book_hashs',
      payload: {
        hotelData: validHotelData
      },
      expectSuccess: false,
      expectedError: 'MISSING_BOOK_HASHS'
    },
    {
      name: 'Empty book_hashs array',
      payload: {
        book_hashs: [],
        hotelData: validHotelData
      },
      expectSuccess: false,
      expectedError: 'MISSING_BOOK_HASHS'
    },
    {
      name: 'Missing hotelData',
      payload: {
        book_hashs: ['hash1', 'hash2']
      },
      expectSuccess: false,
      expectedError: 'MISSING_HOTEL_DATA'
    },
    {
      name: 'Both book_hashs and hotelData missing',
      payload: {},
      expectSuccess: false,
      expectedError: 'MISSING_BOOK_HASHS'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(colors.blue + '\n📋 Test: ' + colors.reset + test.name);
      console.log('   Payload:', JSON.stringify(test.payload, null, 2).split('\n').join('\n   '));

      const response = await axios.post(`${BASE_URL}/booking-form/create-booking-form`, test.payload);

      if (test.expectSuccess) {
        log(colors.green, '✓', 'PASSED - Request succeeded as expected');
        console.log('   Status:', response.status);
        passed++;
      } else {
        log(colors.red, '✗', 'FAILED - Expected error but request succeeded');
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        failed++;
      }
    } catch (error) {
      if (!test.expectSuccess) {
        const errorCode = error.response?.data?.code;
        if (errorCode === test.expectedError) {
          log(colors.green, '✓', 'PASSED - Got expected error: ' + errorCode);
          console.log('   Error message:', error.response.data.message);
          passed++;
        } else {
          log(colors.red, '✗', `FAILED - Expected error ${test.expectedError}, got ${errorCode}`);
          console.log('   Response:', JSON.stringify(error.response?.data, null, 2));
          failed++;
        }
      } else {
        log(colors.red, '✗', 'FAILED - Request failed unexpectedly');
        console.log('   Error:', error.response?.data || error.message);
        failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  log(colors.green, '✓', `Passed: ${passed}/${tests.length}`);
  log(colors.red, '✗', `Failed: ${failed}/${tests.length}`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

testBookingFormValidation();
