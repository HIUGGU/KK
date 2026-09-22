import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { formatDate } from '../utils/formatDate';
import './Advances.css';

interface Employee {
  id?: number;
  employee_id: string;
  name: string;
}

interface Advance {
  id?: number;
  employee_id: number;
  amount: number;
  remark?: string;
  date: string;
  status: 'pending' | 'deducted' | 'cancelled';
  created_at?: string;
}

export default function Advances() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: 0,
    amount: 0,
    remark: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadEmployees();
    loadAdvances();
  }, [selectedEmployee, dateRange]);

  const loadEmployees = async () => {
    try {
      const data = await apiClient.getAllEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadAdvances = async () => {
    try {
      let data;
      if (selectedEmployee) {
        data = await apiClient.getAdvancesByEmployee(
          selectedEmployee,
          dateRange.startDate,
          dateRange.endDate
        );
      } else {
        data = await apiClient.getAllAdvances(
          dateRange.startDate,
          dateRange.endDate
        );
      }
      setAdvances(data);
    } catch (error) {
      console.error('Failed to load advances:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createAdvance(
        formData.employeeId,
        formData.amount,
        formData.remark,
        formData.date
      );
      setShowModal(false);
      resetForm();
      loadAdvances();
      alert('Advance created successfully!');
    } catch (error: any) {
      console.error('Failed to create advance:', error);
      alert(error.message || 'Failed to create advance. Please try again.');
    }
  };

  const handleUpdateStatus = async (id: number, status: 'pending' | 'deducted' | 'cancelled') => {
    try {
      await apiClient.updateAdvanceStatus(id, status);
      loadAdvances();
      alert('Advance status updated!');
    } catch (error: any) {
      console.error('Failed to update advance:', error);
      alert(error.message || 'Failed to update advance. Please try again.');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this advance?')) {
      try {
        await apiClient.deleteAdvance(id);
        loadAdvances();
        alert('Advance deleted successfully!');
      } catch (error: any) {
        console.error('Failed to delete advance:', error);
        alert(error.message || 'Failed to delete advance. Please try again.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: 0,
      amount: 0,
      remark: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  const getEmployeeName = (employeeId: number) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.employee_id} - ${emp.name}` : `Employee #${employeeId}`;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'deducted': return 'status-deducted';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  };

  const totalPending = advances
    .filter(a => a.status === 'pending')
    .reduce((sum, a) => sum + a.amount, 0);
  const totalAdvance = advances
    .filter(a => a.status !== 'cancelled')
    .reduce((sum, a) => sum + a.amount, 0);

  return (
    <div className="advances">
      <div className="page-header">
        <h1>Advance Payments</h1>
        <button className="btn-primary" onClick={() => { setShowModal(true); resetForm(); }}>
          + Add Advance
        </button>
      </div>

      <div className="advances-controls">
        <div className="control-group">
          <label>Filter by Employee</label>
          <select
            value={selectedEmployee || ''}
            onChange={(e) => setSelectedEmployee(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_id} - {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label>Start Date</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
          />
        </div>
        <div className="control-group">
          <label>End Date</label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="advances-summary">
        <div className="summary-card">
          <h3>Total Pending</h3>
          <p className="summary-value">₹{totalPending.toFixed(2)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Advance</h3>
          <p className="summary-value">₹{totalAdvance.toFixed(2)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Records</h3>
          <p className="summary-value">{advances.length}</p>
        </div>
      </div>

      <div className="table-container">
        <table className="advances-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Amount</th>
              <th>Remark</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {advances.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                  No advance records found.
                </td>
              </tr>
            ) : (
              advances.map((advance) => (
                <tr key={advance.id}>
                  <td>{formatDate(advance.date)}</td>
                  <td>{getEmployeeName(advance.employee_id)}</td>
                  <td>₹{parseFloat(advance.amount.toString()).toFixed(2)}</td>
                  <td>{advance.remark || '-'}</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(advance.status)}`}>
                      {advance.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {advance.status === 'pending' && (
                        <button
                          className="btn-cancel"
                          onClick={() => handleUpdateStatus(advance.id!, 'cancelled')}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(advance.id!)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Advance Payment</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Employee *</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: parseInt(e.target.value) })}
                  required
                >
                  <option value={0}>Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_id} - {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                  min="0.01"
                />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Remark</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  rows={3}
                  placeholder="Enter remark for this advance"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">Create Advance</button>
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}








