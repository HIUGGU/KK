#!/bin/bash

echo "Starting API Server..."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Loaded .env file"
else
    echo "⚠️  Warning: .env file not found, using defaults"
fi

# Check if database exists
echo "Checking database connection..."
psql -U ${DB_USER:-local_user} -h ${DB_HOST:-localhost} -d ${DB_NAME:-employee_management} -c "SELECT 1;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database connection OK"
else
    echo "⚠️  Warning: Database connection failed"
    echo "   Make sure PostgreSQL is running and database exists"
    echo "   Run: psql -U local_user -h localhost -d employee_management -f schema.sql"
fi

echo ""
echo "Starting API server on http://localhost:${PORT:-3001}..."
echo "Press Ctrl+C to stop"
echo ""

# Start the API server
npx ts-node API/src/server.ts








