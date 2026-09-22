import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { AppDatabase } from './database';
import { AuthService } from './services/authService';
import { EmployeeService } from './services/employeeService';
import { AttendanceService } from './services/attendanceService';
import { SalaryService } from './services/salaryService';

let mainWindow: BrowserWindow | null = null;
let db: AppDatabase;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  db = new AppDatabase();
  db.initialize();

  // Initialize services
  const authService = new AuthService(db);
  const employeeService = new EmployeeService(db);
  const attendanceService = new AttendanceService(db);
  const salaryService = new SalaryService(db);

  // Auth IPC handlers
  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    return authService.login(username, password);
  });

  ipcMain.handle('auth:check', async () => {
    return authService.checkAuth();
  });

  // Employee IPC handlers
  ipcMain.handle('employee:getAll', async () => {
    return employeeService.getAllEmployees();
  });

  ipcMain.handle('employee:getById', async (_, id: number) => {
    return employeeService.getEmployeeById(id);
  });

  ipcMain.handle('employee:create', async (_, employee: any) => {
    return employeeService.createEmployee(employee);
  });

  ipcMain.handle('employee:update', async (_, id: number, employee: any) => {
    return employeeService.updateEmployee(id, employee);
  });

  ipcMain.handle('employee:delete', async (_, id: number) => {
    return employeeService.deleteEmployee(id);
  });

  // Attendance IPC handlers
  ipcMain.handle('attendance:mark', async (_, employeeId: number, type: 'checkin' | 'checkout') => {
    return attendanceService.markAttendance(employeeId, type);
  });

  ipcMain.handle('attendance:getByEmployee', async (_, employeeId: number, startDate?: string, endDate?: string) => {
    return attendanceService.getAttendanceByEmployee(employeeId, startDate, endDate);
  });

  ipcMain.handle('attendance:getAll', async (_, startDate?: string, endDate?: string) => {
    return attendanceService.getAllAttendance(startDate, endDate);
  });

  // Salary IPC handlers
  ipcMain.handle('salary:calculate', async (_, employeeId: number, month: number, year: number) => {
    return salaryService.calculateSalary(employeeId, month, year);
  });

  ipcMain.handle('salary:getHistory', async (_, employeeId?: number) => {
    return salaryService.getSalaryHistory(employeeId);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
  }
});

