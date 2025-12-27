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

function getDateString(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split('T')[0];
}

async function testDateValidation() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 COMPREHENSIVE DATE VALIDATION TEST SUITE');
  console.log('='.repeat(60) + '\n');

  const tests = [
    {
      name: 'Valid dates (today + 7 days to today + 10 days)',
      payload: {
        region_id: 6218,
        checkin: getDateString(7),
        checkout: getDateString(10),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: true
    },
    {
      name: 'Missing checkin date',
      payload: {
        region_id: 6218,
        checkout: getDateString(10),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'MISSING_CHECKIN'
    },
    {
      name: 'Missing checkout date',
      payload: {
        region_id: 6218,
        checkin: getDateString(7),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'MISSING_CHECKOUT'
    },
    {
      name: 'Invalid checkin format (wrong format)',
      payload: {
        region_id: 6218,
        checkin: '2024/01/15',
        checkout: getDateString(10),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'INVALID_CHECKIN_FORMAT'
    },
    {
      name: 'Invalid checkout format (wrong format)',
      payload: {
        region_id: 6218,
        checkin: getDateString(7),
        checkout: '15-01-2024',
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'INVALID_CHECKOUT_FORMAT'
    },
    {
      name: 'Invalid checkin date (date does not exist)',
      payload: {
        region_id: 6218,
        checkin: '2024-02-30',
        checkout: getDateString(10),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'INVALID_CHECKIN_DATE'
    },
    {
      name: 'Invalid checkout date (date does not exist)',
      payload: {
        region_id: 6218,
        checkin: getDateString(7),
        checkout: '2024-13-01',
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'INVALID_CHECKOUT_DATE'
    },
    {
      name: 'Checkin date in the past',
      payload: {
        region_id: 6218,
        checkin: getDateString(-5),
        checkout: getDateString(10),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'CHECKIN_IN_PAST'
    },
    {
      name: 'Checkout before checkin',
      payload: {
        region_id: 6218,
        checkin: getDateString(10),
        checkout: getDateString(7),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'INVALID_DATE_RANGE'
    },
    {
      name: 'Checkout same as checkin',
      payload: {
        region_id: 6218,
        checkin: getDateString(7),
        checkout: getDateString(7),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'INVALID_DATE_RANGE'
    },
    {
      name: 'Stay duration too long (>30 nights)',
      payload: {
        region_id: 6218,
        checkin: getDateString(7),
        checkout: getDateString(40),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: false,
      expectedError: 'STAY_TOO_LONG'
    },
    {
      name: 'Exactly 30 nights (boundary test)',
      payload: {
        region_id: 6218,
        checkin: getDateString(7),
        checkout: getDateString(37),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: true
    },
    {
      name: 'One night stay (minimum)',
      payload: {
        region_id: 6218,
        checkin: getDateString(7),
        checkout: getDateString(8),
        guests: [{ adults: 2, children: [] }]
      },
      expectSuccess: true
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(colors.blue + '\n📋 Test: ' + colors.reset + test.name);
      console.log('   Payload:', JSON.stringify(test.payload, null, 2).split('\n').join('\n   '));

      const response = await axios.post(`${BASE_URL}/ratehawk/search`, test.payload);

      if (test.expectSuccess) {
        log(colors.green, '✓', 'PASSED - Request succeeded as expected');
        console.log('   Status:', response.status);
        passed++;
      } else {
        log(colors.red, '✗', 'FAILED - Expected error but request succeeded');
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

testDateValidation();
