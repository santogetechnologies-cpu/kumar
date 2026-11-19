import { formatDate, formatDateTime } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { usePharmacy, getBillNetTotal, getBillOriginalTotal, type Bill } from "@/lib/pharmacy-store";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, Undo2, RefreshCcw, ArrowLeft, Calendar, User,
  Receipt, Loader2, CheckCircle2, ChevronRight, FileText
} from "lucide-react";
import { toast } from "sonner";

type StatusFilter = "refundable" | "all" | "refunded" | "paid";
type RangeFilter = "all" | "today" | "week" | "month";

export function ReturnsTab() {
  const { bills, refundItems } = usePharmacy();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("refundable");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [limit, setLimit] = useState(20);

  // Selected bill for refund
  const [foundId, setFoundId] = useState<string | null>(null);
  const [remoteBill, setRemoteBill] = useState<Bill | null>(null);
  const [selectedMedicineId, setSelectedMedicineId] = useState<string | null>(null);
  const [refundQty, setRefundQty] = useState<number>(1);
  const [processing, setProcessing] = useState(false);
  const [remoteSearching, setRemoteSearching] = useState(false);

  // Filter bills in client memory
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // Status filter
      if (statusFilter === "refundable" && b.status === "refunded") return false;
      if (statusFilter === "paid" && b.status !== "paid") return false;
      if (statusFilter === "refunded" && b.status !== "refunded") return false;

      // Date range filter
      if (rangeFilter !== "all") {
        const d = new Date(b.createdAt);
        const now = new Date();
        if (rangeFilter === "today") {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (d < today) return false;
        } else if (rangeFilter === "week") {
          const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
          if (d < weekAgo) return false;
        } else if (rangeFilter === "month") {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          if (d < monthStart) return false;
        }
      }

      // Live search filter across Bill ID, Patient Name, Patient ID, Doctor, Medicine Name
      if (q.trim()) {
        const term = q.trim().toLowerCase();
        const matchId = b.id.toLowerCase().includes(term);
        const matchPatient = b.patientName.toLowerCase().includes(term);
        const matchPatientId = b.patientId?.toLowerCase().includes(term);
        const matchDoctor = b.doctorName?.toLowerCase().includes(term);
        const matchItems = b.items?.some((it) => it.name.toLowerCase().includes(term));
        if (!matchId && !matchPatient && !matchPatientId && !matchDoctor && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [bills, statusFilter, rangeFilter, q]);

  // Direct Supabase lookup fallback when bill is not found in client memory
  const handleRemoteSearch = async () => {
    if (!q.trim()) {
      toast.error("Please enter a bill ID or patient name to search");
      return;
    }
    setRemoteSearching(true);
    try {
      const term = q.trim();
      // Search by bill ID or patient name or patient ID
      const { data: billRows, error: billErr } = await supabase
        .from("bills")
        .select("*")
        .or(`id.ilike.%${term}%,patient_name.ilike.%${term}%,patient_id.ilike.%${term}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (billErr) throw billErr;
      if (!billRows || billRows.length === 0) {
        toast.error(`No historical bills found in database for "${term}"`);
        return;
      }

      // Load items for the first match
      const targetBillRow = billRows[0];
      const { data: itemRows, error: itemErr } = await supabase
        .from("bill_items")
        .select("*")
        .eq("bill_id", targetBillRow.id);

      if (itemErr) throw itemErr;

      const loadedBill: Bill = {
        id: targetBillRow.id,
        patientName: targetBillRow.patient_name,
        patientId: targetBillRow.patient_id ?? "",
        doctorId: targetBillRow.doctor_id ?? undefined,
        doctorName: targetBillRow.doctor_name ?? "",
        items: (itemRows ?? []).map((it: any) => ({
          medicineId: it.medicine_id,
          name: it.name,
          quantity: it.quantity,
          price: parseFloat(it.price),
          refundedQuantity: it.refunded_quantity ?? 0,
          batchId: it.batch_id ?? null,
        })),
        total: parseFloat(targetBillRow.total),
        discountPct: parseFloat(targetBillRow.discount_pct ?? 0),
        status: targetBillRow.status,
        paymentMethod: targetBillRow.payment_method ?? "",
        createdBy: targetBillRow.created_by ?? "",
        createdAt: targetBillRow.created_at,
      };

      setRemoteBill(loadedBill);
      setFoundId(loadedBill.id);
      setSelectedMedicineId(null);
      setRefundQty(1);
      toast.success(`Loaded bill ${loadedBill.id} for ${loadedBill.patientName}`);
    } catch (err: any) {
      toast.error("Database search error: " + err.message);
    } finally {
      setRemoteSearching(false);
    }
  };

  const handleSelectBill = (b: Bill) => {
    setFoundId(b.id);
    setRemoteBill(b);
    setSelectedMedicineId(null);
    setRefundQty(1);
  };

  const goBack = () => {
    setFoundId(null);
    setRemoteBill(null);
    setSelectedMedicineId(null);
    setRefundQty(1);
  };

  // Find active selected bill (from memory or remote)
  const bill = foundId
    ? bills.find((b) => b.id === foundId) || remoteBill
    : null;

  const selectedItem = bill?.items.find((it) => it.medicineId === selectedMedicineId);
  const maxRef = selectedItem
    ? selectedItem.quantity - (selectedItem.refundedQuantity || 0)
    : 0;
  const effectiveRate = selectedItem && bill
    ? selectedItem.price * (1 - (bill.discountPct || 0) / 100)
    : 0;

  const visibleBills = filteredBills.slice(0, limit);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center">
            <Undo2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Returns &amp; Refunds</h2>
            <p className="text-xs text-muted-foreground">Search any historical bill by ID, patient name, or medicine to refund items</p>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar (Always visible) */}
      {!bill && (
        <div className="space-y-3 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by Bill ID, Patient Name, Patient ID, or Medicine..."
                className="pl-9 h-11"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (filteredBills.length === 1) {
                      handleSelectBill(filteredBills[0]);
                    } else if (filteredBills.length === 0) {
                      handleRemoteSearch();
                    }
                  }
                }}
              />
            </div>
            {q.trim() && (
              <Button
                variant="outline"
                onClick={handleRemoteSearch}
                disabled={remoteSearching}
                className="h-11 px-4 whitespace-nowrap"
                title="Search entire database"
              >
                {remoteSearching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Database Search
              </Button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Status filters */}
            <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
              {(["refundable", "all", "paid", "refunded"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {s === "refundable" ? "Refundable Bills" : s}
                </button>
              ))}
            </div>

            {/* Date range filters */}
            <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
              {(["all", "month", "week", "today"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRangeFilter(r)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition ${
                    rangeFilter === r
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {r === "all" ? "All Time" : r === "month" ? "This Month" : r === "week" ? "Last 7 Days" : "Today"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Bill Refund Interface */}
      {bill && (
        <div className="rounded-xl border p-5 bg-card/60 space-y-4">
          {/* Back button */}
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-destructive font-semibold hover:underline transition-opacity hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" /> Back to bill search &amp; list
          </button>

          {/* Bill summary header */}
          <div className="flex items-start justify-between border-b pb-4 flex-wrap gap-3">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Bill ID</div>
              <div className="font-mono font-bold text-xl text-primary">{bill.id}</div>
              <div className="text-sm mt-1 flex items-center gap-2">
                <span className="font-semibold text-foreground">{bill.patientName}</span>
                {bill.patientId && <span className="text-muted-foreground font-mono">({bill.patientId})</span>}
                {bill.doctorName && <span className="text-muted-foreground">• Dr. {bill.doctorName}</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateTime(bill.createdAt)}
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant={
                  bill.status === "paid"
                    ? "default"
                    : bill.status === "refunded"
                    ? "destructive"
                    : "secondary"
                }
                className="text-xs uppercase"
              >
                {bill.status.replace("_", " ")}
              </Badge>
              <div className="text-lg font-bold mt-1">₹{getBillOriginalTotal(bill).toFixed(2)}</div>
              {getBillNetTotal(bill) !== getBillOriginalTotal(bill) && (
                <div className="text-xs font-semibold text-success">Net after refunds: ₹{getBillNetTotal(bill).toFixed(2)}</div>
              )}
              {bill.discountPct > 0 && (
                <div className="text-xs text-muted-foreground">({bill.discountPct}% bill discount applied)</div>
              )}
            </div>
          </div>

          {/* Step 1: Select item to refund */}
          {!selectedMedicineId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Select Item from this Bill to Refund
                </p>
                <span className="text-xs text-muted-foreground">Click any eligible line to return</span>
              </div>

              <div className="space-y-2">
                {bill.items.map((it, i) => {
                  const max = it.quantity - (it.refundedQuantity || 0);
                  const isFullyRefunded = max <= 0;
                  const itemRate = it.price * (1 - (bill.discountPct || 0) / 100);

                  return (
                    <button
                      key={i}
                      disabled={isFullyRefunded || bill.status === "refunded"}
                      onClick={() => {
                        setSelectedMedicineId(it.medicineId);
                        setRefundQty(Math.min(1, max));
                      }}
                      className={`w-full text-left rounded-lg border p-3.5 transition flex justify-between items-center text-sm ${
                        isFullyRefunded || bill.status === "refunded"
                          ? "opacity-50 cursor-not-allowed bg-muted/20"
                          : "hover:border-primary hover:bg-primary/5 cursor-pointer bg-background"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isFullyRefunded ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {it.name}
                          </span>
                          {it.batchId && (
                            <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {it.batchId}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Purchased: <strong>{it.quantity}</strong> | Already Refunded: <strong>{it.refundedQuantity || 0}</strong> | Refundable: <strong className={max > 0 ? "text-green-600 font-bold" : ""}>{max}</strong>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4 flex items-center gap-3">
                        <div>
                          <div className="font-bold">₹{itemRate.toFixed(2)}/unit</div>
                          {bill.discountPct > 0 && (
                            <div className="text-[10px] text-muted-foreground line-through">MRP: ₹{it.price.toFixed(2)}</div>
                          )}
                        </div>
                        {isFullyRefunded ? (
                          <Badge variant="secondary" className="text-[10px]">Fully Refunded</Badge>
                        ) : (
                          <div className="p-1.5 rounded-md bg-brand-red/10 text-brand-red font-medium text-xs flex items-center gap-1">
                            Refund <ChevronRight className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Confirm refund quantity and execute */}
          {selectedMedicineId && selectedItem && (
            <div className="border-t pt-4 space-y-4">
              <button
                onClick={() => { setSelectedMedicineId(null); setRefundQty(1); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Select a different item from this bill
              </button>

              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-base">{selectedItem.name}</div>
                  <Badge variant="outline" className="font-mono">Max: {maxRef} units</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  MRP: ₹{selectedItem.price.toFixed(2)}
                  {bill.discountPct > 0 && ` − ${bill.discountPct}% discount = ₹${effectiveRate.toFixed(2)} effective refund rate`}
                </div>
              </div>

              <div className="flex items-center gap-4 bg-background p-4 rounded-lg border">
                <div>
                  <label className="text-sm font-semibold block mb-1">Quantity to Return</label>
                  <p className="text-xs text-muted-foreground">Restores stock to pharmacy dispensing inventory</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    type="number"
                    className="h-10 w-28 text-center font-bold text-base"
                    min={1}
                    max={maxRef}
                    value={refundQty}
                    onChange={(e) => {
                      let val = parseInt(e.target.value) || 1;
                      if (val > maxRef) val = maxRef;
                      if (val < 1) val = 1;
                      setRefundQty(val);
                    }}
                  />
                  <span className="text-sm text-muted-foreground font-medium">/ {maxRef} max</span>
                </div>
              </div>

              <div className="flex justify-between items-center font-bold text-xl border-t pt-4 px-2">
                <span className="text-muted-foreground text-sm uppercase tracking-wider">Total Refund Amount</span>
                <span className="text-2xl text-destructive font-extrabold">₹{(effectiveRate * refundQty).toFixed(2)}</span>
              </div>

              <Button
                disabled={bill.status === "refunded" || processing || refundQty <= 0 || refundQty > maxRef}
                variant="destructive"
                className="w-full h-12 text-base font-bold shadow-sm"
                onClick={async () => {
                  setProcessing(true);
                  try {
                    await refundItems(bill.id, [
                      {
                        medicineId: selectedMedicineId,
                        quantity: refundQty,
                        qty: refundQty,
                        name: selectedItem.name,
                      },
                    ]);
                    toast.success(`Successfully refunded ${refundQty} units of ${selectedItem.name}! Stock returned to pharmacy.`);
                    setSelectedMedicineId(null);
                    setRefundQty(1);
                  } catch (e: any) {
                    toast.error("Refund failed: " + e.message);
                  } finally {
                    setProcessing(false);
                  }
                }}
              >
                {processing ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing Refund…</>
                ) : (
                  <><RefreshCcw className="h-5 w-5 mr-2" /> Confirm &amp; Process Refund — ₹{(effectiveRate * refundQty).toFixed(2)}</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Full Historical Bills List when no single bill is selected */}
      {!bill && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {statusFilter === "refundable" ? "Refundable Bills" : "All Bills"} ({filteredBills.length} found)
            </div>
            <span className="text-xs text-muted-foreground">Click any bill to initiate returns</span>
          </div>

          {visibleBills.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed text-muted-foreground bg-muted/10 space-y-3">
              <FileText className="h-10 w-10 mx-auto opacity-30" />
              <div className="text-sm font-semibold">No bills match your current filters</div>
              <p className="text-xs max-w-sm mx-auto">
                {q.trim()
                  ? `No matches found for "${q}". Try clicking 'Database Search' above to search the complete server archive.`
                  : "Try switching the status filter to 'All' or date range to 'All Time'."}
              </p>
              {q.trim() && (
                <Button variant="outline" size="sm" onClick={handleRemoteSearch} disabled={remoteSearching}>
                  {remoteSearching ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
                  Search Complete Database for "{q}"
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleBills.map((b) => {
                const itemsCount = b.items?.reduce((s, it) => s + it.quantity, 0) || 0;
                const refundedCount = b.items?.reduce((s, it) => s + (it.refundedQuantity || 0), 0) || 0;

                return (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBill(b)}
                    className="w-full text-left rounded-xl border p-4 bg-card hover:border-primary/50 hover:bg-primary/[0.03] transition-all flex items-start justify-between gap-4 group"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                          {b.id}
                        </span>
                        <Badge
                          variant={
                            b.status === "paid"
                              ? "default"
                              : b.status === "refunded"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px] capitalize"
                        >
                          {b.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(b.createdAt)} · {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span>{b.patientName}</span>
                        {b.patientId && <span className="text-xs text-muted-foreground font-mono">({b.patientId})</span>}
                        {b.doctorName && <span className="text-xs text-muted-foreground font-normal">· Dr. {b.doctorName}</span>}
                      </div>

                      <div className="text-xs text-muted-foreground truncate" title={b.items?.map((it) => it.name).join(", ")}>
                        <strong>Items:</strong> {b.items?.map((it) => `${it.name} (x${it.quantity})`).join(", ") || "No items"}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end">
                      <div className="font-bold text-base text-foreground">₹{getBillNetTotal(b).toFixed(2)}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {itemsCount} units {refundedCount > 0 && <span className="text-brand-red">({refundedCount} returned)</span>}
                      </div>
                      <div className="mt-2 text-xs font-semibold text-brand-red opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Refund Items <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination / Load more */}
          {filteredBills.length > limit && (
            <div className="pt-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 20)}>
                Load More Bills (Showing {limit} of {filteredBills.length})
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
