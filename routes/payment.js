const express = require('express');
const router = express.Router();
const db = require('../config/database');
const midtransClient = require('midtrans-client');

// Inisialisasi Midtrans Snap
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Helper untuk generate order ID unik
const generateOrderId = () => `MED-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// 1. Endpoint Buat Invoice DP (50%)
router.post('/create-dp', async (req, res) => {
  try {
    const { leadId, totalAmount } = req.body;
    const dpAmount = Math.round(totalAmount * 0.5);

    // Update database: tandai sedang tunggu DP
    await db.query(
      `UPDATE leads SET total_amount = $1, payment_status = 'waiting_dp' WHERE id = $2`,
      [totalAmount, leadId]
    );

    // Buat transaksi Midtrans
    const parameter = {
      transaction_details: {
        order_id: generateOrderId(),
        gross_amount: dpAmount
      },
      customer_details: {
        first_name: "Customer",
        email: "admin@medlicensing.id"
      }
    };

    const transaction = await snap.createTransaction(parameter);

    res.json({ 
      success: true, 
      message: 'Invoice DP berhasil dibuat',
      data: { paymentUrl: transaction.redirect_url }
    });

  } catch (error) {
    console.error('Error create DP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Endpoint Buat Invoice Pelunasan (Sisa 50%)
router.post('/create-final', async (req, res) => {
  try {
    const { leadId, totalAmount } = req.body;
    const finalAmount = Math.round(totalAmount * 0.5);

    // Update database: tandai sedang tunggu pelunasan
    await db.query(
      `UPDATE leads SET payment_status = 'waiting_final' WHERE id = $1`,
      [leadId]
    );

    // Buat transaksi Midtrans
    const parameter = {
      transaction_details: {
        order_id: generateOrderId(),
        gross_amount: finalAmount
      },
      customer_details: {
        first_name: "Customer",
        email: "admin@medlicensing.id"
      }
    };

    const transaction = await snap.createTransaction(parameter);

    res.json({ 
      success: true, 
      message: 'Invoice Pelunasan berhasil dibuat',
      data: { paymentUrl: transaction.redirect_url }
    });

  } catch (error) {
    console.error('Error create final:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
