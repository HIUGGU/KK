import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { formatDate, formatDateTime } from '../utils/formatDate';
import './Employees.css';
import './SalaryChanges.css';

interface Employee {
  id: number;
  employee_id: string;
  name: string;
  base_salary: number;
  is_constant_salary?: boolean;
  hire_date: string;
  status?: string;
}

interface SalaryRevision {
  id: number;
  employee_id: number;
  employee_code?: string;
  employee_name?: string;
  old_salary: number | null;
  new_salary: number;
  change: number | null;
  change_percent: number | null;
  is_constant_salary: boolean;
  effective_date: string;
  reason?: string;
  source: string;
  changed_at: string;
}

type ChangeFilter = 'all' | 'increase' | 'decrease';

const SOURCE_LABELS: Record<string, string> = {
  employee_created: 'Hired',
  employee_edited: 'Edited on employee form',
  revision_added: 'Salary change',
  backfill: 'Opening salary',
};

const pad = (n: number) => String(n).padStart(2, '0');
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const money = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const unit = (isConstant?: boolean) => (isConstant ? '/month' : '/day');

// Same rule as the API: latest revision effective on or before the day wins,
// ties going to the one entered last; before the first revision, the opening salary.
function salaryOn(revisions: SalaryRevision[], day: string, fallback: number): number {
  const sorted = [...revisions].sort((a, b) =>
    a.effective_date === b.effective_date ? a.id - b.id : a.effective_date < b.effective_date ? -1 : 1
  );
  if (sorted.length === 0) return fallback;
  let rate = sorted[0].new_salary;
  for (const r of sorted) {
    if (r.effective_date > day) break;
    rate = r.new_salary;
  }
  return rate;
}

function ChangeBadge({ change, percent }: { change: number | null; percent: number | null }) {
  if (change === null) return <span className="change-badge opening">Opening</span>;
  if (change === 0) return <span className="change-badge same">No change</span>;
  const up = change > 0;
  return (
    <span className={`change-badge ${up ? 'increase' : 'decrease'}`}>
      {up ? '▲' : '▼'} {up ? '+' : '−'}
      {money(Math.abs(change))}
      {percent !== null && ` (${up ? '+' : '−'}${Math.abs(percent)}%)`}
    </span>
  );
}

export default function SalaryChanges() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: 0,
    newSalary: '',
    effectiveDate: todayKey(),
    reason: '',
  });

  const selectedEmployee = Number(searchParams.get('employee')) || null;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [emps, revs] = await Promise.all([
        apiClient.getAllEmployees(),
        apiClient.getSalaryRevisions(),
      ]);
      setEmployees(emps as Employee[]);
      setRevisions(revs as SalaryRevision[]);
    } catch (error) {
      console.error('Failed to load salary changes:', error);
    }
  };

  const setSelectedEmployee = (id: number | null) => {
    setSearchParams(id ? { employee: String(id) } : {});
  };

  const visible = useMemo(
    () =>
      revisions.filter((r) => {
        if (selectedEmployee && r.employee_id !== selectedEmployee) return false;
        if (changeFilter === 'increase') return (r.change ?? 0) > 0;
        if (changeFilter === 'decrease') return (r.change ?? 0) < 0;
        return true;
      }),
    [revisions, selectedEmployee, changeFilter]
  );

  const employee = employees.find((e) => e.id === selectedEmployee);
  // A constant salary is never increased or decreased, so only daily wages have changes.
  const dailyWageEmployees = employees.filter((e) => !e.is_constant_salary);
  const employeeRevisions = revisions.filter((r) => r.employee_id === selectedEmployee);
  const changes = revisions.filter(
    (r) => (!selectedEmployee || r.employee_id === selectedEmployee) && r.change !== null
  );
  const increases = changes.filter((r) => (r.change ?? 0) > 0).length;
  const decreases = changes.filter((r) => (r.change ?? 0) < 0).length;

  // For the selected employee: where they started and how far they have moved since.
  const opening = [...employeeRevisions].sort((a, b) =>
    a.effective_date === b.effective_date ? a.id - b.id : a.effective_date < b.effective_date ? -1 : 1
  )[0];
  const startSalary = opening?.new_salary ?? employee?.base_salary ?? 0;
  const netChange = employee ? employee.base_salary - startSalary : 0;
  const netPercent = startSalary ? Math.round((netChange / startSalary) * 10000) / 100 : null;

  // Modal: what the change is measured against is the salary in force on the effective date.
  const formEmployee = employees.find((e) => e.id === formData.employeeId);
  const formRevisions = revisions.filter((r) => r.employee_id === formData.employeeId);
  const salaryBefore = formEmployee
    ? salaryOn(formRevisions, formData.effectiveDate, formEmployee.base_salary)
    : 0;
  const newSalaryNum = parseFloat(formData.newSalary);
  const hasNewSalary = formData.newSalary !== '' && !isNaN(newSalaryNum);
  const formChange = hasNewSalary ? Math.round((newSalaryNum - salaryBefore) * 100) / 100 : null;
  const formPercent =
    formChange !== null && salaryBefore ? Math.round((formChange / salaryBefore) * 10000) / 100 : null;
  const laterRevision = formRevisions
    .filter((r) => r.effective_date > formData.effectiveDate)
    .sort((a, b) => (a.effective_date < b.effective_date ? -1 : 1))[0];
  const isBackDated = formData.effectiveDate < todayKey();

  const openModal = () => {
    setFormData({
      employeeId: employee && !employee.is_constant_salary ? employee.id : 0,
      newSalary: '',
      effectiveDate: todayKey(),
      reason: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) {
      alert('Please select an employee');
      return;
    }
    if (!hasNewSalary || newSalaryNum < 0) {
      alert('Please enter the new salary');
      return;
    }
    if (formChange === 0 && !confirm('The new salary is the same as the current one. Record it anyway?')) {
      return;
    }

    setSaving(true);
    try {
      await apiClient.createSalaryRevision(
        formData.employeeId,
        newSalaryNum,
        formData.effectiveDate,
        formData.reason
      );
      setShowModal(false);
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to record salary change. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="salary-changes">
      <div className="page-header">
        <h1>Salary Changes</h1>
        <button className="btn-primary" onClick={openModal}>
          + Record Salary Change
        </button>
      </div>

      <div className="salary-changes-controls">
        <div className="form-group">
          <label>Employee</label>
          <select
            value={selectedEmployee || ''}
            onChange={(e) => setSelectedEmployee(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">All Employees</option>
            {employee?.is_constant_salary && (
              <option value={employee.id}>
                {employee.employee_id} - {employee.name} (constant salary)
              </option>
            )}
            {dailyWageEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_id} - {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Show</label>
          <select value={changeFilter} onChange={(e) => setChangeFilter(e.target.value as ChangeFilter)}>
            <option value="all">All entries</option>
            <option value="increase">Increases only</option>
            <option value="decrease">Decreases only</option>
          </select>
        </div>
      </div>

      {employee?.is_constant_salary ? (
        <div className="constant-salary-notice">
          <span className="pay-type-badge constant">Constant salary - fixed monthly</span>
          <p>
            <strong>{employee.name}</strong> gets a fixed salary of{' '}
            <strong>{money(employee.base_salary)}/month</strong>. A constant salary is not increased or
            decreased, so there is no salary change history for this employee.
          </p>
          <p className="muted">
            If the amount was entered wrongly, correct it with Edit on the Employees page.
          </p>
        </div>
      ) : (
        <>
        <div className="salary-changes-summary">
          {employee ? (
            <>
              <div className="summary-card">
                <h3>Current Salary</h3>
                <p className="summary-value">
                  {money(employee.base_salary)}
                  <span className="summary-unit">{unit(employee.is_constant_salary)}</span>
                </p>
                <span className={`pay-type-badge ${employee.is_constant_salary ? 'constant' : 'daily'}`}>
                  {employee.is_constant_salary ? 'Constant salary - fixed monthly' : 'Daily wage - paid per day worked'}
                </span>
              </div>
              <div className="summary-card">
                <h3>Starting Salary</h3>
                <p className="summary-value">
                  {money(startSalary)}
                  <span className="summary-unit">{unit(employee.is_constant_salary)}</span>
                </p>
                {opening && <p className="summary-sub">from {formatDate(opening.effective_date)}</p>}
              </div>
              <div className="summary-card">
                <h3>Total Change</h3>
                <p className={`summary-value ${netChange > 0 ? 'text-increase' : netChange < 0 ? 'text-decrease' : ''}`}>
                  {netChange > 0 ? '+' : netChange < 0 ? '−' : ''}
                  {money(Math.abs(netChange))}
                </p>
                {netPercent !== null && netChange !== 0 && (
                  <p className="summary-sub">
                    {netChange > 0 ? '+' : '−'}
                    {Math.abs(netPercent)}% since start
                  </p>
                )}
              </div>
              <div className="summary-card">
                <h3>Increases / Decreases</h3>
                <p className="summary-value">
                  <span className="text-increase">{increases}</span>
                  {' / '}
                  <span className="text-decrease">{decreases}</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="summary-card">
                <h3>Increases</h3>
                <p className="summary-value text-increase">{increases}</p>
              </div>
              <div className="summary-card">
                <h3>Decreases</h3>
                <p className="summary-value text-decrease">{decreases}</p>
              </div>
              <div className="summary-card">
                <h3>Employees With Changes</h3>
                <p className="summary-value">{new Set(changes.map((r) => r.employee_id)).size}</p>
              </div>
            </>
          )}
        </div>

        <p className="salary-changes-hint">
          Daily wage increases and decreases only - a constant (fixed monthly) salary is not changed, so
        those employees are not listed. Every change is kept here and never edited or removed. Each day is paid at the
          salary in force on that day, so a back-dated change re-prices earnings from its effective date.
          To fix a mistake, record a new change with the same effective date - the latest entry wins.
        </p>

        <div className="table-container">
          <table className="employees-table salary-changes-table">
            <thead>
              <tr>
                <th>Effective From</th>
                {!selectedEmployee && <th>Employee</th>}
                <th>Old Salary</th>
                <th>New Salary</th>
                <th>Change</th>
                <th>Reason</th>
                <th>Type</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={selectedEmployee ? 7 : 8} style={{ textAlign: 'center', padding: '40px' }}>
                    No salary changes found.
                  </td>
                </tr>
              ) : (
                visible.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{formatDate(r.effective_date)}</td>
                    {!selectedEmployee && (
                      <td>
                        <button className="link-button" onClick={() => setSelectedEmployee(r.employee_id)}>
                          {r.employee_code} - {r.employee_name}
                        </button>
                      </td>
                    )}
                    <td className="nowrap">{r.old_salary === null ? '-' : money(r.old_salary)}</td>
                    <td className="nowrap">
                      <strong>{money(r.new_salary)}</strong>
                      <span className="salary-unit">{unit(r.is_constant_salary)}</span>
                    </td>
                    <td className="nowrap">
                      <ChangeBadge change={r.change} percent={r.change_percent} />
                    </td>
                    <td>{r.reason || '-'}</td>
                    <td className="muted">{SOURCE_LABELS[r.source] || r.source}</td>
                    <td className="muted nowrap">{formatDateTime(r.changed_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Record Salary Change</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Employee *</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: parseInt(e.target.value) || 0 })}
                  required
                >
                  <option value={0}>Select Employee</option>
                  {dailyWageEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_id} - {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              {formEmployee && (
                <div className="current-salary-box">
                  Salary on {formatDate(formData.effectiveDate)}:{' '}
                  <strong>{money(salaryBefore)}</strong>
                  {unit(formEmployee.is_constant_salary)}
                  <span className="muted">
                    {' '}({formEmployee.is_constant_salary ? 'fixed monthly salary' : 'daily wage'})
                  </span>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>
                    New Salary (₹{formEmployee ? unit(formEmployee.is_constant_salary) : ''}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.newSalary}
                    onChange={(e) => setFormData({ ...formData, newSalary: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Effective From *</label>
                  <input
                    type="date"
                    value={formData.effectiveDate}
                    max={todayKey()}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Reason</label>
                <input
                  type="text"
                  value={formData.reason}
                  placeholder="e.g. Annual increment, promotion, reduced hours"
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>

              {formEmployee && formChange !== null && (
                <div className={`change-preview ${formChange > 0 ? 'increase' : formChange < 0 ? 'decrease' : ''}`}>
                  {formChange > 0 ? 'Increase' : formChange < 0 ? 'Decrease' : 'No change'}
                  {formChange !== 0 && (
                    <>
                      {' of '}
                      <strong>{money(Math.abs(formChange))}</strong>
                      {formPercent !== null && ` (${formChange > 0 ? '+' : '−'}${Math.abs(formPercent)}%)`}
                    </>
                  )}
                </div>
              )}

              {formEmployee && isBackDated && (
                <p className="form-note">
                  Back-dated: {formEmployee.is_constant_salary ? 'earnings' : 'attendance'} from{' '}
                  {formatDate(formData.effectiveDate)} onward will be recalculated at the new salary
                  {laterRevision ? ` until ${formatDate(laterRevision.effective_date)}, when a later change takes over` : ''}.
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
