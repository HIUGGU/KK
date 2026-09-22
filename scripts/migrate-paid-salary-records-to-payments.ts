/**
 * One-time backfill: salary used to be tracked as one record per employee per
 * month with a paid/not_paid flag. Payouts now happen whenever, so each payout
 * is its own row in salary_payments. This turns every already-paid monthly
 * record into a payment so the running balance starts from the right place.
 *
 * Run with: npx ts-node --transpile-only scripts/migrate-paid-salary-records-to-payments.ts
 * Safe to re-run: records already backfilled are skipped.
 */
import prisma from '../API/src/config/database';

const NOTE_PREFIX = 'Migrated from monthly salary record';

async function main() {
  const paidRecords = await prisma.salaryRecord.findMany({
    where: { status: 'paid' },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  console.log(`Found ${paidRecords.length} paid monthly salary record(s).`);

  let created = 0;
  let skipped = 0;

  for (const record of paidRecords) {
    const note = `${NOTE_PREFIX} #${record.id}`;
    const existing = await prisma.salaryPayment.findFirst({
      where: { employeeId: record.employeeId, notes: note },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const amount = Number(record.netSalary);
    if (amount <= 0) {
      skipped += 1;
      continue;
    }

    // Fall back to the last day of the salary month when no payout date was set.
    const paymentDate =
      record.payoutDate ??
      new Date(Date.UTC(record.year, record.month, 0));

    await prisma.salaryPayment.create({
      data: {
        employeeId: record.employeeId,
        amount,
        paymentDate,
        notes: note,
      },
    });
    created += 1;
  }

  console.log(`Created ${created} payment(s), skipped ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
