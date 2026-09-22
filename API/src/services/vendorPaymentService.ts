import prisma from '../config/database';
import { jobNumber, stageLabel, Stage } from './processService';

/**
 * Money paid out to the vendors who work the line, the mirror image of client
 * settlements. It covers every stage - plasma, tinker and buffing - because a
 * vendor is paid for what they did, not for which stage it was.
 *
 * A vendor job stays open until it is picked into a payment. Picking it closes
 * it for good, whether or not the money handed over covered it: the shortfall
 * joins the vendor's running payable balance instead of staying attached to
 * the job. That is what lets a vendor be paid part now and the rest later, and
 * a vendor paid more than they billed simply ends up with a negative balance.
 */

export interface UnpaidJob {
  id: number;
  job_number: string;
  stage: string;
  stage_label: string;
  job_date: string;
  total_quantity: number;
  total_cost: number;
  items_summary: string;
}

export interface PaymentJobLine {
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface VendorPaymentItem {
  job_id: number;
  job_number?: string;
  stage?: string;
  stage_label?: string;
  job_amount: number;
  job_date?: string;
  job_lines?: PaymentJobLine[];
}

export interface VendorPayment {
  id?: number;
  vendor_id: number;
  vendor_name?: string;
  payment_date: string;
  previous_balance?: number;
  job_total?: number;
  cash_amount: number;
  bank_amount: number;
  bank_account_id?: number;
  total_amount?: number;
  new_balance?: number;
  notes?: string;
  items?: VendorPaymentItem[];
  created_at?: string;
}

export interface VendorPaymentSummary {
  unpaid_jobs: UnpaidJob[];
  payable_balance: number;
}

export interface VendorBalance {
  vendor_id: number;
  vendor_name: string;
  /** Jobs not yet picked into any payment. */
  unpaid_jobs_total: number;
  /** Carried over from past payments, not tied to any job. */
  payable_balance: number;
  /** unpaid_jobs_total + payable_balance - what we owe the vendor overall. */
  total_payable: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Deep enough to render each closed job's product breakdown beside the payment. */
const paymentItemsInclude = {
  include: {
    job: {
      include: {
        items: { include: { product: true } },
      },
    },
  },
} as const;

function mapPaymentItem(i: {
  jobId: number;
  jobAmount: any;
  job: {
    stage: string;
    jobDate: Date;
    items: { quantity: any; unitCost: any; totalCost: any; product: { name: string } }[];
  };
}): VendorPaymentItem {
  return {
    job_id: i.jobId,
    job_number: jobNumber(i.job.stage, i.jobId),
    stage: i.job.stage,
    stage_label: stageLabel(i.job.stage as Stage),
    job_amount: Number(i.jobAmount),
    job_date: i.job.jobDate.toISOString().split('T')[0],
    job_lines: i.job.items.map(line => ({
      product_name: line.product.name,
      quantity: Number(line.quantity),
      unit_cost: Number(line.unitCost),
      total_cost: Number(line.totalCost),
    })),
  };
}

function mapPayment(p: any): VendorPayment {
  return {
    id: p.id,
    vendor_id: p.vendorId,
    vendor_name: p.vendor ? p.vendor.name : undefined,
    payment_date: p.paymentDate.toISOString().split('T')[0],
    previous_balance: Number(p.previousBalance),
    job_total: Number(p.jobTotal),
    cash_amount: Number(p.cashAmount),
    bank_amount: Number(p.bankAmount),
    bank_account_id: p.bankAccountId || undefined,
    total_amount: Number(p.totalAmount),
    new_balance: Number(p.newBalance),
    notes: p.notes || undefined,
    created_at: p.createdAt.toISOString(),
    items: p.items.map(mapPaymentItem),
  };
}

export class VendorPaymentService {
  /** One row per active vendor: what we still owe them overall. */
  async getAllVendorBalances(): Promise<VendorBalance[]> {
    const [vendors, unpaidTotals] = await Promise.all([
      prisma.vendor.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } }),
      prisma.processJob.groupBy({
        by: ['vendorId'],
        where: { mode: 'vendor', status: 'not_paid' },
        _sum: { totalCost: true },
      }),
    ]);

    const unpaidByVendor = new Map(
      unpaidTotals
        .filter(row => row.vendorId !== null)
        .map(row => [row.vendorId as number, Number(row._sum.totalCost || 0)])
    );

    return vendors.map(v => {
      const unpaidJobsTotal = round2(unpaidByVendor.get(v.id) || 0);
      const payableBalance = round2(Number(v.payableBalance));
      return {
        vendor_id: v.id,
        vendor_name: v.name,
        unpaid_jobs_total: unpaidJobsTotal,
        payable_balance: payableBalance,
        total_payable: round2(unpaidJobsTotal + payableBalance),
      };
    });
  }

  /**
   * Jobs still open for this vendor across every stage (never picked into a
   * payment), plus the running balance not tied to any specific job.
   */
  async getVendorSummary(vendorId: number): Promise<VendorPaymentSummary> {
    const [jobs, vendor] = await Promise.all([
      prisma.processJob.findMany({
        where: { vendorId, mode: 'vendor', status: 'not_paid' },
        include: { items: { include: { product: true } } },
        orderBy: { jobDate: 'asc' },
      }),
      prisma.vendor.findUnique({ where: { id: vendorId } }),
    ]);

    return {
      unpaid_jobs: jobs.map(j => ({
        id: j.id,
        job_number: jobNumber(j.stage, j.id),
        stage: j.stage,
        stage_label: stageLabel(j.stage as Stage),
        job_date: j.jobDate.toISOString().split('T')[0],
        total_quantity: Number(j.totalQuantity),
        total_cost: Number(j.totalCost),
        items_summary: j.items
          .map(i => `${i.product.name} x ${Number(i.quantity)}`)
          .join(', '),
      })),
      payable_balance: vendor ? Number(vendor.payableBalance) : 0,
    };
  }

  /** Every payment across every vendor, newest first. */
  async getAllPayments(): Promise<VendorPayment[]> {
    const payments = await prisma.vendorPayment.findMany({
      include: { items: paymentItemsInclude, bankAccount: true, vendor: true },
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
    });

    return payments.map(mapPayment);
  }

  async getPaymentsByVendor(vendorId: number): Promise<VendorPayment[]> {
    const payments = await prisma.vendorPayment.findMany({
      where: { vendorId },
      include: { items: paymentItemsInclude, bankAccount: true, vendor: true },
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
    });

    return payments.map(mapPayment);
  }

  /**
   * Records money paid to one vendor. Any jobs picked close out for good
   * (whether or not this payment fully covers them); their total, plus
   * whatever we already owed, minus what was actually paid, becomes the
   * vendor's new running balance. Picking no jobs is fine too: that is just a
   * payment against the existing balance.
   */
  async createPayment(input: {
    vendor_id: number;
    payment_date: string;
    cash_amount: number;
    bank_amount: number;
    bank_account_id?: number;
    notes?: string;
    job_ids?: number[];
  }): Promise<VendorPayment> {
    const cash = Number(input.cash_amount) || 0;
    const bank = Number(input.bank_amount) || 0;
    const paid = round2(cash + bank);
    const jobIds = Array.from(new Set(input.job_ids || []));

    if (bank > 0 && !input.bank_account_id) {
      throw new Error('Select a bank account for the bank amount.');
    }

    const created = await prisma.$transaction(async tx => {
      const vendor = await tx.vendor.findUnique({ where: { id: input.vendor_id } });
      if (!vendor) throw new Error('Vendor not found');

      const jobs = jobIds.length
        ? await tx.processJob.findMany({
            where: {
              id: { in: jobIds },
              vendorId: input.vendor_id,
              mode: 'vendor',
              status: 'not_paid',
            },
          })
        : [];

      if (jobs.length !== jobIds.length) {
        throw new Error('One or more selected jobs are unavailable for this vendor.');
      }

      const jobTotal = round2(jobs.reduce((sum, j) => sum + Number(j.totalCost), 0));
      const previousBalance = Number(vendor.payableBalance);
      const totalOwed = round2(previousBalance + jobTotal);

      if (totalOwed <= 0 && paid <= 0) {
        throw new Error('Nothing to pay: select jobs and/or enter an amount paid.');
      }
      if (paid <= 0 && jobIds.length === 0) {
        throw new Error('Enter a cash or bank amount paid, or select jobs to add to the balance.');
      }

      const newBalance = round2(totalOwed - paid);

      if (jobs.length > 0) {
        await tx.processJob.updateMany({
          where: { id: { in: jobs.map(j => j.id) } },
          data: { status: 'paid' },
        });
      }

      await tx.vendor.update({
        where: { id: input.vendor_id },
        data: { payableBalance: newBalance },
      });

      return tx.vendorPayment.create({
        data: {
          vendorId: input.vendor_id,
          paymentDate: new Date(input.payment_date),
          previousBalance,
          jobTotal,
          cashAmount: cash,
          bankAmount: bank,
          bankAccountId: input.bank_account_id || null,
          totalAmount: paid,
          newBalance,
          notes: input.notes || null,
          items: {
            create: jobs.map(j => ({
              jobId: j.id,
              jobAmount: j.totalCost,
            })),
          },
        },
        include: { items: paymentItemsInclude, bankAccount: true, vendor: true },
      });
    });

    return mapPayment(created);
  }

  /**
   * Undoes a payment: restores the vendor's balance to what it was right
   * before, and reopens any jobs it closed. Only the vendor's most recent
   * payment can be undone - undoing an older one would leave the balance math
   * for everything after it wrong.
   */
  async deletePayment(id: number): Promise<boolean> {
    await prisma.$transaction(async tx => {
      const payment = await tx.vendorPayment.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!payment) throw new Error('Payment not found');

      const latest = await tx.vendorPayment.findFirst({
        where: { vendorId: payment.vendorId },
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      });
      if (!latest || latest.id !== id) {
        throw new Error('Only the most recent payment for this vendor can be undone.');
      }

      if (payment.items.length > 0) {
        await tx.processJob.updateMany({
          where: { id: { in: payment.items.map(i => i.jobId) } },
          data: { status: 'not_paid' },
        });
      }

      await tx.vendor.update({
        where: { id: payment.vendorId },
        data: { payableBalance: payment.previousBalance },
      });

      await tx.vendorPayment.delete({ where: { id } });
    });
    return true;
  }
}
