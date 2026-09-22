import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { ClientProductPriceService } from './clientProductPriceService';

export interface OrderItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id?: number;
  order_number?: string; // Optional - will be auto-generated if not provided
  client_id: number;
  order_date: string;
  delivery_date: string; // Required - orders are only created on delivery
  /// An order is only entered once the goods are delivered, so the status
  /// tracks payment: "not_paid" (the default) or "paid". Once an order is
  /// picked into a Settlement it closes to "paid" for good - any shortfall
  /// moves to the client's outstanding balance instead of staying on the order.
  status?: string;
  notes?: string;
  total_amount?: number;
  items?: OrderItem[];
}

export interface OrderFilters {
  /// Delivery date range, inclusive on both ends. Either end may stand alone.
  from_date?: string;
  to_date?: string;
  /// Keep only orders containing this product.
  product_id?: number;
  /// "paid" or "not_paid"
  status?: string;
}

export const PAYMENT_STATUSES = ['not_paid', 'paid'];

export class OrderService {
  /**
   * Refuses order lines that would sell more than is in stock. Only checked for
   * products that have actually been cut - a product with no CuttingOutput has
   * no defined stock, so nothing here stops it being ordered.
   * `excludeOrderId` leaves the order being edited's own current items out of
   * the "already ordered" total, so re-saving it with the same quantity isn't
   * refused as oversold.
   */
  private async checkStock(
    tx: Prisma.TransactionClient,
    items: OrderItem[] | undefined,
    excludeOrderId?: number
  ): Promise<void> {
    if (!items || items.length === 0) return;

    const requested = new Map<number, number>();
    for (const item of items) {
      requested.set(item.product_id, (requested.get(item.product_id) || 0) + Number(item.quantity));
    }
    const productIds = Array.from(requested.keys());

    const [produced, ordered, products] = await Promise.all([
      tx.cuttingOutput.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _sum: { quantity: true },
      }),
      tx.orderItem.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
        },
        _sum: { quantity: true },
      }),
      tx.product.findMany({ where: { id: { in: productIds } } }),
    ]);

    const producedByProduct = new Map(produced.map(row => [row.productId, Number(row._sum.quantity || 0)]));
    const orderedByProduct = new Map(ordered.map(row => [row.productId, Number(row._sum.quantity || 0)]));
    const productById = new Map(products.map(p => [p.id, p]));

    for (const [productId, requestedQty] of requested) {
      if (!producedByProduct.has(productId)) continue;

      const available = producedByProduct.get(productId)! - (orderedByProduct.get(productId) || 0);
      if (requestedQty > available) {
        const name = productById.get(productId)?.name || `Product #${productId}`;
        throw new Error(
          `Only ${available} ${name} left in stock, but ${requestedQty} were ordered.`
        );
      }
    }
  }


  async getAllOrders(filters: OrderFilters = {}): Promise<Order[]> {
    const where: any = {};

    if (filters.from_date || filters.to_date) {
      where.deliveryDate = {};
      if (filters.from_date) where.deliveryDate.gte = new Date(filters.from_date);
      if (filters.to_date) where.deliveryDate.lte = new Date(filters.to_date);
    }

    if (filters.product_id) {
      where.items = { some: { productId: filters.product_id } };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(o => ({
      id: o.id,
      order_number: o.orderNumber,
      client_id: o.clientId,
      order_date: o.orderDate.toISOString().split('T')[0],
      delivery_date: o.deliveryDate.toISOString().split('T')[0],
      status: o.status,
      notes: o.notes || undefined,
      total_amount: Number(o.totalAmount),
      items: o.items.map(item => ({
        product_id: item.productId,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        total_price: Number(item.totalPrice),
      })),
    }));
  }

  async getOrderById(id: number): Promise<Order | null> {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) return null;

    return {
      id: order.id,
      order_number: order.orderNumber,
      client_id: order.clientId,
      order_date: order.orderDate.toISOString().split('T')[0],
      delivery_date: order.deliveryDate.toISOString().split('T')[0],
      status: order.status,
      notes: order.notes || undefined,
      total_amount: Number(order.totalAmount),
      items: order.items.map(item => ({
        product_id: item.productId,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        total_price: Number(item.totalPrice),
      })),
    };
  }

  async createOrder(order: Order): Promise<Order> {
    if (!order.delivery_date) {
      throw new Error('Delivery date is required. Orders can only be created when products are delivered.');
    }

    const created = await prisma.$transaction(async tx => {
      // Get or generate order number
      let orderNumber = order.order_number;

      if (!orderNumber) {
        // Auto-generate order number
        const client = await tx.client.findUnique({
          where: { id: order.client_id },
        });

        if (!client) {
          throw new Error('Client not found');
        }

        const nextNumber = (client.lastOrderNumber || 0) + 1;
        orderNumber = nextNumber.toString().padStart(4, '0');

        // Update client's last order number
        await tx.client.update({
          where: { id: order.client_id },
          data: { lastOrderNumber: nextNumber },
        });
      } else {
        // Validate order number uniqueness for this client
        const existingOrder = await tx.order.findUnique({
          where: {
            clientId_orderNumber: {
              clientId: order.client_id,
              orderNumber: orderNumber,
            },
          },
        });

        if (existingOrder) {
          throw new Error(`Order number ${orderNumber} already exists for this client. Please use a different number.`);
        }
      }

      await this.checkStock(tx, order.items);

      const totalAmount = order.items?.reduce((sum, item) => sum + item.total_price, 0) || 0;

      return tx.order.create({
        data: {
          orderNumber: orderNumber,
          clientId: order.client_id,
          orderDate: new Date(order.order_date),
          deliveryDate: new Date(order.delivery_date),
          status: order.status || 'not_paid',
          notes: order.notes || null,
          totalAmount: totalAmount,
          items: {
            create: order.items?.map(item => ({
              productId: item.product_id,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              totalPrice: item.total_price,
            })) || [],
          },
        },
        include: {
          client: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    return {
      id: created.id,
      order_number: created.orderNumber,
      client_id: created.clientId,
      order_date: created.orderDate.toISOString().split('T')[0],
      delivery_date: created.deliveryDate?.toISOString().split('T')[0],
      status: created.status,
      notes: created.notes || undefined,
      total_amount: Number(created.totalAmount),
      items: created.items.map(item => ({
        product_id: item.productId,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        total_price: Number(item.totalPrice),
      })),
    };
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order | null> {
    const updated = await prisma.$transaction(async tx => {
      const updateData: any = {};

      if (order.order_number) {
        // Validate order number uniqueness for this client (excluding current order).
        // The client is whichever one the order is being moved to, or its current one.
        const current = await tx.order.findUnique({ where: { id } });
        if (!current) return null;

        const existingOrder = await tx.order.findFirst({
          where: {
            clientId: order.client_id || current.clientId,
            orderNumber: order.order_number,
            id: { not: id },
          },
        });

        if (existingOrder) {
          throw new Error(`Order number ${order.order_number} already exists for this client. Please use a different number.`);
        }

        updateData.orderNumber = order.order_number;
      }
      if (order.client_id) updateData.clientId = order.client_id;
      if (order.order_date) updateData.orderDate = new Date(order.order_date);
      if (order.delivery_date) updateData.deliveryDate = new Date(order.delivery_date);
      if (order.status !== undefined) updateData.status = order.status;
      if (order.notes !== undefined) updateData.notes = order.notes || null;

      if (order.items && order.items.length > 0) {
        // This order's own current items don't count against its own new request
        await this.checkStock(tx, order.items, id);

        const totalAmount = order.items.reduce((sum, item) => sum + item.total_price, 0);
        updateData.totalAmount = totalAmount;

        // Delete existing items and create new ones
        await tx.orderItem.deleteMany({
          where: { orderId: id },
        });

        updateData.items = {
          create: order.items.map(item => ({
            productId: item.product_id,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
          })),
        };
      }

      return tx.order.update({
        where: { id },
        data: updateData,
        include: {
          client: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    if (!updated) return null;

    return {
      id: updated.id,
      order_number: updated.orderNumber,
      client_id: updated.clientId,
      order_date: updated.orderDate.toISOString().split('T')[0],
      delivery_date: updated.deliveryDate?.toISOString().split('T')[0],
      status: updated.status,
      notes: updated.notes || undefined,
      total_amount: Number(updated.totalAmount),
      items: updated.items.map(item => ({
        product_id: item.productId,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        total_price: Number(item.totalPrice),
      })),
    };
  }

  async deleteOrder(id: number): Promise<boolean> {
    try {
      await prisma.order.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

