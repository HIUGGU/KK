import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
  checkAuth: () => ipcRenderer.invoke('auth:check'),

  // Employees
  getAllEmployees: () => ipcRenderer.invoke('employee:getAll'),
  getEmployeeById: (id: number) => ipcRenderer.invoke('employee:getById', id),
  createEmployee: (employee: any) => ipcRenderer.invoke('employee:create', employee),
  updateEmployee: (id: number, employee: any) => ipcRenderer.invoke('employee:update', id, employee),
  deleteEmployee: (id: number) => ipcRenderer.invoke('employee:delete', id),

  // Attendance
  markAttendance: (employeeId: number, type: 'checkin' | 'checkout') => 
    ipcRenderer.invoke('attendance:mark', employeeId, type),
  getAttendanceByEmployee: (employeeId: number, startDate?: string, endDate?: string) =>
    ipcRenderer.invoke('attendance:getByEmployee', employeeId, startDate, endDate),
  getAllAttendance: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke('attendance:getAll', startDate, endDate),

  // Salary
  calculateSalary: (employeeId: number, month: number, year: number) =>
    ipcRenderer.invoke('salary:calculate', employeeId, month, year),
  getSalaryHistory: (employeeId?: number) => ipcRenderer.invoke('salary:getHistory', employeeId),
});

declare global {
  interface Window {
    electronAPI: {
      login: (username: string, password: string) => Promise<boolean>;
      checkAuth: () => Promise<boolean>;
      getAllEmployees: () => Promise<any[]>;
      getEmployeeById: (id: number) => Promise<any>;
      createEmployee: (employee: any) => Promise<any>;
      updateEmployee: (id: number, employee: any) => Promise<any>;
      deleteEmployee: (id: number) => Promise<boolean>;
      markAttendance: (employeeId: number, type: 'checkin' | 'checkout') => Promise<any>;
      getAttendanceByEmployee: (employeeId: number, startDate?: string, endDate?: string) => Promise<any[]>;
      getAllAttendance: (startDate?: string, endDate?: string) => Promise<any[]>;
      calculateSalary: (employeeId: number, month: number, year: number) => Promise<any>;
      getSalaryHistory: (employeeId?: number) => Promise<any[]>;
    };
  }
}








