import express from 'express';
import { CuttingService } from '../services/cuttingService';

const router = express.Router();
const cuttingService = new CuttingService();

/** Validation failures the service raises, mapped to what the user should read. */
const VALIDATION_ERRORS: Record<string, string> = {
  NO_INPUTS: 'Select at least one raw material line',
  NO_OUTPUTS: 'Add at least one finished product with a count',
  DUPLICATE_PRODUCT: 'The same product is listed twice — combine the counts into one line',
  MATERIAL_NOT_FOUND: 'One of the selected raw material lines no longer exists',
  MATERIAL_ALREADY_CUT: 'One of the selected lines has already been used in another cutting',
  MATERIAL_NOT_AVAILABLE: 'One of the selected lines is no longer available for cutting',
  MIXED_SPEC: 'A cutting can only use lines of the same point and size',
};

const sendError = (res: express.Response, error: any, fallback: string) => {
  const message = VALIDATION_ERRORS[error?.message];
  if (message) {
    res.status(400).json({ error: message });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
};

router.get('/', async (req, res) => {
  try {
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const cuttings = await cuttingService.getAll(fromDate, toDate);
    res.json(cuttings);
  } catch (error) {
    sendError(res, error, 'Failed to fetch cuttings');
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await cuttingService.getSummary();
    res.json(summary);
  } catch (error) {
    sendError(res, error, 'Failed to fetch cutting summary');
  }
});

// Raw material lots free to be cut. `forCuttingId` also returns the lots that
// cutting already holds, so its edit form can show them still ticked.
router.get('/available-materials', async (req, res) => {
  try {
    const forCuttingId = req.query.forCuttingId
      ? parseInt(req.query.forCuttingId as string)
      : undefined;
    const materials = await cuttingService.getAvailableMaterials(forCuttingId);
    res.json(materials);
  } catch (error) {
    sendError(res, error, 'Failed to fetch available raw materials');
  }
});

router.get('/product-stock', async (req, res) => {
  try {
    const stock = await cuttingService.getProductStock();
    res.json(stock);
  } catch (error) {
    sendError(res, error, 'Failed to fetch product stock');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const cutting = await cuttingService.getById(parseInt(req.params.id));
    if (cutting) {
      res.json(cutting);
    } else {
      res.status(404).json({ error: 'Cutting not found' });
    }
  } catch (error) {
    sendError(res, error, 'Failed to fetch cutting');
  }
});

router.post('/', async (req, res) => {
  try {
    const cutting = await cuttingService.create(req.body);
    res.status(201).json(cutting);
  } catch (error) {
    sendError(res, error, 'Failed to create cutting');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const cutting = await cuttingService.update(parseInt(req.params.id), req.body);
    if (cutting) {
      res.json(cutting);
    } else {
      res.status(404).json({ error: 'Cutting not found' });
    }
  } catch (error) {
    sendError(res, error, 'Failed to update cutting');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await cuttingService.remove(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Cutting not found' });
    }
  } catch (error) {
    sendError(res, error, 'Failed to delete cutting');
  }
});

export default router;
