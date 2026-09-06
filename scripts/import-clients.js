const fs = require('fs');
const path = require('path');
const db = require('../config/database');
require('dotenv').config();

async function importClients() {
  try {
    const csvPath = path.join(__dirname, '..', 'import_clients.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('ERROR: File import_clients.csv tidak ditemukan!');
      console.error('Lokasi yang dicari:', csvPath);
      process.exit(1);
    }
    
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    // Skip header
    const dataLines = lines.slice(1);
    
    console.log(`Importing ${dataLines.length} clients...`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const line of dataLines) {
      const [nama, profesi, str, tahun, layanan] = line.split(',');
      
      if (!nama || !nama.trim()) continue;
      
      try {
        // Cek apakah sudah ada
        const existing = await db.query(
          'SELECT id FROM past_clients WHERE nama_dokter ILIKE $1',
          [nama.trim()]
        );
        
        if (existing.rows.length > 0) {
          console.log(`Skipped (already exists): ${nama}`);
          skipped++;
          continue;
        }
        
        // Insert ke database
        await db.query(
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
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    
    // Hitung total
    const total = await db.query('SELECT COUNT(*) FROM past_clients');
    console.log(`📊 Total clients in database: ${total.rows[0].count}`);
    console.log(`=====================================\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('💀 Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

importClients();