import express from 'express';
import { MaterialMasterService, MasterKind } from '../services/materialMasterService';

/**
 * Builds an identical CRUD router for either master list.
 * `label` only shapes the error messages the UI shows.
 */
export function createMaterialMasterRouter(kind: MasterKind) {
  const router = express.Router();
  const service = new MaterialMasterService(kind);
  const label = kind === 'point' ? 'Point' : 'Size';

  router.get('/', async (req, res) => {
    try {
      const records = await service.getAll();
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: `Failed to fetch ${label.toLowerCase()}s` });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const record = await service.getById(parseInt(req.params.id));
      if (record) {
        res.json(record);
      } else {
        res.status(404).json({ error: `${label} not found` });
      }
    } catch (error) {
      res.status(500).json({ error: `Failed to fetch ${label.toLowerCase()}` });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const record = await service.create(req.body);
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message === 'DUPLICATE_NAME') {
        res.status(400).json({ error: `${label} "${req.body.name}" already exists` });
        return;
      }
      res.status(500).json({ error: `Failed to create ${label.toLowerCase()}` });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const record = await service.update(parseInt(req.params.id), req.body);
      if (record) {
        res.json(record);
      } else {
        res.status(404).json({ error: `${label} not found` });
      }
    } catch (error: any) {
      if (error.message === 'DUPLICATE_NAME') {
        res.status(400).json({ error: `${label} "${req.body.name}" already exists` });
        return;
      }
      res.status(500).json({ error: `Failed to update ${label.toLowerCase()}` });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const success = await service.delete(parseInt(req.params.id));
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: `${label} not found` });
      }
    } catch (error: any) {
      if (error.message === 'MASTER_IN_USE') {
        res.status(400).json({ error: `Cannot delete a ${label.toLowerCase()} that raw material entries or products use` });
        return;
      }
      res.status(500).json({ error: `Failed to delete ${label.toLowerCase()}` });
    }
  });

  return router;
}
