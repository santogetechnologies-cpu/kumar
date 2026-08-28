-- ============================================================
-- Migration: Pharmacy Feature Enhancements
-- 1. Soft delete (archived) for medicines & materials
-- 2. Per-item custom minimum stock level override
-- 3. General minimum stock setting
-- 4. Batch tracking on bill_items
-- ============================================================

-- Soft delete / archive columns
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Per-item custom minimum stock level (NULL means use general default)
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS custom_min_level INTEGER DEFAULT NULL;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS custom_min_level INTEGER DEFAULT NULL;

-- General minimum stock level setting (admin-configurable default)
INSERT INTO public.settings (key, value) VALUES ('general_min_stock', '10') ON CONFLICT (key) DO NOTHING;

-- Batch purchase reference on bill_items for traceability
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES medicines(id) ON DELETE SET NULL;

-- Purchases: add batch/expiry tracking columns (if not already there)
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS batch TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS expiry DATE;
