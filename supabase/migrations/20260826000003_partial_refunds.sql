-- Allow 'partially_refunded' status in bills
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_status_check;
ALTER TABLE public.bills ADD CONSTRAINT bills_status_check CHECK (status IN ('paid', 'pending', 'refunded', 'partially_refunded'));

-- Add refunded_quantity to bill_items to track partial returns
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS refunded_quantity INTEGER DEFAULT 0;
