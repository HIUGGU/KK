#!/bin/bash

echo "=========================================="
echo "Quick Database Setup"
echo "=========================================="
echo ""

echo "This script will:"
echo "1. Create the database"
echo "2. Grant permissions"
echo "3. Push Prisma schema"
echo ""

read -p "Press Enter to continue (or Ctrl+C to cancel)..."

echo ""
echo "Step 1: Creating database..."
sudo -u postgres psql -f setup-database.sql

if [ $? -eq 0 ]; then
    echo "✅ Database created and permissions granted"
    echo ""
    echo "Step 2: Pushing Prisma schema..."
    npx prisma db push --accept-data-loss
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Schema pushed successfully!"
        echo ""
        echo "Step 3: Generating Prisma Client..."
        npx prisma generate
        echo ""
        echo "✅ Setup complete!"
        echo ""
        echo "You can now run: npm run dev"
    else
        echo "❌ Failed to push schema"
    fi
else
    echo "❌ Failed to create database"
    echo ""
    echo "Please run manually:"
    echo "  sudo -u postgres psql -f setup-database.sql"
fi








