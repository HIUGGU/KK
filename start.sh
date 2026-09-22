#!/bin/bash

echo "Starting Employee Management System..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env 2>/dev/null || echo "Please create .env file manually"
fi

# Check database connection
echo "Checking database connection..."
psql -U local_user -h localhost -d employee_management -c "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Database connection failed!"
    echo "Please ensure PostgreSQL is running and database 'employee_management' exists"
    echo "Run: psql -U local_user -h localhost -d employee_management -f schema.sql"
    echo ""
fi

echo "Starting API and Web servers..."
echo "API: http://localhost:3001"
echo "Web: http://localhost:5173"
echo ""

npm run dev








