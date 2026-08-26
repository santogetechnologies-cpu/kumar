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

  const handlePrint = () => {
    window.print();
  };

  const isThermal = format === "Thermal";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-muted/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Print Bill</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}><X className="h-4 w-4 mr-2"/> Close</Button>
            <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-2"/> Print</Button>
          </div>
        </div>

        <div className="flex justify-center bg-muted py-6 rounded-lg overflow-auto max-h-[70vh]">
          {/* Bill Printable Area */}
          <div 
            id="printable-bill"
            className={`bg-white text-black p-8 shadow-sm print:shadow-none print:m-0 print:p-0 ${
              isThermal ? "w-[80mm] text-[12px] p-4" : "w-[210mm] min-h-[297mm] text-sm"
            }`}
          >
            <div className={`text-center border-b pb-4 mb-4 ${isThermal ? 'border-dashed' : ''}`}>
              <h1 className={`${isThermal ? 'text-xl' : 'text-3xl'} font-bold uppercase tracking-wider`}>KUMAR HMIS</h1>
              <p className="text-gray-600 mt-1">123 Health Avenue, Medical District</p>
              <p className="text-gray-600">Ph: +91 9876543210</p>
              <h2 className="font-bold mt-4 uppercase border bg-gray-100 py-1">Cash Receipt</h2>
            </div>
            
            <div className={`flex justify-between mb-6 ${isThermal ? 'flex-col gap-2' : ''}`}>
              <div>
                <p><strong>Patient Name:</strong> {bill.patientName}</p>
                {bill.patientId && <p><strong>Patient ID:</strong> {bill.patientId}</p>}
                {bill.doctorName && <p><strong>Doctor:</strong> {bill.doctorName}</p>}
              </div>
              <div className={isThermal ? 'text-left' : 'text-right'}>
                <p><strong>Bill No:</strong> {bill.id}</p>
                <p><strong>Date:</strong> {new Date(bill.createdAt).toLocaleString()}</p>
                <p><strong>Billed By:</strong> {bill.createdBy || "Admin"}</p>
              </div>
            </div>

            <table className="w-full text-left mb-6 border-collapse">
              <thead>
                <tr className="border-y bg-gray-50">
                  <th className="py-2 px-1">Item</th>
                  <th className="py-2 px-1 text-right">Qty</th>
                  <th className="py-2 px-1 text-right">Rate</th>
                  <th className="py-2 px-1 text-right">Amt</th>
                </tr>
              </thead>
              <tbody className={isThermal ? 'text-[11px]' : ''}>
                {bill.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 px-1">{it.name}</td>
                    <td className="py-2 px-1 text-right">{it.quantity}</td>
                    <td className="py-2 px-1 text-right">₹{it.price.toFixed(2)}</td>
                    <td className="py-2 px-1 text-right">₹{(it.price * it.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className={`space-y-1 ${isThermal ? 'w-full' : 'w-1/2'}`}>
                {bill.discountPct > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Discount:</span>
                    <span>{bill.discountPct}%</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Net Amount:</span>
                  <span>₹{bill.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Payment Mode:</span>
                  <span className="uppercase">{bill.paymentMethod}</span>
                </div>
              </div>
            </div>

            <div className="text-center mt-12 pt-4 border-t text-gray-500 text-sm">
              <p>Thank you for your visit!</p>
              <p>Get well soon.</p>
            </div>
          </div>
        </div>

        {/* Global Print Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            #printable-bill, #printable-bill * { visibility: visible; }
            #printable-bill { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: ${isThermal ? '80mm' : '100%'} !important; 
            }
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}
