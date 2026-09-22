import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import './Employees.css';
import { notify, confirmDialog } from '../utils/notify';

interface Employee {
  id?: number;
  employee_id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  base_salary: number;
  is_constant_salary?: boolean;
  hire_date: string;
  status?: string;
}

export default function Employees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Employee>({
    employee_id: '',
    name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    base_salary: 0,
    is_constant_salary: false,
    hire_date: new Date().toISOString().split('T')[0],
    status: 'active',
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await apiClient.getAllEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A daily wage is read-only when editing (it changes through Salary Changes),
    // so it is only checked and sent when it can actually be set here.
    const salaryEditable = !editingEmployee || formData.is_constant_salary;
    if (salaryEditable && !(formData.base_salary > 0)) {
      notify.error('Salary must be more than zero');
      return;
    }
    try {
      if (editingEmployee?.id) {
        const { base_salary, ...rest } = formData;
        await apiClient.updateEmployee(editingEmployee.id, salaryEditable ? formData : rest);
      } else {
        await apiClient.createEmployee(formData);
      }
      setShowModal(false);
      setEditingEmployee(null);
      resetForm();
      loadEmployees();
    } catch (error: any) {
      console.error('Failed to save employee:', error);
      notify.error(error.message || 'Failed to save employee. Please try again.');
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData(employee);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (await confirmDialog('Are you sure you want to delete this employee?', { confirmLabel: 'Delete', danger: true })) {
      try {
        await apiClient.deleteEmployee(id);
        loadEmployees();
      } catch (error: any) {
        console.error('Failed to delete employee:', error);
        notify.error(error.message || 'Failed to delete employee. Please try again.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      name: '',
      email: '',
      phone: '',
      department: '',
      position: '',
      base_salary: 0,
      is_constant_salary: false,
      hire_date: new Date().toISOString().split('T')[0],
      status: 'active',
    });
  };

  return (
    <div className="employees">
      <div className="page-header">
        <h1>Employees</h1>
        <button className="btn-primary" onClick={() => { setShowModal(true); setEditingEmployee(null); resetForm(); }}>
          + Add Employee
        </button>
      </div>

      <div className="table-container">
        <table className="employees-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Department</th>
              <th>Position</th>
              <th>Daily Salary</th>
              <th>Constant Salary</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px' }}>
                  No employees found. Add your first employee!
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.employee_id}</td>
                  <td>{emp.name}</td>
                  <td>{emp.email || '-'}</td>
                  <td>{emp.phone || '-'}</td>
                  <td>{emp.department || '-'}</td>
                  <td>{emp.position || '-'}</td>
                  <td>₹{parseFloat(emp.base_salary.toString()).toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${emp.is_constant_salary ? 'constant' : 'attendance'}`}>
                      {emp.is_constant_salary ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${emp.status}`}>
                      {emp.status || 'active'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-edit" onClick={() => handleEdit(emp)}>
                      Edit
                    </button>
                    {!emp.is_constant_salary && (
                      <button className="btn-history" onClick={() => navigate(`/salary-changes?employee=${emp.id}`)}>
                        Salary History
                      </button>
                    )}
                    <button className="btn-delete" onClick={() => handleDelete(emp.id!)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingEmployee(null); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Employee ID *</label>
                  <input
                    type="text"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Position</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{formData.is_constant_salary ? 'Monthly' : 'Daily'} Salary (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.base_salary}
                    onChange={(e) => setFormData({ ...formData, base_salary: parseFloat(e.target.value) || 0 })}
                    required
                    readOnly={!!editingEmployee && !formData.is_constant_salary}
                    className={editingEmployee && !formData.is_constant_salary ? 'input-readonly' : undefined}
                    placeholder={formData.is_constant_salary ? "Enter monthly salary" : "Enter daily salary"}
                  />
                  {editingEmployee && formData.is_constant_salary && (
                    <span className="field-hint">Fixed salary - edit only to correct a wrong amount.</span>
                  )}
                  {editingEmployee && !formData.is_constant_salary && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => navigate(`/salary-changes?employee=${editingEmployee.id}`)}
                    >
                      Increase / decrease daily wage →
                    </button>
                  )}
                </div>
                <div className="form-group">
                  <label>Hire Date *</label>
                  <input
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_constant_salary || false}
                    onChange={(e) => setFormData({ ...formData, is_constant_salary: e.target.checked })}
                  />
                  <span>Constant Salary (Monthly fixed amount, not based on attendance)</span>
                </label>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditingEmployee(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingEmployee ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
