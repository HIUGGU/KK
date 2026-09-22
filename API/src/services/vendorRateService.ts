import prisma from '../config/database';

export interface VendorRate {
  id?: number;
  vendor_id: number;
  vendor_name?: string;
  point_id: number;
  point_name?: string;
  rate_per_kg: number;
  effective_date: string;
  notes?: string;
}

export class VendorRateService {
  private toRate(r: any): VendorRate {
    return {
      id: r.id,
      vendor_id: r.vendorId,
      vendor_name: r.vendor ? r.vendor.name : undefined,
      point_id: r.pointId,
      point_name: r.point ? r.point.name : undefined,
      rate_per_kg: Number(r.ratePerKg),
      effective_date: r.effectiveDate.toISOString().split('T')[0],
      notes: r.notes || undefined,
    };
  }

  /** Full dated history, newest first. This list is the price log. */
  async getRates(vendorId?: number, pointId?: number): Promise<VendorRate[]> {
    const where: any = {};
    if (vendorId) where.vendorId = vendorId;
    if (pointId) where.pointId = pointId;

    const rates = await prisma.vendorRate.findMany({
      where,
      include: { vendor: true, point: true },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    });

    return rates.map(r => this.toRate(r));
  }

  /**
   * The rate a vendor charges for a point on a given date: the newest rate
   * that had already taken effect. Returns null when nothing is mapped yet.
   */
  async getEffectiveRate(vendorId: number, pointId: number, date: string): Promise<VendorRate | null> {
    const rate = await prisma.vendorRate.findFirst({
      where: {
        vendorId,
        pointId,
        effectiveDate: { lte: new Date(date) },
      },
      include: { vendor: true, point: true },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    });

    return rate ? this.toRate(rate) : null;
  }

  /** The rate in force for every point this vendor supplies, on the given date. */
  async getCurrentRatesForVendor(vendorId: number, date?: string): Promise<VendorRate[]> {
    const asOf = date || new Date().toISOString().split('T')[0];
    const points = await prisma.materialPoint.findMany({ orderBy: { name: 'asc' } });

    const current: VendorRate[] = [];
    for (const point of points) {
      const rate = await this.getEffectiveRate(vendorId, point.id, asOf);
      if (rate) current.push(rate);
    }

    return current;
  }

  /**
   * Records a rate. Re-stating a rate for a date that already has one
   * overwrites it rather than failing, so same-day corrections work.
   */
  async setRate(rate: VendorRate): Promise<VendorRate> {
    const effectiveDate = new Date(rate.effective_date);

    const saved = await prisma.vendorRate.upsert({
      where: {
        vendorId_pointId_effectiveDate: {
          vendorId: rate.vendor_id,
          pointId: rate.point_id,
          effectiveDate,
        },
      },
      update: {
        ratePerKg: rate.rate_per_kg,
        notes: rate.notes || null,
      },
      create: {
        vendorId: rate.vendor_id,
        pointId: rate.point_id,
        ratePerKg: rate.rate_per_kg,
        effectiveDate,
        notes: rate.notes || null,
      },
      include: { vendor: true, point: true },
    });

    return this.toRate(saved);
  }

  async deleteRate(id: number): Promise<boolean> {
    try {
      await prisma.vendorRate.delete({ where: { id } });
      return true;
    } catch (error) {
      return false;
    }
  }
}
