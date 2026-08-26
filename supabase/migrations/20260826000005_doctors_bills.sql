-- Add doctor fields to bills table
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS doctor_id text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS doctor_name text;
