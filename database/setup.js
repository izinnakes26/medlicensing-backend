const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function setupDatabase() {
    const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });

    try {
        console.log('📦 Setting up database...');
        
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        await pool.query(schema);
        
        console.log('✅ Database setup complete!');
        console.log('\n📝 Default admin credentials:');
        console.log('   Email: admin@medlicensing.id');
        console.log('   Password: admin123');
        console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
    } finally {
        await pool.end();
    }
}

setupDatabase();