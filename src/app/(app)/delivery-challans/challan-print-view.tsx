"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Download, Printer, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sendChallanWhatsAppAction } from "./actions";

interface ChallanPrintProps {
  challanId: string;
  challanNumber: string;
  customerPhone: string;
  /** The exact HTML rendered to the downloadable PDF — this iframe shows the same document, not a separate re-implementation. */
  html: string;
}

export function ChallanPrintView({ challanId, challanNumber, customerPhone, html }: ChallanPrintProps) {
  const [sendingWa, setSendingWa] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  const handleWhatsApp = async () => {
    setSendingWa(true);
    try {
      const res = await sendChallanWhatsAppAction(challanId);
      if (res.success) {
        toast.success(`Delivery Challan sent to ${customerPhone} via WhatsApp!`);
      } else {
        toast.error(res.error || "Failed to send WhatsApp message");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "WhatsApp delivery error");
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 p-4 md:p-8">
      <div className="mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <Button asChild variant="outline" size="sm">
          <Link href={`/delivery-challans/${challanId}`}>
            <ArrowLeft /> Back to Details
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button onClick={handleWhatsApp} loading={sendingWa} variant="outline" size="sm">
            <Send /> WhatsApp
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/delivery-challans/${challanId}/pdf`} download={`AURCLEAN-Delivery-Challan-${challanNumber}.pdf`}>
              <Download /> Download PDF
            </a>
          </Button>
          <Button onClick={handlePrint} size="sm">
            <Printer /> Print
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] overflow-hidden rounded-xl border border-border bg-white shadow-lg">
        <iframe
          ref={iframeRef}
          title={`Delivery Challan ${challanNumber}`}
          srcDoc={html}
          className="h-[297mm] w-full"
        />
      </div>
    </div>
  );
}
