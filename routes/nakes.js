const express = require('express');
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
            params.push(`%${search}%`);
            query += ` AND (nama ILIKE $${params.length} OR nik LIKE $${params.length} OR str_number LIKE $${params.length})`;
        }
        
        if (profesi) {
            params.push(profesi);
            query += ` AND profesi = $${params.length}`;
        }
        
        query += ` ORDER BY last_updated DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
            `INSERT INTO database_nakes 
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
             RETURNING *`,
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

module.exports = router;