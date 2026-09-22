import * as dotenv from 'dotenv';
import * as path from 'path';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import employeeRoutes from './routes/employeeRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import salaryRoutes from './routes/salaryRoutes';
import advanceRoutes from './routes/advanceRoutes';
import productRoutes from './routes/productRoutes';
import clientRoutes from './routes/clientRoutes';
import orderRoutes from './routes/orderRoutes';
import settlementRoutes from './routes/settlementRoutes';
import bankAccountRoutes from './routes/bankAccountRoutes';
import clientProductPriceRoutes from './routes/clientProductPriceRoutes';
import vendorRoutes from './routes/vendorRoutes';
import rawMaterialRoutes from './routes/rawMaterialRoutes';
import cuttingRoutes from './routes/cuttingRoutes';
import { createMaterialMasterRouter } from './routes/materialMasterRoutes';
import vendorRateRoutes from './routes/vendorRateRoutes';
import { createProcessRouter } from './routes/processRoutes';
import { createProcessRateRouter } from './routes/processRateRoutes';
import vendorPaymentRoutes from './routes/vendorPaymentRoutes';
import { STAGES } from './services/processService';
import { SettlementService } from './services/settlementService';

// Load .env from project root before importing prisma
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import prisma from './config/database';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/advances', advanceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/client-product-prices', clientProductPriceRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/raw-materials', rawMaterialRoutes);
app.use('/api/cuttings', cuttingRoutes);
app.use('/api/material-points', createMaterialMasterRouter('point'));
app.use('/api/material-sizes', createMaterialMasterRouter('size'));
app.use('/api/vendor-rates', vendorRateRoutes);
// plasma, tinker and buffing are the same machinery, one mount each
for (const stage of STAGES) {
  app.use(`/api/${stage}`, createProcessRouter(stage));
  app.use(`/api/${stage}-rates`, createProcessRateRouter(stage));
}
app.use('/api/vendor-payments', vendorPaymentRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Dashboard - Get overall outstanding balance across all clients
app.get('/api/dashboard/outstanding-balance', async (req, res) => {
  try {
    const settlementService = new SettlementService();
    const balances = await settlementService.getAllClientBalances();
    const totalOutstanding = balances.reduce((sum, b) => sum + b.total_due, 0);
    res.json({ outstanding_balance: totalOutstanding });
  } catch (error) {
    console.error('Error calculating outstanding balance:', error);
    res.status(500).json({ error: 'Failed to calculate outstanding balance' });
  }
});

// Initialize database - create default admin if not exists
async function initializeDatabase() {
  try {
    const adminCount = await prisma.admin.count({
      where: { username: 'admin' },
    });

    if (adminCount === 0) {
      await prisma.admin.create({
        data: {
          username: 'admin',
          password: 'admin123',
        },
      });
      console.log('Default admin user created (username: admin, password: admin123)');
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

app.listen(PORT, async () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
});

export default app;

