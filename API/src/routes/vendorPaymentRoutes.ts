import express from 'express';
import { VendorPaymentService } from '../services/vendorPaymentService';

const router = express.Router();
const vendorPaymentService = new VendorPaymentService();

router.get('/', async (req, res) => {
  try {
    const payments = await vendorPaymentService.getAllPayments();
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vendor payments' });
  }
});

router.get('/balances', async (req, res) => {
  try {
    const balances = await vendorPaymentService.getAllVendorBalances();
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vendor balances' });
  }
});

router.get('/summary/:vendorId', async (req, res) => {
  try {
    const summary = await vendorPaymentService.getVendorSummary(parseInt(req.params.vendorId));
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vendor payment summary' });
  }
});

router.get('/vendor/:vendorId', async (req, res) => {
  try {
    const payments = await vendorPaymentService.getPaymentsByVendor(parseInt(req.params.vendorId));
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vendor payments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const payment = await vendorPaymentService.createPayment(req.body);
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to record vendor payment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await vendorPaymentService.deletePayment(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete vendor payment' });
  }
});

export default router;
