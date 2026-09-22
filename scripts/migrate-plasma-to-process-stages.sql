-- Plasma was the only stage between cutting and the order. Tinker and buffing
-- joined it, and since all three behave identically they now share one set of
-- tables keyed by `stage` instead of one set per stage.
--
-- This moves the existing plasma rows across, keeping their ids so the vendor
-- payments that reference them stay intact. Existing plasma jobs are marked
-- `completed`, which is what they were in effect: before work status existed,
-- a recorded job was finished work, and only completed pieces pass to tinker.
--
-- Run once, in place of `prisma db push`:
--   psql "$DATABASE_URL" -f scripts/migrate-plasma-to-process-stages.sql

BEGIN;

CREATE TABLE "process_rates" (
    "id" SERIAL NOT NULL,
    "stage" TEXT NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "charge_type" TEXT NOT NULL DEFAULT 'flat',
    "flat_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rate_per_inch" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "effective_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "process_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_jobs" (
    "id" SERIAL NOT NULL,
    "stage" TEXT NOT NULL,
    "job_date" DATE NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'in_house',
    "vendor_id" INTEGER,
    "work_status" TEXT NOT NULL DEFAULT 'in_progress',
    "completed_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'not_applicable',
    "notes" TEXT,
    "total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "process_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_job_items" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "charge_type" TEXT NOT NULL DEFAULT 'none',
    "height_inches" DECIMAL(10,2),
    "rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "process_job_items_pkey" PRIMARY KEY ("id")
);

-- Ids are carried over so vendor_payment_items keeps pointing at the right jobs
INSERT INTO "process_rates" (id, stage, vendor_id, product_id, charge_type, flat_charge, rate_per_inch, effective_date, notes, created_at)
SELECT id, 'plasma', vendor_id, product_id, charge_type, flat_charge, rate_per_inch, effective_date, notes, created_at
FROM "plasma_rates";

INSERT INTO "process_jobs" (id, stage, job_date, mode, vendor_id, work_status, completed_date, status, notes, total_quantity, total_cost, created_at, updated_at)
SELECT id, 'plasma', job_date, mode, vendor_id, 'completed', job_date, status, notes, total_quantity, total_cost, created_at, updated_at
FROM "plasma_jobs";

INSERT INTO "process_job_items" (id, job_id, product_id, quantity, charge_type, height_inches, rate, unit_cost, total_cost, notes)
SELECT id, job_id, product_id, quantity, charge_type, height_inches, rate, unit_cost, total_cost, notes
FROM "plasma_job_items";

-- Copied ids leave the sequences behind; without this the next insert collides
SELECT setval(pg_get_serial_sequence('process_rates', 'id'), COALESCE((SELECT MAX(id) FROM process_rates), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('process_jobs', 'id'), COALESCE((SELECT MAX(id) FROM process_jobs), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('process_job_items', 'id'), COALESCE((SELECT MAX(id) FROM process_job_items), 0) + 1, false);

CREATE UNIQUE INDEX "process_rates_stage_vendor_id_product_id_effective_date_key"
    ON "process_rates"("stage", "vendor_id", "product_id", "effective_date");
CREATE INDEX "process_jobs_stage_work_status_idx" ON "process_jobs"("stage", "work_status");
CREATE INDEX "process_job_items_product_id_idx" ON "process_job_items"("product_id");

ALTER TABLE "process_rates" ADD CONSTRAINT "process_rates_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_rates" ADD CONSTRAINT "process_rates_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_jobs" ADD CONSTRAINT "process_jobs_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "process_job_items" ADD CONSTRAINT "process_job_items_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "process_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_job_items" ADD CONSTRAINT "process_job_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payments now reference the stage-keyed jobs
ALTER TABLE "vendor_payment_items" DROP CONSTRAINT IF EXISTS "vendor_payment_items_job_id_fkey";
ALTER TABLE "vendor_payment_items" ADD CONSTRAINT "vendor_payment_items_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "process_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "plasma_job_items";
DROP TABLE "plasma_jobs";
DROP TABLE "plasma_rates";

COMMIT;
