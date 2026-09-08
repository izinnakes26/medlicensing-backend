const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function importClients() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database!');
    
    const csvPath = path.join(__dirname, '..', 'import_clients.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('ERROR: File import_clients.csv tidak ditemukan!');
      process.exit(1);
    }
    
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1);
    
    console.log(`Importing ${dataLines.length} clients...`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const line of dataLines) {
      const [nama, profesi, str, tahun, layanan] = line.split(',');
      
      if (!nama || !nama.trim()) continue;
      
      try {
        const existing = await client.query(
          'SELECT id FROM past_clients WHERE nama_dokter ILIKE $1',
          [nama.trim()]
        );
        
        if (existing.rows.length > 0) {
          console.log(`Skipped (already exists): ${nama}`);
          skipped++;
          continue;
        }
        
        await client.query(
          `INSERT INTO past_clients (nama_dokter, profesi, str_number, tahun_pengurusan, jenis_layanan, status)
           VALUES ($1, $2, $3, $4, $5, 'completed')`,
          [
            nama.trim(), 
            profesi?.trim() || 'dokter', 
            str?.trim() || null, 
            tahun?.trim() || '2024', 
            layanan?.trim() || 'SIP'
          ]
        );
        
        imported++;
        console.log(`✅ Imported: ${nama}`);
      } catch (error) {
        errors++;
        console.error(`❌ Error importing ${nama}:`, error.message);
      }
    }
    
    console.log(`\n========== IMPORT SELESAI ==========`);
    console.log(`✅ Imported: ${imported}`);
    console.log(`️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    
    const total = await client.query('SELECT COUNT(*) FROM past_clients');
    console.log(` Total clients in database: ${total.rows[0].count}`);
    console.log(`=====================================\n`);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('💀 Fatal error:', error.message);
    await client.end();
    process.exit(1);
  }
}

importClients();
