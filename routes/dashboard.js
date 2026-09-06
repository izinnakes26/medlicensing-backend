const express = require('express');
const router = express.Router();
const db = require('../config/database');
// Pastikan middleware auth lo return JSON, bukan redirect ke HTML!
const { authenticateToken } = require('../middleware/auth'); 

// Dashboard Stats
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const totalLeads = await db.query('SELECT COUNT(*) FROM leads');
        const leadsByStatus = await db.query(
            `SELECT status, COUNT(*) as count FROM leads GROUP BY status`
        );
        
        // Pakai COALESCE biar gak null kalau tabel kosong
        const totalNakes = await db.query('SELECT COALESCE(COUNT(*), 0) as count FROM database_nakes');
        
        const monthlyRevenue = await db.query(
            `SELECT 
                EXTRACT(MONTH FROM created_at) as month,
                EXTRACT(YEAR FROM created_at) as year,
                COUNT(*) as total_leads,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN 750000 ELSE 0 END), 0) as revenue
             FROM leads
             WHERE created_at >= NOW() - INTERVAL '12 months'
             GROUP BY month, year
             ORDER BY year DESC, month DESC`
        );
        
        const expiringSIP = await db.query(
            `SELECT COALESCE(COUNT(*), 0) as count FROM database_nakes 
             WHERE sip_expiry_date <= NOW() + INTERVAL '30 days'
             AND sip_expiry_date >= NOW()`
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
        console.error('Dashboard Stats Error:', error.message);
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
            `SELECT 
                TO_CHAR(created_at, 'YYYY-MM-DD') as date,
                COUNT(*) as count
             FROM leads
             WHERE created_at >= NOW() - INTERVAL '30 days'
             GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
             ORDER BY date ASC`
        );
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Chart Data Error:', error.message);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;