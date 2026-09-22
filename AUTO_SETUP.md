# Automatic Database Setup

## Quick Setup

Run this script to automatically create the database and push the Prisma schema:

```bash
./create-and-setup-db.sh
```

## What It Does

1. ✅ Creates the `employee_management` database
2. ✅ Grants permissions to `local_user`
3. ✅ Pushes Prisma schema (creates all tables)
4. ✅ Generates Prisma Client

## If Script Fails

### Manual Setup Steps

1. **Create database:**
   ```bash
   sudo -u postgres createdb employee_management
   ```

2. **Grant permissions:**
   ```bash
   sudo -u postgres psql -d employee_management << 'EOF'
   GRANT ALL ON SCHEMA public TO local_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO local_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO local_user;
   EOF
   ```

3. **Push Prisma schema:**
   ```bash
   npx prisma db push
   ```

4. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

## Verify Setup

Check if tables were created:

```bash
export PGPASSWORD=123456
psql -U local_user -h localhost -d employee_management -c "\dt"
```

Should show: `admin`, `employees`, `attendance`, `salary_records`

## Start Application

After setup is complete:

```bash
npm run dev
```

The application will automatically create the default admin user on first run.








