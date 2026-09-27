"use client";

import { useState } from "react";
import { Printer, Download, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sendChallanWhatsAppAction } from "./actions";

interface ChallanPrintProps {
  challan: any;
}

export function ChallanPrintView({ challan }: ChallanPrintProps) {
  const [paperSize, setPaperSize] = useState<"A4" | "A5">("A4");
  const [sendingWa, setSendingWa] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = async () => {
    setSendingWa(true);
    try {
      const res = await sendChallanWhatsAppAction(challan.id);
      if (res.success) {
        toast.success(`Delivery Challan sent to ${challan.customerPhone} via WhatsApp!`);
      } else {
        toast.error(res.error || "Failed to send WhatsApp message");
      }
    } catch (err: any) {
      toast.error(err?.message || "WhatsApp delivery error");
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white text-slate-900">
      {/* Control Bar (hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Link href={`/delivery-challans/${challan.id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Details
            </Button>
          </Link>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setPaperSize("A4")}
              className={`px-3 py-1 rounded-md transition-all ${
                paperSize === "A4" ? "bg-white shadow-sm font-semibold text-emerald-800" : "text-slate-600"
              }`}
            >
              A4 Format
            </button>
            <button
              onClick={() => setPaperSize("A5")}
              className={`px-3 py-1 rounded-md transition-all ${
                paperSize === "A5" ? "bg-white shadow-sm font-semibold text-emerald-800" : "text-slate-600"
              }`}
            >
              A5 Format
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleWhatsApp} disabled={sendingWa} variant="outline" size="sm" className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
            <Send className="w-4 h-4" /> {sendingWa ? "Sending..." : "WhatsApp"}
          </Button>
          <Button onClick={handlePrint} size="sm" className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div
        className={`mx-auto bg-white shadow-lg print:shadow-none print:m-0 border print:border-none border-slate-200 p-8 rounded-none font-sans text-slate-800 ${
          paperSize === "A4" ? "max-w-[210mm] min-h-[297mm]" : "max-w-[148mm] min-h-[210mm] text-xs"
        }`}
        style={{
          boxSizing: "border-box",
        }}
      >
        {/* Header Branding */}
        <div className="flex justify-between items-start border-b-2 border-emerald-800 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-lg">
                A
              </div>
              <h1 className="text-2xl font-black text-emerald-950 tracking-tight">AURCLEAN</h1>
            </div>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mt-0.5">
              Laundry Management ERP
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
              {challan.branch?.name || "Main Processing Branch"} • Phone: {challan.branch?.phone || "+91 9876543210"}
            </p>
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 font-extrabold text-sm uppercase rounded tracking-wider mb-2">
              DELIVERY CHALLAN
            </span>
            <p className="text-sm font-bold text-slate-900">Challan No: <span className="font-mono text-emerald-800">{challan.challanNumber}</span></p>
            <p className="text-xs text-slate-600">Date: {formatDate(challan.challanDate)}</p>
            <p className="text-xs text-slate-600">Order No: <span className="font-medium text-slate-900">{challan.order?.orderNumber}</span></p>
          </div>
        </div>

        {/* Customer & Order Metadata Box */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 text-xs">
          <div>
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Customer Details</h3>
            <p className="font-bold text-slate-900 text-sm">{challan.customerName}</p>
            <p className="text-slate-600">Phone: {challan.customerPhone}</p>
            <p className="text-slate-600 mt-0.5 max-w-xs leading-relaxed">{challan.customerAddress || "Address Not Specified"}</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Delivery Details</h3>
            <p className="text-slate-700"><span className="font-semibold">Order Date:</span> {formatDate(challan.order?.placedAt || challan.createdAt)}</p>
            <p className="text-slate-700"><span className="font-semibold">Delivery Date:</span> {formatDate(challan.deliveryDate || new Date())}</p>
            <p className="text-slate-700"><span className="font-semibold">Payment Status:</span> <span className="font-bold uppercase text-emerald-800">{challan.paymentStatus}</span></p>
            <p className="text-slate-700"><span className="font-semibold">Challan Status:</span> <span className="font-bold uppercase text-blue-800">{challan.status.replace(/_/g, " ")}</span></p>
          </div>
        </div>

        {/* Garments Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-emerald-900 text-white font-semibold">
                <th className="py-2.5 px-3 rounded-tl">#</th>
                <th className="py-2.5 px-3">Garment ID</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Service</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right rounded-tr">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border-b border-slate-200">
              {challan.items.map((item: any, idx: number) => (
                <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="py-2.5 px-3 font-medium text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">{item.garmentCode}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{item.category}</td>
                  <td className="py-2.5 px-3 text-slate-600">{item.description}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-medium">{item.service}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900">{item.quantity}</td>
                  <td className="py-2.5 px-3 text-right text-slate-700">{formatCurrency(Number(item.unitPrice))}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(Number(item.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="flex justify-between items-start gap-6 mb-8 text-xs">
          <div className="flex-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Terms & Conditions</h4>
            <p className="text-slate-600 leading-relaxed text-[11px] whitespace-pre-wrap">
              {challan.terms || "Goods once delivered in good condition cannot be returned. Please inspect all garments upon receipt."}
            </p>
            {challan.notes && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Remarks:</span> <span className="text-slate-600">{challan.notes}</span>
              </div>
            )}
          </div>

          <div className="w-64 space-y-1.5 text-right">
            <div className="flex justify-between text-slate-600 py-0.5">
              <span>Subtotal:</span>
              <span className="font-medium text-slate-900">{formatCurrency(Number(challan.subtotal))}</span>
            </div>
            {Number(challan.discountAmount) > 0 && (
              <div className="flex justify-between text-emerald-700 py-0.5">
                <span>Discount:</span>
                <span className="font-medium">-{formatCurrency(Number(challan.discountAmount))}</span>
              </div>
            )}
            {Number(challan.gstAmount) > 0 && (
              <div className="flex justify-between text-slate-600 py-0.5">
                <span>GST ({Number(challan.gstRate)}%):</span>
                <span className="font-medium text-slate-900">{formatCurrency(Number(challan.gstAmount))}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-slate-900 border-t-2 border-slate-900 pt-1.5 mt-1">
              <span>Grand Total:</span>
              <span>{formatCurrency(Number(challan.grandTotal))}</span>
            </div>
            <div className="flex justify-between text-slate-700 py-0.5">
              <span>Amount Paid:</span>
              <span className="font-semibold text-emerald-700">{formatCurrency(Number(challan.paidAmount))}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200 mt-1">
              <span>Balance Due:</span>
              <span>{formatCurrency(Number(challan.balanceAmount))}</span>
            </div>
          </div>
        </div>

        {/* Signature Footer */}
        <div className="mt-12 pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <div className="h-12 flex items-end justify-center">
              <span className="text-slate-400 font-mono text-[10px]">{challan.customerName}</span>
            </div>
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">Customer Signature</div>
          </div>

          <div>
            <div className="h-12 flex items-end justify-center">
              <span className="text-slate-600 font-medium">{challan.deliveredByName || "Courier / Driver"}</span>
            </div>
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">Delivered By</div>
          </div>

          <div>
            <div className="h-12 flex items-end justify-center">
              <span className="text-emerald-900 font-bold">AURCLEAN ERP</span>
            </div>
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}
