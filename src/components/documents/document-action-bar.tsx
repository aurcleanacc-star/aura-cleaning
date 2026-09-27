"use client";

import { useState } from "react";
import { Printer, Download, Send, Eye, FileText, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { sendDocumentWhatsAppAction } from "@/app/api/documents/actions";
import type { DocumentType } from "@/lib/pdf/types";

interface DocumentActionBarProps {
  documentType: DocumentType;
  documentId: string;
  documentNumber: string;
  customerName?: string;
  customerPhone?: string;
  orderNumber?: string;
  pdfUrl?: string;
  showEdit?: boolean;
  editUrl?: string;
}

export function DocumentActionBar({
  documentType,
  documentId,
  documentNumber,
  customerName,
  customerPhone,
}: DocumentActionBarProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [statusStep, setStatusStep] = useState<string>("");

  const pdfUrl = `/api/documents/pdf?type=${documentType}&id=${documentId}`;
  const downloadUrl = `/api/documents/pdf?type=${documentType}&id=${documentId}&download=true`;

  const handleSendWhatsApp = async () => {
    if (!customerPhone) {
      toast.error("Customer WhatsApp number is missing. Please update the customer profile before sending.");
      return;
    }

    setSendingWa(true);
    setStatusStep("Preparing document & vector PDF...");

    try {
      setStatusStep("Connecting to OpenWA Gateway...");
      const res = await sendDocumentWhatsAppAction({
        documentType,
        documentId,
      });

      if (res.success) {
        setStatusStep("Sent successfully!");
        toast.success(`PDF document ${res.fileName} sent to ${customerPhone} via WhatsApp!`);
      } else {
        setStatusStep("Sending failed");
        toast.error(res.error || "Failed to deliver WhatsApp PDF document.");
      }
    } catch (err: any) {
      setStatusStep("Sending failed");
      toast.error(err?.message || "WhatsApp sending error");
    } finally {
      setSendingWa(false);
      setTimeout(() => setStatusStep(""), 4000);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-800" />
        <div>
          <h4 className="font-bold text-slate-900 text-sm">{documentNumber}</h4>
          {statusStep && (
            <p className="text-xs font-semibold text-emerald-700 animate-pulse">{statusStep}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Preview Button */}
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-1.5 text-xs">
          <Eye className="w-3.5 h-3.5" /> Preview PDF
        </Button>

        {/* Download PDF Button */}
        <a href={downloadUrl} download>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </Button>
        </a>

        {/* Print Button */}
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </a>

        {/* Send WhatsApp Button */}
        <Button
          onClick={handleSendWhatsApp}
          disabled={sendingWa}
          size="sm"
          className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
        >
          <Send className="w-3.5 h-3.5" /> {sendingWa ? "Sending PDF..." : "Send to WhatsApp"}
        </Button>
      </div>

      {/* Real Vector PDF Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[96vw] max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-xl">
          <DialogHeader className="p-3 sm:p-4 border-b bg-slate-50 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
              <FileText className="w-4 h-4 text-emerald-800 shrink-0" /> PDF Document Preview: {documentNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 bg-slate-100 p-1 sm:p-2">
            <iframe src={pdfUrl} className="w-full h-full rounded border border-slate-300 shadow-inner" title="PDF Document Preview" />
          </div>

          <DialogFooter className="p-2 sm:p-3 bg-slate-50 border-t flex flex-row justify-between items-center gap-2">
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Vector A4 Print-Ready PDF</div>
            <div className="flex gap-1.5 sm:gap-2">
              <a href={downloadUrl} download>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
              </a>
              <Button size="sm" className="h-8 text-xs" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
