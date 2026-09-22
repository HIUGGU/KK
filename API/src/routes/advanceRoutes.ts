import express from 'express';
import { AdvanceService } from '../services/advanceService';

const router = express.Router();
const advanceService = new AdvanceService();

router.post('/', async (req, res) => {
  try {
    const { employeeId, amount, remark, date } = req.body;
    if (!employeeId || !amount || !date) {
      return res.status(400).json({ error: 'Employee ID, amount, and date are required' });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (String(date).slice(0, 10) > today) {
      return res.status(400).json({ error: 'Advance date cannot be in the future' });
    }
    const advance = await advanceService.createAdvance(employeeId, amount, remark || '', date);
    res.json(advance);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create advance' });
  }
});

router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const advances = await advanceService.getAdvancesByEmployee(
      parseInt(req.params.employeeId),
      startDate as string,
      endDate as string
    );
    res.json(advances);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch advances' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const advances = await advanceService.getAllAdvances(
      startDate as string,
      endDate as string
    );
    res.json(advances);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch advances' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'deducted', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, deducted, or cancelled' });
    }
    const advance = await advanceService.updateAdvanceStatus(parseInt(req.params.id), status);
    res.json(advance);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update advance status' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await advanceService.deleteAdvance(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete advance' });
  }
});

export default router;








