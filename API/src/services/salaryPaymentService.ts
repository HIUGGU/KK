import prisma from '../config/database';
import { salaryRevisionService, dayKey } from './salaryRevisionService';

export interface SalaryPayment {
  id?: number;
  employee_id: number;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at?: string;
}

export interface MonthlyEarning {
  month: number;
  year: number;
  full_days: number;
  half_days: number;
  absent_days: number;
  earned: number;
}

export interface EmployeeLedger {
  employee_id: number;
  employee_code: string;
  name: string;
  is_constant_salary: boolean;
  base_salary: number;
  total_earned: number;
  total_advances: number;
  total_paid: number;
  balance_due: number;
  last_payment_date?: string;
  monthly_earnings: MonthlyEarning[];
  payments: SalaryPayment[];
}

// Date-only columns are stored at UTC midnight, so a "YYYY-MM-DD" from the UI
// has to be anchored in UTC too - parsing it as a local date shifts the day for
// any machine east of Greenwich.
const toDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (year && month && day) {
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(value);
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

const mapPayment = (p: {
  id: number;
  employeeId: number;
  amount: any;
  paymentDate: Date;
  notes: string | null;
  createdAt: Date;
}): SalaryPayment => ({
  id: p.id,
  employee_id: p.employeeId,
  amount: Number(p.amount),
  payment_date: p.paymentDate.toISOString().split('T')[0],
  notes: p.notes || undefined,
  created_at: p.createdAt.toISOString(),
});

export class SalaryPaymentService {
  async createPayment(
    employeeId: number,
    amount: number,
    paymentDate: string,
    notes?: string
  ): Promise<SalaryPayment> {
    if (!(amount > 0)) {
      throw new Error('Payment amount must be greater than zero');
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    const payment = await prisma.salaryPayment.create({
      data: {
        employeeId,
        amount,
        paymentDate: toDateOnly(paymentDate),
        notes: notes || null,
      },
    });

    return mapPayment(payment);
  }

  async getPayments(employeeId?: number): Promise<SalaryPayment[]> {
    const payments = await prisma.salaryPayment.findMany({
      where: employeeId ? { employeeId } : {},
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
    });
    return payments.map(mapPayment);
  }

  async deletePayment(id: number): Promise<boolean> {
    await prisma.salaryPayment.delete({ where: { id } });
    return true;
  }

  /**
   * What every active employee has earned, been advanced and been paid so far,
   * and what is therefore still owed. `asOf` cuts off attendance, advances and
   * payments after that date (defaults to today).
   */
  async getLedger(asOf?: string, employeeId?: number): Promise<EmployeeLedger[]> {
    const cutoff = asOf ? toDateOnly(asOf) : todayDateOnly();

    const employees = await prisma.employee.findMany({
      where: {
        status: 'active',
        ...(employeeId ? { id: employeeId } : {}),
      },
      orderBy: { employeeId: 'asc' },
    });
    const ids = employees.map((e) => e.id);

    const [attendance, advances, payments] = await Promise.all([
      prisma.attendance.findMany({
        where: { employeeId: { in: ids }, date: { lte: cutoff } },
      }),
      prisma.advance.findMany({
        where: {
          employeeId: { in: ids },
          date: { lte: cutoff },
          status: { in: ['pending', 'deducted'] },
        },
      }),
      prisma.salaryPayment.findMany({
        where: { employeeId: { in: ids }, paymentDate: { lte: cutoff } },
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const rateLookups = await salaryRevisionService.getRateLookups(employees);

    return employees.map((employee) => {
      const empAttendance = attendance.filter((a) => a.employeeId === employee.id);
      const baseSalary = Number(employee.baseSalary);
      const rateOn = rateLookups.get(employee.id)!;

      // Attendance grouped per calendar month, so a fixed-salary employee can be
      // pro-rated against the number of days that month actually has.
      const buckets = new Map<string, MonthlyEarning>();
      for (const record of empAttendance) {
        const month = record.date.getUTCMonth() + 1;
        const year = record.date.getUTCFullYear();
        const key = `${year}-${month}`;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { month, year, full_days: 0, half_days: 0, absent_days: 0, earned: 0 };
          buckets.set(key, bucket);
        }
        if (record.attendanceType === 'full_day') bucket.full_days += 1;
        else if (record.attendanceType === 'half_day') bucket.half_days += 1;
        else bucket.absent_days += 1;

        if (!employee.isConstantSalary) {
          bucket.earned += Number(record.dailySalary);
        } else {
          // The salary is a monthly figure: charge it per attended day, at the
          // monthly rate in force that day so a mid-month change splits cleanly.
          const daysInMonth = new Date(year, month, 0).getDate();
          const weight =
            record.attendanceType === 'full_day' ? 1 : record.attendanceType === 'half_day' ? 0.5 : 0;
          bucket.earned += (rateOn(dayKey(record.date)) * weight) / daysInMonth;
        }
      }

      for (const bucket of buckets.values()) {
        bucket.earned = Math.round(bucket.earned * 100) / 100;
      }

      const monthlyEarnings = Array.from(buckets.values()).sort(
        (a, b) => b.year - a.year || b.month - a.month
      );

      const empPayments = payments.filter((p) => p.employeeId === employee.id);
      const totalEarned = monthlyEarnings.reduce((sum, m) => sum + m.earned, 0);
      const totalAdvances = advances
        .filter((a) => a.employeeId === employee.id)
        .reduce((sum, a) => sum + Number(a.amount), 0);
      const totalPaid = empPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      const round = (n: number) => Math.round(n * 100) / 100;

      return {
        employee_id: employee.id,
        employee_code: employee.employeeId,
        name: employee.name,
        is_constant_salary: employee.isConstantSalary,
        base_salary: baseSalary,
        total_earned: round(totalEarned),
        total_advances: round(totalAdvances),
        total_paid: round(totalPaid),
        balance_due: round(totalEarned - totalAdvances - totalPaid),
        last_payment_date: empPayments[0]?.paymentDate.toISOString().split('T')[0],
        monthly_earnings: monthlyEarnings,
        payments: empPayments.map(mapPayment),
      };
    });
  }
}
