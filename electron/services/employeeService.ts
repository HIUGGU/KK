import Database from 'better-sqlite3';
import { AppDatabase } from '../database';

export interface Employee {
  id?: number;
  employee_id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  base_salary: number;
  hire_date: string;
  status?: string;
}

export class EmployeeService {
  private db: Database.Database;

  constructor(database: AppDatabase) {
    this.db = database.getDatabase();
  }

  getAllEmployees(): Employee[] {
    return this.db.prepare('SELECT * FROM employees ORDER BY created_at DESC').all() as Employee[];
  }

  getEmployeeById(id: number): Employee | null {
    const employee = this.db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee | undefined;
    return employee || null;
  }

  createEmployee(employee: Employee): Employee {
    const stmt = this.db.prepare(`
      INSERT INTO employees (employee_id, name, email, phone, department, position, base_salary, hire_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      employee.employee_id,
      employee.name,
      employee.email || null,
      employee.phone || null,
      employee.department || null,
      employee.position || null,
      employee.base_salary,
      employee.hire_date,
      employee.status || 'active'
    );

    return this.getEmployeeById(result.lastInsertRowid as number)!;
  }

  updateEmployee(id: number, employee: Partial<Employee>): Employee | null {
    const existing = this.getEmployeeById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];

    Object.keys(employee).forEach((key) => {
      if (key !== 'id' && employee[key as keyof Employee] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(employee[key as keyof Employee]);
      }
    });

    if (updates.length === 0) return existing;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getEmployeeById(id);
  }

  deleteEmployee(id: number): boolean {
    const result = this.db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

