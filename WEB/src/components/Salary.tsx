import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import './Salary.css';

interface SalaryPayment {
  id?: number;
  employee_id: number;
  amount: number;
  payment_date: string;
  notes?: string;
}

interface MonthlyEarning {
  month: number;
  year: number;
  full_days: number;
  half_days: number;
  absent_days: number;
  earned: number;
}

interface EmployeeLedger {
  employee_id: number;
  employee_code: string;
  name: string;
  is_constant_salary: boolean;
  base_salary: number;
  total_earned: number;
  total_advances: number;
  total_paid: number;
  balance_due: number;
  last_payment_date?: string;
  monthly_earnings: MonthlyEarning[];
  payments: SalaryPayment[];
}

const today = () => new Date().toISOString().split('T')[0];

const money = (value: number | string) => `₹${parseFloat(value.toString()).toFixed(2)}`;

const getMonthName = (month: number) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

export default function Salary() {
  const [ledger, setLedger] = useState<EmployeeLedger[]>([]);
  const [expandedEmployee, setExpandedEmployee] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [onlyPending, setOnlyPending] = useState(false);
  const [loading, setLoading] = useState(false);

  // Payment modal
  const [payingEmployee, setPayingEmployee] = useState<EmployeeLedger | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLedger();
  }, [asOf]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await (apiClient.getSalaryLedger(asOf) as Promise<EmployeeLedger[]>);
      setLedger(data);
    } catch (error) {
      console.error('Failed to load salary ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (row: EmployeeLedger) => {
    setPayingEmployee(row);
    // Pre-filled with everything owed; overwrite it to pay part of the balance.
    setPayAmount(row.balance_due > 0 ? row.balance_due.toFixed(2) : '');
    setPayDate(today());
    setPayNotes('');
  };

  const closePaymentModal = () => {
    setPayingEmployee(null);
    setPayAmount('');
    setPayNotes('');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingEmployee) return;

    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      alert('Enter a payment amount greater than zero.');
      return;
    }

    setSaving(true);
    try {
      await apiClient.createSalaryPayment(
        payingEmployee.employee_id,
        amount,
        payDate,
        payNotes || undefined
      );
      closePaymentModal();
      loadLedger();
    } catch (error: any) {
      console.error('Failed to record payment:', error);
      alert(error.message || 'Failed to record payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (payment: SalaryPayment) => {
    if (!confirm(`Delete the ${money(payment.amount)} payment dated ${formatDate(payment.payment_date)}?`)) {
      return;
    }
    try {
      await apiClient.deleteSalaryPayment(payment.id!);
      loadLedger();
    } catch (error: any) {
      alert(error.message || 'Failed to delete payment.');
    }
  };

  const search = searchTerm.toLowerCase();
  const rows = ledger.filter((row) => {
    const matchesSearch =
      row.name.toLowerCase().includes(search) ||
      row.employee_code.toLowerCase().includes(search);
    const matchesPending = !onlyPending || row.balance_due > 0;
    return matchesSearch && matchesPending;
  });

  const totalDue = rows.reduce((sum, r) => sum + Math.max(r.balance_due, 0), 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.total_paid, 0);
  const pendingCount = rows.filter((r) => r.balance_due > 0).length;

  return (
    <div className="salary">
      <div className="page-header">
        <h1>Salary Management</h1>
      </div>

      <div className="salary-controls">
        <div className="control-group search-group">
          <label>Search Employee</label>
          <input
            type="text"
            placeholder="Name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="control-group">
          <label>Balance As Of</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
          />
        </div>
        <div className="control-group">
          <label>Show</label>
          <select
            value={onlyPending ? 'pending' : 'all'}
            onChange={(e) => setOnlyPending(e.target.value === 'pending')}
          >
            <option value="all">All Employees</option>
            <option value="pending">Pending Payment Only</option>
          </select>
        </div>
        <div className="control-group action-group">
          <button className="btn-secondary" onClick={loadLedger} disabled={loading} style={{ marginTop: '25px' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="salary-summary">
        <div className="summary-card">
          <h3>Total Pending</h3>
          <p className="summary-value unpaid-text">{money(totalDue)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Paid So Far</h3>
          <p className="summary-value paid-text">{money(totalPaid)}</p>
        </div>
        <div className="summary-card">
          <h3>Employees Awaiting Payment</h3>
          <p className="summary-value">{pendingCount}</p>
        </div>
      </div>

      <div className="table-container">
        <table className="salary-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Worked Days</th>
              <th>Earned</th>
              <th>Advance</th>
              <th>Paid</th>
              <th>Pending</th>
              <th>Last Paid</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  {loading ? 'Loading...' : 'No employees found.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const workedDays = row.monthly_earnings.reduce(
                  (sum, m) => sum + m.full_days + m.half_days * 0.5,
                  0
                );
                const expanded = expandedEmployee === row.employee_id;
                return (
                  <React.Fragment key={row.employee_id}>
                    <tr
                      className={`employee-row ${expanded ? 'expanded' : ''}`}
                      onClick={() => setExpandedEmployee(expanded ? null : row.employee_id)}
                    >
                      <td>
                        <div className="employee-info-cell">
                          <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
                          <div className="employee-name-group">
                            <strong>{row.employee_code} - {row.name}</strong>
                            <span className={`salary-type-badge ${row.is_constant_salary ? 'fixed' : 'attendance'}`}>
                              {row.is_constant_salary ? 'Fixed' : 'Attendance-based'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{workedDays}d</td>
                      <td>{money(row.total_earned)}</td>
                      <td className="unpaid-text">{money(row.total_advances)}</td>
                      <td className="paid-text">{money(row.total_paid)}</td>
                      <td className={row.balance_due > 0 ? 'unpaid-text balance-due' : 'paid-text balance-due'}>
                        {money(row.balance_due)}
                      </td>
                      <td>{formatDate(row.last_payment_date)}</td>
                      <td>
                        <button
                          className="btn-payout"
                          onClick={(e) => { e.stopPropagation(); openPaymentModal(row); }}
                          disabled={loading}
                        >
                          Pay
                        </button>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="details-row">
                        <td colSpan={8}>
                          <div className="employee-details-container">
                            <div className="balance-breakdown">
                              <span>Earned {money(row.total_earned)}</span>
                              <span className="unpaid-text">− Advance {money(row.total_advances)}</span>
                              <span className="paid-text">− Paid {money(row.total_paid)}</span>
                              <span className="balance-due">= Pending {money(row.balance_due)}</span>
                            </div>

                            <h4>Earnings by Month</h4>
                            {row.monthly_earnings.length === 0 ? (
                              <p className="no-records-msg">No attendance marked yet.</p>
                            ) : (
                              <table className="details-table">
                                <thead>
                                  <tr>
                                    <th>Month/Year</th>
                                    <th>Full Days</th>
                                    <th>Half Days</th>
                                    <th>Absent</th>
                                    <th>Earned</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.monthly_earnings.map((m) => (
                                    <tr key={`${m.year}-${m.month}`}>
                                      <td>{getMonthName(m.month)} {m.year}</td>
                                      <td>{m.full_days}</td>
                                      <td>{m.half_days}</td>
                                      <td>{m.absent_days}</td>
                                      <td>{money(m.earned)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            <h4 style={{ marginTop: '20px' }}>Payments</h4>
                            {row.payments.length === 0 ? (
                              <p className="no-records-msg">No payments recorded yet.</p>
                            ) : (
                              <table className="details-table">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Note</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.payments.map((payment) => (
                                    <tr key={payment.id}>
                                      <td>{formatDate(payment.payment_date)}</td>
                                      <td className="paid-text">{money(payment.amount)}</td>
                                      <td>{payment.notes || '-'}</td>
                                      <td>
                                        <button
                                          className="btn-mark-not-paid"
                                          onClick={() => handleDeletePayment(payment)}
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {payingEmployee && (
        <div className="modal-overlay" onClick={closePaymentModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Pay Salary - {payingEmployee.employee_code} - {payingEmployee.name}</h2>
            <form onSubmit={handleRecordPayment}>
              <div className="preview-summary-box">
                <div className="preview-header">
                  <span>Salary Type: <strong>{payingEmployee.is_constant_salary ? 'Fixed Monthly' : 'Attendance-based'}</strong></span>
                  <span>Last Paid: <strong>{formatDate(payingEmployee.last_payment_date)}</strong></span>
                </div>
                <div className="preview-grid">
                  <div className="preview-item">
                    <label>Earned</label>
                    <span>{money(payingEmployee.total_earned)}</span>
                  </div>
                  <div className="preview-item">
                    <label>Advances</label>
                    <span className="unpaid-text">- {money(payingEmployee.total_advances)}</span>
                  </div>
                  <div className="preview-item">
                    <label>Already Paid</label>
                    <span className="paid-text">- {money(payingEmployee.total_paid)}</span>
                  </div>
                  <div className="preview-item highlight">
                    <label>Pending</label>
                    <span className="unpaid-text">{money(payingEmployee.balance_due)}</span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Amount Paying (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  autoFocus
                />
                <small className="field-hint">
                  Pre-filled with the full pending amount. Change it to pay part of it.
                </small>
              </div>

              <div className="form-group">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Note (optional)</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Weekend payout, cash"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closePaymentModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : `Record ${money(parseFloat(payAmount) || 0)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
