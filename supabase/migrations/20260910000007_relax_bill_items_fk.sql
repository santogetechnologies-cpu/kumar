-- ============================================================
-- Migration: Relax Foreign Key on bill_items
-- Reason: Dispensing allows both Medicines and Materials (or custom items).
-- The rigid constraint bill_items_medicine_id_fkey causes errors when
-- dispensing materials or items not strictly in the medicines table.
-- ============================================================

ALTER TABLE public.bill_items DROP CONSTRAINT IF EXISTS bill_items_medicine_id_fkey;
ALTER TABLE public.bill_items DROP CONSTRAINT IF EXISTS bill_items_batch_id_fkey;
