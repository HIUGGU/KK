import prisma from '../config/database';
import { priceLogService } from './priceLogService';

export interface Product {
  id?: number;
  name: string;
  description?: string;
  unit_price: number;
  unit?: string;
  status?: string;
  length?: number | null;
  breadth?: number | null;
  /** Measured in dimension_unit. Plasma vendors billing by the inch charge on this. */
  height?: number | null;
  weight?: number | null;
  top_size?: string | null;
  bottom_size?: string | null;
  dimension_unit?: string | null;
  weight_unit?: string | null;
  point_id?: number | null;
  size_id?: number | null;
  /** Resolved from the master lists for display; never written back. */
  point_name?: string | null;
  size_name?: string | null;
  min_price?: number;
  max_price?: number;
  client_price_count?: number;
}

export interface ProductRate {
  id?: number;
  product_id: number;
  rate: number;
  effective_date: string;
  notes?: string;
}

/** Blank measurements arrive from the form as '' or NaN; store those as "not recorded". */
const toDecimal = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/** An unselected dropdown posts '' — store that as "no point/size chosen". */
const toId = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
};

const toText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

export class ProductService {
  async getAllProducts(): Promise<Product[]> {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { point: true, size: true },
    });

    const clientPricesByProduct = await this.getCurrentClientPricesByProduct();

    return products.map(p => {
      const standardPrice = Number(p.unitPrice);
      const clientPrices = clientPricesByProduct.get(p.id) || [];
      // The range spans the standard rate and every client's special price.
      const allPrices = [standardPrice, ...clientPrices];

      return {
        id: p.id,
        name: p.name,
        description: p.description || undefined,
        unit_price: standardPrice,
        unit: p.unit,
        status: p.status,
        length: p.length === null ? null : Number(p.length),
        breadth: p.breadth === null ? null : Number(p.breadth),
        height: p.height === null ? null : Number(p.height),
        weight: p.weight === null ? null : Number(p.weight),
        top_size: p.topSize,
        bottom_size: p.bottomSize,
        dimension_unit: p.dimensionUnit,
        weight_unit: p.weightUnit,
        point_id: p.pointId,
        size_id: p.sizeId,
        point_name: p.point?.name ?? null,
        size_name: p.size?.name ?? null,
        min_price: Math.min(...allPrices),
        max_price: Math.max(...allPrices),
        client_price_count: clientPrices.length,
      };
    });
  }

  /**
   * The special price each client pays today, grouped by product. Where a client has
   * several dated prices for a product, only the newest one already in effect counts,
   * so superseded rates do not widen the range.
   */
  private async getCurrentClientPricesByProduct(): Promise<Map<number, number[]>> {
    const prices = await prisma.clientProductPrice.findMany({
      where: { effectiveDate: { lte: new Date() } },
      orderBy: { effectiveDate: 'desc' },
      select: { clientId: true, productId: true, price: true },
    });

    const seenPairs = new Set<string>();
    const byProduct = new Map<number, number[]>();

    for (const p of prices) {
      const pair = `${p.clientId}:${p.productId}`;
      if (seenPairs.has(pair)) continue;
      seenPairs.add(pair);

      const list = byProduct.get(p.productId) || [];
      list.push(Number(p.price));
      byProduct.set(p.productId, list);
    }

    return byProduct;
  }

  async getProductById(id: number): Promise<Product | null> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        rateHistory: {
          orderBy: { effectiveDate: 'desc' },
        },
        point: true,
        size: true,
      },
    });

    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      description: product.description || undefined,
      unit_price: Number(product.unitPrice),
      unit: product.unit,
      status: product.status,
      length: product.length === null ? null : Number(product.length),
      breadth: product.breadth === null ? null : Number(product.breadth),
      height: product.height === null ? null : Number(product.height),
      weight: product.weight === null ? null : Number(product.weight),
      top_size: product.topSize,
      bottom_size: product.bottomSize,
      dimension_unit: product.dimensionUnit,
      weight_unit: product.weightUnit,
      point_id: product.pointId,
      size_id: product.sizeId,
      point_name: product.point?.name ?? null,
      size_name: product.size?.name ?? null,
    };
  }

  async getProductRateHistory(productId: number): Promise<ProductRate[]> {
    const rates = await prisma.productRate.findMany({
      where: { productId },
      orderBy: { effectiveDate: 'desc' },
    });

    return rates.map(r => ({
      id: r.id,
      product_id: r.productId,
      rate: Number(r.rate),
      effective_date: r.effectiveDate.toISOString().split('T')[0],
      notes: r.notes || undefined,
    }));
  }

  async addProductRate(rate: ProductRate): Promise<ProductRate> {
    // Re-rating the same effective date replaces that rate rather than failing on the
    // unique constraint. Creating a product already writes a rate for today, so without
    // this the first "Add Rate" on a new product errors out.
    const created = await prisma.productRate.upsert({
      where: {
        productId_effectiveDate: {
          productId: rate.product_id,
          effectiveDate: new Date(rate.effective_date),
        },
      },
      update: {
        rate: rate.rate,
        notes: rate.notes || null,
      },
      create: {
        productId: rate.product_id,
        rate: rate.rate,
        effectiveDate: new Date(rate.effective_date),
        notes: rate.notes || null,
      },
    });

    // Update product's current unit price
    const previous = await prisma.product.findUnique({
      where: { id: rate.product_id },
      select: { unitPrice: true },
    });

    await prisma.product.update({
      where: { id: rate.product_id },
      data: { unitPrice: rate.rate },
    });

    await priceLogService.record({
      productId: rate.product_id,
      scope: 'standard',
      oldPrice: previous ? Number(previous.unitPrice) : null,
      newPrice: rate.rate,
      action: 'updated',
      source: 'rate_added',
      effectiveDate: new Date(rate.effective_date),
      notes: rate.notes || null,
    });

    return {
      id: created.id,
      product_id: created.productId,
      rate: Number(created.rate),
      effective_date: created.effectiveDate.toISOString().split('T')[0],
      notes: created.notes || undefined,
    };
  }

  async getEffectiveRate(productId: number, date: string): Promise<number> {
    const targetDate = new Date(date);
    const rate = await prisma.productRate.findFirst({
      where: {
        productId,
        effectiveDate: {
          lte: targetDate,
        },
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });

    if (rate) {
      return Number(rate.rate);
    }

    // Fallback to product's current price
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    return product ? Number(product.unitPrice) : 0;
  }

  async createProduct(product: Product): Promise<Product> {
    const created = await prisma.product.create({
      data: {
        name: product.name,
        description: product.description || null,
        unitPrice: product.unit_price,
        unit: product.unit || 'piece',
        status: product.status || 'active',
        length: toDecimal(product.length),
        breadth: toDecimal(product.breadth),
        height: toDecimal(product.height),
        weight: toDecimal(product.weight),
        topSize: toText(product.top_size),
        bottomSize: toText(product.bottom_size),
        dimensionUnit: toText(product.dimension_unit),
        weightUnit: toText(product.weight_unit),
        pointId: toId(product.point_id),
        sizeId: toId(product.size_id),
        rateHistory: {
          create: {
            rate: product.unit_price,
            effectiveDate: new Date(),
          },
        },
      },
    });

    await priceLogService.record({
      productId: created.id,
      scope: 'standard',
      oldPrice: null,
      newPrice: Number(created.unitPrice),
      action: 'created',
      source: 'product_created',
      effectiveDate: new Date(),
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description || undefined,
      unit_price: Number(created.unitPrice),
      unit: created.unit,
      status: created.status,
      length: created.length === null ? null : Number(created.length),
      breadth: created.breadth === null ? null : Number(created.breadth),
      height: created.height === null ? null : Number(created.height),
      weight: created.weight === null ? null : Number(created.weight),
      top_size: created.topSize,
      bottom_size: created.bottomSize,
      dimension_unit: created.dimensionUnit,
      weight_unit: created.weightUnit,
      point_id: created.pointId,
      size_id: created.sizeId,
    };
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product | null> {
    const updateData: any = {};

    if (product.name) updateData.name = product.name;
    if (product.description !== undefined) updateData.description = product.description || null;
    if (product.unit_price !== undefined) updateData.unitPrice = product.unit_price;
    if (product.unit !== undefined) updateData.unit = product.unit;
    if (product.status !== undefined) updateData.status = product.status;
    if (product.length !== undefined) updateData.length = toDecimal(product.length);
    if (product.breadth !== undefined) updateData.breadth = toDecimal(product.breadth);
    if (product.height !== undefined) updateData.height = toDecimal(product.height);
    if (product.weight !== undefined) updateData.weight = toDecimal(product.weight);
    if (product.top_size !== undefined) updateData.topSize = toText(product.top_size);
    if (product.bottom_size !== undefined) updateData.bottomSize = toText(product.bottom_size);
    if (product.dimension_unit !== undefined) updateData.dimensionUnit = toText(product.dimension_unit);
    if (product.weight_unit !== undefined) updateData.weightUnit = toText(product.weight_unit);
    if (product.point_id !== undefined) updateData.pointId = toId(product.point_id);
    if (product.size_id !== undefined) updateData.sizeId = toId(product.size_id);

    // Read the current price first: editing a product changes the rate directly,
    // so this is the only chance to capture what it was.
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { unitPrice: true },
    });

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    const oldPrice = existing ? Number(existing.unitPrice) : null;
    const newPrice = Number(updated.unitPrice);

    if (oldPrice !== null && oldPrice !== newPrice) {
      await priceLogService.record({
        productId: id,
        scope: 'standard',
        oldPrice,
        newPrice,
        action: 'updated',
        source: 'product_edited',
        effectiveDate: new Date(),
      });
    }

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description || undefined,
      unit_price: newPrice,
      unit: updated.unit,
      status: updated.status,
      length: updated.length === null ? null : Number(updated.length),
      breadth: updated.breadth === null ? null : Number(updated.breadth),
      height: updated.height === null ? null : Number(updated.height),
      weight: updated.weight === null ? null : Number(updated.weight),
      top_size: updated.topSize,
      bottom_size: updated.bottomSize,
      dimension_unit: updated.dimensionUnit,
      weight_unit: updated.weightUnit,
      point_id: updated.pointId,
      size_id: updated.sizeId,
    };
  }

  async deleteProduct(id: number): Promise<boolean> {
    try {
      await prisma.product.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

