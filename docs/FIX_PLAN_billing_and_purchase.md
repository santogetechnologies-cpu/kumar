# Fix plan: wrong bill amounts, wrong prices after purchase, odd numbers after "Mark Received"

## Context

The pharmacy app (React + Supabase, all logic in `src/lib/pharmacy-store.tsx`) has these reported symptoms:
1. The bill amount changes.
2. After buying a medicine at a new price, billing still uses the old price.
3. After "Mark Received", odd numbers appear: a batch like `NEW-4821`, a strange price, or the wrong stock.

A deep scan found **13 root causes** (listed below). The owner made two decisions:
- **Each batch keeps its own MRP (FIFO).** Old stock sells at the old price. New stock sells at the new price once old stock runs out.
- **Qty and MRP are always per tablet/unit.** No pack-size conversion is needed.

So the goal is not to change the pricing model. The goal is to make it **correct, predictable and visible**.

---

## Root causes (why it happens)

| # | Symptom | Root cause | Where |
|---|---|---|---|
| R1 | Bill amount changes while billing | The cart stores only `{name, qty}`. Prices and batches are **recomputed live** from `medicines` on every reload, so totals jump when stock reloads. | `DispensingTab.tsx:150-161` |
| R2 | Expired or old-price stock gets billed | FIFO sorts by expiry but **does not skip expired batches**, so the oldest or expired batch (old price) is picked first. | `DispensingTab.tsx:54-95` |
| R3 | "New price not coming" | A received purchase goes to `main_quantity` only. Billing uses `pharmacy_quantity` only. The new batch can't be billed until it is transferred, and this is not shown anywhere. | `pharmacy-store.tsx:653-741` |
| R4 | `NEW-xxxx` batch, fake expiry, OLD price after receiving | The "Create PO" path from Low Stock **drops `batch` and `expiry`** and pre-fills MRP with the **old price** (`poItem.price`). On receive, no batch matches, so a `NEW-xxxx` row is created with today+1yr expiry and the old price. | `InventoryTab.tsx:1272-1283, 1298` |
| R5 | Huge wrong price after receiving | Fallback `price: purchase.mrp \|\| purchase.cost`. `cost` is the **total line cost** (e.g. ₹1500), not the unit price. | `pharmacy-store.tsx:738` (also 688, 723) |
| R6 | Duplicate batches / price not updated | The batch match is an exact string compare (`"B12 "` ≠ `"b12"`), so near-duplicate rows get created. | `pharmacy-store.tsx:665, 700` |
| R7 | Stock doubled after receiving | There's no guard against receiving twice: a double-click, or a stale `purchases` closure. The status is set to `received` *before* stock is added. `received` is never filled in. | `pharmacy-store.tsx:648-749` |
| R8 | Wrong stock after deleting a purchase | The revert subtracts from `meds[0]`, a random batch, not the batch that was received. | `pharmacy-store.tsx:751-786` |
| R9 | Different bill amounts on different screens | Some screens use stored `b.total`, others use `getBillNetTotal(b)`. Neither one subtracts refunded quantities. The Analytics "today" revenue includes refunded bills. | `pharmacy-store.tsx:120`, `AnalyticsTab.tsx:71,80,236,246,346`, `PaymentsTab.tsx`, `FinanceTab.tsx`, `BillHistoryTab.tsx` |
| R10 | Wrong stock numbers | Stock changes are read-then-write from the browser (`select qty` → `update qty - x`). Two counters at once overwrite each other. | `addBill`, `refundItems`, `transferStock` in `pharmacy-store.tsx` |
| R11 | Half-saved bills | The bill is inserted, then items, then stock, with no transaction. If a step fails, the bill exists with no items or no stock change. Bill ID `BILL-<ms>` can collide. | `pharmacy-store.tsx:462-547` |
| R12 | Batch edit overwrites stock or price | `BatchEditDialog` uses `useMemo` to call `setState`, so it resets edits whenever data reloads. It saves **absolute** stock values taken from a stale snapshot. | `InventoryTab.tsx:716-755` |
| R13 | Material billed at the medicine price (or the reverse) | Dispensing groups medicines and materials together **by name only**. | `DispensingTab.tsx:48-72` |

---

## Fix plan (do the phases in order; each step is small and self-contained)

> Rules for the implementer: do not rename existing exports. Keep the Lovable branch working (see `AGENTS.md`). Run `npm run build` after every phase.

### Phase 1: Database: atomic functions (fixes R7, R10, R11)

Create the new file `supabase/migrations/20261117000008_atomic_stock.sql`:

```sql
-- 1. Atomic stock delta on medicines/materials (never read-then-write from the browser)
create or replace function public.adjust_stock(p_table text, p_id uuid, p_main int, p_pharmacy int)
returns void language plpgsql security definer as $$
begin
  if p_table = 'medicines' then
    update medicines set main_quantity = main_quantity + p_main,
                         pharmacy_quantity = pharmacy_quantity + p_pharmacy
    where id = p_id and main_quantity + p_main >= 0 and pharmacy_quantity + p_pharmacy >= 0;
  elsif p_table = 'materials' then
    update materials set main_quantity = main_quantity + p_main,
                         pharmacy_quantity = pharmacy_quantity + p_pharmacy
    where id = p_id and main_quantity + p_main >= 0 and pharmacy_quantity + p_pharmacy >= 0;
  else
    raise exception 'bad table %', p_table;
  end if;
  if not found then raise exception 'Insufficient stock or item not found'; end if;
end $$;

-- 2. Create bill + items + stock deduction in ONE transaction
create or replace function public.create_bill(p_bill jsonb, p_items jsonb)
returns text language plpgsql security definer as $$
declare v_id text := 'BILL-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text),1,4);
        it jsonb; v_tbl text;
begin
  insert into bills(id, patient_name, patient_id, doctor_id, doctor_name, total, discount_pct, status, payment_method)
  values (v_id, p_bill->>'patient_name', p_bill->>'patient_id', nullif(p_bill->>'doctor_id','')::uuid,
          p_bill->>'doctor_name', (p_bill->>'total')::numeric, (p_bill->>'discount_pct')::numeric,
          p_bill->>'status', p_bill->>'payment_method');
  for it in select * from jsonb_array_elements(p_items) loop
    insert into bill_items(bill_id, medicine_id, name, quantity, price, batch_id)
    values (v_id, (it->>'medicine_id')::uuid, it->>'name', (it->>'quantity')::int,
            (it->>'price')::numeric, (it->>'medicine_id')::uuid);
    v_tbl := case when exists(select 1 from medicines where id = (it->>'medicine_id')::uuid) then 'medicines' else 'materials' end;
    perform adjust_stock(v_tbl, (it->>'medicine_id')::uuid, 0, -((it->>'quantity')::int));
  end loop;
  return v_id;
end $$;

-- 3. Receive a purchase exactly once
create or replace function public.receive_purchase(p_purchase_id text, p_target_table text, p_target_id uuid)
returns void language plpgsql security definer as $$
declare v_qty int;
begin
  update purchases set status = 'received', received = quantity + coalesce(free_quantity,0)
  where id = p_purchase_id and status = 'pending'
  returning quantity + coalesce(free_quantity,0) into v_qty;
  if v_qty is null then raise exception 'Purchase already received or cancelled'; end if;
  perform adjust_stock(p_target_table, p_target_id, v_qty, 0);
end $$;

-- remember which batch row a purchase went into (for correct revert on delete)
alter table public.purchases add column if not exists target_id uuid;
alter table public.purchases add column if not exists target_table text;

grant execute on function public.adjust_stock(text,uuid,int,int) to authenticated;
grant execute on function public.create_bill(jsonb,jsonb) to authenticated;
grant execute on function public.receive_purchase(text,text,uuid) to authenticated;
```

Before writing it, check the `medicine_id` column type in `supabase/migrations/20260826000001_initial_schema.sql` (around line 96). If `medicine_id` is `uuid`, keep the casts. If it is `text`, drop the `::uuid` casts for it. Apply the migration in the Supabase SQL editor, or with `supabase db push`.

### Phase 2: Store fixes in `src/lib/pharmacy-store.tsx`

**2a. One correct bill-total helper (R9).** Replace `getBillNetTotal` (line 120) with:
```ts
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Amount actually kept after discount and refunds. Use this EVERYWHERE for money. */
export function getBillNetTotal(bill: Bill): number {
  const gross = bill.items.reduce((s, i) => s + i.price * (i.quantity - (i.refundedQuantity || 0)), 0);
  return round2(gross * (1 - (bill.discountPct ?? 0) / 100));
}
/** Original amount charged at billing time (before refunds). */
export function getBillOriginalTotal(bill: Bill): number {
  const gross = bill.items.reduce((s, i) => s + i.price * i.quantity, 0);
  return round2(gross * (1 - (bill.discountPct ?? 0) / 100));
}
```

**2b. `addBill` (R10, R11).** Replace the body with one call to `supabase.rpc("create_bill", { p_bill: {...snake_case fields, total: round2(data.total)}, p_items: data.items.map(i => ({ medicine_id: i.medicineId, name: i.name, quantity: i.quantity, price: i.price })) })`. If there is an error, throw it. Use the returned `data` (the bill id) as `billId`. Keep building `newBill` exactly as now, then call `await Promise.all([loadBills(), loadMedicines(), loadMaterials()])`. Delete the old `"BILL-" + Date.now()` code and the manual stock loop.

**2c. `refundItems` and `transferStock` (R10).** Replace every `select pharmacy_quantity` → `update` pair with:
- refund: `await supabase.rpc("adjust_stock", { p_table, p_id: ref.medicineId, p_main: 0, p_pharmacy: refQty })`. Find `p_table` by checking `medicines.some(m => m.id === id)`, otherwise use `"materials"`. The refund must also be capped: `refQty = Math.min(refQty, item.quantity - currentRefunded)`. Skip the item if the result is `<= 0`.
- transfer: `adjust_stock(table, id, -qty, +qty)`. The SQL `>= 0` check replaces the JS "Not enough main stock" check.

**2d. `updatePurchaseStatus` (R4–R7).** Rewrite it in this order:
1. If the status is `cancelled`: do a plain `update ... .eq("status","pending")` and return.
2. Fetch the purchase **fresh from the DB** (`select * from purchases where id = :id`). Don't use the `purchases` state, which can be stale. If `status !== "pending"`, throw `"Already received"`.
3. Validate: `mrp > 0`, `batch` is not empty, `expiry` is not empty. Otherwise throw `"Purchase is missing MRP/batch/expiry — edit it before receiving"`. **Never** fall back to `cost` or to `NEW-xxxx` / a fake expiry.
4. Normalise: `const norm = (s?: string) => (s ?? "").trim().toUpperCase();`
5. Find the target row: query `medicines` with `.ilike("name", purchase.item.trim())` and `archived = false`. If none, query `materials` the same way. Pick `rows.find(r => norm(r.batch) === norm(purchase.batch))`.
   - Batch found: `update { price: purchase.mrp, expiry: purchase.expiry }` on that row (same batch = same MRP, so updating it is correct).
   - No batch, but the item exists: insert a new row copying `category / min_level / custom_min_level` from `rows[0]`, with `batch: purchase.batch.trim()`, `expiry: purchase.expiry`, `price: purchase.mrp`, `main_quantity: 0`, `pharmacy_quantity: 0`. Use `.select().single()` to get its id.
   - Item not found: insert a new medicine the same way (category `"Tablet"`, `min_level: 10`, quantities 0).
6. Call `supabase.rpc("receive_purchase", { p_purchase_id: id, p_target_table, p_target_id })`. This adds stock **atomically and only once**.
7. `update purchases set target_id, target_table` for that id.
8. Reload purchases, medicines and materials. Remove `purchases` from the `useCallback` deps (it is no longer used).

**2e. `deletePurchase` (R8).** If `revertStock` is set and the purchase is `received` with a `target_id`, call `adjust_stock(target_table, target_id, -(quantity + free_quantity), 0)`. If there is no `target_id` (an old purchase), show the error toast "Cannot auto-revert old purchase; adjust stock manually" and skip the revert. Add `targetId?` and `targetTable?` to `Purchase` and `mapPurchase`.

### Phase 3: Purchase entry fixes in `src/components/pharmacy/InventoryTab.tsx` (R4)

- Low Stock PO `onSave` (around line 1272): add `batch: r.batch, expiry: r.exp` to `addPurchase(...)`, the same as `PurchasesMgmt.handleSave`.
- Low Stock `initialRows` (line 1298): set `mrp: 0, ptr: 0`, not `poItem.price`. The user must type the **new** invoice MRP, and the old price must not be silently reused.
- `InvoiceDialog.submit` (`InvoiceDialog.tsx:104`): also require `r.mrp > 0`. Error text: "Each row needs Product, Batch, Expiry, MRP and Qty".
- Remove the simple `submitPO` / `poCost` path (lines 1182-1220) if it is not rendered anywhere. If it is rendered, give it the same batch/expiry/MRP requirement.
- Purchases table: next to the "Received" status, show `→ Main store (transfer to pharmacy to sell)` so staff know new stock must be transferred before it can be billed (R3).

### Phase 4: Dispensing fixes in `src/components/pharmacy/DispensingTab.tsx` (R1, R2, R3, R13)

1. **Group key** (line 57): use `const key = (m._isMaterial ? "mat:" : "med:") + m.name.trim().toLowerCase();`. Change every cart lookup that uses `g.name` to use a new `key` field. Add `key: string` to `ItemGroup` and `CartState`.
2. **Skip expired batches in FIFO** (`resolveFifo`): add `if (new Date(med.expiry) < startOfToday) continue;`. Count `totalPharmacyStock` from non-expired batches only.
3. **Freeze prices in the cart (R1).** Change `CartState` to `{ key, name, requestedQty, lines: { medId, batch, price, qty }[] }`. Compute `lines` with `resolveFifo` **only when qty changes** (`handleAddItem`, `changeQty`, `setQtyDirect`). Do not compute them in a `useMemo` over `groups`. The `cart` memo then just sums `lines`. `dispense()` builds `billItems` from `lines`.
4. Round: `const total = round2(grossTotal * (1 - discountPct / 100));` (import `round2`).
5. Search card: under the batch rows, if any batch has `mainQuantity > 0` and `pharmacyQuantity === 0`, show the small text `New stock in main store — transfer to sell at ₹{price}` (R3 visibility).
6. Disable the Dispense button while `addBill` runs (`const [busy, setBusy] = useState(false)`) to stop double bills.

### Phase 5: Show the same money everywhere (R9)

Replace raw `b.total` used **as money** with `getBillNetTotal(b)` in:
- `AnalyticsTab.tsx` lines 71, 80, 236, 246, 346. Also filter out `status === "refunded"` bills there.
- `PaymentsTab.tsx:39`.
- `BillHistoryTab.tsx:64`. Show `getBillNetTotal(b)`. If it differs from `getBillOriginalTotal(b)`, show the original struck through.
- `ReturnsTab.tsx:296, 527`: show the original plus a "Net after refunds" line.
- `BillPrintDialog.tsx:323`: use `getBillOriginalTotal(bill)` (a printed invoice is the original sale). Show the batch at line 284 by looking up `it.batchId` in `medicines` (or leave it as is).

Leave `PaymentsTab.tsx:168` / `:242` (an "original amount" display) as they are, but use `getBillOriginalTotal`.

### Phase 6: Batch edit dialog in `InventoryTab.tsx:716-755` (R12)

- Replace the `useMemo(() => setBatches(...))` with `useEffect(() => { if (open) setBatches(structuredClone(item.batches)); }, [open]);`. Depend **only** on `open`, so reloads don't wipe edits.
- Compare numbers as numbers: `if (parseFloat(b.price) !== original.price)`.
- For stock fields, send a **delta** through `adjust_stock(table, id, newMain - original.mainQuantity, newPharm - original.pharmacyQuantity)`. Don't send an absolute value. That way, sales made while the dialog was open are not lost.

### Phase 7 (optional cleanup)

- `BulkUploadDialog` / bulk add (`InventoryTab.tsx:297-360`): before `addMedicine`, check for an existing row with the same normalised name and batch. If one exists, add stock with `adjust_stock` instead of inserting a duplicate row.
- One-time data cleanup SQL, which the owner should review before running:
  `select name, upper(trim(batch)) b, count(*) from medicines where not archived group by 1,2 having count(*)>1;`
  This lists duplicate batches so they can be merged by hand. Also run `select * from medicines where batch like 'NEW-%';` to find fake batches and fix their batch, expiry and price.

---

## Critical files

- `supabase/migrations/20261117000008_atomic_stock.sql` (new)
- `src/lib/pharmacy-store.tsx`: `getBillNetTotal`, `addBill`, `refundItems`, `transferStock`, `updatePurchaseStatus`, `deletePurchase`, `Purchase` type / `mapPurchase`
- `src/components/pharmacy/DispensingTab.tsx`
- `src/components/pharmacy/InventoryTab.tsx`: `PurchasesMgmt`, `LowStockView`, `BatchEditDialog`, bulk add
- `src/components/pharmacy/InvoiceDialog.tsx`: `submit` validation
- `AnalyticsTab.tsx`, `PaymentsTab.tsx`, `BillHistoryTab.tsx`, `ReturnsTab.tsx`, `BillPrintDialog.tsx`: money display

## Verification (manual, in the running app + Supabase table editor)

1. `npm run build`: no type errors.
2. **New price test:** medicine "TestMed", batch A, MRP ₹10, 20 units in pharmacy. Create a purchase with batch B, MRP ₹12, qty 50, and Mark Received. Expected: a new row with batch `B`, price 12, main 50, pharmacy 0. No `NEW-` batch, and the price is not the line cost. The search card shows "New stock in main store". Bill 25 units: the first 20 at ₹10 bill normally, and you can't bill 25 until a transfer. Transfer 50, then bill 25: 20×₹10 + 5×₹12 = ₹260.
3. **Double receive:** double-click Mark Received → stock is added once and the second click shows "already received".
4. **Low-stock PO:** the dialog opens with MRP empty. You can't save without batch, expiry and MRP. Receiving uses the typed values.
5. **Cart stability:** put items in the cart, then in another tab transfer stock or receive a purchase. The open cart's prices and total do not change.
6. **Expired batch:** set batch A's expiry to yesterday. It is not picked by FIFO.
7. **Refund consistency:** bill ₹100 with 10% off (net ₹90), then refund half. Bill History, Payments, Finance and Analytics all show ₹45 net, and the print still shows ₹90.
8. **Concurrency:** open two browser tabs and bill the same item at the same time. The final `pharmacy_quantity` = start − both quantities.
9. **Delete purchase with revert:** stock goes down on the exact batch that was received (batch B, not A).
