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
}

/**
 * A settlement that closed orders (the "anchor"), plus every later pure
 * balance payment made toward it before the next order-bearing settlement
 * came along. The Payments page lets you record a payment with no orders
 * attached at any time - each one is really an installment against
 * whatever's currently owed, so it's grouped under the settlement that
 * created that debt rather than shown as its own row.
 */
export interface SettlementGroup {
  anchor: Settlement;
  installments: Settlement[];
}

/** All events in a group, chronological (anchor first). */
export function groupEvents(group: SettlementGroup): Settlement[] {
  return [group.anchor, ...group.installments];
}

export function groupTotals(group: SettlementGroup) {
  const events = groupEvents(group);
  return {
    cash: events.reduce((sum, e) => sum + e.cash_amount, 0),
    bank: events.reduce((sum, e) => sum + e.bank_amount, 0),
    received: events.reduce((sum, e) => sum + (e.total_amount || 0), 0),
    balanceAfter: events[events.length - 1].new_balance || 0,
  };
}

/**
 * Groups a newest-first settlement list into order-bearing settlements with
 * their trailing pure-payment installments folded in. Grouping runs
 * per-client (a list spanning multiple clients, like the global Payments
 * list, is bucketed first) and in chronological order, since "the next
 * payment after this order was settled" only makes sense read forward in time.
 */
export function groupSettlements(settlementsNewestFirst: Settlement[]): SettlementGroup[] {
  const byClient = new Map<number, Settlement[]>();
  for (const s of settlementsNewestFirst) {
    const arr = byClient.get(s.client_id) || [];
    arr.push(s);
    byClient.set(s.client_id, arr);
  }

  const groups: SettlementGroup[] = [];
  for (const list of byClient.values()) {
    const chronological = [...list].reverse();
    let current: SettlementGroup | null = null;
    for (const s of chronological) {
      const hasOrders = !!(s.items && s.items.length > 0);
      if (hasOrders || !current) {
        current = { anchor: s, installments: [] };
        groups.push(current);
      } else {
        current.installments.push(s);
      }
    }
  }

  groups.sort((a, b) => {
    const aLast = groupEvents(a).slice(-1)[0];
    const bLast = groupEvents(b).slice(-1)[0];
    if (aLast.settlement_date !== bLast.settlement_date) {
      return aLast.settlement_date < bLast.settlement_date ? 1 : -1;
    }
    return (bLast.id || 0) - (aLast.id || 0);
  });

  return groups;
}

/**
 * Expanded view of one settlement group: the orders it closed (product,
 * quantity, rate) plus every payment made toward it, oldest first, each
 * shown as its own line so a payment recorded later on the Payments page is
 * visible right here rather than as a separate top-level entry.
 */
export function SettlementGroupDetail({
  group,
  getBankAccountName,
}: {
  group: SettlementGroup;
  getBankAccountName: (id?: number) => string;
}) {
  const { anchor } = group;
  const hasOrders = anchor.items && anchor.items.length > 0;
  const events = groupEvents(group);

  return (
    <div className="settlement-detail">
      {!hasOrders ? (
        <p className="settlement-detail-empty">No orders attached - this payment was applied directly to the balance.</p>
      ) : (
        anchor.items!.map(item => (
          <div key={item.order_id} className="settlement-detail-order">
            <div className="settlement-detail-order-header">
              <strong>Order {item.order_number}</strong>
              {item.delivery_date && <span>delivered {item.delivery_date}</span>}
              <span className="settlement-detail-order-total">₹{item.order_amount.toFixed(2)}</span>
            </div>
            {item.order_lines && item.order_lines.length > 0 && (
              <table className="settlement-detail-lines">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {item.order_lines.map((line, i) => (
                    <tr key={i}>
                      <td>{line.product_name}</td>
                      <td>{line.quantity}</td>
                      <td>₹{line.unit_price.toFixed(2)}</td>
                      <td>₹{line.total_price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}

      <div className="settlement-detail-payments">
        <h4>Payments toward this{hasOrders ? ' settlement' : ''}</h4>
        <table className="settlement-detail-lines">
          <thead>
            <tr>
              <th>Date</th>
              <th>Cash</th>
              <th>Bank</th>
              <th>Received</th>
              <th>Balance After</th>
              <th>Bank Account</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={e.id ?? i}>
                <td>{e.settlement_date}</td>
                <td>₹{e.cash_amount.toFixed(2)}</td>
                <td>₹{e.bank_amount.toFixed(2)}</td>
                <td><strong>₹{(e.total_amount || 0).toFixed(2)}</strong></td>
                <td>₹{(e.new_balance || 0).toFixed(2)}</td>
                <td>{getBankAccountName(e.bank_account_id)}</td>
                <td>{e.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
