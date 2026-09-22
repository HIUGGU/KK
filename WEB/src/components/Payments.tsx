import { useState, useEffect, Fragment } from 'react';
import { apiClient } from '../api/client';
import { Settlement, SettlementGroupDetail, groupSettlements, groupEvents, groupTotals } from './SettlementDetail';
import './Payments.css';
import { notify, confirmDialog } from '../utils/notify';

interface Client {
  id: number;
  name: string;
}

interface BankAccount {
  id: number;
  account_name: string;
  bank_name: string;
}

const today = () => new Date().toISOString().split('T')[0];

/**
 * A quick way to record money a client hands over before there's any
 * settlement to apply it to (or just to pay down what they already owe).
 * Every entry here is a Settlement with no orders attached, so it's the same
 * record the Settlements page reads - it shows up there too, never twice.
 */
export default function Payments() {
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [clientId, setClientId] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(today());
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'cash' | 'bank_transfer'>('cash');
  const [bankAccountId, setBankAccountId] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClients();
    loadBankAccounts();
    loadSettlements();
  }, []);

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

  const loadSettlements = async () => {
    try {
      const data = await apiClient.getAllSettlements();
      setSettlements(data);
    } catch (error) {
      console.error('Failed to load payments:', error);
    }
  };

  const resetForm = () => {
    setClientId(0);
    setPaymentDate(today());
    setAmount('');
    setMethod('cash');
    setBankAccountId(0);
    setNotes('');
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const amt = parseFloat(amount) || 0;
    if (!clientId) {
      setFormError('Select a client.');
      return;
    }
    if (amt <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    if (method === 'bank_transfer' && !bankAccountId) {
      setFormError('Select a bank account for a bank transfer.');
      return;
    }

    setSaving(true);
    try {
      await apiClient.createSettlement({
        client_id: clientId,
        settlement_date: paymentDate,
        cash_amount: method === 'cash' ? amt : 0,
        bank_amount: method === 'bank_transfer' ? amt : 0,
        bank_account_id: method === 'bank_transfer' ? bankAccountId : undefined,
        notes,
        order_ids: [],
      });
      setShowModal(false);
      resetForm();
      loadSettlements();
    } catch (error: any) {
      console.error('Failed to record payment:', error);
      setFormError(error.message || 'Failed to record payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog('Undo this payment? The client balance will be restored to what it was before.', { confirmLabel: 'Undo', danger: true }))) return;
    try {
      await apiClient.deleteSettlement(id);
      loadSettlements();
    } catch (error: any) {
      console.error('Failed to undo payment:', error);
      notify.error(error.message || 'Failed to undo payment. Only the client\'s most recent settlement can be undone.');
    }
  };

  const getBankAccountName = (id?: number) => {
    if (!id) return '-';
    const acc = bankAccounts.find(a => a.id === id);
    return acc ? `${acc.bank_name} - ${acc.account_name}` : '-';
  };

  return (
    <div className="payments">
      <div className="page-header">
        <h1>Payments</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + Add Payment
        </button>
      </div>
      <p className="payments-hint">
        Every payment here is applied straight to the client's balance and appears on their Settlements page too -
        it's the same record, shown once.
      </p>

      <div className="table-container">
        <table className="payments-table settlement-history-table">
          <thead>
            <tr>
              <th></th>
              <th>Date</th>
              <th>Client</th>
              <th>Cash</th>
              <th>Bank</th>
              <th>Amount</th>
              <th>Bank Account</th>
              <th>Orders Closed</th>
              <th>Balance After</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {settlements.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '40px' }}>
                  No payments recorded yet. Add your first payment!
                </td>
              </tr>
            ) : (
              groupSettlements(settlements).map((group) => {
                const { anchor } = group;
                const events = groupEvents(group);
                const totals = groupTotals(group);
                const latestInGroup = events[events.length - 1];
                // The backend only allows undoing a client's single most recent settlement.
                const latestForClient = settlements.find(o => o.client_id === anchor.client_id);
                const canUndo = latestInGroup.id === latestForClient?.id;
                const isExpanded = expandedId === anchor.id;
                return (
                  <Fragment key={anchor.id}>
                    <tr className="settlement-row" onClick={() => setExpandedId(isExpanded ? null : anchor.id!)}>
                      <td className="settlement-expand-toggle">{isExpanded ? '▾' : '▸'}</td>
                      <td>{anchor.settlement_date}</td>
                      <td>{anchor.client_name}</td>
                      <td>₹{totals.cash.toFixed(2)}</td>
                      <td>₹{totals.bank.toFixed(2)}</td>
                      <td><strong>₹{totals.received.toFixed(2)}</strong></td>
                      <td>{getBankAccountName(anchor.bank_account_id)}</td>
                      <td>{anchor.items && anchor.items.length > 0 ? anchor.items.map(i => i.order_number).join(', ') : '-'}</td>
                      <td>₹{totals.balanceAfter.toFixed(2)}</td>
                      <td>{anchor.notes || '-'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {canUndo && (
                          <button className="btn-delete" onClick={() => handleDelete(latestInGroup.id!)}>
                            Undo
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="settlement-detail-row">
                        <td colSpan={11}>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Payment</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Client *</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(parseInt(e.target.value))}
                    required
                  >
                    <option value={0}>Select Client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Payment Method *</label>
                  <select
                    value={method}
                    onChange={(e) => {
                      const value = e.target.value as 'cash' | 'bank_transfer';
                      setMethod(value);
                      if (value === 'cash') setBankAccountId(0);
                    }}
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              {method === 'bank_transfer' && (
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
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              {formError && <div className="form-error-banner">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
