import fs from 'fs';
import readline from 'readline';

async function convertJsonToCsv() {
  console.log('🚀 Converting JSON to CSV for ultra-fast import...\n');
  
  const inputFile = './dumps/hotel_info_en.json';
  const outputFile = './dumps/hotels_import.csv';
  
  const fileStream = fs.createReadStream(inputFile);
  const writeStream = fs.createWriteStream(outputFile);
  
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  writeStream.write('hotel_id\tname\taddress\tcity\tcountry\tpostal_code\tlatitude\tlongitude\tstar_rating\tkind\tcheck_in_time\tcheck_out_time\temail\tphone\traw_data\n');

  let count = 0;
  let skipped = 0;
  const startTime = Date.now();

  for await (const line of rl) {
    if (!line.trim()) continue;
    
    try {
      const hotel = JSON.parse(line);
      const hotelId = hotel.id || hotel.hid;
      
      if (!hotelId) {
        skipped++;
        continue;
      }

      const row = [
        String(hotelId),
        clean(hotel.name?.substring(0, 255) || ''),
        clean(hotel.address?.substring(0, 500) || ''),
        clean(hotel.region?.name?.substring(0, 100) || ''),
        clean(hotel.region?.country_code?.substring(0, 100) || ''),
        clean(hotel.postal_code?.substring(0, 20) || ''),
        parseFloat(hotel.latitude) || 0,
        parseFloat(hotel.longitude) || 0,
        parseInt(hotel.star_rating) || 0,
        clean(hotel.kind?.substring(0, 50) || ''),
        clean(hotel.check_in_time?.substring(0, 20) || ''),
        clean(hotel.check_out_time?.substring(0, 20) || ''),
        clean(hotel.email?.substring(0, 255) || ''),
        clean(hotel.phone?.substring(0, 50) || ''),
        clean(line.substring(0, 10000).replace(/\n/g, ' '))
      ].join('\t');

      writeStream.write(row + '\n');
      count++;

      if (count % 50000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  ✓ Processed ${count.toLocaleString()} hotels (${elapsed}s)`);
      }
    } catch (error) {
      skipped++;
    }
  }

  writeStream.end();
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✅ CSV Created!`);
  console.log(`   Hotels: ${count.toLocaleString()}`);
  console.log(`   Skipped: ${skipped.toLocaleString()}`);
  console.log(`   Time: ${duration} minutes`);
  console.log(`   File: ${outputFile}`);
  
  return outputFile;
}

function clean(value) {
  if (!value) return '';
  return String(value)
    .replace(/\t/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\\/g, '\\\\');
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  🔥 ULTRA-FAST HOTEL IMPORT - CSV CONVERTER');
  console.log('═'.repeat(60));
  console.log();
  
  try {
    await convertJsonToCsv();
    console.log('\n✅ DONE! CSV file created successfully.');
    console.log('\n📋 Next: Import the CSV to Supabase using psql');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
