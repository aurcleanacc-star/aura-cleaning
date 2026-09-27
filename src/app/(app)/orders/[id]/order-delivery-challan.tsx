"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Printer, Send, CheckCircle, Eye, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createDeliveryChallanAction, sendChallanWhatsAppAction, updateChallanStatusAction } from "@/app/(app)/delivery-challans/actions";

interface Props {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  challans: any[];
  canManage: boolean;
}

export function OrderDeliveryChallanSection({
  orderId,
  orderNumber,
  customerName,
  customerPhone,
  challans,
  canManage,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  const activeChallan = challans.find((c) => c.status !== "CANCELLED") || challans[0];

  const handleCreateChallan = async () => {
    setLoading(true);
    try {
      const res = await createDeliveryChallanAction({
        orderId,
        deliveredByName: "Laundry Dispatch",
        receivedByName: customerName,
      });

      if (res.success) {
        toast.success(`Delivery Challan ${res.challanNumber} created!`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to create Delivery Challan");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error creating challan");
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = async (challanId: string) => {
    setSendingWa(true);
    try {
      const res = await sendChallanWhatsAppAction(challanId);
      if (res.success) {
        toast.success(`Delivery Challan sent to ${customerPhone} via WhatsApp!`);
      } else {
        toast.error(res.error || "Failed to send WhatsApp");
      }
    } catch (err: any) {
      toast.error(err?.message || "WhatsApp delivery error");
    } finally {
      setSendingWa(false);
    }
  };

  const handleMarkDelivered = async (challanId: string) => {
    setLoading(true);
    try {
      const res = await updateChallanStatusAction(challanId, "DELIVERED");
      if (res.success) {
        toast.success("Marked as Delivered!");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch (err: any) {
      toast.error(err?.message || "Delivery update error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-700" />
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider text-[11px]">
            Delivery Challan
          </h3>
        </div>

        {canManage && !activeChallan && (
          <Button
            onClick={handleCreateChallan}
            disabled={loading}
            size="sm"
            className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 h-8 text-xs shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Create Delivery Challan
          </Button>
        )}
      </div>

      {!activeChallan ? (
        <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <Truck className="w-8 h-8 text-slate-300 mx-auto mb-1" />
          <p className="text-xs text-slate-600 font-medium">No active Delivery Challan generated for this order yet.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Generate a formal challan before sending garments for delivery.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-900 font-mono text-sm">{activeChallan.challanNumber}</p>
              <p className="text-slate-500 mt-0.5">
                Total: <span className="font-semibold text-slate-800">₹{Number(activeChallan.grandTotal)}</span> • Balance: <span className="font-semibold text-amber-800">₹{Number(activeChallan.balanceAmount)}</span>
              </p>
            </div>

            <div className="text-right">
              <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider border ${
                activeChallan.status === "DELIVERED"
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : "bg-blue-100 text-blue-900 border-blue-300"
              }`}>
                {activeChallan.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Buttons Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link href={`/delivery-challans/${activeChallan.id}`}>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Eye className="w-3.5 h-3.5" /> View Challan
              </Button>
            </Link>

            <Link href={`/delivery-challans/${activeChallan.id}/print`}>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </Button>
            </Link>

            <Button
              onClick={() => handleWhatsApp(activeChallan.id)}
              disabled={sendingWa}
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <Send className="w-3.5 h-3.5" /> {sendingWa ? "Sending..." : "WhatsApp Challan"}
            </Button>

            {activeChallan.status !== "DELIVERED" && canManage && (
              <Button
                onClick={() => handleMarkDelivered(activeChallan.id)}
                disabled={loading}
                size="sm"
                className="h-8 text-xs gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark Delivered
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
