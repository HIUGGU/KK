/**
 * One-time backfill: salary increases and decreases are now kept in
 * salary_revisions, and every day is paid at the salary in force on it. Existing
 * employees have no history, so each gets an opening entry of their current
 * salary effective from their hire date - past periods keep being paid as they
 * were until older changes are entered on the Salary Changes page.
 *
 * Run with: npx ts-node --transpile-only -P API/tsconfig.json scripts/backfill-salary-revisions.ts
 * Safe to re-run: employees that already have a revision are skipped.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    include: { _count: { select: { salaryRevisions: true } } },
    orderBy: { id: 'asc' },
  });

  let created = 0;
  let skipped = 0;

  for (const employee of employees) {
    if (employee._count.salaryRevisions > 0) {
      skipped += 1;
      continue;
    }

    await prisma.salaryRevision.create({
      data: {
        employeeId: employee.id,
        oldSalary: null,
        newSalary: employee.baseSalary,
        isConstantSalary: employee.isConstantSalary,
        effectiveDate: employee.hireDate,
        source: 'backfill',
      },
    });
    created += 1;
  }

  console.log(`Opening salary entries created: ${created}, skipped (already had history): ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
