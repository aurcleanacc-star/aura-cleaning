import { NextResponse } from "next/server";

import { assertBranchAccess, getCurrentUser, hasPermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getDeliveryChallanById } from "@/lib/services/delivery-challan";
import { buildDeliveryChallanHtml } from "@/lib/pdf/delivery-challan-document";
import { renderHtmlToPdf } from "@/lib/pdf/render";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, PERMISSIONS.DELIVERY_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const challan = await getDeliveryChallanById(id);
  if (!challan) return NextResponse.json({ error: "Delivery Challan not found" }, { status: 404 });

  try {
    assertBranchAccess(user, challan.branchId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let pdf: Buffer;
  try {
    const html = buildDeliveryChallanHtml(challan);
    pdf = await renderHtmlToPdf(html, {
      footer: { label: `AURCLEAN • Delivery Challan No: ${challan.challanNumber}` },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF generation failed" },
      { status: 500 },
    );
  }

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="AURCLEAN-Delivery-Challan-${challan.challanNumber}.pdf"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
    },
  });
}
