-- Doctors table
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to doctors" ON doctors FOR ALL USING (auth.role() = 'authenticated');

-- Settings table
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT 'true',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read settings" ON settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin write settings" ON settings FOR ALL USING (auth.role() = 'authenticated');

-- Seed default setting
INSERT INTO public.settings (key, value) VALUES ('allow_pharmacist_transfer', 'true') ON CONFLICT DO NOTHING;

-- Add doctor_name to bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS doctor_name TEXT DEFAULT '';
