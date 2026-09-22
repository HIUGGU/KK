import prisma from '../config/database';
import { SalaryService } from './salaryService';
import { salaryRevisionService, dayKey } from './salaryRevisionService';

export interface Attendance {
  id?: number;
  employee_id: number;
  date: string;
  attendance_type: 'full_day' | 'half_day' | 'absent';
  daily_salary: number;
  notes?: string;
}

export class AttendanceService {
  async markAttendance(
    employeeId: number, 
    date: string, 
    attendanceType: 'full_day' | 'half_day' | 'absent'
  ): Promise<Attendance> {
    // Get employee details for salary calculation
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Calculate daily salary based on attendance type
    // For constant salary employees, don't calculate daily salary (set to 0)
    // baseSalary is now stored as daily salary, not monthly. The day is priced at
    // the salary in force on it, so re-marking an old day never picks up a later raise.
    const rateOn = await salaryRevisionService.getRateLookup(employee);
    const baseDailySalary = rateOn(dayKey(attendanceDate));
    
    let dailySalary = 0;
    // Skip salary calculation for constant salary employees
    if (!employee.isConstantSalary) {
      if (attendanceType === 'full_day') {
        dailySalary = baseDailySalary;
      } else if (attendanceType === 'half_day') {
        dailySalary = baseDailySalary / 2;
      } else {
        dailySalary = 0; // absent
      }
    }
    // For constant salary employees, dailySalary remains 0

    // Check if attendance record exists
    let attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: attendanceDate,
        },
      },
    });

    if (attendance) {
      // Update existing record
      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          attendanceType,
          dailySalary,
        },
      });
    } else {
      // Create new attendance record
      attendance = await prisma.attendance.create({
        data: {
          employeeId,
          date: attendanceDate,
          attendanceType,
          dailySalary,
        },
      });
    }

    // Auto-recalculate salary for this employee's month/year
    const month = attendanceDate.getMonth() + 1;
    const year = attendanceDate.getFullYear();
    try {
      const salaryService = new SalaryService();
      await salaryService.calculateSalary(employeeId, month, year);
    } catch (err) {
      console.error('Auto salary recalculation failed:', err);
    }

    return {
      id: attendance.id,
      employee_id: attendance.employeeId,
      date: attendance.date.toISOString().split('T')[0],
      attendance_type: attendance.attendanceType as 'full_day' | 'half_day' | 'absent',
      daily_salary: Number(attendance.dailySalary),
      notes: attendance.notes || undefined,
    };
  }

  async getAttendanceByEmployee(
    employeeId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Attendance[]> {
    const where: any = { employeeId };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    } else if (endDate) {
      where.date = { lte: new Date(endDate) };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return attendance.map(att => ({
      id: att.id,
      employee_id: att.employeeId,
      date: att.date.toISOString().split('T')[0],
      attendance_type: att.attendanceType as 'full_day' | 'half_day' | 'absent',
      daily_salary: Number(att.dailySalary),
      notes: att.notes || undefined,
    }));
  }

  async getAllAttendance(startDate?: string, endDate?: string): Promise<Attendance[]> {
    const where: any = {};

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    } else if (endDate) {
      where.date = { lte: new Date(endDate) };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
    });

    return attendance.map(att => ({
      id: att.id,
      employee_id: att.employeeId,
      date: att.date.toISOString().split('T')[0],
      attendance_type: att.attendanceType as 'full_day' | 'half_day' | 'absent',
      daily_salary: Number(att.dailySalary),
      notes: att.notes || undefined,
    }));
  }
}
