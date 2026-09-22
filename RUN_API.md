# How to Start the API Server

## The Problem

You're seeing:
- ❌ "Unable to connect to API server"
- ❌ Failed requests in Network tab (preflight and login)

**This means the API server is NOT running!**

## Solution: Start the API Server

### Method 1: Using npm script (Recommended)

```bash
npm run dev:api
```

### Method 2: Using the startup script

```bash
./start-api.sh
```

### Method 3: Manual start

```bash
npx ts-node API/src/server.ts
```

## What You Should See

When the API starts successfully, you'll see:

```
API server running on http://localhost:3001
Health check: http://localhost:3001/api/health
Connected to PostgreSQL database
```

## Verify It's Working

1. **Test the health endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should return: `{"status":"ok","database":"connected"}`

2. **Test login endpoint:**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```
   Should return: `{"success":true,"token":"..."}`

3. **In browser:**
   - Refresh the page (F5)
   - Try to login again
   - Check Network tab - requests should now succeed!

## If API Won't Start

### Error: "Cannot find module"
```bash
npm install
```

### Error: "Database connection failed"
1. Check PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```

2. Create database if needed:
   ```bash
   psql -U local_user -h localhost
   CREATE DATABASE employee_management;
   \q
   ```

3. Run schema:
   ```bash
   psql -U local_user -h localhost -d employee_management -f schema.sql
   ```

### Error: "Port 3001 already in use"
```bash
# Find what's using the port
lsof -i :3001

# Kill it or change port in .env
PORT=3002 npx ts-node API/src/server.ts
```

## Running Both API and Web

**Terminal 1:**
```bash
npm run dev:api
```

**Terminal 2:**
```bash
npm run dev:web
```

**Or both together:**
```bash
npm run dev
```

## Important Notes

- ✅ **Keep the API server running** - Don't close the terminal!
- ✅ The API must be running **before** you try to login
- ✅ Check the API terminal for error messages
- ✅ Database must be set up before API can start

## Quick Checklist

- [ ] PostgreSQL is running
- [ ] Database `employee_management` exists
- [ ] Schema has been run (schema.sql)
- [ ] `.env` file exists with correct credentials
- [ ] Dependencies installed (`npm install`)
- [ ] API server is running (`npm run dev:api`)
- [ ] Can access http://localhost:3001/api/health








