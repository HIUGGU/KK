import { useState, useEffect } from 'react';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    totalSalaryThisMonth: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const employees = await window.electronAPI.getAllEmployees();
      const today = new Date().toISOString().split('T')[0];
      const attendance = await window.electronAPI.getAllAttendance(today, today);

      const present = attendance.filter((a) => a.status === 'present').length;
      const absent = employees.length - present;

      // Calculate total salary for current month
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      let totalSalary = 0;

      for (const emp of employees) {
        try {
          const salary = await window.electronAPI.calculateSalary(emp.id, currentMonth, currentYear);
          totalSalary += salary.net_salary;
        } catch (err) {
          // Employee might not have attendance for this month
        }
      }

      setStats({
        totalEmployees: employees.length,
        presentToday: present,
        absentToday: absent,
        totalSalaryThisMonth: totalSalary,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3498db' }}>
            👥
          </div>
          <div className="stat-content">
            <h3>Total Employees</h3>
            <p className="stat-value">{stats.totalEmployees}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#2ecc71' }}>
            ✓
          </div>
          <div className="stat-content">
            <h3>Present Today</h3>
            <p className="stat-value">{stats.presentToday}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e74c3c' }}>
            ✗
          </div>
          <div className="stat-content">
            <h3>Absent Today</h3>
            <p className="stat-value">{stats.absentToday}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f39c12' }}>
            💰
          </div>
          <div className="stat-content">
            <h3>Total Salary (This Month)</h3>
            <p className="stat-value">${stats.totalSalaryThisMonth.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

