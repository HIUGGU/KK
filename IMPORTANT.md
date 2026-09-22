# ⚠️ IMPORTANT: API Server Must Be Running

## Current Issue

You're seeing "Invalid username or password" but **NO network requests** in the browser Network tab.

**This means the API server is NOT running!**

## Quick Fix

### Step 1: Start the API Server

Open a terminal and run:

```bash
npm run dev:api
```

You should see:
```
API server running on http://localhost:3001
Connected to PostgreSQL database
```

### Step 2: Keep It Running

**Keep that terminal open!** The API server must stay running.

### Step 3: Start the Web Frontend (in another terminal)

```bash
npm run dev:web
```

### Step 4: Or Start Both Together

```bash
npm run dev
```

This starts both API and Web in one command.

## Verify It's Working

1. **Check API is running:**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should return: `{"status":"ok","database":"connected"}`

2. **Open browser:**
   - Go to: http://localhost:5173
   - Press F12 (DevTools)
   - Go to Network tab
   - Try to login
   - **You should now see a request to `/api/auth/login`**

3. **Login:**
   - Username: `admin`
   - Password: `admin123`

## Why This Happens

- The web frontend (port 5173) can run without the API
- But login requires the API server (port 3001) to be running
- If API isn't running, you'll see the login page but no network requests

## Database Setup (If Needed)

If you get database errors:

```bash
# Create database
psql -U local_user -h localhost
CREATE DATABASE employee_management;
\q

# Run schema
psql -U local_user -h localhost -d employee_management -f schema.sql
```

## Summary

**The API server MUST be running for the application to work!**

Run: `npm run dev:api` (or `npm run dev` for both)








