import { useState, useEffect, Fragment } from 'react';
import { apiClient } from '../api/client';
import { formatDate } from '../utils/formatDate';
import './VendorPayments.css';
import { notify, confirmDialog } from '../utils/notify';

/**
 * Paying plasma vendors: the mirror of client settlements, for money going out.
 * Jobs picked here close out for good - whatever this payment does not cover
 * joins the vendor's running balance rather than staying on the job, so a
 * vendor can be paid part now and the rest later.
 */

interface Vendor {
  id: number;
  name: string;
  status?: string;
}

interface BankAccount {
  id: number;
  account_name: string;
  bank_name: string;
  status?: string;
}

interface UnpaidJob {
  id: number;
  job_number: string;
  job_date: string;
  total_quantity: number;
  total_cost: number;
  items_summary: string;
}

interface VendorBalance {
  vendor_id: number;
  vendor_name: string;
  unpaid_jobs_total: number;
  payable_balance: number;
  total_payable: number;
}

interface PaymentJobLine {
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

interface PaymentItem {
  job_id: number;
  job_number?: string;
  job_amount: number;
  job_date?: string;
  job_lines?: PaymentJobLine[];
}

interface VendorPayment {
  id: number;
  vendor_id: number;
  payment_date: string;
  previous_balance: number;
  job_total: number;
  cash_amount: number;
  bank_amount: number;
  bank_account_id?: number;
  total_amount: number;
  new_balance: number;
  notes?: string;
  items?: PaymentItem[];
}

const today = () => new Date().toISOString().split('T')[0];

const money = (value: number) => `₹${Number(value || 0).toFixed(2)}`;

export default function VendorPayments() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [balances, setBalances] = useState<VendorBalance[]>([]);
  const [vendorId, setVendorId] = useState<number>(0);

  const [unpaidJobs, setUnpaidJobs] = useState<UnpaidJob[]>([]);
  const [payableBalance, setPayableBalance] = useState<number>(0);
  const [history, setHistory] = useState<VendorPayment[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // A Set so a single job can never end up selected more than once
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());

  const [paymentDate, setPaymentDate] = useState(today());
  const [cashAmount, setCashAmount] = useState<string>('');
  const [bankAmount, setBankAmount] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVendors();
    loadBankAccounts();
    loadBalances();
  }, []);

  useEffect(() => {
    if (vendorId > 0) {
      loadSummary();
      loadHistory();
    } else {
      setUnpaidJobs([]);
      setPayableBalance(0);
      setHistory([]);
    }
    // A payment belongs to exactly one vendor - switching vendors starts fresh
    setSelectedJobIds(new Set());
    setExpandedId(null);
    setCashAmount('');
    setBankAmount('');
    setBankAccountId(0);
    setNotes('');
    setFormError('');
  }, [vendorId]);

  const loadVendors = async () => {
    try {
      const data = await apiClient.getAllVendors('plasma');
      setVendors((data as Vendor[]).filter((v) => v.status === 'active'));
    } catch (error) {
      console.error('Failed to load vendors:', error);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const data = await apiClient.getAllBankAccounts();
      setBankAccounts((data as BankAccount[]).filter((a) => a.status === 'active'));
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
    }
  };

  const loadBalances = async () => {
    try {
      const data = await apiClient.getVendorBalances();
      setBalances(data as VendorBalance[]);
    } catch (error) {
      console.error('Failed to load vendor balances:', error);
    }
  };

  const loadSummary = async () => {
    try {
      const data: any = await apiClient.getVendorPaymentSummary(vendorId);
      setUnpaidJobs(data.unpaid_jobs);
      setPayableBalance(data.payable_balance);
    } catch (error) {
      console.error('Failed to load vendor payment summary:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await apiClient.getPaymentsByVendor(vendorId);
      setHistory(data as VendorPayment[]);
    } catch (error) {
      console.error('Failed to load payment history:', error);
    }
  };

  const toggleJob = (jobId: number) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedJobIds.size === unpaidJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(unpaidJobs.map((j) => j.id)));
    }
  };

  const selectedJobsTotal = unpaidJobs
    .filter((j) => selectedJobIds.has(j.id))
    .reduce((sum, j) => sum + j.total_cost, 0);

  const totalOwedThisRound = payableBalance + selectedJobsTotal;
  const enteredTotal = (parseFloat(cashAmount) || 0) + (parseFloat(bankAmount) || 0);
  const balanceAfter = totalOwedThisRound - enteredTotal;

  const vendorName = (id: number) => vendors.find((v) => v.id === id)?.name || 'Unknown';

  const bankAccountName = (id?: number) => {
    if (!id) return '-';
    const account = bankAccounts.find((a) => a.id === id);
    return account ? `${account.bank_name} - ${account.account_name}` : '-';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (selectedJobIds.size === 0 && enteredTotal <= 0) {
      setFormError('Select jobs and/or enter a cash or bank amount paid.');
      return;
    }
    if ((parseFloat(bankAmount) || 0) > 0 && !bankAccountId) {
      setFormError('Select a bank account for the bank amount.');
      return;
    }

    setSaving(true);
    try {
      await apiClient.createVendorPayment({
        vendor_id: vendorId,
        payment_date: paymentDate,
        cash_amount: parseFloat(cashAmount) || 0,
        bank_amount: parseFloat(bankAmount) || 0,
        bank_account_id: bankAccountId || undefined,
        notes,
        job_ids: Array.from(selectedJobIds),
      });
      setSelectedJobIds(new Set());
      setCashAmount('');
      setBankAmount('');
      setBankAccountId(0);
      setNotes('');
      await loadSummary();
      await loadHistory();
      await loadBalances();
    } catch (error: any) {
      console.error('Failed to record vendor payment:', error);
      setFormError(error.message || 'Failed to record the payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !(await confirmDialog('Undo this payment? The vendor balance and any jobs it closed will be restored.', { confirmLabel: 'Undo', danger: true }))
    )
      return;
    try {
      await apiClient.deleteVendorPayment(id);
      await loadSummary();
      await loadHistory();
      await loadBalances();
    } catch (error: any) {
      console.error('Failed to delete vendor payment:', error);
      notify.error(error.message || 'Failed to delete the payment. Please try again.');
    }
  };

  return (
    <div className="vendor-payments">
      <div className="page-header">
        <h1>Vendor Payments</h1>
      </div>

      <div className="vendor-picker">
        <label>Vendor</label>
        <select value={vendorId} onChange={(e) => setVendorId(parseInt(e.target.value))}>
          <option value={0}>Select a vendor to pay</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
      </div>

      <div className="vendor-tiles">
        {balances.map((vb) => (
          <button
            key={vb.vendor_id}
            type="button"
            className={`vendor-tile ${vb.vendor_id === vendorId ? 'active' : ''} ${
              vb.total_payable <= 0 ? 'settled' : ''
            }`}
            onClick={() => setVendorId(vb.vendor_id)}
          >
            <span className="vendor-tile-name">{vb.vendor_name}</span>
            <span className="vendor-tile-amount">
              {vb.total_payable < 0
                ? `${money(Math.abs(vb.total_payable))} credit`
                : money(vb.total_payable)}
            </span>
            <span className="vendor-tile-label">
              {vb.total_payable <= 0 ? 'nothing due' : 'we owe'}
            </span>
          </button>
        ))}
      </div>

      {vendorId === 0 ? (
        <div className="vendor-empty">
          Select a vendor above to see their unpaid plasma jobs, what we still owe, and the
          history of what has been paid.
        </div>
      ) : (
        <div className="vendor-layout">
          <div className="vendor-balance-banner">
            <span>Balance owed to {vendorName(vendorId)}</span>
            <strong className={payableBalance < 0 ? 'credit' : ''}>
              {money(Math.abs(payableBalance))}
              {payableBalance < 0 ? ' (we are in credit)' : ''}
            </strong>
          </div>

          <div className="vendor-panel">
            <h2>Unpaid Plasma Jobs - {vendorName(vendorId)}</h2>
            <p className="vendor-panel-hint">
              Pick the jobs being paid for now. Once submitted, picked jobs close out for good -
              anything the payment does not cover joins the balance above, not the job.
            </p>
            <div className="table-container">
              <table className="vendor-jobs-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          unpaidJobs.length > 0 && selectedJobIds.size === unpaidJobs.length
                        }
                        onChange={toggleAll}
                        disabled={unpaidJobs.length === 0}
                      />
                    </th>
                    <th>Job #</th>
                    <th>Date</th>
                    <th>Pieces</th>
                    <th>Products</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidJobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-row">
                        No unpaid plasma jobs for this vendor.
                      </td>
                    </tr>
                  ) : (
                    unpaidJobs.map((job) => (
                      <tr
                        key={job.id}
                        className={selectedJobIds.has(job.id) ? 'selected-row' : ''}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedJobIds.has(job.id)}
                            onChange={() => toggleJob(job.id)}
                          />
                        </td>
                        <td>{job.job_number}</td>
                        <td>{formatDate(job.job_date)}</td>
                        <td>{job.total_quantity.toFixed(0)}</td>
                        <td className="job-items-cell">{job.items_summary || '-'}</td>
                        <td>{money(job.total_cost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <form className="vendor-form" onSubmit={handleSubmit}>
              <h3 className="vendor-form-title">Record a Payment</h3>
              <p className="vendor-panel-hint">
                No jobs need to be selected to make a payment - this always covers the existing
                balance first, so entering an amount below and submitting is enough to pay it down.
              </p>
              <div className="vendor-calc">
                <div>
                  <span>Existing balance</span>
                  <span>{money(payableBalance)}</span>
                </div>
                <div>
                  <span>Jobs selected now</span>
                  <span>{money(selectedJobsTotal)}</span>
                </div>
                <div className="vendor-calc-total">
                  <span>Total owed this round</span>
                  <span>{money(totalOwedThisRound)}</span>
                </div>
              </div>
              {totalOwedThisRound > 0 && (
                <button
                  type="button"
                  className="btn-secondary vendor-quickfill"
                  onClick={() => {
                    setCashAmount(totalOwedThisRound.toFixed(2));
                    setBankAmount('');
                  }}
                >
                  Fill full amount owed ({money(totalOwedThisRound)}) as cash
                </button>
              )}
              {formError && <div className="form-error-banner">{formError}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cash Paid (₹)</label>
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
                  <label>Bank Paid (₹)</label>
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
                    {bankAccounts.map((account) => (
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
              <div className="vendor-form-footer">
                <span className="vendor-entered-total">
                  Balance after this payment:{' '}
                  <strong>
                    {money(Math.abs(balanceAfter))}
                    {balanceAfter < 0 ? ' (credit)' : ''}
                  </strong>
                </span>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
              <p className="vendor-hint">
                The amount paid does not need to cover the full total - whatever is left simply
                becomes the vendor's new balance.
              </p>
            </form>
          </div>

          <div className="vendor-panel">
            <h2>Payment History - {vendorName(vendorId)}</h2>
            <p className="vendor-panel-hint">
              Click a row to see the jobs it closed and what each one was billed at. Only the most
              recent payment can be undone.
            </p>
            <div className="table-container">
              <table className="vendor-history-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Date</th>
                    <th>Balance Before</th>
                    <th>Jobs Added</th>
                    <th>Cash</th>
                    <th>Bank</th>
                    <th>Paid</th>
                    <th>Balance After</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="empty-row">
                        No payments recorded for this vendor yet.
                      </td>
                    </tr>
                  ) : (
                    history.map((payment, index) => {
                      const isOpen = expandedId === payment.id;
                      return (
                        <Fragment key={payment.id}>
                          <tr
                            className={`history-row${isOpen ? ' open' : ''}`}
                            onClick={() => setExpandedId(isOpen ? null : payment.id)}
                          >
                            <td>
                              <span className={`expander${isOpen ? ' open' : ''}`}>▸</span>
                            </td>
                            <td>{formatDate(payment.payment_date)}</td>
                            <td>{money(payment.previous_balance)}</td>
                            <td>{money(payment.job_total)}</td>
                            <td>{money(payment.cash_amount)}</td>
                            <td>
                              {payment.bank_amount > 0
                                ? `${money(payment.bank_amount)} (${bankAccountName(
                                    payment.bank_account_id,
                                  )})`
                                : money(0)}
                            </td>
                            <td>
                              <strong>{money(payment.total_amount)}</strong>
                            </td>
                            <td className={payment.new_balance < 0 ? 'credit' : ''}>
                              {money(Math.abs(payment.new_balance))}
                              {payment.new_balance < 0 ? ' cr' : ''}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              {/* Undoing anything but the latest would leave the
                                  balance math for everything after it wrong */}
                              {index === 0 && (
                                <button
                                  className="btn-delete"
                                  onClick={() => handleDelete(payment.id)}
                                >
                                  Undo
                                </button>
                              )}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="detail-row">
                              <td colSpan={9}>
                                <div className="detail-wrap">
                                  {(payment.items || []).length === 0 ? (
                                    <p className="detail-note">
                                      A payment against the running balance — no jobs were closed
                                      by it.
                                    </p>
                                  ) : (
                                    (payment.items || []).map((item) => (
                                      <div className="detail-job" key={item.job_id}>
                                        <h4>
                                          {item.job_number} · {formatDate(item.job_date || '')} ·{' '}
                                          {money(item.job_amount)}
                                        </h4>
                                        <table className="detail-table">
                                          <thead>
                                            <tr>
                                              <th>Product</th>
                                              <th>Pieces</th>
                                              <th>Per Piece</th>
                                              <th>Total</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(item.job_lines || []).map((line, i) => (
                                              <tr key={i}>
                                                <td>{line.product_name}</td>
                                                <td>{line.quantity.toFixed(0)}</td>
                                                <td>{money(line.unit_cost)}</td>
                                                <td>{money(line.total_cost)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ))
                                  )}
                                  {payment.notes && (
                                    <p className="detail-note">Note: {payment.notes}</p>
                                  )}
                                </div>
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
