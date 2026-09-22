# Prisma Setup Guide

## What Changed

The application now uses **Prisma ORM** instead of raw SQL queries. This provides:
- Type-safe database access
- Automatic migrations
- Better developer experience
- Schema defined in `prisma/schema.prisma`

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

This will install Prisma and @prisma/client.

### 2. Generate Prisma Client

```bash
npm run prisma:generate
```

Or:
```bash
npx prisma generate
```

### 3. Setup Database

Make sure your `.env` file has the correct DATABASE_URL:

```env
DATABASE_URL="postgresql://local_user:123456@localhost:5432/employee_management?schema=public"
```

### 4. Push Schema to Database

This will create all tables in your database:

```bash
npm run prisma:push
```

Or:
```bash
npx prisma db push
```

### 5. (Optional) Create Migration

If you want to use migrations instead:

```bash
npm run prisma:migrate
```

Or:
```bash
npx prisma migrate dev --name init
```

### 6. Start the Application

```bash
npm run dev
```

## Prisma Commands

- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:push` - Push schema changes to database (dev)
- `npm run prisma:migrate` - Create and apply migration
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Schema File

The database schema is now defined in `prisma/schema.prisma`:

- `Admin` - Admin users
- `Employee` - Employee records
- `Attendance` - Attendance tracking
- `SalaryRecord` - Salary calculations

## Default Admin User

The application will automatically create a default admin user on first run:
- Username: `admin`
- Password: `admin123`

## Troubleshooting

### "Prisma Client not generated"

Run:
```bash
npx prisma generate
```

### "Database connection failed"

1. Check `.env` file has correct `DATABASE_URL`
2. Ensure PostgreSQL is running
3. Verify database exists:
   ```bash
   psql -U local_user -h localhost -d employee_management -c "SELECT 1;"
   ```

### "Table does not exist"

Run:
```bash
npx prisma db push
```

This will create all tables from the schema.

## Benefits of Prisma

✅ Type-safe queries
✅ Auto-completion in IDE
✅ Automatic migrations
✅ Better error messages
✅ Database-agnostic (can switch databases easily)








