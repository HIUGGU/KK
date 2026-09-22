import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    totalSalaryThisMonth: 0,
    outstandingBalance: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const employees = await apiClient.getAllEmployees();
      const today = new Date().toISOString().split('T')[0];
      const attendance = await apiClient.getAllAttendance(today, today);

      const present = attendance.filter((a: any) => a.status === 'present').length;
      const absent = employees.length - present;

      // Calculate total salary for current month
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      let totalSalary = 0;

      for (const emp of employees) {
        try {
          const salary = await apiClient.calculateSalary((emp as any).id, currentMonth, currentYear);
          totalSalary += parseFloat(salary.net_salary);
        } catch (err) {
          // Employee might not have attendance for this month
        }
      }

      // Get outstanding balance from clients
      let outstandingBalance = 0;
      try {
        const balanceData = await apiClient.getOutstandingBalance();
        outstandingBalance = balanceData.outstanding_balance || 0;
      } catch (err) {
        console.error('Failed to load outstanding balance:', err);
      }

      setStats({
        totalEmployees: employees.length,
        presentToday: present,
        absentToday: absent,
        totalSalaryThisMonth: totalSalary,
        outstandingBalance: outstandingBalance,
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
            <p className="stat-value">₹{stats.totalSalaryThisMonth.toFixed(2)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: stats.outstandingBalance >= 0 ? '#e74c3c' : '#2ecc71' }}>
            {stats.outstandingBalance >= 0 ? '📊' : '💵'}
          </div>
          <div className="stat-content">
            <h3>Outstanding Balance</h3>
            <p className="stat-value" style={{ color: stats.outstandingBalance >= 0 ? '#e74c3c' : '#2ecc71' }}>
              {stats.outstandingBalance >= 0 ? '+' : ''}₹{Math.abs(stats.outstandingBalance).toFixed(2)}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px' }}>
              {stats.outstandingBalance === 0 
                ? 'All payments received' 
                : stats.outstandingBalance > 0 
                ? 'Amount to receive from clients' 
                : 'Advance received (excess payment)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
