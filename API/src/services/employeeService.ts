import prisma from '../config/database';
import { salaryRevisionService } from './salaryRevisionService';

export interface Employee {
  id?: number;
  employee_id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  base_salary: number;
  is_constant_salary?: boolean;
  hire_date: string;
  status?: string;
}

export class EmployeeService {
  async getAllEmployees(): Promise<Employee[]> {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return employees.map(emp => ({
      id: emp.id,
      employee_id: emp.employeeId,
      name: emp.name,
      email: emp.email || undefined,
      phone: emp.phone || undefined,
      department: emp.department || undefined,
      position: emp.position || undefined,
      base_salary: Number(emp.baseSalary),
      is_constant_salary: emp.isConstantSalary,
      hire_date: emp.hireDate.toISOString().split('T')[0],
      status: emp.status,
    }));
  }

  async getEmployeeById(id: number): Promise<Employee | null> {
    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) return null;

    return {
      id: employee.id,
      employee_id: employee.employeeId,
      name: employee.name,
      email: employee.email || undefined,
      phone: employee.phone || undefined,
      department: employee.department || undefined,
      position: employee.position || undefined,
      base_salary: Number(employee.baseSalary),
      is_constant_salary: employee.isConstantSalary,
      hire_date: employee.hireDate.toISOString().split('T')[0],
      status: employee.status,
    };
  }

  async createEmployee(employee: Employee): Promise<Employee> {
    const created = await prisma.employee.create({
      data: {
        employeeId: employee.employee_id,
        name: employee.name,
        email: employee.email || null,
        phone: employee.phone || null,
        department: employee.department || null,
        position: employee.position || null,
        baseSalary: employee.base_salary,
        isConstantSalary: employee.is_constant_salary || false,
        hireDate: new Date(employee.hire_date),
        status: employee.status || 'active',
      },
    });
    await salaryRevisionService.recordOpening(created);

    return {
      id: created.id,
      employee_id: created.employeeId,
      name: created.name,
      email: created.email || undefined,
      phone: created.phone || undefined,
      department: created.department || undefined,
      position: created.position || undefined,
      base_salary: Number(created.baseSalary),
      is_constant_salary: created.isConstantSalary,
      hire_date: created.hireDate.toISOString().split('T')[0],
      status: created.status,
    };
  }

  async updateEmployee(id: number, employee: Partial<Employee>): Promise<Employee | null> {
    const updateData: any = {};

    if (employee.employee_id) updateData.employeeId = employee.employee_id;
    if (employee.name) updateData.name = employee.name;
    if (employee.email !== undefined) updateData.email = employee.email || null;
    if (employee.phone !== undefined) updateData.phone = employee.phone || null;
    if (employee.department !== undefined) updateData.department = employee.department || null;
    if (employee.position !== undefined) updateData.position = employee.position || null;
    if (employee.is_constant_salary !== undefined) updateData.isConstantSalary = employee.is_constant_salary;
    if (employee.hire_date) updateData.hireDate = new Date(employee.hire_date);
    if (employee.status) updateData.status = employee.status;

    // A constant salary is never increased or decreased, so editing it here is a
    // correction of the fixed amount and simply overwrites it.
    const isConstant =
      employee.is_constant_salary ??
      (await prisma.employee.findUnique({ where: { id }, select: { isConstantSalary: true } }))
        ?.isConstantSalary;
    if (isConstant && employee.base_salary !== undefined) {
      updateData.baseSalary = employee.base_salary;
    }

    let updated = await prisma.employee.update({
      where: { id },
      data: updateData,
    });

    // A daily wage change is never a plain overwrite: it goes into the revision
    // history, effective today. Back-dated changes use the salary revisions API.
    if (
      !updated.isConstantSalary &&
      employee.base_salary !== undefined &&
      Number(employee.base_salary) !== Number(updated.baseSalary)
    ) {
      const now = new Date();
      const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
        .toISOString()
        .split('T')[0];
      await salaryRevisionService.addRevision(
        id,
        Number(employee.base_salary),
        today,
        undefined,
        'employee_edited'
      );
      updated = await prisma.employee.findUniqueOrThrow({ where: { id } });
    }

    return {
      id: updated.id,
      employee_id: updated.employeeId,
      name: updated.name,
      email: updated.email || undefined,
      phone: updated.phone || undefined,
      department: updated.department || undefined,
      position: updated.position || undefined,
      base_salary: Number(updated.baseSalary),
      is_constant_salary: updated.isConstantSalary,
      hire_date: updated.hireDate.toISOString().split('T')[0],
      status: updated.status,
    };
  }

  async deleteEmployee(id: number): Promise<boolean> {
    try {
      await prisma.employee.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
