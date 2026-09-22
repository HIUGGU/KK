import express from 'express';
import { OrderService, OrderFilters } from '../services/orderService';

const router = express.Router();
const orderService = new OrderService();

router.get('/', async (req, res) => {
  try {
    const filters: OrderFilters = {};

    if (req.query.from_date) filters.from_date = String(req.query.from_date);
    if (req.query.to_date) filters.to_date = String(req.query.to_date);
    if (req.query.status) filters.status = String(req.query.status);

    const productId = parseInt(String(req.query.product_id));
    if (!isNaN(productId)) filters.product_id = productId;

    const orders = await orderService.getAllOrders(filters);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await orderService.getOrderById(parseInt(req.params.id));
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.post('/', async (req, res) => {
  try {
    const order = await orderService.createOrder(req.body);
    res.status(201).json(order);
  } catch (error: any) {
    // The message matters here: duplicate order numbers and a missing delivery
    // date are both shown back on the form.
    res.status(400).json({ error: error.message || 'Failed to create order' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const order = await orderService.updateOrder(parseInt(req.params.id), req.body);
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update order' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await orderService.deleteOrder(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

export default router;
