#!/bin/bash

echo "Setting up Employee Management Database..."
echo ""

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_USER=${DB_USER:-local_user}
DB_HOST=${DB_HOST:-localhost}
DB_NAME=${DB_NAME:-employee_management}
DB_PASSWORD=${DB_PASSWORD:-123456}

# Set password for psql
export PGPASSWORD=$DB_PASSWORD

# Check if database exists
echo "Checking if database exists..."
DB_EXISTS=$(psql -U $DB_USER -h $DB_HOST -lqt | cut -d \| -f 1 | grep -w $DB_NAME | wc -l)

if [ $DB_EXISTS -eq 0 ]; then
    echo "Creating database: $DB_NAME"
    psql -U $DB_USER -h $DB_HOST -d postgres -c "CREATE DATABASE $DB_NAME;" 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Database created successfully"
    else
        echo "❌ Failed to create database"
        exit 1
    fi
else
    echo "✅ Database already exists"
fi

# Run schema
echo ""
echo "Running database schema..."
psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f schema.sql 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Schema applied successfully"
else
    echo "⚠️  Schema application had issues (tables might already exist)"
fi

# Verify admin user
echo ""
echo "Verifying admin user..."
ADMIN_EXISTS=$(psql -U $DB_USER -h $DB_HOST -d $DB_NAME -t -c "SELECT COUNT(*) FROM admin WHERE username='admin';" 2>/dev/null | xargs)

if [ "$ADMIN_EXISTS" -gt 0 ]; then
    echo "✅ Admin user exists"
    echo ""
    echo "Default credentials:"
    echo "  Username: admin"
    echo "  Password: admin123"
else
    echo "⚠️  Admin user not found, creating..."
    psql -U $DB_USER -h $DB_HOST -d $DB_NAME -c "INSERT INTO admin (username, password) VALUES ('admin', 'admin123') ON CONFLICT (username) DO NOTHING;" 2>&1
    echo "✅ Admin user created"
fi

echo ""
echo "✅ Database setup complete!"
echo ""
echo "You can now start the application with: npm run dev"

