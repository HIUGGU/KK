import express from 'express';
import { SettlementService } from '../services/settlementService';

const router = express.Router();
const settlementService = new SettlementService();

router.get('/', async (req, res) => {
  try {
    const settlements = await settlementService.getAllSettlements();
    res.json(settlements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

router.get('/balances', async (req, res) => {
  try {
    const balances = await settlementService.getAllClientBalances();
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch client balances' });
  }
});

router.get('/summary/:clientId', async (req, res) => {
  try {
    const summary = await settlementService.getClientSummary(parseInt(req.params.clientId));
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch client settlement summary' });
  }
});

router.get('/client/:clientId', async (req, res) => {
  try {
    const settlements = await settlementService.getSettlementsByClient(parseInt(req.params.clientId));
    res.json(settlements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

router.post('/', async (req, res) => {
  try {
    const settlement = await settlementService.createSettlement(req.body);
    res.status(201).json(settlement);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create settlement' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await settlementService.deleteSettlement(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete settlement' });
  }
});

export default router;
