const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ===== FONNTE WHATSAPP GATEWAY =====
async function sendFonnte(target, message) {
  console.log('\n========== FONNTE DEBUG START ==========');
  try {
    // Hardcode token untuk testing (bypass .env)
    const token = 'P9PxjGvUyjaafVaJbqTt'; 
    
    let phone = target.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    
    const url = 'https://api.fonnte.com/send';
    const bodyData = { target: phone, message: message, countryCode: '62' };
    
    console.log('Sending to:', phone);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': token ? token.trim() : '',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(bodyData)
    });
    
    const data = await response.json();
    console.log('Fonnte Response:', data);
    console.log('========== FONNTE DEBUG END ==========\n');
    
    return data;
  } catch (error) {
    console.error('Fonnte Error:', error.message);
    console.log('========== FONNTE DEBUG END ==========\n');
    return { status: false, message: error.message, reason: error.message };
  }
}

// 1. GET semua leads
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM leads ORDER BY created_at DESC');
    res.json({ success: true, leads: result.rows });
  } catch (error) {
    console.error('Error fetching leads:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. POST tambah lead baru (DARI LANDING PAGE - TANPA UPLOAD FILE)
router.post('/', async (req, res) => {
  try {
    // TAMBAH 'layanan' di destructuring
    const { nama, nik, str, profesi, layanan, whatsapp, urgency } = req.body;

    // Validasi (layanan dibuat opsional, ada default-nya)
    if (!nama || !nik || !str || !profesi || !whatsapp || !urgency) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }

    // Cek apakah klien lama (auto-verify)
    const pastClientResult = await db.query(
    'SELECT * FROM past_clients WHERE nama_dokter ILIKE $1 OR str ILIKE $2',
    [`%${nama}%`, str]
    );

    let eligible = false;
    let status = 'pending';
    let message = 'Data Anda sedang diverifikasi. Tim kami akan menghubungi Anda dalam 1x24 jam.';
    let skpStatus = 'unknown';
    let skpNotes = 'Perlu verifikasi manual';
    let skpPoints = null;
    let requiresSkp = false;
    let expiryDate = null;
    let daysUntilExpiry = null;

    if (pastClientResult.rows.length > 0) {
      const pastClient = pastClientResult.rows[0];
      console.log(`Klien lama terdeteksi: ${nama}`);
      
      eligible = true;
      status = 'verified';
      message = `Selamat ${nama}! Anda adalah klien kami sebelumnya. Data Anda sudah terverifikasi.`;
      skpStatus = 'sufficient';
      skpNotes = 'Klien lama - sudah terverifikasi';
      requiresSkp = false;
    }

    // Default layanan jika user tidak memilih (fallback aman)
    const jenisLayanan = layanan || 'Pembuatan SIP Baru / Perpanjang SIP';

    // Simpan ke database (TAMBAH 'jenis_layanan' di kolom dan VALUES)
    const result = await db.query(
      `INSERT INTO leads (nama, nik, str, profesi, jenis_layanan, whatsapp, urgency, status, skp_status, skp_notes, requires_skp, follow_up_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)
       RETURNING *`,
      [nama, nik, str, profesi, jenisLayanan, whatsapp, urgency, status, skpStatus, skpNotes, requiresSkp]
    );

    // AUTO-REPLY WA
    const autoReplyMsg = `Halo ${nama} 👋\n\nTerima kasih sudah menghubungi MedLicensing.id!\n\nKami sudah menerima data Anda:\n• Nama: ${nama}\n• Profesi: ${profesi}\n• No. STR: ${str}\n\nTim verifikasi kami sedang mengecek data Anda. Kami akan menghubungi Anda dalam 1x24 jam.\n\nSalam,\nTim MedLicensing.id`;
    
    // Pastikan fungsi sendFonnte sudah di-require di bagian atas file ini
    if (typeof sendFonnte === 'function') {
      sendFonnte(whatsapp, autoReplyMsg).catch(err => console.error('Auto-reply failed:', err));
    }

    res.json({
      success: true,
      eligible,
      message,
      expiryDate,
      daysUntilExpiry,
      skpStatus,
      skpNotes,
      skpPoints,
      requiresSkp,
      lead: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving lead:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. UPDATE status lead
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const result = await db.query(
      `UPDATE leads SET status = $1, notes = $2, last_follow_up = NOW(), follow_up_count = follow_up_count + 1 
       WHERE id = $3 RETURNING *`,
      [status, notes || null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead tidak ditemukan' });
    }
    
    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Error updating lead:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. DELETE lead
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM leads WHERE id = $1', [id]);
    res.json({ success: true, message: 'Lead berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting lead:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. ✅ ENDPOINT KIRIM WA DARI DASHBOARD (YANG TADI HILANG!)
router.post('/:id/send-wa', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    console.log(`\n[SEND WA] Request untuk Lead ID: ${id}`);

    if (!message) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    }

    // Ambil data lead
    const leadResult = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead tidak ditemukan' });
    }

    const lead = leadResult.rows[0];
    console.log(`[SEND WA] Mengirim ke: ${lead.nama} (${lead.whatsapp})`);

    // Kirim via Fonnte
    const fonnteResult = await sendFonnte(lead.whatsapp, message);

    if (fonnteResult.status) {
      // Update tracking follow-up
      await db.query(
        'UPDATE leads SET last_follow_up = NOW(), follow_up_count = follow_up_count + 1 WHERE id = $1',
        [id]
      );
      
      res.json({ 
        success: true, 
        message: 'Pesan WhatsApp berhasil terkirim!',
        data: fonnteResult
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: fonnteResult.reason || 'Gagal mengirim pesan (Cek token/kuota Fonnte)',
        data: fonnteResult
      });
    }
  } catch (error) {
    console.error('Error in send-wa endpoint:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
