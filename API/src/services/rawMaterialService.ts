import prisma from '../config/database';
import { VendorRateService } from './vendorRateService';

export const RAW_MATERIAL_STATUSES = ['in_stock', 'in_use', 'consumed', 'returned'];

/** One line of a delivery: a lot of one point/size that moves through statuses on its own. */
export interface RawMaterialItem {
  id?: number;
  entry_id?: number;
  point_id: number;
  point_name?: string;
  size_id: number;
  size_name?: string;
  weight: number;
  rate_per_kg: number;
  total_cost?: number;
  status?: string;
  notes?: string;
  // Denormalised from the parent so a line can be shown on its own
  vendor_id?: number;
  vendor_name?: string;
  received_date?: string;
}

/** One delivery from one vendor on one date. */
export interface RawMaterialEntry {
  id?: number;
  entry_number?: string;
  vendor_id: number;
  vendor_name?: string;
  received_date: string;
  notes?: string;
  total_weight?: number;
  total_cost?: number;
  line_count?: number;
  status_summary?: Record<string, number>;
  items: RawMaterialItem[];
  update_vendor_rates?: boolean;
}

export interface RawMaterialStatusLog {
  id?: number;
  raw_material_id: number;
  status: string;
  notes?: string;
  changed_at: string;
}

export interface RawMaterialSummary {
  total_entries: number;
  total_lines: number;
  in_stock_weight: number;
  in_stock_value: number;
  in_use_weight: number;
  consumed_weight: number;
}

const entryNumber = (id: number) => `RM-${String(id).padStart(4, '0')}`;

export class RawMaterialService {
  private vendorRateService = new VendorRateService();

  private toItem(m: any, entry?: any): RawMaterialItem {
    const parent = entry || m.entry;
    return {
      id: m.id,
      entry_id: m.entryId,
      point_id: m.pointId,
      point_name: m.point ? m.point.name : undefined,
      size_id: m.sizeId,
      size_name: m.size ? m.size.name : undefined,
      weight: Number(m.weight),
      rate_per_kg: Number(m.ratePerKg),
      total_cost: Number(m.totalCost),
      status: m.status,
      notes: m.notes || undefined,
      vendor_id: parent ? parent.vendorId : undefined,
      vendor_name: parent && parent.vendor ? parent.vendor.name : undefined,
      received_date: parent ? parent.receivedDate.toISOString().split('T')[0] : undefined,
    };
  }

  private toEntry(e: any): RawMaterialEntry {
    const items = (e.items || []).map((item: any) => this.toItem(item, e));

    const statusSummary: Record<string, number> = {};
    for (const item of items) {
      const key = item.status || 'in_stock';
      statusSummary[key] = (statusSummary[key] || 0) + 1;
    }

    return {
      id: e.id,
      entry_number: entryNumber(e.id),
      vendor_id: e.vendorId,
      vendor_name: e.vendor ? e.vendor.name : undefined,
      received_date: e.receivedDate.toISOString().split('T')[0],
      notes: e.notes || undefined,
      total_weight: Number(e.totalWeight),
      total_cost: Number(e.totalCost),
      line_count: items.length,
      status_summary: statusSummary,
      items,
    };
  }

  private itemInclude = { point: true, size: true };

  private entryInclude = {
    vendor: true,
    items: {
      include: this.itemInclude,
      orderBy: { id: 'asc' as const },
    },
  };

  /** Deliveries, newest first. `status` keeps entries having at least one line in it. */
  async getAllEntries(status?: string, vendorId?: number): Promise<RawMaterialEntry[]> {
    const where: any = {};
    if (vendorId) where.vendorId = vendorId;
    if (status) where.items = { some: { status } };

    const entries = await prisma.rawMaterialEntry.findMany({
      where,
      include: this.entryInclude,
      orderBy: [{ receivedDate: 'desc' }, { id: 'desc' }],
    });

    return entries.map(e => this.toEntry(e));
  }

  async getEntryById(id: number): Promise<RawMaterialEntry | null> {
    const entry = await prisma.rawMaterialEntry.findUnique({
      where: { id },
      include: this.entryInclude,
    });

    return entry ? this.toEntry(entry) : null;
  }

  /** Creates the delivery and all of its lines together. */
  async createEntry(entry: RawMaterialEntry): Promise<RawMaterialEntry> {
    if (!entry.items || entry.items.length === 0) {
      throw new Error('NO_ITEMS');
    }

    const totals = this.totalsFor(entry.items);

    const created = await prisma.rawMaterialEntry.create({
      data: {
        vendorId: entry.vendor_id,
        receivedDate: new Date(entry.received_date),
        notes: entry.notes || null,
        totalWeight: totals.weight,
        totalCost: totals.cost,
        items: {
          create: entry.items.map(item => this.itemCreateData(item, entry.notes)),
        },
      },
      include: this.entryInclude,
    });

    if (entry.update_vendor_rates) {
      await this.pushVendorRates(entry);
    }

    return this.toEntry(created);
  }

  /**
   * Replaces a delivery's header and its lines. Lines carrying an id keep their
   * status history; new lines are added and dropped ones are removed.
   */
  async updateEntry(id: number, entry: RawMaterialEntry): Promise<RawMaterialEntry | null> {
    const existing = await prisma.rawMaterialEntry.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return null;

    if (!entry.items || entry.items.length === 0) {
      throw new Error('NO_ITEMS');
    }

    const totals = this.totalsFor(entry.items);
    const keptIds = entry.items.filter(item => item.id).map(item => item.id as number);
    const removedIds = existing.items
      .filter(item => !keptIds.includes(item.id))
      .map(item => item.id);

    await prisma.$transaction([
      prisma.rawMaterial.deleteMany({ where: { id: { in: removedIds } } }),
      ...entry.items
        .filter(item => item.id)
        .map(item =>
          prisma.rawMaterial.update({
            where: { id: item.id },
            data: {
              pointId: item.point_id,
              sizeId: item.size_id,
              weight: item.weight,
              ratePerKg: item.rate_per_kg,
              totalCost: this.calculateTotalCost(item.weight, item.rate_per_kg),
            },
          })
        ),
      ...entry.items
        .filter(item => !item.id)
        .map(item =>
          prisma.rawMaterial.create({
            data: { entryId: id, ...this.itemCreateData(item, entry.notes) },
          })
        ),
      prisma.rawMaterialEntry.update({
        where: { id },
        data: {
          vendorId: entry.vendor_id,
          receivedDate: new Date(entry.received_date),
          notes: entry.notes || null,
          totalWeight: totals.weight,
          totalCost: totals.cost,
        },
      }),
    ]);

    if (entry.update_vendor_rates) {
      await this.pushVendorRates(entry);
    }

    return this.getEntryById(id);
  }

  async deleteEntry(id: number): Promise<boolean> {
    try {
      await prisma.rawMaterialEntry.delete({ where: { id } });
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteItem(id: number): Promise<boolean> {
    const item = await prisma.rawMaterial.findUnique({ where: { id } });
    if (!item) return false;

    const siblingCount = await prisma.rawMaterial.count({
      where: { entryId: item.entryId },
    });
    // An entry with no lines has nothing left to track, so remove the whole thing
    if (siblingCount <= 1) {
      return this.deleteEntry(item.entryId);
    }

    await prisma.rawMaterial.delete({ where: { id } });
    await this.recalculateEntryTotals(item.entryId);
    return true;
  }

  async getStatusHistory(rawMaterialId: number): Promise<RawMaterialStatusLog[]> {
    const logs = await prisma.rawMaterialStatusLog.findMany({
      where: { rawMaterialId },
      orderBy: { changedAt: 'desc' },
    });

    return logs.map(l => ({
      id: l.id,
      raw_material_id: l.rawMaterialId,
      status: l.status,
      notes: l.notes || undefined,
      changed_at: l.changedAt.toISOString(),
    }));
  }

  /** Status is tracked per line, so each lot moves independently. */
  async updateItemStatus(id: number, status: string, notes?: string): Promise<RawMaterialItem | null> {
    const existing = await prisma.rawMaterial.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await prisma.rawMaterial.update({
      where: { id },
      data: {
        status,
        statusHistory: { create: { status, notes: notes || null } },
      },
      include: { ...this.itemInclude, entry: { include: { vendor: true } } },
    });

    return this.toItem(updated);
  }

  /** Moves every line of a delivery at once. */
  async updateEntryStatus(entryId: number, status: string, notes?: string): Promise<RawMaterialEntry | null> {
    const entry = await prisma.rawMaterialEntry.findUnique({
      where: { id: entryId },
      include: { items: true },
    });
    if (!entry) return null;

    for (const item of entry.items) {
      if (item.status === status) continue;
      await this.updateItemStatus(item.id, status, notes);
    }

    return this.getEntryById(entryId);
  }

  async getSummary(): Promise<RawMaterialSummary> {
    const [entryCount, items] = await Promise.all([
      prisma.rawMaterialEntry.count(),
      prisma.rawMaterial.findMany(),
    ]);

    const summary: RawMaterialSummary = {
      total_entries: entryCount,
      total_lines: items.length,
      in_stock_weight: 0,
      in_stock_value: 0,
      in_use_weight: 0,
      consumed_weight: 0,
    };

    for (const item of items) {
      const weight = Number(item.weight);
      if (item.status === 'in_stock') {
        summary.in_stock_weight += weight;
        summary.in_stock_value += Number(item.totalCost);
      } else if (item.status === 'in_use') {
        summary.in_use_weight += weight;
      } else if (item.status === 'consumed') {
        summary.consumed_weight += weight;
      }
    }

    return summary;
  }

  private itemCreateData(item: RawMaterialItem, entryNotes?: string) {
    const status = item.status || 'in_stock';
    return {
      pointId: item.point_id,
      sizeId: item.size_id,
      weight: item.weight,
      ratePerKg: item.rate_per_kg,
      totalCost: this.calculateTotalCost(item.weight, item.rate_per_kg),
      status,
      notes: item.notes || null,
      statusHistory: {
        create: { status, notes: item.notes || entryNotes || null },
      },
    };
  }

  private totalsFor(items: RawMaterialItem[]) {
    return {
      weight: items.reduce((sum, item) => sum + Number(item.weight || 0), 0),
      cost: items.reduce(
        (sum, item) => sum + this.calculateTotalCost(item.weight, item.rate_per_kg),
        0
      ),
    };
  }

  private async recalculateEntryTotals(entryId: number): Promise<void> {
    const items = await prisma.rawMaterial.findMany({ where: { entryId } });
    await prisma.rawMaterialEntry.update({
      where: { id: entryId },
      data: {
        totalWeight: items.reduce((sum, i) => sum + Number(i.weight), 0),
        totalCost: items.reduce((sum, i) => sum + Number(i.totalCost), 0),
      },
    });
  }

  private async pushVendorRates(entry: RawMaterialEntry): Promise<void> {
    for (const item of entry.items) {
      await this.vendorRateService.setRate({
        vendor_id: entry.vendor_id,
        point_id: item.point_id,
        rate_per_kg: item.rate_per_kg,
        effective_date: entry.received_date,
        notes: 'Set from raw material entry',
      });
    }
  }

  private calculateTotalCost(weight: number, ratePerKg: number): number {
    return Math.round(weight * ratePerKg * 100) / 100;
  }
}
