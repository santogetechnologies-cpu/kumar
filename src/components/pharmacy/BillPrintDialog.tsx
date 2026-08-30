import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import type { Bill } from "@/lib/pharmacy-store";

interface BillPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill | null;
  format: string;
}

export function BillPrintDialog({ open, onOpenChange, bill, format }: BillPrintDialogProps) {
  if (!bill) return null;

  const isThermal = format === "Thermal";
  const isLandscape = format === "A4-Landscape";
  const isDotMatrix = format === "DotMatrix";

  const handlePrint = () => {
    const printContent = document.getElementById("printable-bill");
    if (!printContent) return;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Copy Tailwind styles from the main document
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((s) => s.outerHTML)
      .join("");

    iframeDoc.write(`
      <html>
        <head>
          <title>Print Bill</title>
          ${styles}
          <style>
            @page {
              size: ${isThermal ? "80mm auto" : isLandscape ? "A4 landscape" : "A4 portrait"};
              margin: 0;
            }
            body {
              margin: 0;
              padding: ${isThermal ? "4mm" : isDotMatrix ? "5mm" : "12mm"};
              -webkit-print-color-adjust: exact;
              box-sizing: border-box;
            }
            #printable-bill {
              width: 100% !important;
              max-width: ${isThermal ? "80mm" : isLandscape ? "297mm" : "210mm"} !important;
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

  // Portrait = A4-Portrait or legacy "A4"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-muted/20">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">Print Bill</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Format: {isThermal ? "Thermal 80mm" : isLandscape ? "A4 Landscape (Horizontal)" : isDotMatrix ? "Dot Matrix" : "A4 Portrait (Vertical)"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}><X className="h-4 w-4 mr-2"/>Close</Button>
            <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-2"/>Print</Button>
          </div>
        </div>

        <div className="flex justify-center bg-muted py-6 rounded-lg overflow-auto max-h-[72vh]">
          {/* Bill Printable Area */}
          <div
            id="printable-bill"
            className={`bg-white text-black shadow-sm print:shadow-none mx-auto ${
              isThermal
                ? "w-[80mm] text-[12px] p-4"
                : isLandscape
                ? "w-[297mm] min-h-[210mm] text-sm p-10"
                : isDotMatrix
                ? "w-[210mm] font-mono text-sm p-6"
                : "w-[210mm] min-h-[297mm] text-sm p-10"
            }`}
          >
            {/* Header */}
            <div className={`text-center border-b pb-4 mb-5 ${isThermal ? "border-dashed" : ""}`}>
              <h1 className={`${isThermal ? "text-xl" : "text-3xl"} font-bold uppercase tracking-wider`}>
                KUMAR HMIS
              </h1>
              <p className="text-gray-500 mt-1 text-sm">Trivandrum - Nagercoil Highway, Manali Junction, Thuckalay, Tamil Nadu - 629175</p>
              <p className="text-gray-500 text-sm">Ph: +91 9876543210</p>
              <h2 className="font-bold mt-3 uppercase border bg-gray-100 py-1 text-sm tracking-widest">Cash Receipt</h2>
            </div>

            {/* Patient + Bill Meta — landscape gets a 3-col layout */}
            <div className={`mb-6 ${isLandscape ? "grid grid-cols-3 gap-6" : isThermal ? "flex flex-col gap-2" : "flex justify-between"}`}>
              <div className="space-y-1 text-sm">
                <p><strong>Patient Name:</strong> {bill.patientName}</p>
                {bill.patientId && <p><strong>Patient ID:</strong> {bill.patientId}</p>}
                {bill.doctorName && <p><strong>Doctor:</strong> {bill.doctorName}</p>}
              </div>
              {isLandscape && (
                <div className="space-y-1 text-sm text-center">
                  <p className="font-bold text-base">{bill.id}</p>
                  <p className="text-gray-500 text-xs">Bill Number</p>
                </div>
              )}
              <div className={`space-y-1 text-sm ${!isThermal && !isLandscape ? "text-right" : ""}`}>
                <p><strong>Bill No:</strong> {bill.id}</p>
                <p><strong>Date:</strong> {new Date(bill.createdAt).toLocaleString()}</p>
                <p><strong>Billed By:</strong> {bill.createdBy || "Admin"}</p>
                <p><strong>Payment:</strong> <span className="uppercase">{bill.paymentMethod}</span></p>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-left mb-6 border-collapse text-sm">
              <thead>
                <tr className="border-y bg-gray-50">
                  <th className="py-2 px-2 font-semibold">Item</th>
                  {isLandscape && <th className="py-2 px-2 font-semibold">Batch</th>}
                  <th className="py-2 px-2 text-right font-semibold">Qty</th>
                  <th className="py-2 px-2 text-right font-semibold">Rate</th>
                  <th className="py-2 px-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className={isThermal ? "text-[11px]" : ""}>
                {bill.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 px-2">{it.name}</td>
                    {isLandscape && <td className="py-2 px-2 text-gray-500 text-xs font-mono">—</td>}
                    <td className="py-2 px-2 text-right">{it.quantity}</td>
                    <td className="py-2 px-2 text-right">₹{it.price.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-semibold">₹{(it.price * it.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className={`space-y-1.5 ${isThermal ? "w-full" : isLandscape ? "w-1/3" : "w-1/2"}`}>
                {(() => {
                  const grossTotal = bill.items.reduce((s, it) => s + it.price * it.quantity, 0);
                  const discountAmt = grossTotal * (bill.discountPct || 0) / 100;
                  return (
                    <>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Gross Total:</span>
                        <span>₹{grossTotal.toFixed(2)}</span>
                      </div>
                      {(bill.discountPct || 0) > 0 && (
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Discount ({bill.discountPct}%):</span>
                          <span className="text-green-600">-₹{discountAmt.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-1">
                        <span>Net Amount:</span>
                        <span>₹{bill.total.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-10 pt-4 border-t text-gray-400 text-xs">
              <p>Thank you for your visit!</p>
              <p>Get well soon. — Kumar HMIS</p>
            </div>
          </div>
        </div>

        {/* Global Print Styles (Fallback if ever needed, but handled by iframe now) */}
        <style dangerouslySetInnerHTML={{__html: `
          /* No screen-level media print needed anymore since we use iframe printing */
        `}} />
      </DialogContent>
    </Dialog>
  );
}
