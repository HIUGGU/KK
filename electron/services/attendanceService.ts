import Database from 'better-sqlite3';
import { AppDatabase } from '../database';

export interface Attendance {
  id?: number;
  employee_id: number;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  hours_worked: number;
  status: string;
  notes?: string;
}

export class AttendanceService {
  private db: Database.Database;

  constructor(database: AppDatabase) {
    this.db = database.getDatabase();
  }

  markAttendance(employeeId: number, type: 'checkin' | 'checkout'): Attendance {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    let attendance = this.db
      .prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?')
      .get(employeeId, today) as Attendance | undefined;

    if (!attendance) {
      // Create new attendance record
      const stmt = this.db.prepare(`
        INSERT INTO attendance (employee_id, date, check_in_time, status)
        VALUES (?, ?, ?, 'present')
      `);
      stmt.run(employeeId, today, now);
      attendance = this.db
        .prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?')
        .get(employeeId, today) as Attendance;
    } else {
      if (type === 'checkout' && !attendance.check_out_time) {
        // Update checkout time and calculate hours
        const checkIn = new Date(attendance.check_in_time!);
        const checkOut = new Date(now);
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

        this.db
          .prepare('UPDATE attendance SET check_out_time = ?, hours_worked = ? WHERE id = ?')
          .run(now, hours, attendance.id);
      } else if (type === 'checkin' && !attendance.check_in_time) {
        this.db
          .prepare('UPDATE attendance SET check_in_time = ? WHERE id = ?')
          .run(now, attendance.id);
      }
    }

    return this.db
      .prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?')
      .get(employeeId, today) as Attendance;
  }

  getAttendanceByEmployee(employeeId: number, startDate?: string, endDate?: string): Attendance[] {
    let query = 'SELECT * FROM attendance WHERE employee_id = ?';
    const params: any[] = [employeeId];

    if (startDate && endDate) {
      query += ' AND date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    } else if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC';

    return this.db.prepare(query).all(...params) as Attendance[];
  }

  getAllAttendance(startDate?: string, endDate?: string): Attendance[] {
    let query = 'SELECT * FROM attendance WHERE 1=1';
    const params: any[] = [];

    if (startDate && endDate) {
      query += ' AND date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    } else if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC, employee_id';

    return this.db.prepare(query).all(...params) as Attendance[];
  }
}

