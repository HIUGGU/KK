# Quick Start Guide

## Step 1: Setup Database

```bash
# Create database
psql -U local_user -h localhost
CREATE DATABASE employee_management;
\q

# Run schema
psql -U local_user -h localhost -d employee_management -f schema.sql
```

## Step 2: Start the Application

```bash
# Install dependencies (if not done)
npm install

# Start both API and Web (recommended)
npm run dev
```

This will start:
- ✅ API Server: http://localhost:3001
- ✅ Web Frontend: http://localhost:5173

## Step 3: Login

1. Open browser: http://localhost:5173
2. Login with:
   - Username: `admin`
   - Password: `admin123`

## Troubleshooting API Connection

If you see "API not connecting" errors:

1. **Check API is running:**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should return: `{"status":"ok","database":"connected"}`

2. **Start API separately:**
   ```bash
   npm run dev:api
   ```

3. **Check browser console (F12)** for detailed error messages

4. **Verify database connection:**
   ```bash
   psql -U local_user -h localhost -d employee_management -c "SELECT 1;"
   ```

## Project Structure

- `API/` - Backend Express server
- `WEB/` - Frontend React app
- `schema.sql` - Database schema
- `.env` - Environment variables (already created)

## Default Credentials

- Username: `admin`
- Password: `admin123`








