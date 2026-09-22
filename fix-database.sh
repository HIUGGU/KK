#!/bin/bash

echo "Fixing database permissions and setup..."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_USER=${DB_USER:-local_user}
DB_PASSWORD=${DB_PASSWORD:-123456}
DB_NAME=${DB_NAME:-employee_management}

export PGPASSWORD=$DB_PASSWORD

echo "Step 1: Creating database (as postgres user)..."
export PGPASSWORD=postgres
psql -U postgres -h localhost -c "CREATE DATABASE $DB_NAME;" 2>&1 | grep -v "already exists" || echo "Database might already exist"

echo ""
echo "Step 2: Granting permissions to $DB_USER..."
psql -U postgres -h localhost -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>&1
psql -U postgres -h localhost -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>&1
psql -U postgres -h localhost -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" 2>&1

echo ""
echo "Step 3: Running schema..."
export PGPASSWORD=$DB_PASSWORD
psql -U $DB_USER -h localhost -d $DB_NAME -f schema.sql 2>&1 | grep -E "(ERROR|CREATE|INSERT)" | head -5 || echo "Schema applied"

echo ""
echo "Step 4: Verifying setup..."
ADMIN_COUNT=$(psql -U $DB_USER -h localhost -d $DB_NAME -t -c "SELECT COUNT(*) FROM admin;" 2>/dev/null | xargs)

if [ "$ADMIN_COUNT" -gt 0 ]; then
    echo "✅ Database setup complete!"
    echo "✅ Admin user exists"
    echo ""
    echo "Login credentials:"
    echo "  Username: admin"
    echo "  Password: admin123"
else
    echo "⚠️  Admin user not found, creating..."
    psql -U $DB_USER -h localhost -d $DB_NAME -c "INSERT INTO admin (username, password) VALUES ('admin', 'admin123') ON CONFLICT (username) DO NOTHING;" 2>&1
    echo "✅ Setup complete!"
fi

echo ""
echo "You can now restart the application: npm run dev"








