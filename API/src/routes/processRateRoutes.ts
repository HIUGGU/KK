import express from 'express';
import { ProcessRateService } from '../services/processRateService';
import { Stage } from '../services/processService';

/** One rate-card router per stage: the same vendor can price each stage differently. */
export function createProcessRateRouter(stage: Stage) {
  const router = express.Router();
  const service = new ProcessRateService();

  router.get('/', async (req, res) => {
    try {
      const vendorId = req.query.vendorId ? parseInt(req.query.vendorId as string) : undefined;
      const productId = req.query.productId
        ? parseInt(req.query.productId as string)
        : undefined;
      res.json(await service.getRates(stage, vendorId, productId));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch rates' });
    }
  });

  router.get('/effective', async (req, res) => {
    try {
      const vendorId = parseInt(req.query.vendorId as string);
      const productId = parseInt(req.query.productId as string);
      if (!vendorId || !productId) {
        res.status(400).json({ error: 'vendorId and productId are required' });
        return;
      }
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      res.json(await service.getEffectiveRate(stage, vendorId, productId, date));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch the effective rate' });
    }
  });

  router.get('/vendor/:vendorId/current', async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      res.json(
        await service.getCurrentRatesForVendor(stage, parseInt(req.params.vendorId), date)
      );
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch current rates' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const rate = await service.setRate({ ...req.body, stage });
      res.status(201).json(rate);
    } catch (error: any) {
      if (error?.message === 'NO_CHARGE') {
        res.status(400).json({ error: 'Enter the amount this vendor charges' });
        return;
      }
      console.error('Failed to save rate', error);
      res.status(500).json({ error: 'Failed to save the rate' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const success = await service.deleteRate(parseInt(req.params.id));
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Rate not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete the rate' });
    }
  });

  return router;
}
