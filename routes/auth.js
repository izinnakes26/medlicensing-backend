const express = require('express');
const router = express.Router();
const db = require('../config/database');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email dan password wajib diisi' 
      });
    }
    
    // Cari user di database
    const result = await db.query(
      'SELECT * FROM admin_users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email atau password salah' 
      });
    }
    
    const user = result.rows[0];
    
    // Verifikasi password (bcrypt)
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email atau password salah' 
      });
    }
    
    // Login berhasil
    res.json({ 
      success: true, 
      message: 'Login berhasil',
      user: {
        id: user.id,
        email: user.email,
        name: user.name || 'Admin'
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;
