// Create a simple test PNG image
const fs = require('fs');

// This is a minimal 1x1 pixel PNG in base64
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Convert to buffer and save
const pngBuffer = Buffer.from(pngBase64, 'base64');
fs.writeFileSync('test-image.png', pngBuffer);

console.log('✅ Test image created: test-image.png');
console.log('File size:', pngBuffer.length, 'bytes');
console.log('First 8 bytes (PNG signature):', Array.from(pngBuffer.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

