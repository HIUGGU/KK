import express from 'express';
import { VendorRateService } from '../services/vendorRateService';

const router = express.Router();
const vendorRateService = new VendorRateService();

router.get('/', async (req, res) => {
  try {
    const vendorId = req.query.vendorId ? parseInt(req.query.vendorId as string) : undefined;
    const pointId = req.query.pointId ? parseInt(req.query.pointId as string) : undefined;
    const rates = await vendorRateService.getRates(vendorId, pointId);
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vendor rates' });
  }
});

router.get('/effective', async (req, res) => {
  try {
    const vendorId = parseInt(req.query.vendorId as string);
    const pointId = parseInt(req.query.pointId as string);
    if (!vendorId || !pointId) {
      res.status(400).json({ error: 'vendorId and pointId are required' });
      return;
    }
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const rate = await vendorRateService.getEffectiveRate(vendorId, pointId, date);
    res.json(rate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch effective rate' });
  }
});

router.get('/vendor/:vendorId/current', async (req, res) => {
  try {
    const date = req.query.date as string | undefined;
    const rates = await vendorRateService.getCurrentRatesForVendor(parseInt(req.params.vendorId), date);
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current rates' });
  }
});

router.post('/', async (req, res) => {
  try {
    const rate = await vendorRateService.setRate(req.body);
    res.status(201).json(rate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save vendor rate' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await vendorRateService.deleteRate(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Vendor rate not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vendor rate' });
  }
});

export default router;
