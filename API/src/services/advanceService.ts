import prisma from '../config/database';

export interface Advance {
  id?: number;
  employee_id: number;
  amount: number;
  remark?: string;
  date: string;
  status: 'pending' | 'deducted' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

export class AdvanceService {
  async createAdvance(
    employeeId: number,
    amount: number,
    remark: string,
    date: string
  ): Promise<Advance> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    // Keep the UTC midnight a yyyy-mm-dd string parses to, so the stored day matches
    const advanceDate = new Date(date);

    const advance = await prisma.advance.create({
      data: {
        employeeId,
        amount,
        remark: remark || null,
        date: advanceDate,
        status: 'pending',
      },
    });

    return {
      id: advance.id,
      employee_id: advance.employeeId,
      amount: Number(advance.amount),
      remark: advance.remark || undefined,
      date: advance.date.toISOString().split('T')[0],
      status: advance.status as 'pending' | 'deducted' | 'cancelled',
      created_at: advance.createdAt.toISOString(),
      updated_at: advance.updatedAt.toISOString(),
    };
  }

  async getAdvancesByEmployee(
    employeeId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Advance[]> {
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

    const advances = await prisma.advance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return advances.map(adv => ({
      id: adv.id,
      employee_id: adv.employeeId,
      amount: Number(adv.amount),
      remark: adv.remark || undefined,
      date: adv.date.toISOString().split('T')[0],
      status: adv.status as 'pending' | 'deducted' | 'cancelled',
      created_at: adv.createdAt.toISOString(),
      updated_at: adv.updatedAt.toISOString(),
    }));
  }

  async getAllAdvances(startDate?: string, endDate?: string): Promise<Advance[]> {
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

    const advances = await prisma.advance.findMany({
      where,
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
    });

    return advances.map(adv => ({
      id: adv.id,
      employee_id: adv.employeeId,
      amount: Number(adv.amount),
      remark: adv.remark || undefined,
      date: adv.date.toISOString().split('T')[0],
      status: adv.status as 'pending' | 'deducted' | 'cancelled',
      created_at: adv.createdAt.toISOString(),
      updated_at: adv.updatedAt.toISOString(),
    }));
  }

  async getPendingAdvancesForPeriod(
    employeeId: number,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const advances = await prisma.advance.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['pending', 'deducted'],
        },
      },
    });

    return advances.reduce((sum, adv) => sum + Number(adv.amount), 0);
  }

  async updateAdvanceStatus(
    id: number,
    status: 'pending' | 'deducted' | 'cancelled'
  ): Promise<Advance> {
    const advance = await prisma.advance.update({
      where: { id },
      data: { status },
    });

    return {
      id: advance.id,
      employee_id: advance.employeeId,
      amount: Number(advance.amount),
      remark: advance.remark || undefined,
      date: advance.date.toISOString().split('T')[0],
      status: advance.status as 'pending' | 'deducted' | 'cancelled',
      created_at: advance.createdAt.toISOString(),
      updated_at: advance.updatedAt.toISOString(),
    };
  }

  async deleteAdvance(id: number): Promise<boolean> {
    await prisma.advance.delete({
      where: { id },
    });
    return true;
  }
}








