import express from 'express';
import { ClientProductPriceService } from '../services/clientProductPriceService';

const router = express.Router();
const priceService = new ClientProductPriceService();

router.get('/client/:clientId', async (req, res) => {
  try {
    const prices = await priceService.getClientPrices(parseInt(req.params.clientId));
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch client prices' });
  }
});

router.get('/client/:clientId/rate-summary', async (req, res) => {
  try {
    const summary = await priceService.getClientRateSummary(parseInt(req.params.clientId));
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch client rate summary' });
  }
});

router.get('/client/:clientId/product/:productId', async (req, res) => {
  try {
    const prices = await priceService.getProductPricesForClient(
      parseInt(req.params.clientId),
      parseInt(req.params.productId)
    );
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product prices' });
  }
});

router.get('/client/:clientId/product/:productId/effective', async (req, res) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const price = await priceService.getClientProductPrice(
      parseInt(req.params.clientId),
      parseInt(req.params.productId),
      date
    );
    res.json({ price });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch effective price' });
  }
});

router.post('/', async (req, res) => {
  try {
    const price = await priceService.setClientProductPrice(req.body);
    res.status(201).json(price);
  } catch (error) {
    res.status(500).json({ error: 'Failed to set client product price' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const price = await priceService.updateClientProductPrice(parseInt(req.params.id), req.body);
    if (price) {
      res.json(price);
    } else {
      res.status(404).json({ error: 'Price not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update client product price' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await priceService.deleteClientProductPrice(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Price not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client product price' });
  }
});

export default router;



