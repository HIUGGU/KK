# Database Setup - Quick Fix

## The Problem

You're seeing: `error: database "employee_management" does not exist`

## Quick Solution

### Option 1: Using PostgreSQL superuser (Recommended)

Run this command (you'll be prompted for postgres password):

```bash
# Connect as postgres user
sudo -u postgres psql

# Then run these commands:
CREATE DATABASE employee_management;
CREATE USER local_user WITH PASSWORD '123456';
GRANT ALL PRIVILEGES ON DATABASE employee_management TO local_user;
\c employee_management
GRANT ALL ON SCHEMA public TO local_user;
\q

# Then run the schema
export PGPASSWORD=123456
psql -U local_user -h localhost -d employee_management -f schema.sql
```

### Option 2: Using the fix script

```bash
./fix-database.sh
```

(You'll need the postgres user password)

### Option 3: Manual setup (if you have postgres access)

```bash
# 1. Create database
sudo -u postgres createdb employee_management

# 2. Grant permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE employee_management TO local_user;"

# 3. Run schema
export PGPASSWORD=123456
psql -U local_user -h localhost -d employee_management -f schema.sql
```

### Option 4: If you don't have postgres user access

You need to ask your system administrator to:
1. Create the database `employee_management`
2. Grant permissions to user `local_user`

Or use a different PostgreSQL user that has CREATE DATABASE privileges.

## Verify It's Working

After setup, test the connection:

```bash
export PGPASSWORD=123456
psql -U local_user -h localhost -d employee_management -c "SELECT username FROM admin;"
```

Should return: `admin`

## Then Restart the Application

```bash
npm run dev
```

The API server should now connect successfully!

## Default Login

- Username: `admin`
- Password: `admin123`








