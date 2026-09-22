import express from 'express';
import { ProcessService, Stage } from '../services/processService';

/** Validation failures the service raises, mapped to what the user should read. */
const VALIDATION_ERRORS: Record<string, string> = {
  NO_ITEMS: 'Add at least one product with a count',
  DUPLICATE_PRODUCT: 'The same product is listed twice — combine the counts into one line',
  NO_VENDOR: 'Select the vendor doing the work',
  PRODUCT_NOT_FOUND: 'One of the selected products no longer exists',
  OVER_PENDING: 'More pieces were entered than the previous stage has finished for that product',
  JOB_PAID: 'This job has already been paid for — undo the payment first',
  CONSUMED_DOWNSTREAM:
    'These pieces have already moved on to the next stage — undo that work first',
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

/**
 * One router per stage of the line. Plasma, tinker and buffing behave
 * identically, so they are mounted from the same factory rather than copied -
 * the same way the material master lists are.
 */
export function createProcessRouter(stage: Stage) {
  const router = express.Router();
  const service = new ProcessService(stage);

  router.get('/', async (req, res) => {
    try {
      const jobs = await service.getAll({
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        mode: req.query.mode as string | undefined,
        vendorId: req.query.vendorId ? parseInt(req.query.vendorId as string) : undefined,
        status: req.query.status as string | undefined,
        workStatus: req.query.workStatus as string | undefined,
      });
      res.json(jobs);
    } catch (error) {
      sendError(res, error, 'Failed to fetch jobs');
    }
  });

  router.get('/summary', async (req, res) => {
    try {
      res.json(await service.getSummary());
    } catch (error) {
      sendError(res, error, 'Failed to fetch summary');
    }
  });

  // Where every product stands at this stage: ready, in progress, finished
  router.get('/stock', async (req, res) => {
    try {
      const forJobId = req.query.forJobId ? parseInt(req.query.forJobId as string) : undefined;
      res.json(await service.getStock(forJobId));
    } catch (error) {
      sendError(res, error, 'Failed to fetch stage stock');
    }
  });

  // Only what is free to send in. `forJobId` frees up the pieces that job holds.
  router.get('/pending', async (req, res) => {
    try {
      const forJobId = req.query.forJobId ? parseInt(req.query.forJobId as string) : undefined;
      res.json(await service.getPending(forJobId));
    } catch (error) {
      sendError(res, error, 'Failed to fetch pending pieces');
    }
  });

  // What a vendor would charge for a set of lines, without saving anything
  router.post('/quote', async (req, res) => {
    try {
      const { vendor_id, job_date, items } = req.body;
      const quote = await service.quote(
        parseInt(vendor_id),
        job_date || new Date().toISOString().split('T')[0],
        items || []
      );
      res.json(quote);
    } catch (error) {
      sendError(res, error, 'Failed to price the job');
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const job = await service.getById(parseInt(req.params.id));
      if (job) {
        res.json(job);
      } else {
        res.status(404).json({ error: 'Job not found' });
      }
    } catch (error) {
      sendError(res, error, 'Failed to fetch job');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const job = await service.create(req.body);
      res.status(201).json(job);
    } catch (error) {
      sendError(res, error, 'Failed to create job');
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const job = await service.update(parseInt(req.params.id), req.body);
      if (job) {
        res.json(job);
      } else {
        res.status(404).json({ error: 'Job not found' });
      }
    } catch (error) {
      sendError(res, error, 'Failed to update job');
    }
  });

  // Finishing a job is what releases its pieces to the next stage
  router.put('/:id/work-status', async (req, res) => {
    try {
      const completed = req.body.work_status === 'completed';
      const job = await service.setWorkStatus(
        parseInt(req.params.id),
        completed,
        req.body.completed_date
      );
      if (job) {
        res.json(job);
      } else {
        res.status(404).json({ error: 'Job not found' });
      }
    } catch (error) {
      sendError(res, error, 'Failed to update the job status');
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const success = await service.remove(parseInt(req.params.id));
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Job not found' });
      }
    } catch (error) {
      sendError(res, error, 'Failed to delete job');
    }
  });

  return router;
}
