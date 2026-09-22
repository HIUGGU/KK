import prisma from '../config/database';

export interface UnpaidOrder {
  id: number;
  order_number: string;
  order_date: string;
  delivery_date: string;
  total_amount: number;
  items_summary: string;
}

export interface SettlementOrderLine {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface SettlementItem {
  order_id: number;
  order_number?: string;
  order_amount: number;
  order_date?: string;
  delivery_date?: string;
  order_lines?: SettlementOrderLine[];
}

export interface Settlement {
  id?: number;
  client_id: number;
  client_name?: string;
  settlement_date: string;
  previous_balance?: number;
  order_total?: number;
  cash_amount: number;
  bank_amount: number;
  bank_account_id?: number;
  total_amount?: number;
  new_balance?: number;
  notes?: string;
  items?: SettlementItem[];
  created_at?: string;
}

export interface ClientSettlementSummary {
  unpaid_orders: UnpaidOrder[];
  outstanding_balance: number;
}

export interface ClientBalance {
  client_id: number;
  client_name: string;
  /// Not yet picked into any settlement.
  unpaid_orders_total: number;
  /// Carried over from past settlements, not tied to any order.
  outstanding_balance: number;
  /// unpaid_orders_total + outstanding_balance - what the client owes overall.
  total_due: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/// One settlement's `items` include, deep enough to render each closed
/// order's product/quantity/rate breakdown alongside the payment.
const settlementItemsInclude = {
  include: {
    order: {
      include: {
        items: { include: { product: true } },
      },
    },
  },
} as const;

function mapSettlementItem(i: {
  orderId: number;
  orderAmount: any;
  order: {
    orderNumber: string;
    orderDate: Date;
    deliveryDate: Date;
    items: { quantity: any; unitPrice: any; totalPrice: any; product: { name: string } }[];
  };
}): SettlementItem {
  return {
    order_id: i.orderId,
    order_number: i.order.orderNumber,
    order_amount: Number(i.orderAmount),
    order_date: i.order.orderDate.toISOString().split('T')[0],
    delivery_date: i.order.deliveryDate.toISOString().split('T')[0],
    order_lines: i.order.items.map(line => ({
      product_name: line.product.name,
      quantity: Number(line.quantity),
      unit_price: Number(line.unitPrice),
      total_price: Number(line.totalPrice),
    })),
  };
}

export class SettlementService {
  /** One tile per active client: what they still owe overall, for the settlement picker. */
  async getAllClientBalances(): Promise<ClientBalance[]> {
    const [clients, unpaidTotals] = await Promise.all([
      prisma.client.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } }),
      prisma.order.groupBy({
        by: ['clientId'],
        where: { status: 'not_paid' },
        _sum: { totalAmount: true },
      }),
    ]);

    const unpaidByClient = new Map(unpaidTotals.map(row => [row.clientId, Number(row._sum.totalAmount || 0)]));

    return clients.map(c => {
      const unpaidOrdersTotal = round2(unpaidByClient.get(c.id) || 0);
      const outstandingBalance = round2(Number(c.outstandingBalance));
      return {
        client_id: c.id,
        client_name: c.name,
        unpaid_orders_total: unpaidOrdersTotal,
        outstanding_balance: outstandingBalance,
        total_due: round2(unpaidOrdersTotal + outstandingBalance),
      };
    });
  }

  /**
   * Orders still open for this client (never picked into a settlement), plus
   * the client's running balance that's no longer tied to any specific order.
   */
  async getClientSummary(clientId: number): Promise<ClientSettlementSummary> {
    const [orders, client] = await Promise.all([
      prisma.order.findMany({
        where: { clientId, status: 'not_paid' },
        include: { items: { include: { product: true } } },
        orderBy: { deliveryDate: 'asc' },
      }),
      prisma.client.findUnique({ where: { id: clientId } }),
    ]);

    return {
      unpaid_orders: orders.map(o => ({
        id: o.id,
        order_number: o.orderNumber,
        order_date: o.orderDate.toISOString().split('T')[0],
        delivery_date: o.deliveryDate.toISOString().split('T')[0],
        total_amount: Number(o.totalAmount),
        items_summary: o.items.map(i => `${i.product.name} x ${Number(i.quantity)}`).join(', '),
      })),
      outstanding_balance: client ? Number(client.outstandingBalance) : 0,
    };
  }

  /**
   * Every settlement across every client, newest first - this is the single
   * source of truth for money received. A settlement with no orders attached
   * is a pure payment (e.g. an advance taken before any order existed); one
   * with orders is a batch settled against them. Either way it appears here
   * exactly once, however it was recorded.
   */
  async getAllSettlements(): Promise<Settlement[]> {
    const settlements = await prisma.settlement.findMany({
      include: {
        items: settlementItemsInclude,
        bankAccount: true,
        client: true,
      },
      orderBy: [{ settlementDate: 'desc' }, { id: 'desc' }],
    });

    return settlements.map(s => ({
      id: s.id,
      client_id: s.clientId,
      client_name: s.client.name,
      settlement_date: s.settlementDate.toISOString().split('T')[0],
      previous_balance: Number(s.previousBalance),
      order_total: Number(s.orderTotal),
      cash_amount: Number(s.cashAmount),
      bank_amount: Number(s.bankAmount),
      bank_account_id: s.bankAccountId || undefined,
      total_amount: Number(s.totalAmount),
      new_balance: Number(s.newBalance),
      notes: s.notes || undefined,
      created_at: s.createdAt.toISOString(),
      items: s.items.map(mapSettlementItem),
    }));
  }

  async getSettlementsByClient(clientId: number): Promise<Settlement[]> {
    const settlements = await prisma.settlement.findMany({
      where: { clientId },
      include: {
        items: settlementItemsInclude,
        bankAccount: true,
      },
      orderBy: [{ settlementDate: 'desc' }, { id: 'desc' }],
    });

    return settlements.map(s => ({
      id: s.id,
      client_id: s.clientId,
      settlement_date: s.settlementDate.toISOString().split('T')[0],
      previous_balance: Number(s.previousBalance),
      order_total: Number(s.orderTotal),
      cash_amount: Number(s.cashAmount),
      bank_amount: Number(s.bankAmount),
      bank_account_id: s.bankAccountId || undefined,
      total_amount: Number(s.totalAmount),
      new_balance: Number(s.newBalance),
      notes: s.notes || undefined,
      created_at: s.createdAt.toISOString(),
      items: s.items.map(mapSettlementItem),
    }));
  }

  /**
   * Records money received from one client. Any orders picked close out for
   * good (regardless of whether this payment fully covers them); their total,
   * plus whatever the client already owed, minus what was actually received,
   * becomes the client's new running balance - no longer tied to any order.
   * Picking no orders is fine too: it's just a payment against the existing balance.
   */
  async createSettlement(input: {
    client_id: number;
    settlement_date: string;
    cash_amount: number;
    bank_amount: number;
    bank_account_id?: number;
    notes?: string;
    order_ids?: number[];
  }): Promise<Settlement> {
    const cash = Number(input.cash_amount) || 0;
    const bank = Number(input.bank_amount) || 0;
    const received = round2(cash + bank);
    const orderIds = Array.from(new Set(input.order_ids || []));

    if (bank > 0 && !input.bank_account_id) {
      throw new Error('Select a bank account for the bank amount.');
    }

    const created = await prisma.$transaction(async tx => {
      const client = await tx.client.findUnique({ where: { id: input.client_id } });
      if (!client) throw new Error('Client not found');

      const orders = orderIds.length
        ? await tx.order.findMany({
            where: { id: { in: orderIds }, clientId: input.client_id, status: 'not_paid' },
          })
        : [];

      if (orders.length !== orderIds.length) {
        throw new Error('One or more selected orders are unavailable for this client.');
      }

      const orderTotal = round2(orders.reduce((sum, o) => sum + Number(o.totalAmount), 0));
      const previousBalance = Number(client.outstandingBalance);
      const totalOwed = round2(previousBalance + orderTotal);

      if (totalOwed <= 0 && received <= 0) {
        throw new Error('Nothing to settle: select orders and/or enter an amount received.');
      }
      if (received <= 0 && orderIds.length === 0) {
        throw new Error('Enter a cash or bank amount received, or select orders to add to the balance.');
      }

      const newBalance = round2(totalOwed - received);

      if (orders.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: orders.map(o => o.id) } },
          data: { status: 'paid' },
        });
      }

      await tx.client.update({
        where: { id: input.client_id },
        data: { outstandingBalance: newBalance },
      });

      return tx.settlement.create({
        data: {
          clientId: input.client_id,
          settlementDate: new Date(input.settlement_date),
          previousBalance,
          orderTotal,
          cashAmount: cash,
          bankAmount: bank,
          bankAccountId: input.bank_account_id || null,
          totalAmount: received,
          newBalance,
          notes: input.notes || null,
          items: {
            create: orders.map(o => ({
              orderId: o.id,
              orderAmount: o.totalAmount,
            })),
          },
        },
        include: {
          items: settlementItemsInclude,
          bankAccount: true,
        },
      });
    });

    return {
      id: created.id,
      client_id: created.clientId,
      settlement_date: created.settlementDate.toISOString().split('T')[0],
      previous_balance: Number(created.previousBalance),
      order_total: Number(created.orderTotal),
      cash_amount: Number(created.cashAmount),
      bank_amount: Number(created.bankAmount),
      bank_account_id: created.bankAccountId || undefined,
      total_amount: Number(created.totalAmount),
      new_balance: Number(created.newBalance),
      notes: created.notes || undefined,
      created_at: created.createdAt.toISOString(),
      items: created.items.map(mapSettlementItem),
    };
  }

  /**
   * Undoes a settlement: restores the client's balance to what it was right
   * before, and reopens any orders it closed. Only the client's most recent
   * settlement can be undone - undoing an older one would leave the balance
   * math for everything after it wrong.
   */
  async deleteSettlement(id: number): Promise<boolean> {
    await prisma.$transaction(async tx => {
      const settlement = await tx.settlement.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!settlement) throw new Error('Settlement not found');

      const latest = await tx.settlement.findFirst({
        where: { clientId: settlement.clientId },
        orderBy: [{ settlementDate: 'desc' }, { id: 'desc' }],
      });
      if (!latest || latest.id !== id) {
        throw new Error('Only the most recent settlement for this client can be undone.');
      }

      if (settlement.items.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: settlement.items.map(i => i.orderId) } },
          data: { status: 'not_paid' },
        });
      }

      await tx.client.update({
        where: { id: settlement.clientId },
        data: { outstandingBalance: settlement.previousBalance },
      });

      await tx.settlement.delete({ where: { id } });
    });
    return true;
  }
}
