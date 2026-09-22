import prisma from '../config/database';

export interface SalaryRevisionEntry {
  id: number;
  employee_id: number;
  employee_code?: string;
  employee_name?: string;
  old_salary: number | null;
  new_salary: number;
  /// new_salary - old_salary; null for the opening entry.
  change: number | null;
  change_percent: number | null;
  is_constant_salary: boolean;
  effective_date: string;
  reason?: string;
  source: string;
  changed_at: string;
}

type Revision = {
  id: number;
  newSalary: any;
  effectiveDate: Date;
};

// Date-only columns come back as UTC midnight, so the UTC date is the stored day.
export const dayKey = (d: Date) => d.toISOString().split('T')[0];

const todayKey = () => {
  const now = new Date();
  return dayKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
};

const toDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Salary in force on any given day, from an employee's revisions. The latest
 * revision effective on or before the day wins, ties going to the most recently
 * entered one (that is how a mistaken entry gets corrected). Days before the
 * first revision use the opening salary; with no revisions at all, `fallback`.
 */
export function buildRateLookup(revisions: Revision[], fallback: number) {
  const sorted = revisions
    .map((r) => ({ id: r.id, day: dayKey(r.effectiveDate), salary: Number(r.newSalary) }))
    .sort((a, b) => (a.day === b.day ? a.id - b.id : a.day < b.day ? -1 : 1));

  return (day: string): number => {
    if (sorted.length === 0) return fallback;
    let rate = sorted[0].salary;
    for (const r of sorted) {
      if (r.day > day) break;
      rate = r.salary;
    }
    return rate;
  };
}

export class SalaryRevisionService {
  async getRateLookup(employeeId: number, fallback: number) {
    const revisions = await prisma.salaryRevision.findMany({ where: { employeeId } });
    return buildRateLookup(revisions, fallback);
  }

  /** Rate lookups for several employees in one query, keyed by employee id. */
  async getRateLookups(employees: { id: number; baseSalary: any }[]) {
    const revisions = await prisma.salaryRevision.findMany({
      where: { employeeId: { in: employees.map((e) => e.id) } },
    });
    const lookups = new Map<number, (day: string) => number>();
    for (const e of employees) {
      lookups.set(
        e.id,
        buildRateLookup(revisions.filter((r) => r.employeeId === e.id), Number(e.baseSalary))
      );
    }
    return lookups;
  }

  /** Opening entry when an employee is created: their salary from the hire date. */
  async recordOpening(employee: {
    id: number;
    baseSalary: any;
    isConstantSalary: boolean;
    hireDate: Date;
  }) {
    await prisma.salaryRevision.create({
      data: {
        employeeId: employee.id,
        oldSalary: null,
        newSalary: employee.baseSalary,
        isConstantSalary: employee.isConstantSalary,
        effectiveDate: employee.hireDate,
        source: 'employee_created',
      },
    });
  }

  /**
   * Record an increase or decrease effective from `effectiveDate`, then bring
   * everything priced off the salary back in line: Employee.baseSalary becomes
   * whatever is in force today, and daily-wage attendance from the effective
   * date on is re-priced at the rate in force on each day.
   */
  async addRevision(
    employeeId: number,
    newSalary: number,
    effectiveDate: string,
    reason?: string,
    source = 'revision_added'
  ): Promise<SalaryRevisionEntry> {
    if (!(newSalary >= 0) || !Number.isFinite(newSalary)) {
      throw new Error('New salary must be zero or more');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate || '')) {
      throw new Error('Effective date is required (YYYY-MM-DD)');
    }
    if (effectiveDate > todayKey()) {
      throw new Error('Effective date cannot be in the future - record the change on or after the day it applies');
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    const revision = await prisma.$transaction(async (tx) => {
      const existing = await tx.salaryRevision.findMany({ where: { employeeId } });
      // Without an opening entry the new figure would apply to every earlier day too.
      if (existing.length === 0) {
        existing.push(
          await tx.salaryRevision.create({
            data: {
              employeeId,
              oldSalary: null,
              newSalary: employee.baseSalary,
              isConstantSalary: employee.isConstantSalary,
              effectiveDate: employee.hireDate,
              source: 'backfill',
            },
          })
        );
      }
      const before = buildRateLookup(existing, Number(employee.baseSalary));
      const oldSalary = before(effectiveDate);

      const created = await tx.salaryRevision.create({
        data: {
          employeeId,
          oldSalary,
          newSalary,
          isConstantSalary: employee.isConstantSalary,
          effectiveDate: toDateOnly(effectiveDate),
          reason: reason?.trim() || null,
          source,
        },
      });

      const rateOn = buildRateLookup([...existing, created], Number(employee.baseSalary));
      await tx.employee.update({
        where: { id: employeeId },
        data: { baseSalary: rateOn(todayKey()) },
      });

      if (!employee.isConstantSalary) {
        const affected = await tx.attendance.findMany({
          where: { employeeId, date: { gte: toDateOnly(effectiveDate) } },
        });
        for (const a of affected) {
          const rate = rateOn(dayKey(a.date));
          const dailySalary =
            a.attendanceType === 'full_day' ? rate : a.attendanceType === 'half_day' ? rate / 2 : 0;
          if (Number(a.dailySalary) !== dailySalary) {
            await tx.attendance.update({ where: { id: a.id }, data: { dailySalary } });
          }
        }
      }

      return created;
    });

    return this.toEntry(revision);
  }

  async getRevisions(employeeId?: number): Promise<SalaryRevisionEntry[]> {
    const revisions = await prisma.salaryRevision.findMany({
      where: employeeId ? { employeeId } : {},
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
      include: { employee: { select: { employeeId: true, name: true } } },
    });

    return revisions.map((r) => ({
      ...this.toEntry(r),
      employee_code: r.employee.employeeId,
      employee_name: r.employee.name,
    }));
  }

  private toEntry(r: {
    id: number;
    employeeId: number;
    oldSalary: any;
    newSalary: any;
    isConstantSalary: boolean;
    effectiveDate: Date;
    reason: string | null;
    source: string;
    createdAt: Date;
  }): SalaryRevisionEntry {
    const oldSalary = r.oldSalary === null ? null : Number(r.oldSalary);
    const newSalary = Number(r.newSalary);
    const change = oldSalary === null ? null : round2(newSalary - oldSalary);
    return {
      id: r.id,
      employee_id: r.employeeId,
      old_salary: oldSalary,
      new_salary: newSalary,
      change,
      change_percent:
        change === null || !oldSalary ? null : round2((change / oldSalary) * 100),
      is_constant_salary: r.isConstantSalary,
      effective_date: dayKey(r.effectiveDate),
      reason: r.reason || undefined,
      source: r.source,
      changed_at: r.createdAt.toISOString(),
    };
  }
}

export const salaryRevisionService = new SalaryRevisionService();
