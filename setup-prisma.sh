#!/bin/bash

echo "Setting up Prisma Database..."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_USER=${DB_USER:-local_user}
DB_PASSWORD=${DB_PASSWORD:-123456}
DB_NAME=${DB_NAME:-employee_management}

export PGPASSWORD=$DB_PASSWORD

echo "Step 1: Granting permissions to $DB_USER..."
export PGPASSWORD=postgres
psql -U postgres -h localhost -d $DB_NAME << EOF 2>&1 | grep -v "does not exist" || true
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

echo ""
echo "Step 2: Pushing Prisma schema..."
export PGPASSWORD=$DB_PASSWORD
npx prisma db push --skip-generate 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database schema created successfully!"
    echo ""
    echo "Step 3: Generating Prisma Client..."
    npx prisma generate 2>&1 | tail -3
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "You can now start the application with: npm run dev"
else
    echo ""
    echo "❌ Failed to push schema. You may need to run as postgres user:"
    echo "   sudo -u postgres psql -d $DB_NAME -c \"GRANT ALL ON SCHEMA public TO $DB_USER;\""
fi








