import "server-only";

import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { getCompanyProfile, PDFDocumentBuilder, type PDFTableColumn, type PDFTableRow } from "./pdf-builder";

/**
 * 1. Tax Invoice PDF Generator
 */
export async function generateInvoicePDF(invoiceId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      order: {
        include: { garments: { include: { garmentType: true, service: true } } },
      },
      customer: true,
      lines: true,
      branch: true,
    },
  });

  if (!invoice) throw new Error(`Invoice #${invoiceId} not found.`);

  const company = await getCompanyProfile();
  const builder = new PDFDocumentBuilder(company);

  builder.renderHeader("TAX INVOICE", invoice.invoiceNumber, formatDate(invoice.issuedAt));

  builder.renderInfoGrid({
    customerTitle: "BILL TO / CUSTOMER",
    customerName: invoice.billToName || invoice.customer?.name || "Valued Customer",
    customerPhone: invoice.billToPhone || invoice.customer?.phone || "",
    customerAddress: invoice.billToAddress || invoice.customer?.addressLine || "",
    metaItems: [
      { label: "Invoice No", value: invoice.invoiceNumber },
      { label: "Order No", value: invoice.order?.orderNumber || "N/A" },
      { label: "Due Date", value: invoice.dueAt ? formatDate(invoice.dueAt) : "On Receipt" },
      { label: "Payment Status", value: invoice.status.replace(/_/g, " ") },
    ],
  });

  const columns: PDFTableColumn[] = [
    { id: "sl", header: "#", width: 6, align: "center" },
    { id: "garmentCode", header: "GARMENT ID", width: 20 },
    { id: "category", header: "CATEGORY", width: 22 },
    { id: "service", header: "SERVICE", width: 22 },
    { id: "qty", header: "QTY", width: 8, align: "center" },
    { id: "unitPrice", header: "RATE", width: 11, align: "right" },
    { id: "amount", header: "AMOUNT", width: 11, align: "right" },
  ];

  const rows: PDFTableRow[] = (invoice.order?.garments || []).map((g, idx) => ({
    sl: idx + 1,
    garmentCode: g.garmentCode,
    category: g.garmentType.name,
    service: g.service.name,
    qty: 1,
    unitPrice: formatCurrency(Number(invoice.subtotal) / (invoice.order?.garments.length || 1)),
    amount: formatCurrency(Number(invoice.subtotal) / (invoice.order?.garments.length || 1)),
  }));

  builder.renderItemsTable(columns, rows.length > 0 ? rows : invoice.lines.map((l, i) => ({
    sl: i + 1,
    garmentCode: "ITEM",
    category: l.description,
    service: "Service",
    qty: Number(l.quantity),
    unitPrice: formatCurrency(Number(l.unitPrice)),
    amount: formatCurrency(Number(l.lineTotal)),
  })));

  builder.renderTotalsBlock({
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discountAmount),
    gstRate: Number(invoice.gstRate),
    gstAmount: Number(invoice.cgstAmount) + Number(invoice.sgstAmount) + Number(invoice.igstAmount),
    grandTotal: Number(invoice.totalAmount),
    paidAmount: Number(invoice.amountPaid),
    balanceAmount: Number(invoice.amountDue),
  });

  builder.renderTermsAndSignatures({
    terms: company.termsConditions,
    signatures: [
      { title: "Customer Acceptance" },
      { title: "Authorized Signatory", name: company.name },
    ],
  });

  const buffer = await builder.build();
  return {
    buffer,
    fileName: `AURCLEAN-Invoice-${invoice.invoiceNumber}.pdf`,
  };
}

/**
 * 2. Delivery Challan PDF Generator
 */
export async function generateChallanPDF(challanId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const challan = await prisma.deliveryChallan.findUnique({
    where: { id: challanId },
    include: {
      order: true,
      customer: true,
      items: true,
      branch: true,
    },
  });

  if (!challan) throw new Error(`Delivery Challan #${challanId} not found.`);

  const company = await getCompanyProfile();
  const builder = new PDFDocumentBuilder(company);

  builder.renderHeader("DELIVERY CHALLAN", challan.challanNumber, formatDate(challan.challanDate));

  builder.renderInfoGrid({
    customerTitle: "DELIVER TO",
    customerName: challan.customerName,
    customerPhone: challan.customerPhone,
    customerAddress: challan.customerAddress || "",
    metaItems: [
      { label: "Challan No", value: challan.challanNumber },
      { label: "Order No", value: challan.order.orderNumber },
      { label: "Delivery Date", value: formatDate(challan.deliveryDate || new Date()) },
      { label: "Delivery Status", value: challan.status.replace(/_/g, " ") },
    ],
  });

  const columns: PDFTableColumn[] = [
    { id: "sl", header: "#", width: 6, align: "center" },
    { id: "garmentCode", header: "GARMENT ID", width: 22 },
    { id: "category", header: "CATEGORY", width: 24 },
    { id: "service", header: "SERVICE", width: 24 },
    { id: "qty", header: "QTY", width: 10, align: "center" },
    { id: "status", header: "STATUS", width: 14, align: "center" },
  ];

  const rows: PDFTableRow[] = challan.items.map((item, idx) => ({
    sl: idx + 1,
    garmentCode: item.garmentCode,
    category: item.category,
    service: item.service,
    qty: item.quantity,
    status: item.status.replace(/_/g, " "),
  }));

  builder.renderItemsTable(columns, rows);

  const totalQuantity = challan.items.reduce((sum, item) => sum + item.quantity, 0);
  builder.renderSimpleTotal("Total Garments", totalQuantity);

  builder.renderTermsAndSignatures({
    terms: challan.terms || company.termsConditions,
    remarks: challan.notes || undefined,
    signatures: [
      { title: "Customer Signature" },
      { title: "Delivered By", name: challan.deliveredByName || "Driver" },
      { title: "Authorized Signatory", name: company.name },
    ],
  });

  const buffer = await builder.build();
  return {
    buffer,
    fileName: `AURCLEAN-Delivery-Challan-${challan.challanNumber}.pdf`,
  };
}

/**
 * 3. Payment Receipt PDF Generator
 */
export async function generatePaymentReceiptPDF(paymentId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: { include: { customer: true } },
      invoice: true,
      branch: true,
      receivedBy: true,
    },
  });

  if (!payment) throw new Error(`Payment #${paymentId} not found.`);

  const company = await getCompanyProfile();
  const builder = new PDFDocumentBuilder(company);

  builder.renderHeader("PAYMENT RECEIPT", payment.paymentNumber, formatDate(payment.paidAt));

  builder.renderInfoGrid({
    customerTitle: "RECEIVED FROM",
    customerName: payment.order?.customerName || "Valued Customer",
    customerPhone: payment.order?.customerPhone || "",
    customerAddress: payment.order?.addressLine || "",
    metaItems: [
      { label: "Receipt No", value: payment.paymentNumber },
      { label: "Order No", value: payment.order?.orderNumber || "N/A" },
      { label: "Payment Method", value: payment.method },
      { label: "State", value: payment.state },
    ],
  });

  const columns: PDFTableColumn[] = [
    { id: "sl", header: "#", width: 8, align: "center" },
    { id: "description", header: "DESCRIPTION", width: 50 },
    { id: "method", header: "METHOD", width: 22, align: "center" },
    { id: "amount", header: "AMOUNT PAID", width: 20, align: "right" },
  ];

  const rows: PDFTableRow[] = [
    {
      sl: 1,
      description: `Payment received for Order #${payment.order?.orderNumber || 'N/A'}${payment.notes ? ` (${payment.notes})` : ''}`,
      method: payment.method,
      amount: formatCurrency(Number(payment.amount)),
    },
  ];

  builder.renderItemsTable(columns, rows);

  builder.renderTotalsBlock({
    subtotal: Number(payment.amount),
    grandTotal: Number(payment.amount),
    paidAmount: Number(payment.amount),
    balanceAmount: payment.order ? Math.max(0, Number(payment.order.outstandingAmount)) : 0,
  });

  builder.renderTermsAndSignatures({
    terms: "This is an official payment receipt issued by AURCLEAN.",
    signatures: [
      { title: "Payer Acknowledgement" },
      { title: "Received By", name: payment.receivedBy?.name || company.name },
    ],
  });

  const buffer = await builder.build();
  return {
    buffer,
    fileName: `AURCLEAN-Payment-Receipt-${payment.paymentNumber}.pdf`,
  };
}

/**
 * 4. Delivery Receipt PDF Generator
 */
export async function generateDeliveryReceiptPDF(deliveryId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      order: { include: { garments: { include: { garmentType: true, service: true } } } },
      driver: { include: { user: true } },
      branch: true,
    },
  });

  if (!delivery) throw new Error(`Delivery #${deliveryId} not found.`);

  const company = await getCompanyProfile();
  const builder = new PDFDocumentBuilder(company);

  builder.renderHeader("DELIVERY RECEIPT", delivery.deliveryNumber, formatDate(delivery.deliveredAt || delivery.scheduledAt));

  builder.renderInfoGrid({
    customerTitle: "DELIVERED TO",
    customerName: delivery.contactName,
    customerPhone: delivery.contactPhone,
    customerAddress: delivery.addressLine,
    metaItems: [
      { label: "Delivery No", value: delivery.deliveryNumber },
      { label: "Order No", value: delivery.order.orderNumber },
      { label: "Driver", value: delivery.driver?.user.name || "Unassigned" },
      { label: "Status", value: delivery.status },
    ],
  });

  const columns: PDFTableColumn[] = [
    { id: "sl", header: "#", width: 8, align: "center" },
    { id: "garmentCode", header: "GARMENT ID", width: 26 },
    { id: "category", header: "CATEGORY", width: 30 },
    { id: "service", header: "SERVICE", width: 26 },
    { id: "qty", header: "QTY", width: 10, align: "center" },
  ];

  const rows: PDFTableRow[] = (delivery.order.garments || []).map((g, idx) => ({
    sl: idx + 1,
    garmentCode: g.garmentCode,
    category: g.garmentType.name,
    service: g.service.name,
    qty: 1,
  }));

  builder.renderItemsTable(columns, rows);

  builder.renderTotalsBlock({
    subtotal: Number(delivery.order.subtotal),
    discount: Number(delivery.order.discountAmount),
    gstAmount: Number(delivery.order.gstAmount),
    grandTotal: Number(delivery.order.totalAmount),
    paidAmount: Number(delivery.order.paidAmount),
    balanceAmount: Number(delivery.order.outstandingAmount),
  });

  builder.renderTermsAndSignatures({
    terms: "Customer confirms receipt of garments in good condition.",
    signatures: [
      { title: "Customer Signature", name: delivery.receivedByName || delivery.contactName },
      { title: "Delivered By", name: delivery.driver?.user.name || "Courier" },
    ],
  });

  const buffer = await builder.build();
  return {
    buffer,
    fileName: `AURCLEAN-Delivery-Receipt-${delivery.deliveryNumber}.pdf`,
  };
}

/**
 * 5. Order Summary PDF Generator
 */
export async function generateOrderSummaryPDF(orderId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: { include: { service: true, garmentType: true } },
      garments: { include: { service: true, garmentType: true } },
      branch: true,
    },
  });

  if (!order) throw new Error(`Order #${orderId} not found.`);

  const company = await getCompanyProfile();
  const builder = new PDFDocumentBuilder(company);

  builder.renderHeader("ORDER SUMMARY", order.orderNumber, formatDate(order.placedAt));

  builder.renderInfoGrid({
    customerTitle: "CUSTOMER",
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.addressLine || "",
    metaItems: [
      { label: "Order No", value: order.orderNumber },
      { label: "Order Status", value: order.status.replace(/_/g, " ") },
      { label: "Expected Delivery", value: formatDate(order.expectedDeliveryAt) },
      { label: "Total Pieces", value: String(order.totalPieces) },
    ],
  });

  const columns: PDFTableColumn[] = [
    { id: "sl", header: "#", width: 6, align: "center" },
    { id: "garmentCode", header: "GARMENT CODE", width: 22 },
    { id: "category", header: "GARMENT TYPE", width: 24 },
    { id: "service", header: "SERVICE", width: 24 },
    { id: "status", header: "STATUS", width: 24, align: "center" },
  ];

  const rows: PDFTableRow[] = order.garments.map((g, idx) => ({
    sl: idx + 1,
    garmentCode: g.garmentCode,
    category: g.garmentType.name,
    service: g.service.name,
    status: g.status.replace(/_/g, " "),
  }));

  builder.renderItemsTable(columns, rows);

  builder.renderTotalsBlock({
    subtotal: Number(order.subtotal),
    discount: Number(order.discountAmount),
    gstRate: Number(order.gstRate),
    gstAmount: Number(order.gstAmount),
    grandTotal: Number(order.totalAmount),
    paidAmount: Number(order.paidAmount),
    balanceAmount: Number(order.outstandingAmount),
  });

  builder.renderTermsAndSignatures({
    terms: company.termsConditions,
    remarks: order.specialInstructions || undefined,
  });

  const buffer = await builder.build();
  return {
    buffer,
    fileName: `AURCLEAN-Order-Summary-${order.orderNumber}.pdf`,
  };
}

/**
 * 6. Customer Statement / Ledger PDF Generator
 */
export async function generateStatementPDF(customerId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      orders: { orderBy: { placedAt: "desc" }, take: 50 },
      branch: true,
    },
  });

  if (!customer) throw new Error(`Customer #${customerId} not found.`);

  const company = await getCompanyProfile();
  const builder = new PDFDocumentBuilder(company);

  const statementNo = `STM-${customer.code}-${Date.now().toString().slice(-4)}`;
  builder.renderHeader("CUSTOMER STATEMENT", statementNo, formatDate(new Date()));

  builder.renderInfoGrid({
    customerTitle: "STATEMENT FOR",
    customerName: customer.name,
    customerPhone: customer.phone,
    customerAddress: customer.addressLine || "",
    metaItems: [
      { label: "Customer Code", value: customer.code },
      { label: "Total Orders", value: String(customer.orderCount) },
      { label: "Lifetime Spend", value: formatCurrency(Number(customer.totalSpent)) },
      { label: "Outstanding Balance", value: formatCurrency(Number(customer.outstandingAmount)) },
    ],
  });

  const columns: PDFTableColumn[] = [
    { id: "sl", header: "#", width: 6, align: "center" },
    { id: "orderNumber", header: "ORDER NO", width: 20 },
    { id: "date", header: "DATE", width: 18 },
    { id: "status", header: "STATUS", width: 18, align: "center" },
    { id: "total", header: "TOTAL", width: 19, align: "right" },
    { id: "balance", header: "BALANCE", width: 19, align: "right" },
  ];

  const rows: PDFTableRow[] = customer.orders.map((ord, idx) => ({
    sl: idx + 1,
    orderNumber: ord.orderNumber,
    date: formatDate(ord.placedAt),
    status: ord.status,
    total: formatCurrency(Number(ord.totalAmount)),
    balance: formatCurrency(Number(ord.outstandingAmount)),
  }));

  builder.renderItemsTable(columns, rows);

  builder.renderTotalsBlock({
    subtotal: Number(customer.totalSpent),
    grandTotal: Number(customer.totalSpent),
    paidAmount: Math.max(0, Number(customer.totalSpent) - Number(customer.outstandingAmount)),
    balanceAmount: Number(customer.outstandingAmount),
  });

  builder.renderTermsAndSignatures({
    terms: "Statement of Account generated from AURCLEAN ERP.",
  });

  const buffer = await builder.build();
  return {
    buffer,
    fileName: `AURCLEAN-Statement-${customer.code}.pdf`,
  };
}

/**
 * 7. Expense Receipt PDF Generator
 */
export async function generateExpenseReceiptPDF(expenseId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { branch: true, createdBy: true, approvedBy: true },
  });

  if (!expense) throw new Error(`Expense #${expenseId} not found.`);

  const company = await getCompanyProfile();
  const builder = new PDFDocumentBuilder(company);

  builder.renderHeader("EXPENSE VOUCHER", expense.expenseNumber, formatDate(expense.expenseDate));

  builder.renderInfoGrid({
    customerTitle: "PAYEE / EXPENSE DETAILS",
    customerName: expense.paidTo || "Operational Expense",
    customerPhone: expense.category,
    customerAddress: expense.description,
    metaItems: [
      { label: "Expense No", value: expense.expenseNumber },
      { label: "Category", value: expense.category },
      { label: "Payment Method", value: expense.paymentMethod },
      { label: "Status", value: expense.status },
    ],
  });

  const columns: PDFTableColumn[] = [
    { id: "sl", header: "#", width: 8, align: "center" },
    { id: "description", header: "EXPENSE DESCRIPTION", width: 52 },
    { id: "category", header: "CATEGORY", width: 20, align: "center" },
    { id: "amount", header: "AMOUNT", width: 20, align: "right" },
  ];

  const rows: PDFTableRow[] = [
    {
      sl: 1,
      description: expense.description,
      category: expense.category,
      amount: formatCurrency(Number(expense.amount)),
    },
  ];

  builder.renderItemsTable(columns, rows);

  builder.renderTotalsBlock({
    subtotal: Number(expense.amount),
    grandTotal: Number(expense.amount),
  });

  builder.renderTermsAndSignatures({
    signatures: [
      { title: "Prepared By", name: expense.createdBy?.name || company.name },
      { title: "Approved By", name: expense.approvedBy?.name || "Manager" },
    ],
  });

  const buffer = await builder.build();
  return {
    buffer,
    fileName: `AURCLEAN-Expense-${expense.expenseNumber}.pdf`,
  };
}
