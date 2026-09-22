#!/bin/bash

# Database setup script for Employee Management System

DB_NAME=${DB_NAME:-employee_management}
DB_USER=${DB_USER:-local_user}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo "Setting up database: $DB_NAME"

# Create database
echo "Creating database..."
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database might already exist"

# Run schema
echo "Running schema..."
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f schema.sql

echo "Database setup complete!"








