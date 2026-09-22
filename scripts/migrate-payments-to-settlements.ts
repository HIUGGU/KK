/**
 * One-off: folds every row of the legacy `payments` table into the new
 * Settlement ledger before that table is dropped. Each payment reduces the
 * client's outstandingBalance (going negative = credit), applied in
 * chronological order per client so later settlements see the right
 * starting balance. Run once: npx ts-node scripts/migrate-payments-to-settlements.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const payments = await prisma.payment.findMany({
    orderBy: [{ clientId: 'asc' }, { paymentDate: 'asc' }, { id: 'asc' }],
  });

  console.log(`Migrating ${payments.length} payment(s) into settlements...`);

  for (const payment of payments) {
    await prisma.$transaction(async tx => {
      const client = await tx.client.findUnique({ where: { id: payment.clientId } });
      if (!client) {
        console.warn(`Skipping payment ${payment.id}: client ${payment.clientId} no longer exists`);
        return;
      }

      const amount = Number(payment.amount);
      const isBank = payment.paymentMethod === 'bank_transfer';
      const previousBalance = Number(client.outstandingBalance);
      const newBalance = round2(previousBalance - amount);

      const noteParts = [`Migrated from Payments (${payment.paymentType})`];
      if (payment.transactionId) noteParts.push(`txn: ${payment.transactionId}`);
      if (payment.notes) noteParts.push(payment.notes);

      await tx.settlement.create({
        data: {
          clientId: payment.clientId,
          settlementDate: payment.paymentDate,
          previousBalance,
          orderTotal: 0,
          cashAmount: isBank ? 0 : amount,
          bankAmount: isBank ? amount : 0,
          bankAccountId: payment.bankAccountId,
          totalAmount: amount,
          newBalance,
          notes: noteParts.join(' - '),
        },
      });

      await tx.client.update({
        where: { id: payment.clientId },
        data: { outstandingBalance: newBalance },
      });
    });
    console.log(`Migrated payment ${payment.id} (client ${payment.clientId}, ₹${payment.amount})`);
  }

  console.log('Done.');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
