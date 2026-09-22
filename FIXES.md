# API Connection Fixes Applied

## Issues Fixed

1. ✅ **CORS Configuration** - Added proper CORS settings to allow frontend connections
2. ✅ **Error Handling** - Improved API client error handling with better messages
3. ✅ **Environment Variables** - Created `.env` file with database configuration
4. ✅ **API Client** - Enhanced error messages to show connection issues
5. ✅ **Server Configuration** - Updated CORS and middleware setup

## How to Start

### Option 1: Start Both Together (Recommended)
```bash
npm run dev
```

### Option 2: Start Separately

**Terminal 1 - API Server:**
```bash
npm run dev:api
```

**Terminal 2 - Web Frontend:**
```bash
npm run dev:web
```

## Verify API is Working

1. **Check API Health:**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should return: `{"status":"ok","database":"connected"}`

2. **Check Browser Console:**
   - Open http://localhost:5173
   - Press F12 to open DevTools
   - Check Console tab for any errors
   - Check Network tab to see API calls

## Common Issues

### "Unable to connect to API server"
- **Solution:** Make sure API server is running on port 3001
- Run: `npm run dev:api` in a separate terminal

### "Database connection failed"
- **Solution:** 
  1. Ensure PostgreSQL is running
  2. Create database: `psql -U local_user -h localhost -c "CREATE DATABASE employee_management;"`
  3. Run schema: `psql -U local_user -h localhost -d employee_management -f schema.sql`

### CORS Errors
- **Solution:** Already fixed in server.ts with proper CORS configuration

## Testing Login

1. Start the application: `npm run dev`
2. Open: http://localhost:5173
3. Login with:
   - Username: `admin`
   - Password: `admin123`

If login fails, check:
- Browser console (F12) for error messages
- API server terminal for errors
- Database connection status








