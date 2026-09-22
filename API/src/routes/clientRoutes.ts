import express from 'express';
import { ClientService } from '../services/clientService';

const router = express.Router();
const clientService = new ClientService();

router.get('/', async (req, res) => {
  try {
    const clients = await clientService.getAllClients();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await clientService.getClientById(parseInt(req.params.id));
    if (client) {
      res.json(client);
    } else {
      res.status(404).json({ error: 'Client not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

router.post('/', async (req, res) => {
  try {
    const client = await clientService.createClient(req.body);
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const client = await clientService.updateClient(parseInt(req.params.id), req.body);
    if (client) {
      res.json(client);
    } else {
      res.status(404).json({ error: 'Client not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await clientService.deleteClient(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Client not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;



