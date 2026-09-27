import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/dates";

/** Formats local or international phone numbers to WhatsApp format */
export function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const formatted = digits.length === 10 ? `91${digits}` : digits;
  return formatted;
}

/** Interpolates variables into editable message templates (pure client helper) */
export function interpolateWhatsAppTemplate(
  templateBody: string,
  variables: {
    customerName?: string;
    orderId?: string;
    invoiceNumber?: string;
    total?: number;
    paid?: number;
    balance?: number;
    deliveryDate?: string | Date;
    businessName?: string;
    messageText?: string;
  },
): string {
  return templateBody
    .replace(/\{\{customerName\}\}/g, variables.customerName || "Valued Customer")
    .replace(/\{\{orderId\}\}/g, variables.orderId || "ORD-XXXX")
    .replace(/\{\{invoiceNumber\}\}/g, variables.invoiceNumber || variables.orderId || "INV-XXXX")
    .replace(/\{\{total\}\}/g, formatCurrency(variables.total ?? 0))
    .replace(/\{\{paid\}\}/g, formatCurrency(variables.paid ?? 0))
    .replace(/\{\{balance\}\}/g, formatCurrency(variables.balance ?? 0))
    .replace(
      /\{\{deliveryDate\}\}/g,
      variables.deliveryDate ? formatDate(variables.deliveryDate) : "Scheduled Date",
    )
    .replace(/\{\{businessName\}\}/g, variables.businessName || "AURCLEAN")
    .replace(/\{\{messageText\}\}/g, variables.messageText || "");
}
