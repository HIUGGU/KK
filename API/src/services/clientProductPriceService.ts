import prisma from '../config/database';
import { priceLogService } from './priceLogService';

export interface ClientProductPrice {
  id?: number;
  client_id: number;
  product_id: number;
  price: number;
  effective_date: string;
  notes?: string;
  product_name?: string;
  product_unit?: string;
}

export interface ClientProductRateSummary {
  product_id: number;
  product_name: string;
  product_unit: string;
  scope: 'client' | 'standard';
  current_price: number;
  previous_price: number | null;
  change: number | null;
  changed_at: string | null;
  effective_date: string | null;
}

export class ClientProductPriceService {
  async getClientProductPrice(clientId: number, productId: number, date?: string): Promise<number | null> {
    const targetDate = date ? new Date(date) : new Date();
    
    const price = await prisma.clientProductPrice.findFirst({
      where: {
        clientId,
        productId,
        effectiveDate: {
          lte: targetDate,
        },
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });

    return price ? Number(price.price) : null;
  }

  async getClientPrices(clientId: number): Promise<ClientProductPrice[]> {
    const prices = await prisma.clientProductPrice.findMany({
      where: { clientId },
      include: {
        product: true,
      },
      orderBy: [{ productId: 'asc' }, { effectiveDate: 'desc' }],
    });

    return prices.map(p => ({
      id: p.id,
      client_id: p.clientId,
      product_id: p.productId,
      price: Number(p.price),
      effective_date: p.effectiveDate.toISOString().split('T')[0],
      notes: p.notes || undefined,
      product_name: p.product.name,
      product_unit: p.product.unit,
    }));
  }

  async getProductPricesForClient(clientId: number, productId: number): Promise<ClientProductPrice[]> {
    const prices = await prisma.clientProductPrice.findMany({
      where: {
        clientId,
        productId,
      },
      orderBy: { effectiveDate: 'desc' },
    });

    return prices.map(p => ({
      id: p.id,
      client_id: p.clientId,
      product_id: p.productId,
      price: Number(p.price),
      effective_date: p.effectiveDate.toISOString().split('T')[0],
      notes: p.notes || undefined,
    }));
  }

  async setClientProductPrice(price: ClientProductPrice): Promise<ClientProductPrice> {
    // An upsert hides whether this replaced an existing price, so check first.
    const existing = await prisma.clientProductPrice.findUnique({
      where: {
        clientId_productId_effectiveDate: {
          clientId: price.client_id,
          productId: price.product_id,
          effectiveDate: new Date(price.effective_date),
        },
      },
    });

    const created = await prisma.clientProductPrice.upsert({
      where: {
        clientId_productId_effectiveDate: {
          clientId: price.client_id,
          productId: price.product_id,
          effectiveDate: new Date(price.effective_date),
        },
      },
      update: {
        price: price.price,
        notes: price.notes || null,
      },
      create: {
        clientId: price.client_id,
        productId: price.product_id,
        price: price.price,
        effectiveDate: new Date(price.effective_date),
        notes: price.notes || null,
      },
    });

    await priceLogService.record({
      productId: created.productId,
      scope: 'client',
      clientId: created.clientId,
      oldPrice: existing ? Number(existing.price) : null,
      newPrice: Number(created.price),
      action: existing ? 'updated' : 'created',
      source: existing ? 'client_price_replaced' : 'client_price_set',
      effectiveDate: created.effectiveDate,
      notes: created.notes,
    });

    return {
      id: created.id,
      client_id: created.clientId,
      product_id: created.productId,
      price: Number(created.price),
      effective_date: created.effectiveDate.toISOString().split('T')[0],
      notes: created.notes || undefined,
    };
  }

  async updateClientProductPrice(id: number, price: Partial<ClientProductPrice>): Promise<ClientProductPrice | null> {
    const updateData: any = {};

    if (price.price !== undefined) updateData.price = price.price;
    if (price.effective_date) updateData.effectiveDate = new Date(price.effective_date);
    if (price.notes !== undefined) updateData.notes = price.notes || null;

    // The update overwrites the row in place, so read the old price while it exists.
    const before = await prisma.clientProductPrice.findUnique({ where: { id } });

    const updated = await prisma.clientProductPrice.update({
      where: { id },
      data: updateData,
    });

    if (before && Number(before.price) !== Number(updated.price)) {
      await priceLogService.record({
        productId: updated.productId,
        scope: 'client',
        clientId: updated.clientId,
        oldPrice: Number(before.price),
        newPrice: Number(updated.price),
        action: 'updated',
        source: 'client_price_edited',
        effectiveDate: updated.effectiveDate,
        notes: updated.notes,
      });
    }

    return {
      id: updated.id,
      client_id: updated.clientId,
      product_id: updated.productId,
      price: Number(updated.price),
      effective_date: updated.effectiveDate.toISOString().split('T')[0],
      notes: updated.notes || undefined,
    };
  }

  /**
   * For every active product, the rate this client is actually charged (their own
   * override if one exists, otherwise the standard rate) alongside the price it
   * changed from and when - taken straight from the latest matching price_logs row,
   * since that single entry already carries the old -> new transition.
   */
  async getClientRateSummary(clientId: number): Promise<ClientProductRateSummary[]> {
    const products = await prisma.product.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });
    const today = new Date();

    return Promise.all(
      products.map(async (product) => {
        // Same precedence orders use: a client override in effect today wins,
        // otherwise fall back to the product's standard rate as of today.
        const overridePrice = await this.getClientProductPrice(clientId, product.id);
        const scope: 'client' | 'standard' = overridePrice !== null ? 'client' : 'standard';

        let currentPrice: number;
        if (scope === 'client') {
          currentPrice = overridePrice as number;
        } else {
          const standardRate = await prisma.productRate.findFirst({
            where: { productId: product.id, effectiveDate: { lte: today } },
            orderBy: { effectiveDate: 'desc' },
          });
          currentPrice = standardRate ? Number(standardRate.rate) : Number(product.unitPrice);
        }

        // The log entry only supplies the "previous price / when it changed" story;
        // the current price above is always computed from live data, not the log.
        const latestLog = await prisma.priceLog.findFirst({
          where: {
            productId: product.id,
            scope,
            ...(scope === 'client' ? { clientId } : {}),
          },
          orderBy: { createdAt: 'desc' },
        });

        const previousPrice = latestLog?.oldPrice != null ? Number(latestLog.oldPrice) : null;

        return {
          product_id: product.id,
          product_name: product.name,
          product_unit: product.unit,
          scope,
          current_price: currentPrice,
          previous_price: previousPrice,
          change: previousPrice !== null ? currentPrice - previousPrice : null,
          changed_at: latestLog?.createdAt.toISOString() ?? null,
          effective_date: latestLog?.effectiveDate ? latestLog.effectiveDate.toISOString().split('T')[0] : null,
        };
      })
    );
  }

  async deleteClientProductPrice(id: number): Promise<boolean> {
    try {
      // Capture the price being removed before it is gone for good.
      const existing = await prisma.clientProductPrice.findUnique({ where: { id } });

      await prisma.clientProductPrice.delete({
        where: { id },
      });

      if (existing) {
        await priceLogService.record({
          productId: existing.productId,
          scope: 'client',
          clientId: existing.clientId,
          oldPrice: Number(existing.price),
          newPrice: null,
          action: 'deleted',
          source: 'client_price_removed',
          effectiveDate: existing.effectiveDate,
          notes: existing.notes,
        });
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}



