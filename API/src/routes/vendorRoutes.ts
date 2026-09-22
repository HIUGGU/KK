import express from 'express';
import { VendorService } from '../services/vendorService';

const router = express.Router();
const vendorService = new VendorService();

router.get('/', async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const vendors = await vendorService.getAllVendors(type);
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const vendor = await vendorService.getVendorById(parseInt(req.params.id));
    if (vendor) {
      res.json(vendor);
    } else {
      res.status(404).json({ error: 'Vendor not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const vendor = await vendorService.createVendor(req.body);
    res.status(201).json(vendor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const vendor = await vendorService.updateVendor(parseInt(req.params.id), req.body);
    if (vendor) {
      res.json(vendor);
    } else {
      res.status(404).json({ error: 'Vendor not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await vendorService.deleteVendor(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Vendor not found' });
    }
  } catch (error: any) {
    if (error.message === 'VENDOR_IN_USE') {
      res.status(400).json({ error: 'Cannot delete a vendor that has raw material entries' });
      return;
    }
    if (error.message === 'VENDOR_HAS_JOBS') {
      res.status(400).json({ error: 'Cannot delete a vendor that has plasma jobs' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

export default router;
