const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function fixAdminPassword() {
    try {
        console.log('🔧 Memulai reset password admin...');
        
        // Hash password baru
        const newPassword = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update di database
        const result = await db.query(
            "UPDATE admin_users SET password = $1 WHERE email = 'admin@medlicensing.id'",
            [hashedPassword]
        );
        
        if (result.rowCount > 0) {
            console.log('✅ BERHASIL! Password admin sudah direset.');
            console.log('📝 Email: admin@medlicensing.id');
            console.log(' Password: admin123');
        } else {
            console.log('⚠️ User admin tidak ditemukan. Pastikan setup-db sudah dijalankan.');
        }
        
        process.exit();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixAdminPassword();