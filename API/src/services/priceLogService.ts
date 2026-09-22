import prisma from '../config/database';

export interface PriceLogEntry {
  id?: number;
  product_id: number;
  product_name?: string;
  scope: 'standard' | 'client';
  client_id?: number | null;
  client_name?: string | null;
  old_price?: number | null;
  new_price?: number | null;
  action: 'created' | 'updated' | 'deleted';
  source: string;
  effective_date?: string | null;
  notes?: string | null;
  changed_at?: string;
}

export interface RecordPriceChange {
  productId: number;
  scope: 'standard' | 'client';
  clientId?: number | null;
  oldPrice?: number | null;
  newPrice?: number | null;
  action: 'created' | 'updated' | 'deleted';
  source: string;
  effectiveDate?: Date | null;
  notes?: string | null;
}

export class PriceLogService {
  /**
   * Append one entry to the price audit trail. Logging must never break the price
   * change that triggered it, so failures are swallowed and reported to the console.
   */
  async record(change: RecordPriceChange): Promise<void> {
    try {
      // Snapshot the client name so the entry stays readable if the client is deleted later.
      let clientName: string | null = null;
      if (change.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: change.clientId },
          select: { name: true },
        });
        clientName = client?.name || null;
      }

      await prisma.priceLog.create({
        data: {
          productId: change.productId,
          scope: change.scope,
          clientId: change.clientId || null,
          clientName,
          oldPrice: change.oldPrice ?? null,
          newPrice: change.newPrice ?? null,
          action: change.action,
          source: change.source,
          effectiveDate: change.effectiveDate || null,
          notes: change.notes || null,
        },
      });
    } catch (error) {
      console.error('Failed to record price log entry:', error);
    }
  }

  async getProductPriceLog(productId: number): Promise<PriceLogEntry[]> {
    const entries = await prisma.priceLog.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });

    return entries.map(e => this.toEntry(e));
  }

  async getAllPriceLogs(limit = 200): Promise<PriceLogEntry[]> {
    const entries = await prisma.priceLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { product: { select: { name: true } } },
    });

    return entries.map(e => ({
      ...this.toEntry(e),
      product_name: e.product.name,
    }));
  }

  private toEntry(e: any): PriceLogEntry {
    return {
      id: e.id,
      product_id: e.productId,
      scope: e.scope,
      client_id: e.clientId,
      client_name: e.clientName,
      old_price: e.oldPrice === null ? null : Number(e.oldPrice),
      new_price: e.newPrice === null ? null : Number(e.newPrice),
      action: e.action,
      source: e.source,
      effective_date: e.effectiveDate ? e.effectiveDate.toISOString().split('T')[0] : null,
      notes: e.notes,
      changed_at: e.createdAt.toISOString(),
    };
  }
}

export const priceLogService = new PriceLogService();
