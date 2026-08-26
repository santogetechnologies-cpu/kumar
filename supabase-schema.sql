-- 1. Create Profiles Table (for RBAC)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  role TEXT DEFAULT 'pharmacist' CHECK (role IN ('admin', 'pharmacist')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to automatically create a profile on signup
-- By default, we will assign 'admin' to the first user or based on the request "ANYONE LOGINS VIA SUPABASE AUTH DIRECTLY IS SER ADMIN". 
-- To achieve this, we can set the default role to 'admin' for now, and later when an admin creates a pharmacist, they will explicitly set the role.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'admin');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Create Medicines Table
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
CREATE POLICY "Allow authenticated full access to medicines" ON medicines FOR ALL USING (auth.role() = 'authenticated');

-- 3. Create Materials Table
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
CREATE POLICY "Allow authenticated full access to materials" ON materials FOR ALL USING (auth.role() = 'authenticated');

-- 4. Create Bills and Bill Items
CREATE TABLE public.bills (
  id TEXT PRIMARY KEY, -- Keeping text as it looks like "B10001" format
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
CREATE POLICY "Allow authenticated full access to bills" ON bills FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE public.bill_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id TEXT REFERENCES bills(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL
);
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to bill_items" ON bill_items FOR ALL USING (auth.role() = 'authenticated');

-- 5. Create Purchases Table
CREATE TABLE public.purchases (
  id TEXT PRIMARY KEY, -- "PO2001" format
  item TEXT NOT NULL,
  supplier TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  received INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'received', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to purchases" ON purchases FOR ALL USING (auth.role() = 'authenticated');
