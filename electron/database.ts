import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

export class AppDatabase {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'employee_management.db');
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
  }

  initialize() {
    // Admin table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employees table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        department TEXT,
        position TEXT,
        base_salary REAL NOT NULL DEFAULT 0,
        hire_date DATE NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Attendance table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date DATE NOT NULL,
        check_in_time DATETIME,
        check_out_time DATETIME,
        hours_worked REAL DEFAULT 0,
        status TEXT DEFAULT 'present',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE(employee_id, date)
      )
    `);

    // Salary records table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS salary_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        base_salary REAL NOT NULL,
        days_present INTEGER DEFAULT 0,
        days_absent INTEGER DEFAULT 0,
        total_hours REAL DEFAULT 0,
        gross_salary REAL NOT NULL,
        deductions REAL DEFAULT 0,
        net_salary REAL NOT NULL,
        calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE(employee_id, month, year)
      )
    `);

    // Create default admin if not exists
    const adminExists = this.db.prepare('SELECT COUNT(*) as count FROM admin').get() as { count: number };
    if (adminExists.count === 0) {
      // Default password: admin123 (should be hashed in production)
      this.db.prepare('INSERT INTO admin (username, password) VALUES (?, ?)').run('admin', 'admin123');
    }
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

