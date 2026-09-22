# Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database

**Option A: Using the setup script**
```bash
# Make sure PostgreSQL is running
./scripts/setup-db.sh
```

**Option B: Manual setup**
```bash
# Create database
psql -U local_user -h localhost
CREATE DATABASE employee_management;
\q

# Run schema
psql -U local_user -h localhost -d employee_management -f schema.sql
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` with your database credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=local_user
DB_PASSWORD=123456
DB_NAME=employee_management
DATABASE_URL=postgresql://local_user:123456@localhost:5432/employee_management
JWT_SECRET=your-secret-key-change-in-production
```

### 4. Run the Application

**Development Mode (Both API and Web):**
```bash
npm run dev
```

This starts:
- API server on `http://localhost:3001`
- Web frontend on `http://localhost:5173`

**Or run separately:**

Terminal 1 - API Server:
```bash
npm run dev:api
```

Terminal 2 - Web Frontend:
```bash
npm run dev:web
```

### 5. Access the Application

1. Open browser: `http://localhost:5173`
2. Login with:
   - Username: `admin`
   - Password: `admin123`

## Troubleshooting

### API Not Connecting

1. **Check if API server is running:**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should return: `{"status":"ok","database":"connected"}`

2. **Check database connection:**
   - Ensure PostgreSQL is running
   - Verify credentials in `.env` file
   - Test connection: `psql -U local_user -h localhost -d employee_management`

3. **Check browser console:**
   - Open browser DevTools (F12)
   - Check Network tab for API calls
   - Look for CORS errors or connection failures

### Database Issues

1. **Database doesn't exist:**
   ```bash
   psql -U local_user -h localhost
   CREATE DATABASE employee_management;
   ```

2. **Tables missing:**
   ```bash
   psql -U local_user -h localhost -d employee_management -f schema.sql
   ```

3. **Connection refused:**
   - Check PostgreSQL is running: `sudo systemctl status postgresql`
   - Verify connection string in `.env`

### Port Already in Use

If port 3001 or 5173 is already in use:

1. **Change API port:**
   Edit `.env`:
   ```
   PORT=3002
   ```

2. **Change Web port:**
   Edit `vite.web.config.ts`:
   ```typescript
   server: {
     port: 5174,
     ...
   }
   ```

## Project Structure

```
├── API/                 # Backend API
│   └── src/
│       ├── config/     # Database config
│       ├── routes/      # API routes
│       ├── services/    # Business logic
│       └── server.ts    # Express server
├── WEB/                 # Frontend
│   └── src/
│       ├── components/ # React components
│       ├── api/         # API client
│       └── App.tsx
├── schema.sql           # Database schema
└── .env                 # Environment variables
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - Login
- `POST /api/auth/verify` - Verify token
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/attendance` - Get attendance
- `POST /api/salary/calculate` - Calculate salary
- `GET /api/salary/history` - Get salary history
