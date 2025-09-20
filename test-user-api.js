// Test script for User API endpoints
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

// Test data
const testUser = {
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    phone_number: '+1234567890',
    agency_name: 'Test Travel Agency',
    legal_name: 'Test Travel Agency LLC',
    city: 'New York',
    address: '123 Test Street, New York, NY 10001',
    actual_address_matches: true,
    itn: '123456789'
};

async function testCreateUser() {
    console.log('🧪 Testing POST /api/user/users');

    try {
        const response = await fetch(`${BASE_URL}/api/user/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testUser)
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('✅ User created successfully');
            return data.data[0]; // Return the created user
        } else {
            console.log('❌ User creation failed');
        }
    } catch (error) {
        console.error('💥 Error creating user:', error.message);
    }
}

async function testGetUsers() {
    console.log('\n🧪 Testing GET /api/user/users');

    try {
        const response = await fetch(`${BASE_URL}/api/user/users`);
        const data = await response.json();

        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('✅ Users fetched successfully');
            console.log(`📊 Found ${data.data.length} users`);
        } else {
            console.log('❌ Failed to fetch users');
        }
    } catch (error) {
        console.error('💥 Error fetching users:', error.message);
    }
}

async function testHealthCheck() {
    console.log('\n🧪 Testing GET /api/health');

    try {
        const response = await fetch(`${BASE_URL}/api/health`);
        const data = await response.json();

        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('✅ Health check passed');
        } else {
            console.log('❌ Health check failed');
        }
    } catch (error) {
        console.error('💥 Error in health check:', error.message);
    }
}

async function runTests() {
    console.log('🚀 Starting API Tests...\n');

    // Test health check first
    await testHealthCheck();

    // Test creating a user
    await testCreateUser();

    // Test getting all users
    await testGetUsers();

    console.log('\n🏁 Tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testCreateUser, testGetUsers, testHealthCheck };
