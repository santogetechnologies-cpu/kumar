-- Add extra tracking fields for purchases and invoices
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_no text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS free_quantity integer DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS mrp numeric DEFAULT 0;
