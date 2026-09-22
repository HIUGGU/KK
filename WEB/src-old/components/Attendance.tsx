import { useState, useEffect } from 'react';
import './Attendance.css';

interface Employee {
  id?: number;
  employee_id: string;
  name: string;
}

interface Attendance {
  id?: number;
  employee_id: number;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  hours_worked: number;
  status: string;
}

export default function Attendance() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadEmployees();
    loadAttendance();
  }, [selectedEmployee, dateRange]);

  const loadEmployees = async () => {
    try {
      const data = await window.electronAPI.getAllEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadAttendance = async () => {
    try {
      let data;
      if (selectedEmployee) {
        data = await window.electronAPI.getAttendanceByEmployee(
          selectedEmployee,
          dateRange.startDate,
          dateRange.endDate
        );
      } else {
        data = await window.electronAPI.getAllAttendance(
          dateRange.startDate,
          dateRange.endDate
        );
      }
      setAttendance(data);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    }
  };

  const handleMarkAttendance = async (employeeId: number, type: 'checkin' | 'checkout') => {
    try {
      await window.electronAPI.markAttendance(employeeId, type);
      loadAttendance();
      alert(`${type === 'checkin' ? 'Check-in' : 'Check-out'} recorded successfully!`);
    } catch (error) {
      console.error('Failed to mark attendance:', error);
      alert('Failed to mark attendance. Please try again.');
    }
  };

  const getEmployeeName = (employeeId: number) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.employee_id} - ${emp.name}` : `Employee #${employeeId}`;
  };

  return (
    <div className="attendance">
      <div className="page-header">
        <h1>Attendance</h1>
      </div>

      <div className="attendance-controls">
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

      <div className="quick-actions">
        <h3>Quick Mark Attendance (Today)</h3>
        <div className="employee-buttons">
          {employees.map((emp) => (
            <div key={emp.id} className="employee-action-group">
              <span>{emp.name}</span>
              <div>
                <button
                  className="btn-checkin"
                  onClick={() => handleMarkAttendance(emp.id!, 'checkin')}
                >
                  Check In
                </button>
                <button
                  className="btn-checkout"
                  onClick={() => handleMarkAttendance(emp.id!, 'checkout')}
                >
                  Check Out
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="table-container">
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Hours Worked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                  No attendance records found.
                </td>
              </tr>
            ) : (
              attendance.map((record) => (
                <tr key={record.id}>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>{getEmployeeName(record.employee_id)}</td>
                  <td>
                    {record.check_in_time
                      ? new Date(record.check_in_time).toLocaleTimeString()
                      : '-'}
                  </td>
                  <td>
                    {record.check_out_time
                      ? new Date(record.check_out_time).toLocaleTimeString()
                      : '-'}
                  </td>
                  <td>{record.hours_worked.toFixed(2)} hrs</td>
                  <td>
                    <span className={`status-badge ${record.status}`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

