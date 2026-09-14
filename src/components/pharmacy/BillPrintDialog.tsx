import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, X, FileText } from "lucide-react";
import type { Bill } from "@/lib/pharmacy-store";

export function normalizePrintFormat(format?: string): string {
  if (!format) return "A4-Portrait";
  const f = format.trim().toLowerCase();
  if (f === "thermal" || f === "80mm") return "Thermal";
  if (f === "a4-landscape" || f === "landscape" || f === "a4_landscape") return "A4-Landscape";
  if (f === "a4-portrait" || f === "portrait" || f === "a4" || f === "a4_portrait") return "A4-Portrait";
  if (f === "a5-portrait" || f === "a5" || f === "a5_portrait") return "A5-Portrait";
  if (f === "a5-landscape" || f === "a5_landscape") return "A5-Landscape";
  if (f === "dotmatrix" || f === "dot-matrix" || f === "dot_matrix") return "DotMatrix";
  return format;
}

interface BillPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill | null;
  format: string;
}

export function BillPrintDialog({ open, onOpenChange, bill, format }: BillPrintDialogProps) {
  const [activeFormat, setActiveFormat] = useState(() => normalizePrintFormat(format));

  useEffect(() => {
    setActiveFormat(normalizePrintFormat(format));
  }, [format, open]);

  if (!bill) return null;

  const isThermal = activeFormat === "Thermal";
  const isA4Landscape = activeFormat === "A4-Landscape";
  const isA5Landscape = activeFormat === "A5-Landscape";
  const isA5Portrait = activeFormat === "A5-Portrait";
  const isDotMatrix = activeFormat === "DotMatrix";
  const isA4Portrait = activeFormat === "A4-Portrait" || (!isThermal && !isA4Landscape && !isA5Landscape && !isA5Portrait && !isDotMatrix);

  const isAnyLandscape = isA4Landscape || isA5Landscape;
  const isA5 = isA5Portrait || isA5Landscape;

  const handlePrint = () => {
    const printContent = document.getElementById("printable-bill");
    if (!printContent) return;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Determine @page size and container constraints
    let pageSize = "A4 portrait";
    let maxWidth = "210mm";
    let bodyPadding = "10mm";

    if (isThermal) {
      pageSize = "80mm auto";
      maxWidth = "80mm";
      bodyPadding = "3mm";
    } else if (isA5Landscape) {
      pageSize = "A5 landscape";
      maxWidth = "210mm";
      bodyPadding = "5mm";
    } else if (isA5Portrait) {
      pageSize = "A5 portrait";
      maxWidth = "148mm";
      bodyPadding = "5mm";
    } else if (isA4Landscape) {
      pageSize = "A4 landscape";
      maxWidth = "297mm";
      bodyPadding = "8mm";
    } else if (isDotMatrix) {
      pageSize = "A4 portrait";
      maxWidth = "210mm";
      bodyPadding = "5mm";
    } else {
      pageSize = "A4 portrait";
      maxWidth = "210mm";
      bodyPadding = "10mm";
    }

    // Copy styles from the main document
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((s) => s.outerHTML)
      .join("");

    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Bill - ${bill.id}</title>
          ${styles}
          <style>
            @page {
              size: ${pageSize};
              margin: 0;
            }
            @media print {
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
              }
            }
            body {
              margin: 0;
              padding: ${bodyPadding};
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              box-sizing: border-box;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            #printable-bill {
              width: 100% !important;
              max-width: ${maxWidth} !important;
              box-sizing: border-box;
              box-shadow: none !important;
              margin: 0 auto !important;
            }
          </style>
        </head>
        <body>
          ${printContent.outerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Wait for styles to apply before triggering print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  const getFormatLabel = () => {
    switch (activeFormat) {
      case "A4-Portrait": return "A4 Portrait (210×297mm)";
      case "A4-Landscape": return "A4 Landscape (297×210mm)";
      case "A5-Portrait": return "A5 Portrait (148×210mm)";
      case "A5-Landscape": return "A5 Landscape (210×148mm)";
      case "Thermal": return "Thermal Receipt (80mm)";
      case "DotMatrix": return "Dot Matrix Continuous";
      default: return activeFormat;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-muted/30">
        <DialogHeader className="sr-only">
          <DialogTitle>Print Bill {bill.id}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-bold leading-none">Print Bill</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current format: <span className="font-semibold text-foreground">{getFormatLabel()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-background border rounded-lg px-2 py-1">
              <span className="text-xs text-muted-foreground font-medium">Format:</span>
              <Select value={activeFormat} onValueChange={setActiveFormat}>
                <SelectTrigger className="h-7 w-44 text-xs border-0 shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4-Portrait">A4 Portrait (Vertical)</SelectItem>
                  <SelectItem value="A4-Landscape">A4 Landscape (Horizontal)</SelectItem>
                  <SelectItem value="A5-Portrait">A5 Portrait (Vertical)</SelectItem>
                  <SelectItem value="A5-Landscape">A5 Landscape (Horizontal)</SelectItem>
                  <SelectItem value="Thermal">Thermal Receipt (80mm)</SelectItem>
                  <SelectItem value="DotMatrix">Dot Matrix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1.5" /> Close
            </Button>
            <Button size="sm" onClick={handlePrint} className="bg-primary hover:bg-primary/90">
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
          </div>
        </div>

        <div className="flex justify-center bg-muted/60 p-4 rounded-lg overflow-auto max-h-[70vh]">
          {/* Bill Printable Area */}
          <div
            id="printable-bill"
            className={`bg-white text-black shadow-md print:shadow-none mx-auto transition-all ${
              isThermal
                ? "w-[80mm] text-[12px] p-4"
                : isA5Portrait
                ? "w-[148mm] min-h-[210mm] text-xs p-5"
                : isA5Landscape
                ? "w-[210mm] min-h-[148mm] text-xs p-5"
                : isA4Landscape
                ? "w-[297mm] min-h-[210mm] text-sm p-8"
                : isDotMatrix
                ? "w-[210mm] font-mono text-sm p-6"
                : "w-[210mm] min-h-[297mm] text-sm p-8"
            }`}
          >
            {/* Header */}
            <div className={`text-center border-b pb-3 mb-4 ${isThermal ? "border-dashed" : ""}`}>
              <h1 className={`${isThermal ? "text-lg" : isA5 ? "text-xl font-black" : "text-2xl font-bold"} uppercase tracking-wider`}>
                KUMAR HMIS
              </h1>
              <p className={`text-gray-600 mt-0.5 ${isThermal || isA5 ? "text-[11px]" : "text-xs"}`}>
                Trivandrum - Nagercoil Highway, Manali Junction, Thuckalay, Tamil Nadu - 629175
              </p>
              <p className={`text-gray-600 ${isThermal || isA5 ? "text-[11px]" : "text-xs"}`}>
                Ph: +91 9876543210
              </p>
              <h2 className={`font-bold mt-2 uppercase border bg-gray-100 py-0.5 tracking-widest ${isThermal || isA5 ? "text-xs" : "text-sm"}`}>
                Cash Receipt
              </h2>
            </div>

            {/* Patient + Bill Meta */}
            <div className={`mb-4 ${
              isA4Landscape
                ? "grid grid-cols-3 gap-4"
                : isThermal
                ? "flex flex-col gap-1 text-[11px]"
                : isA5Landscape
                ? "grid grid-cols-2 gap-4 text-xs"
                : isA5Portrait
                ? "grid grid-cols-2 gap-2 text-xs"
                : "flex justify-between text-sm"
            }`}>
              <div className="space-y-0.5">
                <p><strong>Patient Name:</strong> {bill.patientName}</p>
                {bill.patientId && <p><strong>Patient ID:</strong> {bill.patientId}</p>}
                {bill.doctorName && <p><strong>Doctor:</strong> {bill.doctorName}</p>}
              </div>

              {isA4Landscape && (
                <div className="space-y-0.5 text-center">
                  <p className="font-bold text-sm">{bill.id}</p>
                  <p className="text-gray-500 text-[11px]">Bill Number</p>
                </div>
              )}

              <div className={`space-y-0.5 ${!isThermal && !isA4Landscape ? "text-right" : ""}`}>
                <p><strong>Bill No:</strong> {bill.id}</p>
                <p><strong>Date:</strong> {new Date(bill.createdAt).toLocaleDateString()} {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p><strong>Billed By:</strong> {bill.createdBy || "Admin"}</p>
                <p><strong>Payment:</strong> <span className="uppercase font-medium">{bill.paymentMethod}</span></p>
              </div>
            </div>

            {/* Items Table */}
            <table className={`w-full text-left mb-4 border-collapse ${isThermal || isA5 ? "text-xs" : "text-sm"}`}>
              <thead>
                <tr className="border-y bg-gray-50">
                  <th className="py-1.5 px-2 font-semibold">Item</th>
                  {isA4Landscape && <th className="py-1.5 px-2 font-semibold">Batch</th>}
                  <th className="py-1.5 px-2 text-right font-semibold">Qty</th>
                  <th className="py-1.5 px-2 text-right font-semibold">Rate</th>
                  <th className="py-1.5 px-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className={isThermal ? "text-[11px]" : ""}>
                {bill.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 px-2">{it.name}</td>
                    {isA4Landscape && <td className="py-1.5 px-2 text-gray-500 text-xs font-mono">—</td>}
                    <td className="py-1.5 px-2 text-right">{it.quantity}</td>
                    <td className="py-1.5 px-2 text-right">₹{it.price.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right font-semibold">₹{(it.price * it.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className={`space-y-1 ${
                isThermal
                  ? "w-full"
                  : isA4Landscape
                  ? "w-1/3"
                  : isA5Landscape
                  ? "w-5/12"
                  : isA5Portrait
                  ? "w-7/12"
                  : "w-1/2"
              }`}>
                {(() => {
                  const grossTotal = bill.items.reduce((s, it) => s + it.price * it.quantity, 0);
                  const discountAmt = grossTotal * (bill.discountPct || 0) / 100;
                  return (
                    <>
                      <div className={`flex justify-between text-gray-600 ${isThermal || isA5 ? "text-xs" : "text-sm"}`}>
                        <span>Gross Total:</span>
                        <span>₹{grossTotal.toFixed(2)}</span>
                      </div>
                      {(bill.discountPct || 0) > 0 && (
                        <div className={`flex justify-between text-gray-600 ${isThermal || isA5 ? "text-xs" : "text-sm"}`}>
                          <span>Discount ({bill.discountPct}%):</span>
                          <span className="text-green-600">-₹{discountAmt.toFixed(2)}</span>
                        </div>
                      )}
                      <div className={`flex justify-between font-bold border-t pt-1.5 mt-1 ${isThermal || isA5 ? "text-sm" : "text-base"}`}>
                        <span>Net Amount:</span>
                        <span>₹{bill.total.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className={`text-center pt-3 border-t text-gray-500 ${isThermal || isA5 ? "mt-6 text-[10px]" : "mt-8 text-xs"}`}>
              <p>Thank you for your visit!</p>
              <p>Get well soon. — Kumar HMIS</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

