# Employee Management System

A cross-platform desktop application for managing employee details, attendance tracking, and salary calculation. Built with Express API backend and React frontend.

## Features

- **Employee Management**: Add, edit, and delete employee records
- **Attendance Tracking**: Mark check-in/check-out times and track daily attendance
- **Salary Calculation**: Automatically calculate salaries based on attendance and base salary
- **Admin Authentication**: Secure JWT-based authentication
- **PostgreSQL Database**: Robust database with proper schema

## Project Structure

```
├── API/              # Backend API (Express + TypeScript)
│   ├── src/
│   │   ├── config/   # Database configuration
│   │   ├── routes/   # API routes
│   │   ├── services/ # Business logic
│   │   └── server.ts # Express server
│   └── tsconfig.json
├── WEB/              # Frontend (React + TypeScript)
│   └── src/
│       ├── components/
│       ├── api/       # API client
│       └── App.tsx
├── schema.sql        # PostgreSQL database schema
└── .env.example      # Environment variables template
```

## Prerequisites

1. **PostgreSQL** installed and running
2. **Node.js** (v18 or higher)
3. **npm** (comes with Node.js)

## Setup Instructions

### 1. Database Setup

1. Create a PostgreSQL database:
```bash
psql -U local_user -h localhost
CREATE DATABASE employee_management;
\q
```

2. Run the schema file:
```bash
psql -U local_user -h localhost -d employee_management -f schema.sql
```

### 2. Environment Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Update `.env` with your database credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=local_user
DB_PASSWORD=123456
DB_NAME=employee_management
DATABASE_URL=postgresql://local_user:123456@localhost:5432/employee_management
JWT_SECRET=your-secret-key-change-in-production
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

**Development Mode:**
```bash
npm run dev
```

This will start:
- API server on `http://localhost:3001`
- Web frontend on `http://localhost:5173`

**Or run separately:**
```bash
# Terminal 1 - API Server
npm run dev:api

# Terminal 2 - Web Frontend
npm run dev:web
```

## Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change the default password in production!

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/verify` - Verify token

### Employees
- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get employee by ID
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Attendance
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/attendance` - Get all attendance
- `GET /api/attendance/employee/:employeeId` - Get attendance by employee

### Salary
- `POST /api/salary/calculate` - Calculate salary
- `GET /api/salary/history` - Get salary history

## Building for Production

```bash
# Build API
npm run build:api

# Build Web
npm run build:web
```

## Technologies Used

- **Backend**: Express.js, TypeScript, PostgreSQL (pg)
- **Frontend**: React, TypeScript, Vite
- **Authentication**: JWT (jsonwebtoken)
- **Database**: PostgreSQL

## License

MIT
