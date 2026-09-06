const express = require('express');
const router = express.Router();
const db = require('../config/database');
const midtransClient = require('midtrans-client');

// Inisialisasi Midtrans Snap (akan diisi setelah dapet API Key)
let snap = null;

// Fungsi inisialisasi Midtrans
function initMidtrans() {
  if (!process.env.MIDTRANS_SERVER_KEY) {
    console.warn('⚠️  MIDTRANS_SERVER_KEY belum diatur di .env');
    return null;
  }

  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  
  snap = new midtransClient.Snap({
    isProduction: isProduction,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
  });

  console.log('✅ Midtrans initialized:', isProduction ? 'PRODUCTION' : 'SANDBOX');
  return snap;
}

// ===== ENDPOINT: BUAT PAYMENT LINK (UNTUK DP) =====
// POST /api/payment/create-dp
router.post('/create-dp', async (req, res) => {
  try {
    const { leadId, totalAmount } = req.body;

    // Validasi
    if (!leadId || !totalAmount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lead ID dan total amount wajib diisi' 
      });
    }

    // Hitung DP 50%
    const dpAmount = Math.round(totalAmount * 0.5);

    console.log(`\n💰 Create DP Payment:`);
    console.log(`Lead ID: ${leadId}`);
    console.log(`Total: Rp ${totalAmount.toLocaleString('id-ID')}`);
    console.log(`DP (50%): Rp ${dpAmount.toLocaleString('id-ID')}`);

    // Ambil data lead
    const leadResult = await db.query(
      'SELECT * FROM leads WHERE id = $1',
      [leadId]
    );

    if (leadResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lead tidak ditemukan' 
      });
    }

    const lead = leadResult.rows[0];

    // Generate Order ID unik
    const orderId = `MEDI-DP-${leadId}-${Date.now()}`;

    // Inisialisasi Midtrans jika belum
    if (!snap) {
      initMidtrans();
    }

    if (!snap) {
      return res.status(500).json({ 
        success: false, 
        message: 'Midtrans belum dikonfigurasi. Hubungi admin.' 
      });
    }

    // Parameter untuk Midtrans
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: dpAmount
      },
      credit_card: {
        secure: true
      },
      customer_details: {
        first_name: lead.nama,
        email: lead.email || 'admin@medlicensing.id',
        phone: lead.whatsapp
      },
      item_details: [
        {
          id: 'DP-MEDLICENSING',
          price: dpAmount,
          quantity: 1,
          name: `DP 50% - Jasa Pengurusan ${lead.profesi === 'dokter' ? 'SIP' : 'Izin Klinik'}`,
          category: 'healthcare_service'
        }
      ]
    };

    console.log('📤 Sending to Midtrans:', parameter);

    // Request ke Midtrans
    const transaction = await snap.createTransaction(parameter);
    
    console.log('✅ Midtrans Response:', transaction);

    // Simpan ke database
    await db.query(
      `UPDATE leads 
       SET total_amount = $1, 
           payment_status = 'waiting_dp', 
           midtrans_order_id = $2, 
           payment_url = $3
       WHERE id = $4`,
      [totalAmount, orderId, transaction.redirect_url, leadId]
    );

    console.log(' Payment data saved to database');

    res.json({
      success: true,
      message: 'Payment link berhasil dibuat',
      data: {
        orderId: orderId,
        paymentUrl: transaction.redirect_url,
        dpAmount: dpAmount,
        totalAmount: totalAmount
      }
    });

  } catch (error) {
    console.error('❌ Error creating payment:', error.message);
    console.error(error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal membuat payment link: ' + error.message 
    });
  }
});

// ===== ENDPOINT: BUAT PAYMENT LINK PELUNASAN =====
// POST /api/payment/create-final
router.post('/create-final', async (req, res) => {
  try {
    const { leadId } = req.body;

    // Ambil data lead
    const leadResult = await db.query(
      'SELECT * FROM leads WHERE id = $1',
      [leadId]
    );

    if (leadResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lead tidak ditemukan' 
      });
    }

    const lead = leadResult.rows[0];

    if (!lead.total_amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Total amount belum diset' 
      });
    }

    // Hitung sisa pembayaran (50%)
    const finalAmount = Math.round(lead.total_amount * 0.5);

    // Generate Order ID
    const orderId = `MEDI-FINAL-${leadId}-${Date.now()}`;

    // Inisialisasi Midtrans
    if (!snap) initMidtrans();

    if (!snap) {
      return res.status(500).json({ 
        success: false, 
        message: 'Midtrans belum dikonfigurasi' 
      });
    }

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: finalAmount
      },
      customer_details: {
        first_name: lead.nama,
        email: lead.email || 'admin@medlicensing.id',
        phone: lead.whatsapp
      },
      item_details: [
        {
          id: 'FINAL-MEDLICENSING',
          price: finalAmount,
          quantity: 1,
          name: `Pelunasan - Jasa Pengurusan ${lead.profesi === 'dokter' ? 'SIP' : 'Izin Klinik'}`,
          category: 'healthcare_service'
        }
      ]
    };

    const transaction = await snap.createTransaction(parameter);

    // Update database
    await db.query(
      `UPDATE leads 
       SET payment_status = 'waiting_final', 
           midtrans_order_id = $1, 
           payment_url = $2
       WHERE id = $3`,
      [orderId, transaction.redirect_url, leadId]
    );

    res.json({
      success: true,
      message: 'Payment link pelunasan berhasil dibuat',
      data: {
        orderId: orderId,
        paymentUrl: transaction.redirect_url,
        finalAmount: finalAmount
      }
    });

  } catch (error) {
    console.error('Error creating final payment:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ===== WEBHOOK: MIDTRANS NOTIFICATION =====
// POST /api/payment/notification
router.post('/notification', async (req, res) => {
  try {
    const notification = req.body;
    
    console.log('\n🔔 Midtrans Webhook Received:');
    console.log('Order ID:', notification.order_id);
    console.log('Transaction Status:', notification.transaction_status);
    console.log('Fraud Status:', notification.fraud_status);

    // Extract order ID dari notification
    const orderId = notification.order_id;
    
    // Parse lead ID dari order ID (format: MEDI-DP-123-...)
    const leadIdMatch = orderId.match(/MEDI-(?:DP|FINAL)-(\d+)-/);
    if (!leadIdMatch) {
      return res.status(400).json({ success: false, message: 'Invalid order ID format' });
    }
    
    const leadId = parseInt(leadIdMatch[1]);

    // Tentukan status pembayaran
    let paymentStatus = 'unpaid';
    let leadStatus = 'pending';

    if (notification.transaction_status === 'capture') {
      if (notification.fraud_status === 'accept') {
        paymentStatus = 'paid';
        leadStatus = 'dp_paid'; // Akan diupdate manual oleh admin
      }
    } else if (notification.transaction_status === 'settlement') {
      paymentStatus = 'paid';
      leadStatus = 'dp_paid';
    } else if (notification.transaction_status === 'pending') {
      paymentStatus = 'pending';
    } else if (notification.transaction_status === 'deny' || 
               notification.transaction_status === 'expire' || 
               notification.transaction_status === 'cancel') {
      paymentStatus = 'expired';
    }

    // Update database
    await db.query(
      `UPDATE leads 
       SET payment_status = $1, 
           status = CASE WHEN $1 = 'paid' THEN $2 ELSE status END
       WHERE midtrans_order_id = $3`,
      [paymentStatus, leadStatus, orderId]
    );

    console.log(`✅ Database updated: payment_status = ${paymentStatus}`);

    res.json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error(' Error processing webhook:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;