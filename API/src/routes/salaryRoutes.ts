import express from 'express';
import { SalaryService } from '../services/salaryService';
import { SalaryPaymentService } from '../services/salaryPaymentService';

const router = express.Router();
const salaryService = new SalaryService();
const salaryPaymentService = new SalaryPaymentService();

// What each employee has earned, been advanced and been paid, and what is left
// owing. This is the view that matters when payouts happen ad hoc rather than
// once a month.
router.get('/ledger', async (req, res) => {
  try {
    const { asOf, employeeId } = req.query;
    const ledger = await salaryPaymentService.getLedger(
      asOf ? (asOf as string) : undefined,
      employeeId ? parseInt(employeeId as string) : undefined
    );
    res.json(ledger);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch salary ledger' });
  }
});

router.post('/payments', async (req, res) => {
  try {
    const { employeeId, amount, paymentDate, notes } = req.body;
    if (!employeeId || amount === undefined || !paymentDate) {
      return res.status(400).json({ error: 'Employee ID, amount and payment date are required' });
    }
    const payment = await salaryPaymentService.createPayment(
      employeeId,
      parseFloat(amount),
      paymentDate,
      notes
    );
    res.json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to record payment' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const { employeeId } = req.query;
    const payments = await salaryPaymentService.getPayments(
      employeeId ? parseInt(employeeId as string) : undefined
    );
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch payments' });
  }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    await salaryPaymentService.deletePayment(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete payment' });
  }
});

router.post('/calculate', async (req, res) => {
  try {
    const { employeeId, month, year, extraAmount, payoutDate } = req.body;
    if (!employeeId || !month || !year) {
      return res.status(400).json({ error: 'Employee ID, month, and year are required' });
    }
    const salary = await salaryService.calculateSalary(
      employeeId,
      month,
      year,
      extraAmount || 0,
      payoutDate
    );
    res.json(salary);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to calculate salary' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { employeeId } = req.query;
    const history = await salaryService.getSalaryHistory(
      employeeId ? parseInt(employeeId as string) : undefined
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch salary history' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['paid', 'not_paid'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "paid" or "not_paid"' });
    }
    const updated = await salaryService.updateSalaryStatus(
      parseInt(req.params.id),
      status as 'paid' | 'not_paid'
    );
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update salary status' });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const { employeeId, month, year, extraAmount } = req.body;
    if (!employeeId || !month || !year) {
      return res.status(400).json({ error: 'Employee ID, month, and year are required' });
    }
    const preview = await salaryService.previewSalary(
      employeeId,
      month,
      year,
      extraAmount || 0
    );
    res.json(preview);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to preview salary' });
  }
});

export default router;

