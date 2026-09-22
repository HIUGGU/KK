import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { heightInInches, unitCostFor } from './processRateService';

/**
 * The stages a cut piece passes through before it can be sold.
 *
 * The line runs raw material -> cutting -> plasma -> tinker -> buffing -> order.
 * Each stage draws only on pieces the stage before it has finished, so work
 * cannot run ahead of itself: pieces on a job that is still `in_progress` are
 * committed to that stage but not yet available to the next one. That is also
 * what makes "how many pieces are sitting at the tinker right now" answerable.
 *
 * Every stage works the same way - on our own floor or out to a vendor, priced
 * from that vendor's rate card for that stage - so one service covers all of
 * them rather than three near-identical copies.
 */

export const STAGES = ['plasma', 'tinker', 'buffing'] as const;
export type Stage = (typeof STAGES)[number];

export const isStage = (value: string): value is Stage =>
  (STAGES as readonly string[]).includes(value);

/** The stage each one feeds off. Plasma takes its pieces from cutting. */
const PREVIOUS_STAGE: Record<Stage, Stage | null> = {
  plasma: null,
  tinker: 'plasma',
  buffing: 'tinker',
};

const STAGE_LABEL: Record<Stage, string> = {
  plasma: 'Plasma',
  tinker: 'Tinker',
  buffing: 'Buffing',
};

const STAGE_PREFIX: Record<Stage, string> = {
  plasma: 'PL',
  tinker: 'TK',
  buffing: 'BF',
};

export type Mode = 'in_house' | 'vendor';

export interface ProcessJobLine {
  id?: number;
  product_id: number;
  product_name?: string;
  unit?: string;
  quantity: number;
  charge_type?: string;
  height_inches?: number;
  rate?: number;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  /** Set when a vendor line had no rate card to price it with */
  unpriced?: boolean;
}

export interface ProcessJob {
  id?: number;
  stage?: string;
  job_number?: string;
  job_date: string;
  mode: Mode;
  vendor_id?: number | null;
  vendor_name?: string;
  work_status?: string;
  completed_date?: string;
  status?: string;
  notes?: string;
  total_quantity?: number;
  total_cost?: number;
  line_count?: number;
  items: ProcessJobLine[];
}

/** Per product, where a stage stands: what it can take, holds, and has finished. */
export interface StageStock {
  product_id: number;
  product_name: string;
  unit?: string;
  height_inches?: number;
  /** Finished by the previous stage (or cut, for plasma) */
  ready: number;
  /** Sent into this stage but not yet finished - physically at the vendor or on the floor */
  in_progress: number;
  /** Finished by this stage, and so available to the next one */
  completed: number;
  /** ready - (in_progress + completed): still waiting to be sent in */
  pending: number;
}

export interface ProcessSummary {
  stage: string;
  stage_label: string;
  total_jobs: number;
  in_house_jobs: number;
  vendor_jobs: number;
  total_quantity: number;
  in_house_quantity: number;
  vendor_quantity: number;
  /** What vendor work at this stage has cost, paid or not. */
  total_cost: number;
  /** Vendor jobs not yet picked into a payment. */
  unpaid_cost: number;
  /** Pieces waiting to be sent into this stage. */
  pending_quantity: number;
  /** Pieces sent in but not yet finished. */
  in_progress_quantity: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export const stageLabel = (stage: Stage) => STAGE_LABEL[stage];

export const jobNumber = (stage: string, id: number) =>
  `${STAGE_PREFIX[stage as Stage] || 'JOB'}-${String(id).padStart(4, '0')}`;

export class ProcessService {
  constructor(private stage: Stage) {}

  private get previous(): Stage | null {
    return PREVIOUS_STAGE[this.stage];
  }

  private jobInclude = {
    vendor: true,
    items: {
      include: { product: true },
      orderBy: { id: 'asc' as const },
    },
  };

  private toLine(item: any): ProcessJobLine {
    return {
      id: item.id,
      product_id: item.productId,
      product_name: item.product ? item.product.name : undefined,
      unit: item.product ? item.product.unit : undefined,
      quantity: Number(item.quantity),
      charge_type: item.chargeType,
      height_inches: item.heightInches === null ? undefined : Number(item.heightInches),
      rate: Number(item.rate),
      unit_cost: Number(item.unitCost),
      total_cost: Number(item.totalCost),
      notes: item.notes || undefined,
    };
  }

  private toJob(j: any): ProcessJob {
    const items = (j.items || []).map((item: any) => this.toLine(item));

    return {
      id: j.id,
      stage: j.stage,
      job_number: jobNumber(j.stage, j.id),
      job_date: j.jobDate.toISOString().split('T')[0],
      mode: j.mode as Mode,
      vendor_id: j.vendorId,
      vendor_name: j.vendor ? j.vendor.name : undefined,
      work_status: j.workStatus,
      completed_date: j.completedDate
        ? j.completedDate.toISOString().split('T')[0]
        : undefined,
      status: j.status,
      notes: j.notes || undefined,
      total_quantity: Number(j.totalQuantity),
      total_cost: Number(j.totalCost),
      line_count: items.length,
      items,
    };
  }

  /** Jobs at this stage, newest first. */
  async getAll(filters?: {
    fromDate?: string;
    toDate?: string;
    mode?: string;
    vendorId?: number;
    status?: string;
    workStatus?: string;
  }): Promise<ProcessJob[]> {
    const where: any = { stage: this.stage };
    const { fromDate, toDate, mode, vendorId, status, workStatus } = filters || {};

    if (fromDate || toDate) {
      where.jobDate = {};
      if (fromDate) where.jobDate.gte = new Date(fromDate);
      if (toDate) where.jobDate.lte = new Date(toDate);
    }
    if (mode) where.mode = mode;
    if (vendorId) where.vendorId = vendorId;
    if (status) where.status = status;
    if (workStatus) where.workStatus = workStatus;

    const jobs = await prisma.processJob.findMany({
      where,
      include: this.jobInclude,
      orderBy: [{ jobDate: 'desc' }, { id: 'desc' }],
    });

    return jobs.map(j => this.toJob(j));
  }

  async getById(id: number): Promise<ProcessJob | null> {
    const job = await prisma.processJob.findUnique({
      where: { id },
      include: this.jobInclude,
    });

    return job && job.stage === this.stage ? this.toJob(job) : null;
  }

  /**
   * Per product: how many pieces the previous stage has finished, how many are
   * in progress here, how many this stage has finished, and what is left
   * waiting. `forJobId` adds back the pieces that job itself holds, so its
   * edit form is not told its own quantities are over the limit.
   */
  async getStock(forJobId?: number): Promise<StageStock[]> {
    const [ready, sent, completed, own] = await Promise.all([
      this.readyByProduct(prisma),
      this.stageQuantities(prisma, this.stage),
      this.stageQuantities(prisma, this.stage, 'completed'),
      forJobId
        ? prisma.processJobItem.groupBy({
            by: ['productId'],
            where: { jobId: forJobId },
            _sum: { quantity: true },
          })
        : Promise.resolve([] as { productId: number; _sum: { quantity: any } }[]),
    ]);

    const productIds = Array.from(
      new Set([...ready.keys(), ...sent.keys(), ...completed.keys()])
    );
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map(p => [p.id, p]));
    const ownByProduct = new Map(
      own.map(row => [row.productId, Number(row._sum.quantity || 0)])
    );

    return productIds
      .map(productId => {
        const product = productById.get(productId);
        const readyCount = ready.get(productId) || 0;
        // The job being edited does not count against itself
        const sentCount = (sent.get(productId) || 0) - (ownByProduct.get(productId) || 0);
        const completedCount = completed.get(productId) || 0;
        const height = product ? heightInInches(product) : null;

        return {
          product_id: productId,
          product_name: product ? product.name : `#${productId}`,
          unit: product ? product.unit : undefined,
          height_inches: height === null ? undefined : height,
          ready: readyCount,
          in_progress: sentCount - completedCount,
          completed: completedCount,
          pending: readyCount - sentCount,
        };
      })
      .filter(row => row.ready > 0 || row.in_progress > 0 || row.completed > 0)
      .sort((a, b) => a.product_name.localeCompare(b.product_name));
  }

  /** Only the products with pieces actually free to send into this stage. */
  async getPending(forJobId?: number): Promise<StageStock[]> {
    const stock = await this.getStock(forJobId);
    return stock.filter(row => row.pending > 0);
  }

  /**
   * What a vendor would charge today for a set of product quantities, without
   * saving anything. The job form uses this to show a total before recording.
   */
  async quote(
    vendorId: number,
    date: string,
    lines: { product_id: number; quantity: number }[]
  ): Promise<ProcessJobLine[]> {
    const priced = await this.priceLines(prisma, 'vendor', vendorId, date, lines);

    const products = await prisma.product.findMany({
      where: { id: { in: priced.map(line => line.productId) } },
    });
    const productById = new Map(products.map(p => [p.id, p]));

    return priced.map(line => {
      const product = productById.get(line.productId);
      return {
        product_id: line.productId,
        product_name: product ? product.name : undefined,
        unit: product ? product.unit : undefined,
        quantity: line.quantity,
        charge_type: line.chargeType,
        height_inches: line.heightInches === null ? undefined : line.heightInches,
        rate: line.rate,
        unit_cost: line.unitCost,
        total_cost: line.totalCost,
        unpriced: line.unpriced,
      };
    });
  }

  async create(job: ProcessJob): Promise<ProcessJob> {
    const mode = this.validMode(job);
    const vendorId = this.validVendorId(job, mode);
    const lines = this.validLines(job);

    const created = await prisma.$transaction(async tx => {
      await this.assertWithinReady(tx, lines);

      const priced = await this.priceLines(tx, mode, vendorId, job.job_date, lines);
      const totals = this.totalsFor(priced);

      return tx.processJob.create({
        data: {
          stage: this.stage,
          jobDate: new Date(job.job_date),
          mode,
          vendorId,
          workStatus: 'in_progress',
          status: mode === 'vendor' ? 'not_paid' : 'not_applicable',
          notes: job.notes || null,
          totalQuantity: totals.quantity,
          totalCost: totals.cost,
          items: { create: priced.map(line => this.lineCreateData(line)) },
        },
      });
    });

    return (await this.getById(created.id)) as ProcessJob;
  }

  /**
   * Replaces a job's lines and re-prices them. A job already closed into a
   * payment is left alone: its cost is part of a settled balance, so changing
   * it would silently put the vendor's books out.
   */
  async update(id: number, job: ProcessJob): Promise<ProcessJob | null> {
    const existing = await prisma.processJob.findUnique({ where: { id } });
    if (!existing || existing.stage !== this.stage) return null;
    if (existing.status === 'paid') throw new Error('JOB_PAID');

    const mode = this.validMode(job);
    const vendorId = this.validVendorId(job, mode);
    const lines = this.validLines(job);

    await prisma.$transaction(async tx => {
      await this.assertWithinReady(tx, lines, id);
      // Pieces already passed on to the next stage cannot be taken back
      await this.assertNotConsumedDownstream(tx, id, lines);

      const priced = await this.priceLines(tx, mode, vendorId, job.job_date, lines);
      const totals = this.totalsFor(priced);

      await tx.processJobItem.deleteMany({ where: { jobId: id } });

      await tx.processJob.update({
        where: { id },
        data: {
          jobDate: new Date(job.job_date),
          mode,
          vendorId,
          status: mode === 'vendor' ? existing.status : 'not_applicable',
          notes: job.notes || null,
          totalQuantity: totals.quantity,
          totalCost: totals.cost,
          items: { create: priced.map(line => this.lineCreateData(line)) },
        },
      });
    });

    return this.getById(id);
  }

  /**
   * Marks the work done, which is what releases these pieces to the next
   * stage. Reopening is allowed only while the next stage has not taken any of
   * them yet.
   */
  async setWorkStatus(id: number, completed: boolean, date?: string): Promise<ProcessJob | null> {
    const existing = await prisma.processJob.findUnique({ where: { id } });
    if (!existing || existing.stage !== this.stage) return null;

    if (!completed) {
      await prisma.$transaction(async tx => {
        const items = await tx.processJobItem.findMany({ where: { jobId: id } });
        await this.assertNotConsumedDownstream(
          tx,
          id,
          items.map(i => ({ product_id: i.productId, quantity: 0 }))
        );
        await tx.processJob.update({
          where: { id },
          data: { workStatus: 'in_progress', completedDate: null },
        });
      });
      return this.getById(id);
    }

    await prisma.processJob.update({
      where: { id },
      data: {
        workStatus: 'completed',
        completedDate: new Date(date || new Date().toISOString().split('T')[0]),
      },
    });

    return this.getById(id);
  }

  /** A job that has been paid for, or whose pieces have moved on, cannot be removed. */
  async remove(id: number): Promise<boolean> {
    const existing = await prisma.processJob.findUnique({ where: { id } });
    if (!existing || existing.stage !== this.stage) return false;
    if (existing.status === 'paid') throw new Error('JOB_PAID');

    await prisma.$transaction(async tx => {
      const items = await tx.processJobItem.findMany({ where: { jobId: id } });
      await this.assertNotConsumedDownstream(
        tx,
        id,
        items.map(i => ({ product_id: i.productId, quantity: 0 }))
      );
      await tx.processJob.delete({ where: { id } });
    });

    return true;
  }

  async getSummary(): Promise<ProcessSummary> {
    const [jobs, stock] = await Promise.all([
      prisma.processJob.findMany({ where: { stage: this.stage } }),
      this.getStock(),
    ]);

    const inHouse = jobs.filter(j => j.mode === 'in_house');
    const vendorJobs = jobs.filter(j => j.mode === 'vendor');
    const quantityOf = (rows: typeof jobs) =>
      rows.reduce((sum, j) => sum + Number(j.totalQuantity), 0);

    return {
      stage: this.stage,
      stage_label: STAGE_LABEL[this.stage],
      total_jobs: jobs.length,
      in_house_jobs: inHouse.length,
      vendor_jobs: vendorJobs.length,
      total_quantity: quantityOf(jobs),
      in_house_quantity: quantityOf(inHouse),
      vendor_quantity: quantityOf(vendorJobs),
      total_cost: round2(vendorJobs.reduce((sum, j) => sum + Number(j.totalCost), 0)),
      unpaid_cost: round2(
        vendorJobs
          .filter(j => j.status === 'not_paid')
          .reduce((sum, j) => sum + Number(j.totalCost), 0)
      ),
      pending_quantity: stock.reduce((sum, row) => sum + Math.max(row.pending, 0), 0),
      in_progress_quantity: stock.reduce((sum, row) => sum + Math.max(row.in_progress, 0), 0),
    };
  }

  /**
   * Pieces per product this stage can draw on: what cutting produced for
   * plasma, or what the stage before finished for the others.
   */
  private async readyByProduct(
    tx: Prisma.TransactionClient | typeof prisma,
    productIds?: number[]
  ): Promise<Map<number, number>> {
    const previous = this.previous;

    if (!previous) {
      const produced = await tx.cuttingOutput.groupBy({
        by: ['productId'],
        where: productIds ? { productId: { in: productIds } } : {},
        _sum: { quantity: true },
      });
      return new Map(produced.map(row => [row.productId, Number(row._sum.quantity || 0)]));
    }

    return this.stageQuantities(tx, previous, 'completed', productIds);
  }

  /**
   * Pieces per product committed to a stage, optionally only those whose job
   * has been marked finished.
   */
  private async stageQuantities(
    tx: Prisma.TransactionClient | typeof prisma,
    stage: Stage,
    workStatus?: string,
    productIds?: number[]
  ): Promise<Map<number, number>> {
    const rows = await tx.processJobItem.groupBy({
      by: ['productId'],
      where: {
        job: { stage, ...(workStatus ? { workStatus } : {}) },
        ...(productIds ? { productId: { in: productIds } } : {}),
      },
      _sum: { quantity: true },
    });

    return new Map(rows.map(row => [row.productId, Number(row._sum.quantity || 0)]));
  }

  private validMode(job: ProcessJob): Mode {
    return job.mode === 'vendor' ? 'vendor' : 'in_house';
  }

  /** In-house work has no vendor; vendor work must name one. */
  private validVendorId(job: ProcessJob, mode: Mode): number | null {
    if (mode === 'in_house') return null;

    const vendorId = Number(job.vendor_id);
    if (!Number.isInteger(vendorId) || vendorId <= 0) throw new Error('NO_VENDOR');
    return vendorId;
  }

  /** Lines worth storing: a real product and a count above zero. */
  private validLines(job: ProcessJob): { product_id: number; quantity: number; notes?: string }[] {
    const lines = (job.items || [])
      .filter(item => Number(item.product_id) > 0 && Number(item.quantity) > 0)
      .map(item => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        notes: item.notes,
      }));

    if (lines.length === 0) throw new Error('NO_ITEMS');

    const productIds = lines.map(line => line.product_id);
    if (new Set(productIds).size !== productIds.length) throw new Error('DUPLICATE_PRODUCT');

    return lines;
  }

  /**
   * Refuses to send more pieces into this stage than the stage before it has
   * finished. `forJobId` excludes the job being edited from what is already
   * committed, so re-saving it unchanged is not treated as a doubling.
   */
  private async assertWithinReady(
    tx: Prisma.TransactionClient,
    lines: { product_id: number; quantity: number }[],
    forJobId?: number
  ): Promise<void> {
    const productIds = lines.map(line => line.product_id);

    const ready = await this.readyByProduct(tx, productIds);

    const committedRows = await tx.processJobItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        job: { stage: this.stage },
        ...(forJobId ? { jobId: { not: forJobId } } : {}),
      },
      _sum: { quantity: true },
    });
    const committed = new Map(
      committedRows.map(row => [row.productId, Number(row._sum.quantity || 0)])
    );

    for (const line of lines) {
      const available = (ready.get(line.product_id) || 0) - (committed.get(line.product_id) || 0);
      if (line.quantity > available) throw new Error('OVER_PENDING');
    }
  }

  /**
   * Stops a job being changed or removed once the next stage has drawn on the
   * pieces it finished - those pieces are physically further down the line.
   */
  private async assertNotConsumedDownstream(
    tx: Prisma.TransactionClient,
    jobId: number,
    lines: { product_id: number; quantity: number }[]
  ): Promise<void> {
    const next = (STAGES as readonly Stage[]).find(s => PREVIOUS_STAGE[s] === this.stage);
    if (!next) return;

    const job = await tx.processJob.findUnique({ where: { id: jobId } });
    // Pieces only become available downstream once this job is finished
    if (!job || job.workStatus !== 'completed') return;

    const productIds = lines.map(line => line.product_id);
    const taken = await tx.processJobItem.count({
      where: { productId: { in: productIds }, job: { stage: next } },
    });

    if (taken > 0) throw new Error('CONSUMED_DOWNSTREAM');
  }

  /**
   * Works out what each line costs. In-house lines are free. Vendor lines are
   * priced from the rate in force on the job date for this stage: a flat
   * charge per piece, or the per-inch rate times the product's height. A line
   * the vendor has no rate for is kept at zero and flagged, rather than
   * blocking the job - the price can be filled in and the job re-saved.
   */
  private async priceLines(
    tx: Prisma.TransactionClient | typeof prisma,
    mode: Mode,
    vendorId: number | null,
    date: string,
    lines: { product_id: number; quantity: number; notes?: string }[]
  ) {
    const productIds = lines.map(line => line.product_id);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) throw new Error('PRODUCT_NOT_FOUND');
    const productById = new Map(products.map(p => [p.id, p]));

    const rates =
      mode === 'vendor' && vendorId
        ? await tx.processRate.findMany({
            where: {
              stage: this.stage,
              vendorId,
              productId: { in: productIds },
              effectiveDate: { lte: new Date(date) },
            },
            orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
          })
        : [];

    // Newest first, so the first rate seen for a product is the one in force
    const rateByProduct = new Map<number, (typeof rates)[number]>();
    for (const rate of rates) {
      if (!rateByProduct.has(rate.productId)) rateByProduct.set(rate.productId, rate);
    }

    return lines.map(line => {
      const product = productById.get(line.product_id)!;
      const height = heightInInches(product);
      const rate = rateByProduct.get(line.product_id);

      if (mode === 'in_house' || !rate) {
        return {
          productId: line.product_id,
          quantity: line.quantity,
          chargeType: 'none',
          heightInches: null as number | null,
          rate: 0,
          unitCost: 0,
          totalCost: 0,
          notes: line.notes,
          unpriced: mode === 'vendor',
        };
      }

      const flatCharge = Number(rate.flatCharge);
      const ratePerInch = Number(rate.ratePerInch);
      const unitCost = unitCostFor(rate.chargeType, flatCharge, ratePerInch, height);

      return {
        productId: line.product_id,
        quantity: line.quantity,
        chargeType: rate.chargeType,
        heightInches: rate.chargeType === 'per_inch' ? height : null,
        rate: rate.chargeType === 'per_inch' ? ratePerInch : flatCharge,
        unitCost,
        totalCost: round2(unitCost * line.quantity),
        notes: line.notes,
        // Priced per inch but the product has no usable height, so it came to nothing
        unpriced: rate.chargeType === 'per_inch' && height === null,
      };
    });
  }

  private lineCreateData(line: {
    productId: number;
    quantity: number;
    chargeType: string;
    heightInches: number | null;
    rate: number;
    unitCost: number;
    totalCost: number;
    notes?: string;
  }) {
    return {
      productId: line.productId,
      quantity: line.quantity,
      chargeType: line.chargeType,
      heightInches: line.heightInches,
      rate: line.rate,
      unitCost: line.unitCost,
      totalCost: line.totalCost,
      notes: line.notes || null,
    };
  }

  private totalsFor(lines: { quantity: number; totalCost: number }[]) {
    return {
      quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      cost: round2(lines.reduce((sum, line) => sum + line.totalCost, 0)),
    };
  }
}
