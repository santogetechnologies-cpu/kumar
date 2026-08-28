import { useState, useMemo } from "react";
import { usePharmacy, getEffectiveMinLevel } from "@/lib/pharmacy-store";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Settings2, RotateCcw, Save, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

export function MinStockConfigTab() {
  const { medicines, materials, generalMinStock, updateGeneralMinStock, updateMedicineMinStock } = usePharmacy();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  // General min stock editing
  const [generalInput, setGeneralInput] = useState<string>(String(generalMinStock));
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Per-item search
  const [q, setQ] = useState("");
  const [itemType, setItemType] = useState<"medicine" | "material">("medicine");

  // Per-item editing state: map of id -> pending value
  const [pendingValues, setPendingValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const allItems = useMemo(() => {
    const meds = medicines.map((m) => ({ ...m, _type: "medicine" as const }));
    const mats = materials.map((m) => ({ ...m, _type: "material" as const }));
    return itemType === "medicine" ? meds : mats;
  }, [medicines, materials, itemType]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return allItems;
    // Group by name
    const seen = new Set<string>();
    return allItems.filter((item) => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return item.name.toLowerCase().includes(t);
    });
  }, [allItems, q]);

  // Deduplicate by name — show one row per medicine name with the effective min
  const deduped = useMemo(() => {
    const map = new Map<string, typeof filtered[0]>();
    for (const item of filtered) {
      if (!map.has(item.name)) {
        map.set(item.name, item);
      } else {
        // If any batch has a custom min, prefer that row
        const existing = map.get(item.name)!;
        if (item.customMinLevel !== null && existing.customMinLevel === null) {
          map.set(item.name, item);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const handleSaveGeneral = async () => {
    const val = parseInt(generalInput, 10);
    if (isNaN(val) || val < 0) {
      toast.error("Please enter a valid non-negative number");
      return;
    }
    setSavingGeneral(true);
    try {
      await updateGeneralMinStock(val);
      toast.success(`General minimum stock updated to ${val}`);
    } catch (e: any) {
      toast.error("Failed to update: " + e.message);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveItemMin = async (item: typeof deduped[0]) => {
    const rawVal = pendingValues[item.id];
    if (rawVal === undefined || rawVal === "") {
      toast.error("Enter a value or use Reset to General Default");
      return;
    }
    const val = parseInt(rawVal, 10);
    if (isNaN(val) || val < 0) {
      toast.error("Please enter a valid non-negative number");
      return;
    }
    setSavingId(item.id);
    try {
      // Update ALL batches of this medicine/material name
      const allBatches = allItems.filter((i) => i.name === item.name);
      for (const batch of allBatches) {
        await updateMedicineMinStock(batch.id, val, item._type);
      }
      setPendingValues((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
      toast.success(`Custom minimum stock for ${item.name} set to ${val}`);
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleResetToDefault = async (item: typeof deduped[0]) => {
    setSavingId(item.id);
    try {
      // Reset ALL batches of this medicine/material name
      const allBatches = allItems.filter((i) => i.name === item.name);
      for (const batch of allBatches) {
        await updateMedicineMinStock(batch.id, null, item._type);
      }
      setPendingValues((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
      toast.success(`${item.name} will now use the General Minimum Stock (${generalMinStock})`);
    } catch (e: any) {
      toast.error("Failed to reset: " + e.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── General Min Stock ── */}
      <Card className="p-5 border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">General Minimum Stock Level</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              This default applies to all medicines/materials <em>without</em> a custom minimum configured.
            </p>
          </div>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning mb-4">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>Only Admin can change the General Minimum Stock setting.</span>
          </div>
        )}

        <div className="flex items-end gap-3 max-w-sm">
          <div className="flex-1">
            <Label htmlFor="general-min-stock" className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Default Minimum Stock
            </Label>
            <Input
              id="general-min-stock"
              type="number"
              min={0}
              value={generalInput}
              onChange={(e) => setGeneralInput(e.target.value)}
              disabled={!isAdmin || savingGeneral}
              className="mt-1.5 h-10"
              placeholder="e.g. 10"
            />
          </div>
          {isAdmin && (
            <Button onClick={handleSaveGeneral} disabled={savingGeneral} className="h-10">
              {savingGeneral ? "Saving…" : <><Save className="h-4 w-4 mr-1.5" />Save</>}
            </Button>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Current general minimum: <strong>{generalMinStock}</strong> units.
            Any medicine/material with a custom value set below will use <em>that</em> value instead.
          </span>
        </div>
      </Card>

      {/* ── Per-Item Config ── */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Medicine / Material Minimum Stock Override</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set a custom minimum for individual items. This overrides the general default for that item only.
            </p>
          </div>
        </div>

        {/* Type Toggle + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex rounded-lg border p-1 gap-1">
            {(["medicine", "material"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setItemType(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  itemType === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {t === "medicine" ? "Medicines" : "Materials"}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${itemType}s by name…`}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-primary/20 border border-primary/40" />
            Custom value set
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-muted border border-border" />
            Using general default ({generalMinStock})
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Medicine / Material", "Effective Min", "Source", "Custom Override", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deduped.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    {q ? `No ${itemType}s matching "${q}"` : `No ${itemType}s found`}
                  </td>
                </tr>
              )}
              {deduped.map((item) => {
                const effectiveMin = getEffectiveMinLevel(item, generalMinStock);
                const hasCustom = item.customMinLevel !== null;
                const isSaving = savingId === item.id;
                const pendingVal = pendingValues[item.id];
                const displayVal = pendingVal !== undefined ? pendingVal : (item.customMinLevel !== null ? String(item.customMinLevel) : "");

                return (
                  <tr key={item.id} className="border-t hover:bg-muted/20 transition-colors">
                    {/* Name */}
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.category}</div>
                    </td>

                    {/* Effective Min */}
                    <td className="px-3 py-2.5">
                      <span className={`font-bold text-base ${hasCustom ? "text-primary" : "text-foreground"}`}>
                        {effectiveMin}
                      </span>
                    </td>

                    {/* Source Badge */}
                    <td className="px-3 py-2.5">
                      {hasCustom ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 text-[11px]">
                          Custom ({item.customMinLevel})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          General ({generalMinStock})
                        </Badge>
                      )}
                    </td>

                    {/* Custom Value Input */}
                    <td className="px-3 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        value={displayVal}
                        onChange={(e) =>
                          setPendingValues((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder={`Default: ${generalMinStock}`}
                        disabled={isSaving}
                        className="h-8 w-28 text-sm"
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSaveItemMin(item)}
                          disabled={isSaving || pendingVal === undefined || pendingVal === ""}
                        >
                          {isSaving ? "…" : <><Save className="h-3 w-3 mr-1" />Save</>}
                        </Button>
                        {hasCustom && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleResetToDefault(item)}
                            disabled={isSaving}
                            title={`Reset to General Default (${generalMinStock})`}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reset
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {deduped.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Showing {deduped.length} {itemType}(s).
            {q && ` Filtered by "${q}".`}
          </p>
        )}
      </Card>

      {/* Priority explanation */}
      <Card className="p-4 bg-muted/30 border-dashed">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          Minimum Stock Priority Logic
        </h4>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>
            <strong>Medicine-specific custom value</strong> — if set, this always takes priority for that medicine.
          </li>
          <li>
            <strong>General Admin minimum stock</strong> — used for all medicines/materials without a custom value.
          </li>
        </ol>
        <div className="mt-3 rounded-lg bg-background border p-3 text-xs">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left pb-1">Medicine</th>
                <th className="text-left pb-1">Custom Min</th>
                <th className="text-left pb-1">General Min</th>
                <th className="text-left pb-1 font-bold text-foreground">Effective Min Used</th>
              </tr>
            </thead>
            <tbody className="text-foreground/80">
              <tr>
                <td className="py-0.5">Medicine A</td>
                <td>5</td>
                <td>{generalMinStock}</td>
                <td className="font-semibold text-primary">5</td>
              </tr>
              <tr>
                <td className="py-0.5">Medicine B</td>
                <td className="text-muted-foreground">—</td>
                <td>{generalMinStock}</td>
                <td className="font-semibold">{generalMinStock}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
