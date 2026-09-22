import express from 'express';
import { EmployeeService } from '../services/employeeService';
import { salaryRevisionService } from '../services/salaryRevisionService';

const router = express.Router();
const employeeService = new EmployeeService();

router.get('/', async (req, res) => {
  try {
    const employees = await employeeService.getAllEmployees();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Salary increase/decrease history, across all employees or one (?employeeId=)
router.get('/salary-revisions', async (req, res) => {
  try {
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined;
    res.json(await salaryRevisionService.getRevisions(employeeId));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch salary history' });
  }
});

router.get('/:id/salary-revisions', async (req, res) => {
  try {
    res.json(await salaryRevisionService.getRevisions(parseInt(req.params.id)));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch salary history' });
  }
});

router.post('/:id/salary-revisions', async (req, res) => {
  try {
    const { new_salary, effective_date, reason } = req.body;
    const revision = await salaryRevisionService.addRevision(
      parseInt(req.params.id),
      Number(new_salary),
      effective_date,
      reason
    );
    res.status(201).json(revision);
  } catch (error: any) {
    const status = error.message === 'Employee not found' ? 404 : 400;
    res.status(status).json({ error: error.message || 'Failed to record salary change' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const employee = await employeeService.getEmployeeById(parseInt(req.params.id));
    if (employee) {
      res.json(employee);
    } else {
      res.status(404).json({ error: 'Employee not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

router.post('/', async (req, res) => {
  try {
    const employee = await employeeService.createEmployee(req.body);
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const employee = await employeeService.updateEmployee(parseInt(req.params.id), req.body);
    if (employee) {
      res.json(employee);
    } else {
      res.status(404).json({ error: 'Employee not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await employeeService.deleteEmployee(parseInt(req.params.id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Employee not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

export default router;








