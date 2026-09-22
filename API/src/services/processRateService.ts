import prisma from '../config/database';

/**
 * What a vendor charges to put one piece of a product through a stage.
 *
 * A vendor bills one of two ways, per product:
 *  - flat:     a fixed amount for every piece, whatever its size
 *  - per_inch: an amount for each inch of the product's height
 *
 * Rates are dated, like vendor and client rates elsewhere, so a job keeps the
 * price that was in force on the day it was done. They are also per stage: the
 * same vendor can charge one way for plasma and another for buffing.
 */

export type ChargeType = 'flat' | 'per_inch';

export interface ProcessRate {
  id?: number;
  stage: string;
  vendor_id: number;
  vendor_name?: string;
  product_id: number;
  product_name?: string;
  charge_type: ChargeType;
  /** Per piece, when charge_type is flat */
  flat_charge: number;
  /** Per inch of product height, when charge_type is per_inch */
  rate_per_inch: number;
  effective_date: string;
  notes?: string;
  /** Height in inches the rate would be applied to, for showing a worked-out cost */
  height_inches?: number;
  /** What one piece costs at this rate today */
  unit_cost?: number;
}

/** Multipliers onto inches for the units a product's dimensions can be recorded in. */
const INCHES_PER_UNIT: Record<string, number> = {
  inch: 1,
  in: 1,
  cm: 1 / 2.54,
  mm: 1 / 25.4,
  ft: 12,
  m: 39.3701,
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * A product's height expressed in inches, or null when it has no height
 * recorded. Anything measured in a unit we do not know is left alone rather
 * than silently converted with the wrong factor.
 */
export const heightInInches = (product: {
  height: any;
  dimensionUnit?: string | null;
}): number | null => {
  if (product.height === null || product.height === undefined) return null;

  const factor = INCHES_PER_UNIT[(product.dimensionUnit || 'inch').toLowerCase()];
  if (!factor) return null;

  return round2(Number(product.height) * factor);
};

/** What one piece costs at a rate, given the height it would be billed on. */
export const unitCostFor = (
  chargeType: string,
  flatCharge: number,
  ratePerInch: number,
  height: number | null
): number => {
  if (chargeType === 'per_inch') {
    return height === null ? 0 : round2(ratePerInch * height);
  }
  return round2(flatCharge);
};

export class ProcessRateService {
  private toRate(r: any): ProcessRate {
    const height = r.product ? heightInInches(r.product) : null;
    const chargeType = r.chargeType as ChargeType;
    const flatCharge = Number(r.flatCharge);
    const ratePerInch = Number(r.ratePerInch);

    return {
      id: r.id,
      stage: r.stage,
      vendor_id: r.vendorId,
      vendor_name: r.vendor ? r.vendor.name : undefined,
      product_id: r.productId,
      product_name: r.product ? r.product.name : undefined,
      charge_type: chargeType,
      flat_charge: flatCharge,
      rate_per_inch: ratePerInch,
      effective_date: r.effectiveDate.toISOString().split('T')[0],
      notes: r.notes || undefined,
      height_inches: height === null ? undefined : height,
      unit_cost: r.product
        ? unitCostFor(chargeType, flatCharge, ratePerInch, height)
        : undefined,
    };
  }

  /** Full dated history for a stage, newest first. This list doubles as the rate log. */
  async getRates(stage: string, vendorId?: number, productId?: number): Promise<ProcessRate[]> {
    const where: any = { stage };
    if (vendorId) where.vendorId = vendorId;
    if (productId) where.productId = productId;

    const rates = await prisma.processRate.findMany({
      where,
      include: { vendor: true, product: true },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    });

    return rates.map(r => this.toRate(r));
  }

  /**
   * The rate a vendor charges for a product on a given date: the newest one
   * that had already taken effect. Null when the vendor has no price for it.
   */
  async getEffectiveRate(
    stage: string,
    vendorId: number,
    productId: number,
    date: string
  ): Promise<ProcessRate | null> {
    const rate = await prisma.processRate.findFirst({
      where: {
        stage,
        vendorId,
        productId,
        effectiveDate: { lte: new Date(date) },
      },
      include: { vendor: true, product: true },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    });

    return rate ? this.toRate(rate) : null;
  }

  /** The rate in force for every product this vendor prices at a stage, on the given date. */
  async getCurrentRatesForVendor(
    stage: string,
    vendorId: number,
    date?: string
  ): Promise<ProcessRate[]> {
    const asOf = date || new Date().toISOString().split('T')[0];

    const rates = await prisma.processRate.findMany({
      where: { stage, vendorId, effectiveDate: { lte: new Date(asOf) } },
      include: { vendor: true, product: true },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    });

    // The list is newest first, so the first row seen for a product is the one in force
    const current = new Map<number, any>();
    for (const rate of rates) {
      if (!current.has(rate.productId)) current.set(rate.productId, rate);
    }

    return Array.from(current.values())
      .map(r => this.toRate(r))
      .sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));
  }

  /**
   * Records a rate. Re-stating one for a date that already has a rate
   * overwrites it rather than failing, so same-day corrections work.
   */
  async setRate(rate: ProcessRate): Promise<ProcessRate> {
    const chargeType: ChargeType = rate.charge_type === 'per_inch' ? 'per_inch' : 'flat';
    // Only the figure the chosen charge type uses is kept, so a vendor switched
    // from one basis to the other cannot leave a stale number behind
    const flatCharge = chargeType === 'flat' ? Number(rate.flat_charge) || 0 : 0;
    const ratePerInch = chargeType === 'per_inch' ? Number(rate.rate_per_inch) || 0 : 0;

    if (chargeType === 'flat' && flatCharge <= 0) throw new Error('NO_CHARGE');
    if (chargeType === 'per_inch' && ratePerInch <= 0) throw new Error('NO_CHARGE');

    const effectiveDate = new Date(rate.effective_date);

    const saved = await prisma.processRate.upsert({
      where: {
        stage_vendorId_productId_effectiveDate: {
          stage: rate.stage,
          vendorId: rate.vendor_id,
          productId: rate.product_id,
          effectiveDate,
        },
      },
      update: {
        chargeType,
        flatCharge,
        ratePerInch,
        notes: rate.notes || null,
      },
      create: {
        stage: rate.stage,
        vendorId: rate.vendor_id,
        productId: rate.product_id,
        chargeType,
        flatCharge,
        ratePerInch,
        effectiveDate,
        notes: rate.notes || null,
      },
      include: { vendor: true, product: true },
    });

    return this.toRate(saved);
  }

  async deleteRate(id: number): Promise<boolean> {
    try {
      await prisma.processRate.delete({ where: { id } });
      return true;
    } catch (error) {
      return false;
    }
  }
}
