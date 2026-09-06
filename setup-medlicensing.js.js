const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up MedLicensing Backend...\n');

// ============ FOLDER STRUCTURE ============
const folders = [
    'config',
    'routes',
    'middleware',
    'uploads',
    'database'
];

// ============ FILES CONTENT ============
const files = {
    // Main Entry Point
    'server.js': `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/nakes', require('./routes/nakes'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'MedLicensing API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!',
        error: err.message 
    });
});

app.listen(PORT, () => {
    console.log(\`🚀 Server running on port \${PORT}\`);
});`,

    // Environment Variables
    '.env': `PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medlicensing
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=your-super-secret-key-change-this-in-production
WHATSAPP_API_KEY=your-fonnte-api-key
GOOGLE_SHEET_ID=your-google-sheet-id`,

    // Database Config
    'config/database.js': `const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Database error:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};`,

    // Auth Middleware
    'middleware/auth.js': `const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access token required' 
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }
        
        req.user = user;
        next();
    });
};

module.exports = { authenticateToken };`,

    // Auth Routes
    'routes/auth.js': `const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Login Admin
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await db.query(
            'SELECT * FROM admin_users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Register Admin
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const result = await db.query(
            \`INSERT INTO admin_users (email, password, name, role) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, email, name, role\`,
            [email, hashedPassword, name, role || 'admin']
        );
        
        res.status(201).json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;`,

    // Leads Routes
    'routes/leads.js': `const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Submit Lead
router.post('/', async (req, res) => {
    try {
        const { nama, nik, str, profesi, whatsapp } = req.body;
        
        const nakesCheck = await db.query(
            \`SELECT * FROM database_nakes 
             WHERE nik = $1 OR str_number = $2\`,
            [nik, str]
        );
        
        let eligible = false;
        let expiryDate = null;
        let daysUntilExpiry = null;
        
        if (nakesCheck.rows.length > 0) {
            const record = nakesCheck.rows[0];
            const today = new Date();
            const expiry = new Date(record.sip_expiry_date);
            daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            eligible = daysUntilExpiry > 30;
            expiryDate = record.sip_expiry_date;
        }
        
        const leadResult = await db.query(
            \`INSERT INTO leads (nama, nik, str_number, profesi, whatsapp, status, eligible, expiry_date) 
             VALUES ($1, $2, $3, $4, $5, 'new', $6, $7) 
             RETURNING *\`,
            [nama, nik, str, profesi, whatsapp, eligible, expiryDate]
        );
        
        res.json({
            success: true,
            lead: leadResult.rows[0],
            eligible,
            expiryDate,
            daysUntilExpiry
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get All Leads
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, profesi, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT * FROM leads WHERE 1=1';
        const params = [];
        
        if (status) {
            params.push(status);
            query += \` AND status = $\${params.length}\`;
        }
        
        if (profesi) {
            params.push(profesi);
            query += \` AND profesi = $\${params.length}\`;
        }
        
        query += \` ORDER BY created_at DESC LIMIT $\${params.length + 1} OFFSET $\${params.length + 2}\`;
        params.push(limit, offset);
        
        const result = await db.query(query, params);
        const countResult = await db.query('SELECT COUNT(*) FROM leads');
        
        res.json({
            success: true,
            leads: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(countResult.rows[0].count / limit)
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Update Lead Status
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        const result = await db.query(
            \`UPDATE leads 
             SET status = $1, notes = $2, updated_at = NOW() 
             WHERE id = $3 
             RETURNING *\`,
            [status, notes, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Lead not found' 
            });
        }
        
        res.json({
            success: true,
            lead: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;`,

    // Nakes Routes
    'routes/nakes.js': `const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get All Nakes
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { search, profesi, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT * FROM database_nakes WHERE 1=1';
        const params = [];
        
        if (search) {
            params.push(\`%\${search}%\`);
            query += \` AND (nama ILIKE $\${params.length} OR nik LIKE $\${params.length} OR str_number LIKE $\${params.length})\`;
        }
        
        if (profesi) {
            params.push(profesi);
            query += \` AND profesi = $\${params.length}\`;
        }
        
        query += \` ORDER BY last_updated DESC LIMIT $\${params.length + 1} OFFSET $\${params.length + 2}\`;
        params.push(limit, offset);
        
        const result = await db.query(query, params);
        const countResult = await db.query('SELECT COUNT(*) FROM database_nakes');
        
        res.json({
            success: true,
            nakes: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(countResult.rows[0].count / limit)
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get Nakes by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            'SELECT * FROM database_nakes WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Nakes not found' 
            });
        }
        
        res.json({
            success: true,
            nakes: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Add/Update Nakes
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { 
            nik, nama, profesi, str_number, str_expiry_date, 
            sip_number, sip_expiry_date, tempat_praktik 
        } = req.body;
        
        const result = await db.query(
            \`INSERT INTO database_nakes 
             (nik, nama, profesi, str_number, str_expiry_date, sip_number, sip_expiry_date, tempat_praktik) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (nik) DO UPDATE SET
                nama = EXCLUDED.nama,
                profesi = EXCLUDED.profesi,
                str_number = EXCLUDED.str_number,
                str_expiry_date = EXCLUDED.str_expiry_date,
                sip_number = EXCLUDED.sip_number,
                sip_expiry_date = EXCLUDED.sip_expiry_date,
                tempat_praktik = EXCLUDED.tempat_praktik,
                last_updated = NOW()
             RETURNING *\`,
            [nik, nama, profesi, str_number, str_expiry_date, sip_number, sip_expiry_date, JSON.stringify(tempat_praktik)]
        );
        
        res.json({
            success: true,
            nakes: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;`,

    // Dashboard Routes
    'routes/dashboard.js': `const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Dashboard Stats
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const totalLeads = await db.query('SELECT COUNT(*) FROM leads');
        const leadsByStatus = await db.query(
            \`SELECT status, COUNT(*) as count 
             FROM leads 
             GROUP BY status\`
        );
        const totalNakes = await db.query('SELECT COUNT(*) FROM database_nakes');
        const monthlyRevenue = await db.query(
            \`SELECT 
                EXTRACT(MONTH FROM created_at) as month,
                EXTRACT(YEAR FROM created_at) as year,
                COUNT(*) as total_leads,
                SUM(CASE WHEN status = 'paid' THEN 750000 ELSE 0 END) as revenue
             FROM leads
             WHERE created_at >= NOW() - INTERVAL '12 months'
             GROUP BY month, year
             ORDER BY year DESC, month DESC\`
        );
        const expiringSIP = await db.query(
            \`SELECT COUNT(*) FROM database_nakes 
             WHERE sip_expiry_date <= NOW() + INTERVAL '30 days'
             AND sip_expiry_date >= NOW()\`
        );
        
        res.json({
            success: true,
            stats: {
                totalLeads: parseInt(totalLeads.rows[0].count),
                totalNakes: parseInt(totalNakes.rows[0].count),
                leadsByStatus: leadsByStatus.rows,
                monthlyRevenue: monthlyRevenue.rows,
                expiringSIP: parseInt(expiringSIP.rows[0].count)
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Chart Data
router.get('/chart/leads-trend', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            \`SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
             FROM leads
             WHERE created_at >= NOW() - INTERVAL '30 days'
             GROUP BY DATE(created_at)
             ORDER BY date ASC\`
        );
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;`,

    // Package.json
    'package.json': `{
  "name": "medlicensing-backend",
  "version": "1.0.0",
  "description": "MedLicensing Backend API - Healthcare Licensing Management System",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "setup-db": "node database/setup.js"
  },
  "keywords": ["healthcare", "licensing", "sip", "str", "crm"],
  "author": "MedLicensing Team",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}`,

    // Database Schema
    'database/schema.sql': `-- MedLicensing Database Schema

-- Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Leads (CRM)
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    nik VARCHAR(16) NOT NULL,
    str_number VARCHAR(50),
    profesi VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'new',
    eligible BOOLEAN,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Database Nakes Nasional
CREATE TABLE IF NOT EXISTS database_nakes (
    id SERIAL PRIMARY KEY,
    nik VARCHAR(16) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    profesi VARCHAR(50) NOT NULL,
    str_number VARCHAR(50),
    str_expiry_date DATE,
    sip_number VARCHAR(50),
    sip_expiry_date DATE,
    tempat_praktik JSONB,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_profesi ON leads(profesi);
CREATE INDEX IF NOT EXISTS idx_nakes_nik ON database_nakes(nik);
CREATE INDEX IF NOT EXISTS idx_nakes_sip_expiry ON database_nakes(sip_expiry_date);

-- Insert default admin (password: admin123)
INSERT INTO admin_users (email, password, name, role) 
VALUES (
    'admin@medlicensing.id', 
    '$2a$10$rKvXeQZJxZJxZJxZJxZJxOqZJxZJxZJxZJxZJxZJxZJxZJxZJxZ.', 
    'Super Admin', 
    'superadmin'
) ON CONFLICT (email) DO NOTHING;`,

    // Database Setup Script
    'database/setup.js': `const fs = require('fs');
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
        console.log('\\n📝 Default admin credentials:');
        console.log('   Email: admin@medlicensing.id');
        console.log('   Password: admin123');
        console.log('\\n⚠️  IMPORTANT: Change the default password after first login!');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
    } finally {
        await pool.end();
    }
}

setupDatabase();`,

    // Gitignore
    '.gitignore': `node_modules/
.env
uploads/
*.log
.DS_Store`,

    // README
    'README.md': `# MedLicensing Backend API

Healthcare Licensing Management System - Backend API

## 🚀 Quick Start

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Setup PostgreSQL database
# Create database first:
# createdb medlicensing

# 3. Update .env file with your database credentials

# 4. Run database setup
npm run setup-db

# 5. Start server
npm run dev
\`\`\`

## 📝 Default Admin Credentials

- Email: admin@medlicensing.id
- Password: admin123

**⚠️ Change password after first login!**

## 🔌 API Endpoints

### Auth
- POST /api/auth/login
- POST /api/auth/register

### Leads
- POST /api/leads (submit lead)
- GET /api/leads (get all leads)
- PUT /api/leads/:id (update lead)

### Nakes
- GET /api/nakes (get all nakes)
- GET /api/nakes/:id (get nakes by id)
- POST /api/nakes (add/update nakes)

### Dashboard
- GET /api/dashboard/stats
- GET /api/dashboard/chart/leads-trend

## 🛠️ Tech Stack

- Node.js + Express
- PostgreSQL
- JWT Authentication
- bcryptjs

## 📄 License

MIT
`
};

// ============ SETUP PROCESS ============

// Create folders
folders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log(`✅ Created folder: ${folder}`);
    }
});

// Create files
Object.entries(files).forEach(([filename, content]) => {
    if (!fs.existsSync(filename)) {
        fs.writeFileSync(filename, content);
        console.log(`✅ Created file: ${filename}`);
    } else {
        console.log(`⚠️  File already exists: ${filename}`);
    }
});

console.log('\n🎉 Project setup complete!');
console.log('\n📋 Next steps:');
console.log('1. npm install');
console.log('2. Create PostgreSQL database: createdb medlicensing');
console.log('3. Update .env with your database credentials');
console.log('4. npm run setup-db');
console.log('5. npm run dev');
console.log('\n🔐 Default admin:');
console.log('   Email: admin@medlicensing.id');
console.log('   Password: admin123');
console.log('\n🚀 Happy coding!');