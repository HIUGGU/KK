-- Employee Management System Database Schema
-- PostgreSQL Database Schema

-- Admin table
CREATE TABLE IF NOT EXISTS admin (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    department VARCHAR(255),
    position VARCHAR(255),
    base_salary DECIMAL(10, 2) NOT NULL DEFAULT 0,
    hire_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    date DATE NOT NULL,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    hours_worked DECIMAL(5, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(employee_id, date)
);

-- Salary records table
CREATE TABLE IF NOT EXISTS salary_records (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    base_salary DECIMAL(10, 2) NOT NULL,
    days_present INTEGER DEFAULT 0,
    days_absent INTEGER DEFAULT 0,
    total_hours DECIMAL(10, 2) DEFAULT 0,
    gross_salary DECIMAL(10, 2) NOT NULL,
    deductions DECIMAL(10, 2) DEFAULT 0,
    net_salary DECIMAL(10, 2) NOT NULL,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(employee_id, month, year)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_salary_records_employee_id ON salary_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_month_year ON salary_records(month, year);

-- Insert default admin user (password: admin123)
INSERT INTO admin (username, password) 
VALUES ('admin', 'admin123')
ON CONFLICT (username) DO NOTHING;








