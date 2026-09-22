# How to Start the Application

## The Problem

If you see "Invalid username or password" but **NO network requests** in the browser Network tab, it means:

❌ **The API server is NOT running**

## Solution: Start Both Servers

### Option 1: Start Both Together (Recommended)

```bash
npm run dev
```

This starts:

- ✅ API Server on http://localhost:3001
- ✅ Web Frontend on http://localhost:5173

### Option 2: Start Separately

**Terminal 1 - Start API Server:**

```bash
npm run dev:api
```

Wait until you see:

```
API server running on http://localhost:3001
Connected to PostgreSQL database
```

**Terminal 2 - Start Web Frontend:**

```bash
npm run dev:web
```

Wait until you see:

```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

## Verify It's Working

1. **Check API is running:**

   ```bash
   curl http://localhost:3001/api/health
   ```

   Should return: `{"status":"ok","database":"connected"}`

2. **Open browser:**

   - Go to: http://localhost:5173
   - Open DevTools (F12)
   - Go to Network tab
   - Try to login
   - You should see a request to `/api/auth/login`

3. **Login with:**
   - Username: `admin`
   - Password: `admin123`

## If API Still Doesn't Start

1. **Check database exists:**

   ```bash
   psql -U local_user -h localhost -c "\l" | grep employee_management
   ```

2. **If database doesn't exist:**

   ```bash
   psql -U local_user -h localhost
   CREATE DATABASE employee_management;
   \q
   psql -U local_user -h localhost -d employee_management -f schema.sql
   ```

3. **Check .env file:**

   ```bash
   cat .env
   ```

   Should show database credentials.

4. **Install dependencies:**
   ```bash
   npm install
   ```

## Quick Test

Run this to test the API:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Should return: `{"success":true,"token":"..."}`







