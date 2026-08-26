import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { usePharmacy } from "@/lib/pharmacy-store";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "medicine" | "material";
}

export function BulkUploadDialog({ open, onOpenChange, type }: BulkUploadDialogProps) {
  const { addMedicine, addMaterial } = usePharmacy();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const downloadTemplate = () => {
    const headers = "Product,HSN,Batch,Expiry,MRP,PTR,Qty,Free,DisPct,GstPct,Supplier\n";
    const example = type === "medicine" 
      ? "Paracetamol 500mg,3004,B123,2026-12-31,10.0,8.0,100,10,5,12,PharmaCorp\n"
      : "Surgical Mask,9018,SM99,2028-01-01,5.0,4.0,500,50,0,5,MedSupply\n";
    
    const blob = new Blob([headers + example], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_invoice_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim() !== "");
        if (lines.length <= 1) {
          toast.error("CSV file is empty or only contains headers.");
          return;
        }

        const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
        const parsedRows = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map(v => v.trim());
          const row: any = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] || "";
          });
          
          if (row.product && row.batch && row.expiry) {
            parsedRows.push({
              product: row.product,
              hsn: row.hsn || "",
              batch: row.batch,
              expiry: row.expiry,
              mrp: parseFloat(row.mrp) || 0,
              ptr: parseFloat(row.ptr) || 0,
              qty: parseInt(row.qty) || 0,
              free: parseInt(row.free) || 0,
              disPct: parseFloat(row.dispct) || 0,
              gstPct: parseFloat(row.gstpct) || 0,
              supplier: row.supplier || ""
            });
          }
        }
        
        setRows(parsedRows);
        toast.success(`Parsed ${parsedRows.length} valid rows from CSV`);
      } catch (err) {
        toast.error("Failed to parse CSV file. Please ensure it follows the template format.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setLoading(true);
    try {
      let imported = 0;
      for (const row of rows) {
        const payload = {
          name: row.product,
          category: type === "medicine" ? "Tablet" : "Surgical",
          batch: row.batch,
          expiry: row.expiry,
          mainQuantity: row.qty + row.free,
          pharmacyQuantity: 0,
          minLevel: 10,
          price: row.mrp || row.ptr || 0,
          supplier: row.supplier
        };

        if (type === "medicine") {
          await addMedicine(payload);
        } else {
          await addMaterial(payload);
        }
        imported++;
      }
      toast.success(`Successfully imported ${imported} ${type}s`);
      onOpenChange(false);
      setRows([]);
      setFileName(null);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && !loading) {
        onOpenChange(val);
        setRows([]);
        setFileName(null);
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> 
            Bulk Upload {type === "medicine" ? "Medicines" : "Materials"}
          </DialogTitle>
          <DialogDescription>
            Download the CSV template, fill it out, and upload it here to import multiple items at once.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Button variant="outline" className="w-full h-12 border-dashed" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download CSV Template
          </Button>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={loading}
            />
            <Button variant="secondary" className="w-full h-12">
              <Upload className="h-4 w-4 mr-2" /> 
              {fileName ? fileName : "Select CSV File"}
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="bg-success/10 text-success p-3 rounded-lg flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" />
              Ready to import {rows.length} items
            </div>
          )}
          {fileName && rows.length === 0 && (
             <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-sm font-medium">
             <AlertCircle className="h-5 w-5" />
             No valid rows found. Check column headers.
           </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleImport} disabled={loading || rows.length === 0}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</> : "Confirm Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
