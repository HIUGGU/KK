# Fix Database Permissions for Prisma

## The Problem

You're seeing: `ERROR: permission denied for schema public`

This means the `local_user` doesn't have permission to create tables in the database.

## Solution

### Option 1: Grant Permissions (Recommended)

Run this command (you'll need sudo access):

```bash
sudo -u postgres psql -d employee_management -c "GRANT ALL ON SCHEMA public TO local_user;"
sudo -u postgres psql -d employee_management -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO local_user;"
sudo -u postgres psql -d employee_management -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO local_user;"
```

### Option 2: Use the Setup Script

```bash
./setup-prisma.sh
```

(You may need to enter postgres password)

### Option 3: Manual SQL

Connect as postgres user and run:

```sql
\c employee_management
GRANT ALL ON SCHEMA public TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO local_user;
```

## After Granting Permissions

1. **Push Prisma schema:**
   ```bash
   npx prisma db push
   ```

2. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Start the application:**
   ```bash
   npm run dev
   ```

## Quick One-Liner

If you have sudo access:

```bash
sudo -u postgres psql -d employee_management << 'EOF'
GRANT ALL ON SCHEMA public TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO local_user;
EOF
npx prisma db push
```

## Verify It Worked

After granting permissions, you should see:

```
✔ Your database is now in sync with your Prisma schema.
```

Then you can start the app!








