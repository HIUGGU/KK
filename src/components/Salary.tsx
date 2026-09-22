import { useState, useEffect } from 'react';
import './Salary.css';

interface Employee {
  id?: number;
  employee_id: string;
  name: string;
  base_salary: number;
}

interface SalaryRecord {
  id?: number;
  employee_id: number;
  month: number;
  year: number;
  base_salary: number;
  days_present: number;
  days_absent: number;
  total_hours: number;
  gross_salary: number;
  deductions: number;
  net_salary: number;
}

export default function Salary() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryRecord[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [calculationMonth, setCalculationMonth] = useState(new Date().getMonth() + 1);
  const [calculationYear, setCalculationYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
    loadSalaryHistory();
  }, [selectedEmployee]);

  const loadEmployees = async () => {
    try {
      const data = await window.electronAPI.getAllEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadSalaryHistory = async () => {
    try {
      const data = await window.electronAPI.getSalaryHistory(selectedEmployee || undefined);
      setSalaryHistory(data);
    } catch (error) {
      console.error('Failed to load salary history:', error);
    }
  };

  const handleCalculateSalary = async (employeeId: number) => {
    setLoading(true);
    try {
      await window.electronAPI.calculateSalary(employeeId, calculationMonth, calculationYear);
      alert('Salary calculated successfully!');
      loadSalaryHistory();
    } catch (error) {
      console.error('Failed to calculate salary:', error);
      alert('Failed to calculate salary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateAll = async () => {
    if (!confirm('Calculate salary for all employees this month?')) return;
    
    setLoading(true);
    try {
      for (const emp of employees) {
        try {
          await window.electronAPI.calculateSalary(emp.id!, calculationMonth, calculationYear);
        } catch (error) {
          console.error(`Failed to calculate for ${emp.name}:`, error);
        }
      }
      alert('Salary calculated for all employees!');
      loadSalaryHistory();
    } catch (error) {
      console.error('Failed to calculate salaries:', error);
      alert('Some salaries failed to calculate. Please check the console.');
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (employeeId: number) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.employee_id} - ${emp.name}` : `Employee #${employeeId}`;
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const totalNetSalary = salaryHistory.reduce((sum, record) => sum + record.net_salary, 0);

  return (
    <div className="salary">
      <div className="page-header">
        <h1>Salary Management</h1>
      </div>

      <div className="salary-controls">
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
          <label>Calculate for Month</label>
          <select
            value={calculationMonth}
            onChange={(e) => setCalculationMonth(parseInt(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>
                {getMonthName(month)}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label>Year</label>
          <input
            type="number"
            value={calculationYear}
            onChange={(e) => setCalculationYear(parseInt(e.target.value))}
            min="2020"
            max="2100"
          />
        </div>
        <div className="control-group">
          <label>Actions</label>
          <div className="action-buttons">
            {selectedEmployee ? (
              <button
                className="btn-calculate"
                onClick={() => handleCalculateSalary(selectedEmployee)}
                disabled={loading}
              >
                Calculate Selected
              </button>
            ) : (
              <button
                className="btn-calculate-all"
                onClick={handleCalculateAll}
                disabled={loading}
              >
                Calculate All
              </button>
            )}
          </div>
        </div>
      </div>

      {salaryHistory.length > 0 && (
        <div className="salary-summary">
          <div className="summary-card">
            <h3>Total Net Salary</h3>
            <p className="summary-value">${totalNetSalary.toFixed(2)}</p>
          </div>
          <div className="summary-card">
            <h3>Records Count</h3>
            <p className="summary-value">{salaryHistory.length}</p>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="salary-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Month/Year</th>
              <th>Base Salary</th>
              <th>Days Present</th>
              <th>Days Absent</th>
              <th>Total Hours</th>
              <th>Gross Salary</th>
              <th>Deductions</th>
              <th>Net Salary</th>
            </tr>
          </thead>
          <tbody>
            {salaryHistory.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                  No salary records found. Calculate salaries to see records.
                </td>
              </tr>
            ) : (
              salaryHistory.map((record) => (
                <tr key={record.id}>
                  <td>{getEmployeeName(record.employee_id)}</td>
                  <td>{getMonthName(record.month)} {record.year}</td>
                  <td>${record.base_salary.toFixed(2)}</td>
                  <td>{record.days_present}</td>
                  <td>{record.days_absent}</td>
                  <td>{record.total_hours.toFixed(2)}</td>
                  <td>${record.gross_salary.toFixed(2)}</td>
                  <td>${record.deductions.toFixed(2)}</td>
                  <td className="net-salary">${record.net_salary.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}








