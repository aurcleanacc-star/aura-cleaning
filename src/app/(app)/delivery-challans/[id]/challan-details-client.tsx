"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Printer,
  Send,
  CheckCircle,
  Clock,
  Truck,
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  Ban,
  UserCheck,
} from "lucide-react";

import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { updateChallanStatusAction, cancelChallanAction, sendChallanWhatsAppAction } from "../actions";
import type { ChallanStatus, PaymentMethod } from "@/generated/prisma/client";

interface Props {
  challan: any;
}

export function ChallanDetailsClient({ challan }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  // Modals state
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Deliver options state
  const [collectPayment, setCollectPayment] = useState(Number(challan.balanceAmount) > 0);
  const [paymentAmount, setPaymentAmount] = useState<number>(Number(challan.balanceAmount));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [deliveredBy, setDeliveredBy] = useState(challan.deliveredByName || "");
  const [receivedBy, setReceivedBy] = useState(challan.receivedByName || challan.customerName);

  // Cancel state
  const [cancelReason, setCancelReason] = useState("");

  const handleMarkReady = async () => {
    setLoading(true);
    try {
      const res = await updateChallanStatusAction(challan.id, "READY_FOR_DELIVERY");
      if (res.success) {
        toast.success("Delivery Challan marked as Ready for Delivery!");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch (err: any) {
      toast.error(err?.message || "Status update error");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async () => {
    setLoading(true);
    try {
      const res = await updateChallanStatusAction(challan.id, "DELIVERED", {
        deliveredByName: deliveredBy,
        receivedByName: receivedBy,
        paymentAmount: collectPayment ? paymentAmount : 0,
        paymentMethod: collectPayment ? paymentMethod : undefined,
      });

      if (res.success) {
        toast.success("Delivery Challan marked as Delivered!");
        setDeliverModalOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to mark delivered");
      }
    } catch (err: any) {
      toast.error(err?.message || "Delivery error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelChallan = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancelling this challan.");
      return;
    }

    setLoading(true);
    try {
      const res = await cancelChallanAction(challan.id, cancelReason);
      if (res.success) {
        toast.success("Delivery Challan cancelled.");
        setCancelModalOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to cancel challan");
      }
    } catch (err: any) {
      toast.error(err?.message || "Cancellation error");
    } finally {
      setLoading(false);
    }
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

  const statusBadgeColor: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-800 border-slate-300",
    GENERATED: "bg-blue-100 text-blue-900 border-blue-300",
    READY_FOR_DELIVERY: "bg-amber-100 text-amber-900 border-amber-300",
    PARTIALLY_DELIVERED: "bg-indigo-100 text-indigo-900 border-indigo-300",
    DELIVERED: "bg-emerald-100 text-emerald-900 border-emerald-300",
    CANCELLED: "bg-rose-100 text-rose-900 border-rose-300",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/delivery-challans">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Challans
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 font-mono">{challan.challanNumber}</h1>
              <span className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${statusBadgeColor[challan.status]}`}>
                {challan.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Order: <Link href={`/orders/${challan.order.id}`} className="font-semibold text-emerald-800 hover:underline">{challan.order.orderNumber}</Link> • Created on {formatDate(challan.createdAt)}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/delivery-challans/${challan.id}/print`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Printer className="w-4 h-4" /> Print / PDF
            </Button>
          </Link>

          <Button
            onClick={handleWhatsApp}
            disabled={sendingWa}
            variant="outline"
            size="sm"
            className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <Send className="w-4 h-4" /> {sendingWa ? "Sending..." : "WhatsApp Challan"}
          </Button>

          {challan.status === "GENERATED" && (
            <Button onClick={handleMarkReady} disabled={loading} size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Clock className="w-4 h-4" /> Mark Ready for Delivery
            </Button>
          )}

          {(challan.status === "GENERATED" || challan.status === "READY_FOR_DELIVERY" || challan.status === "PARTIALLY_DELIVERED") && (
            <Button onClick={() => setDeliverModalOpen(true)} disabled={loading} size="sm" className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm">
              <CheckCircle className="w-4 h-4" /> Deliver Order
            </Button>
          )}

          {challan.status !== "DELIVERED" && challan.status !== "CANCELLED" && (
            <Button onClick={() => setCancelModalOpen(true)} variant="outline" size="sm" className="gap-2 text-rose-700 border-rose-200 hover:bg-rose-50">
              <Ban className="w-4 h-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer & Delivery Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-sm border-b pb-2 uppercase tracking-wider text-[11px]">Customer & Address</h3>
          <div>
            <p className="font-bold text-slate-900 text-base">{challan.customerName}</p>
            <p className="text-sm font-semibold text-emerald-800 mt-0.5">{challan.customerPhone}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{challan.customerAddress || "Address not provided"}</p>
          </div>
          {challan.customer && (
            <Link href={`/customers/${challan.customer.id}`} className="inline-block text-xs font-semibold text-emerald-700 hover:underline pt-2">
              View Customer Profile →
            </Link>
          )}
        </div>

        {/* Order Details Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-sm border-b pb-2 uppercase tracking-wider text-[11px]">Linked Order</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Order Number:</span>
              <span className="font-bold text-slate-900">{challan.order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Order Date:</span>
              <span className="font-medium text-slate-800">{formatDate(challan.order.placedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Expected Delivery:</span>
              <span className="font-medium text-slate-800">{formatDate(challan.expectedDeliveryDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Order Pieces:</span>
              <span className="font-bold text-slate-900">{challan.order.totalPieces || challan.order.garments?.length || 0}</span>
            </div>
          </div>
          <Link href={`/orders/${challan.order.id}`} className="inline-block text-xs font-semibold text-emerald-700 hover:underline pt-2">
            Open Order Details →
          </Link>
        </div>

        {/* Financial Summary Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-sm border-b pb-2 uppercase tracking-wider text-[11px]">Payment Summary</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Challan Amount:</span>
              <span className="font-semibold text-slate-900">{formatCurrency(Number(challan.grandTotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Paid Amount:</span>
              <span className="font-semibold text-emerald-700">{formatCurrency(Number(challan.paidAmount))}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1.5 border-t">
              <span className="text-slate-800">Balance Due:</span>
              <span className={Number(challan.balanceAmount) > 0 ? "text-amber-800" : "text-emerald-700"}>
                {formatCurrency(Number(challan.balanceAmount))}
              </span>
            </div>
            <div className="pt-2">
              <span className={`inline-block w-full text-center py-1 rounded font-bold uppercase text-[10px] tracking-wider border ${
                challan.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-900 border-amber-200"
              }`}>
                Payment {challan.paymentStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Garment Details Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider text-[11px]">
            Garments Included in Delivery ({challan.items.length})
          </h3>
          <span className="text-xs text-slate-500">
            {challan.items.length === challan.order.garments?.length ? "Full Delivery" : `Partial Delivery (${challan.items.length} of ${challan.order.garments?.length})`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Garment ID</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4">Service</th>
                <th className="py-2.5 px-4 text-center">Qty</th>
                <th className="py-2.5 px-4 text-right">Unit Price</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {challan.items.map((item: any, idx: number) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 text-slate-500 font-medium">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{item.garmentCode}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">{item.category}</td>
                  <td className="py-2.5 px-4 text-slate-600">{item.description}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-700">{item.service}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-slate-900">{item.quantity}</td>
                  <td className="py-2.5 px-4 text-right text-slate-700">{formatCurrency(Number(item.unitPrice))}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">{formatCurrency(Number(item.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity / Status History */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-800 text-sm border-b pb-2 uppercase tracking-wider text-[11px]">
          Challan Status History & Audit Log
        </h3>
        <div className="space-y-3 pt-1">
          {challan.statusHistory.map((hist: any) => (
            <div key={hist.id} className="flex items-start gap-3 text-xs border-l-2 border-emerald-600 pl-3 py-1">
              <div className="flex-1">
                <p className="font-bold text-slate-900">
                  Status changed to <span className="uppercase text-emerald-800">{hist.toStatus.replace(/_/g, " ")}</span>
                </p>
                {hist.note && <p className="text-slate-600 mt-0.5">{hist.note}</p>}
                <p className="text-[10px] text-slate-400 mt-1">
                  {formatDate(hist.createdAt)} • {hist.userName || "System Operator"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mark Delivered Modal */}
      <Dialog open={deliverModalOpen} onOpenChange={setDeliverModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <CheckCircle className="w-5 h-5 text-emerald-700" /> Deliver Order & Complete Challan
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <p><span className="font-bold text-slate-700">Customer:</span> {challan.customerName}</p>
              <p><span className="font-bold text-slate-700">Order No:</span> {challan.order.orderNumber}</p>
              <p><span className="font-bold text-slate-700">Garments:</span> {challan.items.length} items</p>
              <p><span className="font-bold text-slate-700">Challan Total:</span> {formatCurrency(Number(challan.grandTotal))}</p>
            </div>

            {Number(challan.balanceAmount) > 0 && (
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-700" /> Payment Pending: {formatCurrency(Number(challan.balanceAmount))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="collectPayment"
                    checked={collectPayment}
                    onChange={(e) => setCollectPayment(e.target.checked)}
                    className="rounded border-amber-400 text-emerald-700 focus:ring-emerald-600"
                  />
                  <label htmlFor="collectPayment" className="font-semibold text-slate-900 cursor-pointer">
                    Collect Payment now upon delivery
                  </label>
                </div>

                {collectPayment && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <Label className="text-[11px]">Amount to Collect (₹)</Label>
                      <Input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Payment Method</Label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-xs font-semibold"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card</option>
                        <option value="ONLINE">Online</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Delivered By</Label>
                <Input
                  value={deliveredBy}
                  onChange={(e) => setDeliveredBy(e.target.value)}
                  placeholder="Driver / Courier Name"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Received By</Label>
                <Input
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="Customer Name"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkDelivered} disabled={loading} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              {loading ? "Processing..." : "Confirm Delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Challan Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Ban className="w-5 h-5" /> Cancel Delivery Challan
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-600">
              Are you sure you want to cancel Delivery Challan <span className="font-bold text-slate-900">{challan.challanNumber}</span>? Finalized delivery challans will be retained in history as cancelled.
            </p>

            <div>
              <Label className="text-[11px] font-bold">Reason for Cancellation</Label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Specify why this delivery challan is being cancelled..."
                className="w-full h-20 p-2 text-xs border rounded-md focus:ring-2 focus:ring-rose-500 mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
              Back
            </Button>
            <Button onClick={handleCancelChallan} disabled={loading} className="bg-rose-700 hover:bg-rose-800 text-white">
              {loading ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
