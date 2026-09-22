#!/bin/bash

echo "=========================================="
echo "Database Setup for Employee Management"
echo "=========================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_USER=${DB_USER:-local_user}
DB_PASSWORD=${DB_PASSWORD:-123456}
DB_NAME=${DB_NAME:-employee_management}

echo "Step 1: Creating database '$DB_NAME'..."
echo "Note: This requires postgres superuser access"
echo ""

# Try to create database using postgres user
if command -v sudo &> /dev/null; then
    echo "Attempting to create database with sudo..."
    sudo -u postgres psql << EOF 2>&1 | grep -v "already exists" || true
CREATE DATABASE $DB_NAME;
\q
EOF
    
    if [ $? -eq 0 ]; then
        echo "✅ Database created"
    else
        echo "⚠️  Could not create database with sudo. Trying alternative..."
    fi
fi

# Alternative: Try connecting as postgres directly
export PGPASSWORD=postgres
psql -U postgres -h localhost -c "CREATE DATABASE $DB_NAME;" 2>&1 | grep -v "already exists" || echo "Database might already exist or need manual creation"

echo ""
echo "Step 2: Granting permissions..."
export PGPASSWORD=postgres
psql -U postgres -h localhost -d $DB_NAME << 'EOF' 2>&1
GRANT ALL ON SCHEMA public TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO local_user;
GRANT ALL PRIVILEGES ON DATABASE employee_management TO local_user;
EOF

if [ $? -ne 0 ]; then
    echo "⚠️  Could not grant permissions automatically."
    echo "Please run manually:"
    echo "  sudo -u postgres psql -d $DB_NAME -c \"GRANT ALL ON SCHEMA public TO $DB_USER;\""
fi

echo ""
echo "Step 3: Pushing Prisma schema..."
export PGPASSWORD=$DB_PASSWORD
npx prisma db push --accept-data-loss 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Schema pushed successfully!"
    echo ""
    echo "Step 4: Generating Prisma Client..."
    npx prisma generate 2>&1 | tail -3
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "You can now start the application with: npm run dev"
else
    echo ""
    echo "❌ Failed to push schema. Please check permissions."
    echo ""
    echo "Manual steps:"
    echo "1. Create database: sudo -u postgres createdb $DB_NAME"
    echo "2. Grant permissions: sudo -u postgres psql -d $DB_NAME -c \"GRANT ALL ON SCHEMA public TO $DB_USER;\""
    echo "3. Push schema: npx prisma db push"
fi








