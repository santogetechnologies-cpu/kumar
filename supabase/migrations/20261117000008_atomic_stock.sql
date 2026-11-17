-- ============================================================
-- Migration: Atomic stock operations
-- Fixes lost stock updates (two counters billing at once), half-saved
-- bills, and purchases being received (stock added) more than once.
-- Functions run as the calling user (SECURITY INVOKER) so existing RLS applies.
-- ============================================================

-- Remember which batch row a purchase was received into (for exact revert on delete)
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS target_table text;

-- 1. Atomic stock delta on medicines/materials
CREATE OR REPLACE FUNCTION public.adjust_stock(p_table text, p_id uuid, p_main int, p_pharmacy int)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_table = 'medicines' THEN
    UPDATE medicines
       SET main_quantity = main_quantity + p_main,
           pharmacy_quantity = pharmacy_quantity + p_pharmacy
     WHERE id = p_id
       AND main_quantity + p_main >= 0
       AND pharmacy_quantity + p_pharmacy >= 0;
  ELSIF p_table = 'materials' THEN
    UPDATE materials
       SET main_quantity = main_quantity + p_main,
           pharmacy_quantity = pharmacy_quantity + p_pharmacy
     WHERE id = p_id
       AND main_quantity + p_main >= 0
       AND pharmacy_quantity + p_pharmacy >= 0;
  ELSE
    RAISE EXCEPTION 'Invalid table %', p_table;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock or item not found';
  END IF;
END $$;

-- 2. Create bill + items + stock deduction in ONE transaction
CREATE OR REPLACE FUNCTION public.create_bill(p_bill jsonb, p_items jsonb)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_id  text := 'BILL-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(md5(random()::text), 1, 4));
  it    jsonb;
  v_mid uuid;
  v_qty int;
  v_tbl text;
BEGIN
  INSERT INTO bills (id, patient_name, patient_id, doctor_id, doctor_name, total, discount_pct, status, payment_method)
  VALUES (
    v_id,
    p_bill->>'patient_name',
    p_bill->>'patient_id',
    NULLIF(p_bill->>'doctor_id', ''),
    COALESCE(p_bill->>'doctor_name', ''),
    (p_bill->>'total')::numeric,
    COALESCE((p_bill->>'discount_pct')::numeric, 0),
    COALESCE(p_bill->>'status', 'paid'),
    p_bill->>'payment_method'
  );

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_mid := NULLIF(it->>'medicine_id', '')::uuid;
    v_qty := (it->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for %', it->>'name';
    END IF;

    INSERT INTO bill_items (bill_id, medicine_id, name, quantity, price, batch_id)
    VALUES (v_id, v_mid, it->>'name', v_qty, (it->>'price')::numeric, v_mid);

    IF v_mid IS NOT NULL THEN
      v_tbl := CASE WHEN EXISTS (SELECT 1 FROM medicines WHERE id = v_mid) THEN 'medicines' ELSE 'materials' END;
      BEGIN
        PERFORM adjust_stock(v_tbl, v_mid, 0, -v_qty);
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Not enough pharmacy stock for % (batch changed — please re-add to cart)', it->>'name';
      END;
    END IF;
  END LOOP;

  RETURN v_id;
END $$;

-- 3. Receive a purchase exactly once (status flip + stock add are atomic)
CREATE OR REPLACE FUNCTION public.receive_purchase(p_purchase_id text, p_target_table text, p_target_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_qty int;
BEGIN
  UPDATE purchases
     SET status = 'received',
         received = quantity + COALESCE(free_quantity, 0),
         target_id = p_target_id,
         target_table = p_target_table
   WHERE id = p_purchase_id AND status = 'pending'
  RETURNING quantity + COALESCE(free_quantity, 0) INTO v_qty;

  IF v_qty IS NULL THEN
    RAISE EXCEPTION 'Purchase already received or cancelled';
  END IF;

  PERFORM adjust_stock(p_target_table, p_target_id, v_qty, 0);
END $$;

GRANT EXECUTE ON FUNCTION public.adjust_stock(text, uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bill(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase(text, text, uuid) TO authenticated;
