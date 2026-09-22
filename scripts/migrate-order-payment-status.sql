-- Orders now exist only once the goods are delivered, so orders.status tracks
-- payment instead of delivery. Run once, after `npm run prisma:push`.
--
--   psql "$DATABASE_URL" -f scripts/migrate-order-payment-status.sql

ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'not_paid';

-- Existing rows carry the old delivery statuses; none of them were paid yet.
UPDATE orders SET status = 'not_paid' WHERE status NOT IN ('paid', 'not_paid');
