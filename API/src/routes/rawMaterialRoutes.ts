import express from 'express';
import { RawMaterialService, RAW_MATERIAL_STATUSES } from '../services/rawMaterialService';

const router = express.Router();
const rawMaterialService = new RawMaterialService();

// Deliveries, each with its lines nested
router.get('/', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const vendorId = req.query.vendorId ? parseInt(req.query.vendorId as string) : undefined;
    const entries = await rawMaterialService.getAllEntries(status, vendorId);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch raw material entries' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await rawMaterialService.getSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch raw material summary' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const entry = await rawMaterialService.getEntryById(parseInt(req.params.id));
    if (entry) {
      res.json(entry);
    } else {
      res.status(404).json({ error: 'Entry not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

router.post('/', async (req, res) => {
  try {
    const entry = await rawMaterialService.createEntry(req.body);
    res.status(201).json(entry);
  } catch (error: any) {
    if (error.message === 'NO_ITEMS') {
      res.status(400).json({ error: 'Add at least one material line' });
      return;
    }
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const entry = await rawMaterialService.updateEntry(parseInt(req.params.id), req.body);
    if (entry) {
      res.json(entry);
    } else {
      res.status(404).json({ error: 'Entry not found' });
    }
  } catch (error: any) {
    if (error.message === 'NO_ITEMS') {
      res.status(400).json({ error: 'Add at least one material line' });
      return;
    }
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await rawMaterialService.deleteEntry(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Entry not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Move every line of a delivery at once
router.put('/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!RAW_MATERIAL_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const entry = await rawMaterialService.updateEntryStatus(parseInt(req.params.id), status, notes);
    if (entry) {
      res.json(entry);
    } else {
      res.status(404).json({ error: 'Entry not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Line-level routes: status is tracked per lot
router.get('/items/:itemId/status-history', async (req, res) => {
  try {
    const history = await rawMaterialService.getStatusHistory(parseInt(req.params.itemId));
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

router.put('/items/:itemId/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!RAW_MATERIAL_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const item = await rawMaterialService.updateItemStatus(parseInt(req.params.itemId), status, notes);
    if (item) {
      res.json(item);
    } else {
      res.status(404).json({ error: 'Line not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.delete('/items/:itemId', async (req, res) => {
  try {
    const success = await rawMaterialService.deleteItem(parseInt(req.params.itemId));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Line not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete line' });
  }
});

export default router;
