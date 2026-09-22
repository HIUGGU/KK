import prisma from '../config/database';
import { AdvanceService } from './advanceService';
import { salaryRevisionService, dayKey } from './salaryRevisionService';

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
  extra_amount?: number;
  total_advances?: number;
  deductions: number;
  net_salary: number;
  payout_date?: string;
  status?: string;
}

export class SalaryService {
  private advanceService: AdvanceService;

  constructor() {
    this.advanceService = new AdvanceService();
  }

  // Shared calculation logic
  private async performCalculation(
    employeeId: number,
    month: number,
    year: number,
    extraAmount: number = 0
  ) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const fullDays = attendance.filter((a) => a.attendanceType === 'full_day').length;
    const halfDays = attendance.filter((a) => a.attendanceType === 'half_day').length;
    const daysAbsent = attendance.filter((a) => a.attendanceType === 'absent').length;
    const daysPresent = fullDays + halfDays;

    // The monthly figure in force at month end, and for a fixed salary, each
    // calendar day charged at the rate in force that day so a mid-month
    // increase or decrease is split between the two rates.
    const rateOn = await salaryRevisionService.getRateLookup(employeeId, Number(employee.baseSalary));
    const daysInMonth = endDate.getDate();
    const baseSalary = rateOn(dayKey(new Date(Date.UTC(year, month - 1, daysInMonth))));

    let grossSalary: number;
    if (employee.isConstantSalary) {
      let total = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        total += rateOn(dayKey(new Date(Date.UTC(year, month - 1, day))));
      }
      grossSalary = Math.round((total / daysInMonth) * 100) / 100;
    } else {
      grossSalary = attendance.reduce((sum, a) => sum + Number(a.dailySalary), 0);
    }

    const totalAdvances = await this.advanceService.getPendingAdvancesForPeriod(
      employeeId,
      startDate,
      endDate
    );

    const deductions = 0;
    const netSalary = grossSalary + extraAmount - totalAdvances - deductions;
    const totalHours = (fullDays * 8) + (halfDays * 4);

    return {
      employee,
      baseSalary,
      daysPresent,
      daysAbsent,
      totalHours,
      grossSalary,
      totalAdvances,
      deductions,
      netSalary
    };
  }

  async previewSalary(
    employeeId: number,
    month: number,
    year: number,
    extraAmount: number = 0
  ) {
    const calc = await this.performCalculation(employeeId, month, year, extraAmount);
    return {
      employee_id: employeeId,
      month,
      year,
      base_salary: calc.baseSalary,
      is_constant_salary: calc.employee.isConstantSalary,
      days_present: calc.daysPresent,
      days_absent: calc.daysAbsent,
      total_hours: calc.totalHours,
      gross_salary: calc.grossSalary,
      extra_amount: extraAmount,
      total_advances: calc.totalAdvances,
      deductions: calc.deductions,
      net_salary: calc.netSalary,
      status: 'preview'
    };
  }

  async calculateSalary(
    employeeId: number,
    month: number,
    year: number,
    extraAmount: number = 0,
    payoutDate?: string
  ): Promise<SalaryRecord> {
    const calc = await this.performCalculation(employeeId, month, year, extraAmount);
    const payoutDateObj = payoutDate ? new Date(payoutDate) : null;

    // Check if record exists
    const existing = await prisma.salaryRecord.findUnique({
      where: {
        employeeId_month_year: {
          employeeId,
          month,
          year,
        },
      },
    });

    const data = {
      employeeId,
      month,
      year,
      baseSalary: calc.baseSalary,
      daysPresent: calc.daysPresent,
      daysAbsent: calc.daysAbsent,
      totalHours: calc.totalHours,
      grossSalary: calc.grossSalary,
      extraAmount,
      totalAdvances: calc.totalAdvances,
      deductions: calc.deductions,
      netSalary: calc.netSalary,
      payoutDate: payoutDateObj,
    };

    let record;
    if (existing) {
      record = await prisma.salaryRecord.update({
        where: { id: existing.id },
        data: {
          ...data,
          status: existing.status === 'paid' ? 'paid' : 'not_paid',
        },
      });
    } else {
      record = await prisma.salaryRecord.create({
        data: {
          ...data,
          status: 'not_paid',
        },
      });
    }

    return {
      id: record.id,
      employee_id: record.employeeId,
      month: record.month,
      year: record.year,
      base_salary: Number(record.baseSalary),
      days_present: record.daysPresent,
      days_absent: record.daysAbsent,
      total_hours: Number(record.totalHours),
      gross_salary: Number(record.grossSalary),
      extra_amount: Number(record.extraAmount),
      total_advances: Number(record.totalAdvances),
      deductions: Number(record.deductions),
      net_salary: Number(record.netSalary),
      payout_date: record.payoutDate?.toISOString().split('T')[0],
      status: record.status,
    };
  }

  async getSalaryHistory(employeeId?: number): Promise<SalaryRecord[]> {
    const where = employeeId ? { employeeId } : {};

    const records = await prisma.salaryRecord.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return records.map(record => ({
      id: record.id,
      employee_id: record.employeeId,
      month: record.month,
      year: record.year,
      base_salary: Number(record.baseSalary),
      days_present: record.daysPresent,
      days_absent: record.daysAbsent,
      total_hours: Number(record.totalHours),
      gross_salary: Number(record.grossSalary),
      extra_amount: Number(record.extraAmount),
      total_advances: Number(record.totalAdvances),
      deductions: Number(record.deductions),
      net_salary: Number(record.netSalary),
      payout_date: record.payoutDate?.toISOString().split('T')[0],
      status: record.status,
    }));
  }

  async updateSalaryStatus(id: number, status: 'paid' | 'not_paid'): Promise<SalaryRecord> {
    const updated = await prisma.salaryRecord.update({
      where: { id },
      data: { status },
    });

    return {
      id: updated.id,
      employee_id: updated.employeeId,
      month: updated.month,
      year: updated.year,
      base_salary: Number(updated.baseSalary),
      days_present: updated.daysPresent,
      days_absent: updated.daysAbsent,
      total_hours: Number(updated.totalHours),
      gross_salary: Number(updated.grossSalary),
      extra_amount: Number(updated.extraAmount),
      total_advances: Number(updated.totalAdvances),
      deductions: Number(updated.deductions),
      net_salary: Number(updated.netSalary),
      payout_date: updated.payoutDate?.toISOString().split('T')[0],
      status: updated.status,
    };
  }
}
