require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const leadsRoutes = require('./routes/leads');
const paymentRoutes = require('./routes/payment');
const dashboardRoutes = require('./routes/dashboard');
const db = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();

// ===== KONFIGURASI STATIC FILES =====
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ===== ROUTES API =====
app.use('/api/auth', authRoutes);           // ← TAMBAH INI!
app.use('/api/leads', leadsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ===== ENDPOINT TEST ENV (BUAT CEK .env) =====
app.get('/api/test-env', (req, res) => {
  res.json({
    MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY ? 'SET ✅' : 'NOT SET ❌',
    MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY ? 'SET ✅' : 'NOT SET ❌',
    MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION || 'false',
    PORT: process.env.PORT || 3000,
    DATABASE_URL: process.env.DATABASE_URL ? 'SET ✅' : 'NOT SET ❌'
  });
});

// ===== ENDPOINT PAST CLIENTS =====
app.get('/api/past-clients', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT nama_dokter, profesi, tahun_pengurusan, jenis_layanan FROM past_clients ORDER BY created_at DESC'
    );
    res.json({ success: true, clients: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error fetching past clients:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== ENDPOINT STATS =====
app.get('/api/stats', async (req, res) => {
  try {
    const totalClients = await db.query('SELECT COUNT(*) FROM past_clients');
    const totalLeads = await db.query('SELECT COUNT(*) FROM leads');
    res.json({
      success: true,
      stats: {
        totalClients: parseInt(totalClients.rows[0].count),
        totalLeads: parseInt(totalLeads.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== PAGE ROUTES =====
app.get('/landing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
