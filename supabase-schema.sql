-- ============================================================
-- Kumar Hospital Pharmacy - Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Profiles Table (Role-Based Access Control)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'pharmacist' CHECK (role IN ('admin', 'pharmacist')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated users" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can update any profile" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trigger: auto-create profile on signup, default role = 'admin'
-- (Direct signups are treated as admin; admin creates pharmacists via UI)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    'admin'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Medicines Table
CREATE TABLE public.medicines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  batch TEXT NOT NULL,
  expiry DATE NOT NULL,
  main_quantity INTEGER NOT NULL DEFAULT 0,
  pharmacy_quantity INTEGER NOT NULL DEFAULT 0,
  min_level INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  supplier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to medicines" ON medicines FOR ALL USING (auth.role() = 'authenticated');

-- 3. Materials Table
CREATE TABLE public.materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  batch TEXT NOT NULL,
  expiry DATE NOT NULL,
  main_quantity INTEGER NOT NULL DEFAULT 0,
  pharmacy_quantity INTEGER NOT NULL DEFAULT 0,
  min_level INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  supplier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to materials" ON materials FOR ALL USING (auth.role() = 'authenticated');

-- 4. Bills
CREATE TABLE public.bills (
  id TEXT PRIMARY KEY,
  patient_name TEXT NOT NULL,
  patient_id TEXT,
  total DECIMAL(10,2) NOT NULL,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  status TEXT CHECK (status IN ('paid', 'pending', 'refunded')) DEFAULT 'paid',
  payment_method TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to bills" ON bills FOR ALL USING (auth.role() = 'authenticated');

-- 5. Bill Items
CREATE TABLE public.bill_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id TEXT REFERENCES bills(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL
);
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to bill_items" ON bill_items FOR ALL USING (auth.role() = 'authenticated');

-- 6. Purchases
CREATE TABLE public.purchases (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  supplier TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  received INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'received', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to purchases" ON purchases FOR ALL USING (auth.role() = 'authenticated');
