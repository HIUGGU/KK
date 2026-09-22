import { useState, useEffect, Fragment } from 'react';
import { apiClient } from '../api/client';
import { Settlement, SettlementGroupDetail, groupSettlements, groupEvents, groupTotals } from './SettlementDetail';
import './Settlements.css';

interface Client {
  id: number;
  name: string;
}

interface BankAccount {
  id: number;
  account_name: string;
  bank_name: string;
}

interface UnpaidOrder {
  id: number;
  order_number: string;
  order_date: string;
  delivery_date: string;
  total_amount: number;
  items_summary: string;
}

interface ClientBalance {
  client_id: number;
  client_name: string;
  unpaid_orders_total: number;
  outstanding_balance: number;
  total_due: number;
}

const today = () => new Date().toISOString().split('T')[0];

export default function Settlements() {
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [clientBalances, setClientBalances] = useState<ClientBalance[]>([]);
  const [clientId, setClientId] = useState<number>(0);

  const [unpaidOrders, setUnpaidOrders] = useState<UnpaidOrder[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState<number>(0);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [expandedSettlementId, setExpandedSettlementId] = useState<number | null>(null);
  // A Set so a single order can never end up selected more than once.
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());

  const [settlementDate, setSettlementDate] = useState(today());
  const [cashAmount, setCashAmount] = useState<string>('');
  const [bankAmount, setBankAmount] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClients();
    loadBankAccounts();
    loadClientBalances();
  }, []);

  useEffect(() => {
    if (clientId > 0) {
      loadSummary();
      loadHistory();
    } else {
      setUnpaidOrders([]);
      setOutstandingBalance(0);
      setHistory([]);
    }
    // A settlement belongs to exactly one client - switching clients starts fresh.
    setSelectedOrderIds(new Set());
    setExpandedSettlementId(null);
    setCashAmount('');
    setBankAmount('');
    setBankAccountId(0);
    setNotes('');
    setFormError('');
  }, [clientId]);

  const loadClients = async () => {
    try {
      const data = await apiClient.getAllClients();
      setClients(data.filter((c: any) => c.status === 'active'));
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const data = await apiClient.getAllBankAccounts();
      setBankAccounts(data.filter((a: any) => a.status === 'active'));
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
    }
  };

  const loadClientBalances = async () => {
    try {
      const data = await apiClient.getClientBalances();
      setClientBalances(data);
    } catch (error) {
      console.error('Failed to load client balances:', error);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await apiClient.getClientSettlementSummary(clientId);
      setUnpaidOrders(data.unpaid_orders);
      setOutstandingBalance(data.outstanding_balance);
    } catch (error) {
      console.error('Failed to load client settlement summary:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await apiClient.getSettlementsByClient(clientId);
      setHistory(data);
    } catch (error) {
      console.error('Failed to load settlement history:', error);
    }
  };

  const toggleOrder = (orderId: number) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedOrderIds.size === unpaidOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(unpaidOrders.map(o => o.id)));
    }
  };

  const selectedOrdersTotal = unpaidOrders
    .filter(o => selectedOrderIds.has(o.id))
    .reduce((sum, o) => sum + o.total_amount, 0);

  const totalOwedThisRound = outstandingBalance + selectedOrdersTotal;
  const enteredTotal = (parseFloat(cashAmount) || 0) + (parseFloat(bankAmount) || 0);
  const balanceAfter = totalOwedThisRound - enteredTotal;

  const getClientName = (id: number) => clients.find(c => c.id === id)?.name || 'Unknown';
  const getBankAccountName = (id?: number) => {
    if (!id) return '-';
    const acc = bankAccounts.find(a => a.id === id);
    return acc ? `${acc.bank_name} - ${acc.account_name}` : '-';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (selectedOrderIds.size === 0 && enteredTotal <= 0) {
      setFormError('Select orders and/or enter a cash or bank amount received.');
      return;
    }
    if ((parseFloat(bankAmount) || 0) > 0 && !bankAccountId) {
      setFormError('Select a bank account for the bank amount.');
      return;
    }

    setSaving(true);
    try {
      await apiClient.createSettlement({
        client_id: clientId,
        settlement_date: settlementDate,
        cash_amount: parseFloat(cashAmount) || 0,
        bank_amount: parseFloat(bankAmount) || 0,
        bank_account_id: bankAccountId || undefined,
        notes,
        order_ids: Array.from(selectedOrderIds),
      });
      setSelectedOrderIds(new Set());
      setCashAmount('');
      setBankAmount('');
      setBankAccountId(0);
      setNotes('');
      await loadSummary();
      await loadHistory();
      await loadClientBalances();
    } catch (error: any) {
      console.error('Failed to record settlement:', error);
      setFormError(error.message || 'Failed to record settlement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSettlement = async (id: number) => {
    if (!confirm('Undo this settlement? The client balance and any orders it closed will be restored.')) return;
    try {
      await apiClient.deleteSettlement(id);
      await loadSummary();
      await loadHistory();
      await loadClientBalances();
    } catch (error: any) {
      console.error('Failed to delete settlement:', error);
      alert(error.message || 'Failed to delete settlement. Please try again.');
    }
  };

  return (
    <div className="settlements">
      <div className="page-header">
        <h1>Settlements</h1>
      </div>

      <div className="settlement-client-picker">
        <label>Client</label>
        <select value={clientId} onChange={(e) => setClientId(parseInt(e.target.value))}>
          <option value={0}>Select a client to settle</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </div>

      <div className="client-tiles">
        {clientBalances.map(cb => (
          <button
            key={cb.client_id}
            type="button"
            className={`client-tile ${cb.client_id === clientId ? 'active' : ''} ${cb.total_due <= 0 ? 'settled' : ''}`}
            onClick={() => setClientId(cb.client_id)}
          >
            <span className="client-tile-name">{cb.client_name}</span>
            <span className="client-tile-amount">
              {cb.total_due < 0
                ? `₹${Math.abs(cb.total_due).toFixed(2)} credit`
                : `₹${cb.total_due.toFixed(2)}`}
            </span>
            <span className="client-tile-label">{cb.total_due <= 0 ? 'settled up' : 'balance due'}</span>
          </button>
        ))}
      </div>

      {clientId === 0 ? (
        <div className="settlement-empty">Select a client above to see their unpaid orders, balance, and settlement history.</div>
      ) : (
        <div className="settlement-layout">
          <div className="settlement-balance-banner">
            <span>Outstanding balance for {getClientName(clientId)}</span>
            <strong className={outstandingBalance < 0 ? 'credit' : ''}>
              ₹{Math.abs(outstandingBalance).toFixed(2)}{outstandingBalance < 0 ? ' (in credit)' : ''}
            </strong>
          </div>

          <div className="settlement-panel">
            <h2>Unpaid Orders - {getClientName(clientId)}</h2>
            <p className="settlement-panel-hint">
              Pick the orders to settle now. Once submitted, picked orders close out for good -
              anything not covered by the amount received joins the outstanding balance above, not the order.
            </p>
            <div className="table-container">
              <table className="settlement-orders-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={unpaidOrders.length > 0 && selectedOrderIds.size === unpaidOrders.length}
                        onChange={toggleAll}
                        disabled={unpaidOrders.length === 0}
                      />
                    </th>
                    <th>Order #</th>
                    <th>Delivery Date</th>
                    <th>Items</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px' }}>
                        No unpaid orders for this client.
                      </td>
                    </tr>
                  ) : (
                    unpaidOrders.map(order => (
                      <tr key={order.id} className={selectedOrderIds.has(order.id) ? 'selected-row' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.has(order.id)}
                            onChange={() => toggleOrder(order.id)}
                          />
                        </td>
                        <td>{order.order_number}</td>
                        <td>{order.delivery_date}</td>
                        <td className="order-items-cell">{order.items_summary || '-'}</td>
                        <td>₹{order.total_amount.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <form className="settlement-form" onSubmit={handleSubmit}>
              <h3 className="settlement-form-title">Record a Payment</h3>
              <p className="settlement-panel-hint">
                No orders need to be selected to make a payment - this always covers the existing balance
                first, so entering an amount below and submitting is enough to pay it down or clear it.
              </p>
              <div className="settlement-calc">
                <div><span>Existing balance</span><span>₹{outstandingBalance.toFixed(2)}</span></div>
                <div><span>Orders selected now</span><span>₹{selectedOrdersTotal.toFixed(2)}</span></div>
                <div className="settlement-calc-total"><span>Total owed this round</span><span>₹{totalOwedThisRound.toFixed(2)}</span></div>
              </div>
              {totalOwedThisRound > 0 && (
                <button
                  type="button"
                  className="btn-secondary settlement-quickfill"
                  onClick={() => { setCashAmount(totalOwedThisRound.toFixed(2)); setBankAmount(''); }}
                >
                  Fill full amount owed (₹{totalOwedThisRound.toFixed(2)}) as cash
                </button>
              )}
              {formError && <div className="form-error-banner">{formError}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label>Settlement Date *</label>
                  <input
                    type="date"
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cash Received (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Bank Received (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bankAmount}
                    onChange={(e) => setBankAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              {(parseFloat(bankAmount) || 0) > 0 && (
                <div className="form-group">
                  <label>Bank Account *</label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(parseInt(e.target.value))}
                    required
                  >
                    <option value={0}>Select Bank Account</option>
                    {bankAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.bank_name} - {account.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="settlement-form-footer">
                <span className="settlement-entered-total">
                  Balance after this settlement: <strong>₹{Math.abs(balanceAfter).toFixed(2)}{balanceAfter < 0 ? ' (credit)' : ''}</strong>
                </span>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Record Settlement'}
                </button>
              </div>
              <p className="settlement-hint">
                The amount received doesn't need to cover the full total - whatever's left simply becomes the client's new outstanding balance.
              </p>
            </form>
          </div>

          <div className="settlement-panel">
            <h2>Payment History - {getClientName(clientId)}</h2>
            <p className="settlement-panel-hint">
              Only settlements with orders get their own row - payments made afterward against the same balance
              are folded in underneath. Click a row to see the orders, products and every payment made toward it.
            </p>
            <div className="table-container">
              <table className="settlement-history-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Date</th>
                    <th>Balance Before</th>
                    <th>Orders Added</th>
                    <th>Cash</th>
                    <th>Bank</th>
                    <th>Received</th>
                    <th>Balance After</th>
                    <th>Bank Account</th>
                    <th>Orders Closed</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '30px' }}>
                        No settlements recorded for this client yet.
                      </td>
                    </tr>
                  ) : (
                    groupSettlements(history).map((group) => {
                      const { anchor } = group;
                      const events = groupEvents(group);
                      const totals = groupTotals(group);
                      const latestInGroup = events[events.length - 1];
                      const canUndo = latestInGroup.id === history[0]?.id;
                      const isExpanded = expandedSettlementId === anchor.id;
                      return (
                        <Fragment key={anchor.id}>
                          <tr
                            className="settlement-row"
                            onClick={() => setExpandedSettlementId(isExpanded ? null : anchor.id!)}
                          >
                            <td className="settlement-expand-toggle">{isExpanded ? '▾' : '▸'}</td>
                            <td>{anchor.settlement_date}</td>
                            <td>₹{(anchor.previous_balance || 0).toFixed(2)}</td>
                            <td>₹{(anchor.order_total || 0).toFixed(2)}</td>
                            <td>₹{totals.cash.toFixed(2)}</td>
                            <td>₹{totals.bank.toFixed(2)}</td>
                            <td><strong>₹{totals.received.toFixed(2)}</strong></td>
                            <td>₹{totals.balanceAfter.toFixed(2)}</td>
                            <td>{getBankAccountName(anchor.bank_account_id)}</td>
                            <td className="order-items-cell">
                              {anchor.items && anchor.items.length > 0
                                ? anchor.items.map(i => i.order_number).join(', ')
                                : '-'}
                            </td>
                            <td>{anchor.notes || '-'}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              {canUndo && (
                                <button className="btn-delete" onClick={() => handleDeleteSettlement(latestInGroup.id!)}>
                                  Undo
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="settlement-detail-row">
                              <td colSpan={12}>
                                <SettlementGroupDetail group={group} getBankAccountName={getBankAccountName} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
