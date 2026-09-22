import express from 'express';
import { ProductService } from '../services/productService';
import { priceLogService } from '../services/priceLogService';

const router = express.Router();
const productService = new ProductService();

router.get('/', async (req, res) => {
  try {
    const products = await productService.getAllProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await productService.getProductById(parseInt(req.params.id));
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.post('/', async (req, res) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const product = await productService.updateProduct(parseInt(req.params.id), req.body);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await productService.deleteProduct(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Rate history routes
router.get('/:id/price-log', async (req, res) => {
  try {
    const log = await priceLogService.getProductPriceLog(parseInt(req.params.id));
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch price log' });
  }
});

router.get('/:id/rates', async (req, res) => {
  try {
    const rates = await productService.getProductRateHistory(parseInt(req.params.id));
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rate history' });
  }
});

router.post('/:id/rates', async (req, res) => {
  try {
    const rate = await productService.addProductRate({
      ...req.body,
      product_id: parseInt(req.params.id),
    });
    res.status(201).json(rate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add rate' });
  }
});

router.get('/:id/effective-rate', async (req, res) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const rate = await productService.getEffectiveRate(parseInt(req.params.id), date);
    res.json({ rate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get effective rate' });
  }
});

export default router;

