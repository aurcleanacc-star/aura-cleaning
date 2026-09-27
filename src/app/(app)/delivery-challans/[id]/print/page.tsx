import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getDeliveryChallanById } from "@/lib/services/delivery-challan";
import { buildDeliveryChallanHtml } from "@/lib/pdf/delivery-challan-document";
import { ChallanPrintView } from "../../challan-print-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const challan = await getDeliveryChallanById(id);
  if (!challan) return { title: "Challan Print View" };
  return {
    title: `Print Challan ${challan.challanNumber}`,
  };
}

export default async function DeliveryChallanPrintPage({ params }: PageProps) {
  await requirePermission(PERMISSIONS.DELIVERY_VIEW);
  const { id } = await params;

  const challan = await getDeliveryChallanById(id);
  if (!challan) {
    notFound();
  }

  const html = buildDeliveryChallanHtml(challan);

  return (
    <ChallanPrintView
      challanId={challan.id}
      challanNumber={challan.challanNumber}
      customerPhone={challan.customerPhone}
      html={html}
    />
  );
}
