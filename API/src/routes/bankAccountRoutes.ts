import express from 'express';
import { BankAccountService } from '../services/bankAccountService';

const router = express.Router();
const bankAccountService = new BankAccountService();

router.get('/', async (req, res) => {
  try {
    const accounts = await bankAccountService.getAllBankAccounts();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const account = await bankAccountService.getBankAccountById(parseInt(req.params.id));
    if (account) {
      res.json(account);
    } else {
      res.status(404).json({ error: 'Bank account not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bank account' });
  }
});

router.post('/', async (req, res) => {
  try {
    const account = await bankAccountService.createBankAccount(req.body);
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create bank account' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const account = await bankAccountService.updateBankAccount(parseInt(req.params.id), req.body);
    if (account) {
      res.json(account);
    } else {
      res.status(404).json({ error: 'Bank account not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update bank account' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await bankAccountService.deleteBankAccount(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Bank account not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bank account' });
  }
});

export default router;



