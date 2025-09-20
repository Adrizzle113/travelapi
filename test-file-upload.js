// Test script for file upload functionality
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

// Create a test image file (1x1 pixel PNG)
function createTestImage() {
    // This is a minimal 1x1 pixel PNG in base64
    const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    return pngData;
}

async function testCreateUserWithLogo() {
    console.log('🧪 Testing POST /api/user/users with logo upload');

    try {
        // Create form data
        const form = new FormData();

        // Add user data with unique email
        const timestamp = Date.now();
        form.append('email', `test.logo.${timestamp}@example.com`);
        form.append('first_name', 'Test');
        form.append('last_name', 'User');
        form.append('agency_name', 'Test Travel Agency');
        form.append('city', 'New York');

        // Use the real test image file
        if (fs.existsSync('test-image.png')) {
            const testImage = fs.readFileSync('test-image.png');
            form.append('logo', testImage, {
                filename: 'test-logo.png',
                contentType: 'image/png'
            });
            console.log('📁 Using real PNG file, size:', testImage.length, 'bytes');
        } else {
            console.log('⚠️ test-image.png not found, creating minimal PNG...');
            // Fallback to base64 PNG
            const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
            const testImage = Buffer.from(pngBase64, 'base64');
            form.append('logo', testImage, {
                filename: 'test-logo.png',
                contentType: 'image/png'
            });
        }

        const response = await fetch(`${BASE_URL}/api/user/users`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('✅ User with logo created successfully');
            if (data.data && data.data[0] && data.data[0].logo_url) {
                console.log('🖼️ Logo URL:', data.data[0].logo_url);
            }
        } else {
            console.log('❌ User creation with logo failed');
        }
    } catch (error) {
        console.error('💥 Error creating user with logo:', error.message);
    }
}

async function testCreateUserWithInvalidFile() {
    console.log('\n🧪 Testing POST /api/user/users with invalid file type');

    try {
        const form = new FormData();

        // Add user data with unique email
        const timestamp = Date.now();
        form.append('email', `test.invalid.${timestamp}@example.com`);
        form.append('first_name', 'Test');
        form.append('last_name', 'User');
        form.append('agency_name', 'Test Travel Agency');
        form.append('city', 'New York');

        // Add a text file (invalid type)
        form.append('logo', Buffer.from('This is a text file, not an image'), {
            filename: 'test.txt',
            contentType: 'text/plain'
        });

        const response = await fetch(`${BASE_URL}/api/user/users`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.status === 400) {
            console.log('✅ Correctly rejected invalid file type');
        } else {
            console.log('❌ Should have rejected invalid file type');
        }
    } catch (error) {
        console.error('💥 Error testing invalid file:', error.message);
    }
}

async function testCreateUserWithoutLogo() {
    console.log('\n🧪 Testing POST /api/user/users without logo');

    try {
        const response = await fetch(`${BASE_URL}/api/user/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: `test.nologo.${Date.now()}@example.com`,
                first_name: 'Test',
                last_name: 'User',
                agency_name: 'Test Travel Agency',
                city: 'New York'
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('✅ User without logo created successfully');
        } else {
            console.log('❌ User creation without logo failed');
        }
    } catch (error) {
        console.error('💥 Error creating user without logo:', error.message);
    }
}

async function runFileUploadTests() {
    console.log('🚀 Starting File Upload Tests...\n');

    // Test creating user without logo
    await testCreateUserWithoutLogo();

    // Test creating user with valid logo
    await testCreateUserWithLogo();

    // Test creating user with invalid file type
    await testCreateUserWithInvalidFile();

    console.log('\n🏁 File upload tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runFileUploadTests().catch(console.error);
}

module.exports = {
    testCreateUserWithLogo,
    testCreateUserWithInvalidFile,
    testCreateUserWithoutLogo
};
