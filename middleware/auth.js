// middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    // 1. Ambil token dari header (format: "Bearer <token>")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // 2. Jika tidak ada token, KIRIM JSON ERROR (JANGAN REDIRECT KE HTML!)
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access denied. No token provided.' 
        });
    }

    // 3. Verifikasi token
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Simpan data user di request
        next(); // Lanjut ke route berikutnya
    } catch (error) {
        // 4. Jika token invalid/expired, KIRIM JSON ERROR (JANGAN REDIRECT!)
        return res.status(403).json({ 
            success: false, 
            message: 'Invalid or expired token.' 
        });
    }
};

module.exports = { authenticateToken };