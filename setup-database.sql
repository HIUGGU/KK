-- Database Setup Script for Employee Management System
-- Run this as postgres superuser: sudo -u postgres psql -f setup-database.sql

-- Create database
CREATE DATABASE employee_management;

-- Connect to the new database
\c employee_management

-- Grant permissions to local_user
GRANT ALL ON SCHEMA public TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO local_user;
GRANT ALL PRIVILEGES ON DATABASE employee_management TO local_user;

-- Verify
\dt








