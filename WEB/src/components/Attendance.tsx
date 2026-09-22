import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { formatDate } from '../utils/formatDate';
import { notify } from '../utils/notify';
import './Attendance.css';

interface Employee {
  id?: number;
  employee_id: string;
  name: string;
  base_salary: number;
}

interface Attendance {
  id?: number;
  employee_id: number;
  date: string;
  attendance_type: 'full_day' | 'half_day' | 'absent';
  daily_salary: number;
  notes?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');

// Normalises whatever the API returns (ISO string or Date) to a local YYYY-MM-DD key,
// matching how formatDate renders the same value
const toDateKey = (value: string | Date): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Attendance() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  // Local-day keys: toISOString() is UTC, which is still yesterday before 05:30 IST
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      startDate: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: toDateKey(now),
    };
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthAttendance, setMonthAttendance] = useState<Attendance[]>([]);

  useEffect(() => {
    loadEmployees();
    loadAttendance();
  }, [selectedEmployee, dateRange]);

  useEffect(() => {
    loadMonthAttendance();
  }, [calendarMonth]);

  const loadEmployees = async () => {
    try {
      const data = await apiClient.getAllEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadAttendance = async () => {
    try {
      let data;
      if (selectedEmployee) {
        data = await apiClient.getAttendanceByEmployee(
          selectedEmployee,
          dateRange.startDate,
          dateRange.endDate
        );
      } else {
        data = await apiClient.getAllAttendance(
          dateRange.startDate,
          dateRange.endDate
        );
      }
      setAttendance(data);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    }
  };

  const loadMonthAttendance = async () => {
    try {
      const year = calendarMonth.getFullYear();
      const month = calendarMonth.getMonth();
      const start = toDateKey(new Date(year, month, 1));
      const end = toDateKey(new Date(year, month + 1, 0));
      const data = await apiClient.getAllAttendance(start, end);
      setMonthAttendance(data);
    } catch (error) {
      console.error('Failed to load month attendance:', error);
    }
  };

  const handleMarkAttendance = async (
    employeeId: number, 
    date: string, 
    attendanceType: 'full_day' | 'half_day' | 'absent'
  ) => {
    try {
      const result = await apiClient.markAttendance(employeeId, date, attendanceType);
      loadAttendance();
      loadMonthAttendance();
      const typeLabel = attendanceType === 'full_day' ? 'Full Day' : 
                        attendanceType === 'half_day' ? 'Half Day' : 'Absent';
      const employee = employees.find((e) => e.id === employeeId);
      notify.success(
        `${typeLabel} marked for ${employee?.name ?? 'employee'} on ${formatDate(date)} · Daily Salary: ₹${result.daily_salary.toFixed(2)}`
      );
    } catch (error: any) {
      console.error('Failed to mark attendance:', error);
      notify.error(error.message || 'Failed to mark attendance. Please try again.');
    }
  };

  const getEmployeeName = (employeeId: number) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.employee_id} - ${emp.name}` : `Employee #${employeeId}`;
  };

  const getAttendanceTypeLabel = (type: string) => {
    switch (type) {
      case 'full_day': return 'Full Day';
      case 'half_day': return 'Half Day';
      case 'absent': return 'Absent';
      default: return type;
    }
  };

  const shiftMonth = (delta: number) => {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1)
    );
  };

  const attendanceByDay = monthAttendance.reduce<Record<string, Attendance[]>>((acc, record) => {
    const key = toDateKey(record.date);
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  const calendarCells: (string | null)[] = (() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const cells: (string | null)[] = [];
    const leading = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(`${year}-${pad(month + 1)}-${pad(day)}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  })();

  // Heat level 0-4, scaled against how many employees could have worked that day
  const getHeatLevel = (units: number) => {
    if (units <= 0) return 0;
    const ratio = employees.length > 0 ? units / employees.length : 1;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const todayKey = toDateKey(new Date());

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
        <h3>Mark Attendance</h3>
        <div className="mark-attendance-section">
          <div className="control-group">
            <label>Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="employee-attendance-grid">
            {employees.map((emp) => {
              // base_salary is now stored as daily salary
              const dailySalary = parseFloat(emp.base_salary.toString());
              const halfDaySalary = dailySalary / 2;
              
              // Check if attendance already marked for this date
              const existingAttendance = attendance.find(
                (a) => a.employee_id === emp.id && toDateKey(a.date) === selectedDate
              );

              return (
                <div key={emp.id} className="employee-attendance-card">
                  <div className="employee-info">
                    <span style={{ fontWeight: '600' }}>{emp.name}</span>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Daily Rate: ₹{dailySalary.toFixed(2)} | Half Day: ₹{halfDaySalary.toFixed(2)}
                    </div>
                    {existingAttendance && (
                      <div style={{ fontSize: '11px', color: '#2ecc71', marginTop: '4px', fontWeight: '600' }}>
                        Marked: {getAttendanceTypeLabel(existingAttendance.attendance_type)} - ₹{existingAttendance.daily_salary.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="attendance-buttons">
                    <button
                      className={`btn-full-day ${existingAttendance?.attendance_type === 'full_day' ? 'active' : ''}`}
                      onClick={() => handleMarkAttendance(emp.id!, selectedDate, 'full_day')}
                    >
                      Full Day
                    </button>
                    <button
                      className={`btn-half-day ${existingAttendance?.attendance_type === 'half_day' ? 'active' : ''}`}
                      onClick={() => handleMarkAttendance(emp.id!, selectedDate, 'half_day')}
                    >
                      Half Day
                    </button>
                    <button
                      className={`btn-absent ${existingAttendance?.attendance_type === 'absent' ? 'active' : ''}`}
                      onClick={() => handleMarkAttendance(emp.id!, selectedDate, 'absent')}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="attendance-calendar">
        <div className="calendar-header">
          <h3>Work Map</h3>
          <div className="calendar-nav">
            <button type="button" onClick={() => shiftMonth(-1)}>&#8249;</button>
            <span className="calendar-month-label">
              {calendarMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => shiftMonth(1)}>&#8250;</button>
          </div>
        </div>

        <div className="calendar-grid calendar-weekdays">
          {WEEKDAYS.map((day) => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarCells.map((dateKey, index) => {
            if (!dateKey) {
              return <div key={`empty-${index}`} className="calendar-day empty" />;
            }

            const records = attendanceByDay[dateKey] || [];
            const worked = records.filter((r) => r.attendance_type !== 'absent');
            const absent = records.filter((r) => r.attendance_type === 'absent');
            const units = worked.reduce(
              (sum, r) => sum + (r.attendance_type === 'full_day' ? 1 : 0.5),
              0
            );
            const total = worked.reduce(
              (sum, r) => sum + parseFloat(r.daily_salary.toString()),
              0
            );
            const level = getHeatLevel(units);
            const column = index % 7;
            const tooltipAlign = column <= 1 ? 'left' : column >= 5 ? 'right' : 'center';

            return (
              <div
                key={dateKey}
                className={`calendar-day level-${level} ${dateKey === selectedDate ? 'selected' : ''} ${dateKey === todayKey ? 'today' : ''}`}
                onClick={() => setSelectedDate(dateKey)}
              >
                <span className="calendar-day-number">{parseInt(dateKey.slice(8, 10), 10)}</span>
                {worked.length > 0 && (
                  <span className="calendar-day-count">{worked.length}</span>
                )}
                <div className={`calendar-tooltip align-${tooltipAlign}`}>
                  <div className="calendar-tooltip-title">{formatDate(dateKey)}</div>
                  {worked.length === 0 && absent.length === 0 ? (
                    <div className="calendar-tooltip-empty">No attendance marked</div>
                  ) : (
                    <>
                      {worked.map((record) => (
                        <div key={record.id} className="calendar-tooltip-row">
                          <span className="calendar-tooltip-name">
                            {getEmployeeName(record.employee_id)}
                          </span>
                          <span className={`attendance-type-badge ${record.attendance_type}`}>
                            {getAttendanceTypeLabel(record.attendance_type)}
                          </span>
                          <span className="calendar-tooltip-amount">
                            &#8377;{parseFloat(record.daily_salary.toString()).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {absent.map((record) => (
                        <div key={record.id} className="calendar-tooltip-row muted">
                          <span className="calendar-tooltip-name">
                            {getEmployeeName(record.employee_id)}
                          </span>
                          <span className="attendance-type-badge absent">Absent</span>
                        </div>
                      ))}
                      {worked.length > 0 && (
                        <div className="calendar-tooltip-footer">
                          {worked.length} worked &middot; {units} day{units === 1 ? '' : 's'} &middot; &#8377;{total.toFixed(2)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span>Less</span>
          <span className="legend-box level-0" />
          <span className="legend-box level-1" />
          <span className="legend-box level-2" />
          <span className="legend-box level-3" />
          <span className="legend-box level-4" />
          <span>More</span>
        </div>
      </div>

      <div className="table-container">
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Type</th>
              <th>Daily Salary</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>
                  No attendance records found.
                </td>
              </tr>
            ) : (
              attendance.map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.date)}</td>
                  <td>{getEmployeeName(record.employee_id)}</td>
                  <td>
                    <span className={`attendance-type-badge ${record.attendance_type}`}>
                      {getAttendanceTypeLabel(record.attendance_type)}
                    </span>
                  </td>
                  <td>₹{parseFloat(record.daily_salary.toString()).toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${record.attendance_type === 'absent' ? 'absent' : 'present'}`}>
                      {record.attendance_type === 'absent' ? 'Absent' : 'Present'}
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
