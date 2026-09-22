import Database from 'better-sqlite3';
import { AppDatabase } from '../database';

export interface SalaryRecord {
  id?: number;
  employee_id: number;
  month: number;
  year: number;
  base_salary: number;
  days_present: number;
  days_absent: number;
  total_hours: number;
  gross_salary: number;
  deductions: number;
  net_salary: number;
}

export class SalaryService {
  private db: Database.Database;

  constructor(database: AppDatabase) {
    this.db = database.getDatabase();
  }

  calculateSalary(employeeId: number, month: number, year: number): SalaryRecord {
    // Get employee details
    const employee = this.db
      .prepare('SELECT * FROM employees WHERE id = ?')
      .get(employeeId) as any;

    if (!employee) {
      throw new Error('Employee not found');
    }

    // Get attendance for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const attendance = this.db
      .prepare('SELECT * FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?')
      .all(employeeId, startDate, endDate) as any[];

    const daysPresent = attendance.filter((a) => a.status === 'present').length;
    const daysAbsent = attendance.filter((a) => a.status === 'absent').length;
    const totalHours = attendance.reduce((sum, a) => sum + (a.hours_worked || 0), 0);

    // Calculate salary (assuming 8 hours per day, 30 days per month)
    const workingDaysPerMonth = 30;
    const hoursPerDay = 8;
    const dailyRate = employee.base_salary / workingDaysPerMonth;
    const hourlyRate = dailyRate / hoursPerDay;

    const grossSalary = dailyRate * daysPresent;
    const deductions = 0; // Can be customized (taxes, insurance, etc.)
    const netSalary = grossSalary - deductions;

    // Save or update salary record
    const existing = this.db
      .prepare('SELECT * FROM salary_records WHERE employee_id = ? AND month = ? AND year = ?')
      .get(employeeId, month, year) as SalaryRecord | undefined;

    if (existing) {
      this.db
        .prepare(`
          UPDATE salary_records 
          SET base_salary = ?, days_present = ?, days_absent = ?, total_hours = ?,
              gross_salary = ?, deductions = ?, net_salary = ?
          WHERE id = ?
        `)
        .run(
          employee.base_salary,
          daysPresent,
          daysAbsent,
          totalHours,
          grossSalary,
          deductions,
          netSalary,
          existing.id
        );
    } else {
      this.db
        .prepare(`
          INSERT INTO salary_records 
          (employee_id, month, year, base_salary, days_present, days_absent, total_hours, gross_salary, deductions, net_salary)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          employeeId,
          month,
          year,
          employee.base_salary,
          daysPresent,
          daysAbsent,
          totalHours,
          grossSalary,
          deductions,
          netSalary
        );
    }

    return this.db
      .prepare('SELECT * FROM salary_records WHERE employee_id = ? AND month = ? AND year = ?')
      .get(employeeId, month, year) as SalaryRecord;
  }

  getSalaryHistory(employeeId?: number): SalaryRecord[] {
    let query = 'SELECT * FROM salary_records';
    const params: any[] = [];

    if (employeeId) {
      query += ' WHERE employee_id = ?';
      params.push(employeeId);
    }

    query += ' ORDER BY year DESC, month DESC';

    return this.db.prepare(query).all(...params) as SalaryRecord[];
  }
}

