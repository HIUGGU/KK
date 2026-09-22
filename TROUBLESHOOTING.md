# Troubleshooting: API Not Calling

## Issue: Network Tab Shows No API Requests

If you see "Invalid username or password" but the Network tab shows no requests, the API calls aren't being made.

## Quick Fix Steps

### 1. Check if API Server is Running

Open a terminal and run:
```bash
curl http://localhost:3001/api/health
```

**Expected response:**
```json
{"status":"ok","database":"connected"}
```

**If you get "Connection refused":**
- Start the API server: `npm run dev:api`
- Or start both: `npm run dev`

### 2. Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors like:
   - "Failed to fetch"
   - "Network error"
   - "CORS error"
   - Any red error messages

### 3. Verify API Client is Working

The API client should make requests to: `http://localhost:3001/api`

Check in browser console:
```javascript
// In browser console, test the API directly:
fetch('http://localhost:3001/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

### 4. Check Database Connection

```bash
psql -U local_user -h localhost -d employee_management -c "SELECT * FROM admin;"
```

Should return the admin user.

### 5. Common Issues

#### Issue: API Server Not Running
**Solution:**
```bash
# Terminal 1
npm run dev:api

# Terminal 2  
npm run dev:web
```

#### Issue: Database Not Connected
**Solution:**
1. Ensure PostgreSQL is running
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

#### Issue: Port Already in Use
**Solution:**
- Change API port in `.env`: `PORT=3002`
- Update API client in `WEB/src/api/client.ts`:
  ```typescript
  const API_BASE_URL = 'http://localhost:3002/api';
  ```

#### Issue: CORS Errors
**Solution:**
Already fixed in `API/src/server.ts` with CORS configuration.

## Debug Mode

I've added console.log statements to help debug:
- Check browser console for "API Request:" messages
- Check browser console for "API Response status:" messages
- Check API server terminal for incoming requests

## Test Login Manually

1. Open browser console (F12)
2. Run:
```javascript
fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

Should return: `{success: true, token: "..."}`

## Still Not Working?

1. **Check .env file exists** and has correct values
2. **Restart both servers** (API and Web)
3. **Clear browser cache** and hard refresh (Ctrl+Shift+R)
4. **Check firewall** isn't blocking port 3001
5. **Verify Node.js version**: `node --version` (should be v18+)








