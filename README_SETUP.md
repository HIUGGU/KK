# Complete Setup Instructions

## Prerequisites

- PostgreSQL installed and running
- Node.js and npm installed
- Sudo access (for database creation)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Database and Setup

**Option A: Using the SQL script (Recommended)**

```bash
sudo -u postgres psql -f setup-database.sql
```

**Option B: Manual commands**

```bash
# Create database
sudo -u postgres createdb employee_management

# Grant permissions
sudo -u postgres psql -d employee_management << 'EOF'
GRANT ALL ON SCHEMA public TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO local_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO local_user;
EOF
```

### 3. Push Prisma Schema

```bash
npx prisma db push
```

This will create all tables defined in `prisma/schema.prisma`.

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Start the Application

```bash
npm run dev
```

## Verify Setup

Check if tables were created:

```bash
export PGPASSWORD=123456
psql -U local_user -h localhost -d employee_management -c "\dt"
```

Should show:
- `admin`
- `employees`
- `attendance`
- `salary_records`

## Default Admin User

The application will automatically create a default admin user on first run:
- Username: `admin`
- Password: `admin123`

## Troubleshooting

### "Database does not exist"
Run: `sudo -u postgres createdb employee_management`

### "Permission denied for schema public"
Run the grant permissions commands from Step 2.

### "Environment variable not found: DATABASE_URL"
Make sure `.env` file exists in the project root with:
```
DATABASE_URL="postgresql://local_user:123456@localhost:5432/employee_management?schema=public"
```

## Files Created

- ✅ `.env` - Environment variables
- ✅ `prisma/schema.prisma` - Database schema
- ✅ `setup-database.sql` - SQL setup script
- ✅ `QUICK_SETUP.sh` - Automated setup script








