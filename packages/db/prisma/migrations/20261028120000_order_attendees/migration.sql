-- Checkout collects attendee names before a paid order is settled.
-- The payment webhook is the only writer of Ticket rows for those orders.
ALTER TABLE "Order" ADD COLUMN "attendees" JSONB;
