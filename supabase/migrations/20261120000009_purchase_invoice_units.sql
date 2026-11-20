-- Keep the supplier invoice's original quantities/units/prices.
-- quantity, free_quantity and mrp remain in PIECES (inventory units).
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_qty numeric;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_qty_unit text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_free_qty numeric;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_free_unit text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS pieces_per_strip integer;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_mrp numeric;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_ptr numeric;
