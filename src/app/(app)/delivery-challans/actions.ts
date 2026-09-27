"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import {
  createDeliveryChallan,
  updateChallanStatus,
  cancelDeliveryChallan,
  getDeliveryChallanById,
} from "@/lib/services/delivery-challan";
import { sendWhatsAppMessage, interpolateWhatsAppTemplate } from "@/lib/services/whatsapp";
import type { ChallanStatus, PaymentMethod } from "@/generated/prisma/client";

export async function createDeliveryChallanAction(data: {
  orderId: string;
  notes?: string;
  terms?: string;
  deliveredByName?: string;
  receivedByName?: string;
  garmentIds?: string[];
}) {
  const session = await requirePermission(PERMISSIONS.DELIVERY_MANAGE);

  try {
    const challan = await createDeliveryChallan({
      ...data,
      userId: session.id,
      userBranchId: session.branchId || undefined,
    });

    revalidatePath("/delivery-challans");
    revalidatePath(`/delivery-challans/${challan.id}`);
    revalidatePath(`/orders/${data.orderId}`);
    if (challan.customerId) {
      revalidatePath(`/customers/${challan.customerId}`);
    }

    return {
      success: true,
      id: challan.id,
      challanNumber: challan.challanNumber,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to create Delivery Challan",
    };
  }
}

export async function updateChallanStatusAction(
  id: string,
  toStatus: ChallanStatus,
  options: {
    note?: string;
    deliveredByName?: string;
    receivedByName?: string;
    paymentAmount?: number;
    paymentMethod?: PaymentMethod;
  } = {},
) {
  const session = await requirePermission(PERMISSIONS.DELIVERY_MANAGE);

  try {
    const updated = await updateChallanStatus(id, toStatus, {
      ...options,
      userId: session.id,
    });

    revalidatePath("/delivery-challans");
    revalidatePath(`/delivery-challans/${id}`);
    revalidatePath(`/orders/${updated.orderId}`);
    if (updated.customerId) {
      revalidatePath(`/customers/${updated.customerId}`);
    }

    return {
      success: true,
      status: updated.status,
      challanNumber: updated.challanNumber,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to update Delivery Challan status",
    };
  }
}

export async function cancelChallanAction(id: string, reason: string) {
  const session = await requirePermission(PERMISSIONS.DELIVERY_MANAGE);

  try {
    const updated = await cancelDeliveryChallan(id, reason, session.id);

    revalidatePath("/delivery-challans");
    revalidatePath(`/delivery-challans/${id}`);
    revalidatePath(`/orders/${updated.orderId}`);

    return {
      success: true,
      status: updated.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to cancel Delivery Challan",
    };
  }
}

export async function sendChallanWhatsAppAction(challanId: string) {
  const session = await requirePermission(PERMISSIONS.DELIVERY_MANAGE);

  try {
    const challan = await getDeliveryChallanById(challanId);
    if (!challan) {
      throw new Error(`Delivery Challan #${challanId} not found.`);
    }

    if (!challan.customerPhone) {
      throw new Error("Customer phone number is missing on this Delivery Challan.");
    }

    const messageText = interpolateWhatsAppTemplate(
      "Hello {{customerName}},\n\nYour AURCLEAN delivery challan for Order {{orderId}} is attached.\n\nChallan No: {{challanNumber}}\nTotal Amount: {{total}}\nPaid: {{paid}}\nBalance: {{balance}}\n\nThank you for choosing AURCLEAN.",
      {
        customerName: challan.customerName,
        orderId: challan.order.orderNumber,
        challanNumber: challan.challanNumber,
        total: Number(challan.grandTotal),
        paid: Number(challan.paidAmount),
        balance: Number(challan.balanceAmount),
        businessName: challan.branch?.name || "AURCLEAN Laundry Management ERP",
      },
    );

    const result = await sendWhatsAppMessage({
      phone: challan.customerPhone,
      messageType: "DELIVERY_CHALLAN",
      messageText,
      customerId: challan.customerId || undefined,
      orderId: challan.orderId,
      sentByUserId: session.id,
    });

    revalidatePath(`/delivery-challans/${challanId}`);

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to send Delivery Challan via WhatsApp",
    };
  }
}
