#!/bin/bash

echo "=== API Connection Check ==="
echo ""

echo "1. Checking if API server is running..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ API server is running"
    curl -s http://localhost:3001/api/health | jq . 2>/dev/null || curl -s http://localhost:3001/api/health
else
    echo "❌ API server is NOT running"
    echo "   Start it with: npm run dev:api"
fi

echo ""
echo "2. Testing login endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

if [ $? -eq 0 ]; then
    echo "✅ Login endpoint is accessible"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
else
    echo "❌ Cannot reach login endpoint"
fi

echo ""
echo "3. Checking database connection..."
if psql -U local_user -h localhost -d employee_management -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database is connected"
else
    echo "❌ Database connection failed"
    echo "   Check PostgreSQL is running and database exists"
fi

echo ""
echo "=== Check Complete ==="








