import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import {
  generateInvoicePDF,
  generateChallanPDF,
  generatePaymentReceiptPDF,
  generateDeliveryReceiptPDF,
  generateOrderSummaryPDF,
  generateStatementPDF,
  generateExpenseReceiptPDF,
} from "@/lib/pdf/pdf-templates";

/**
 * Real Server-Side Vector PDF Generator API Endpoint:
 * GET /api/documents/pdf?type={type}&id={id}&download={true|false}
 */
export async function GET(req: Request) {
  try {
    await requirePermission([
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.DELIVERY_VIEW,
      PERMISSIONS.BILLING_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
    ]);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");
    const download = searchParams.get("download") === "true";

    if (!type || !id) {
      return NextResponse.json({ error: "Missing required parameters: 'type' and 'id'" }, { status: 400 });
    }

    const normalizedType = type.toLowerCase().replace("delivery_challan", "challan").replace("payment_receipt", "payment_receipt").replace("expense_receipt", "expense");

    let pdfResult: { buffer: Buffer; fileName: string };

    switch (normalizedType) {
      case "invoice":
        pdfResult = await generateInvoicePDF(id);
        break;
      case "challan":
      case "delivery_challan":
        pdfResult = await generateChallanPDF(id);
        break;
      case "payment_receipt":
        pdfResult = await generatePaymentReceiptPDF(id);
        break;
      case "delivery_receipt":
        pdfResult = await generateDeliveryReceiptPDF(id);
        break;
      case "order_summary":
        pdfResult = await generateOrderSummaryPDF(id);
        break;
      case "statement":
        pdfResult = await generateStatementPDF(id);
        break;
      case "expense":
      case "expense_receipt":
        pdfResult = await generateExpenseReceiptPDF(id);
        break;
      default:
        return NextResponse.json({ error: `Unsupported document type: ${type}` }, { status: 400 });
    }

    const disposition = download ? `attachment; filename="${pdfResult.fileName}"` : `inline; filename="${pdfResult.fileName}"`;

    return new NextResponse(new Uint8Array(pdfResult.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Content-Length": String(pdfResult.buffer.length),
        "Cache-Control": "private, no-transform, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("PDF generation route error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate PDF document" }, { status: 500 });
  }
}
