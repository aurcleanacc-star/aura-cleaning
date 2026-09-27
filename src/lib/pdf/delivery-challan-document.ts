import "server-only";

import { formatDate } from "@/lib/dates";
import { getDocumentLogoDataUri } from "@/lib/pdf/logo";

/** Matches the shape returned by getDeliveryChallanById(). */
export interface DeliveryChallanDocumentInput {
  challanNumber: string;
  challanDate: Date;
  deliveryDate: Date | null;
  expectedDeliveryDate: Date | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  terms: string | null;
  branch: {
    name: string;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
  };
  order: {
    orderNumber: string;
    type: string;
  };
  items: Array<{
    garmentCode: string;
    description: string;
    quantity: number;
    garment: {
      service: { pricingMode: string };
    } | null;
  }>;
}

const DEFAULT_TERMS = [
  "No guarantee against colour loss, bleeding & shrinkage.",
  "In case of rare damage, the company's liability shall be limited to a maximum of eight (8) times the processing (laundry/dry clean) cost.",
];

function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unitFor(pricingMode: string | undefined): string {
  return pricingMode === "PER_KG" ? "Kg" : "-";
}

function humanizeOrderType(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("/");
}

/**
 * Builds the full standalone HTML for a Delivery Challan document — the
 * single template shared by the on-screen preview and the generated PDF.
 *
 * A Delivery Challan documents which garments moved, not money: no subtotal,
 * tax, discount, paid amount or balance appears anywhere on this page.
 */
export function buildDeliveryChallanHtml(challan: DeliveryChallanDocumentInput): string {
  const branchAddress = [challan.branch.addressLine, challan.branch.city, challan.branch.state, challan.branch.pincode]
    .filter(Boolean)
    .join(", ");

  const contactLine = [
    branchAddress || null,
    challan.branch.phone ? `Phone: ${esc(challan.branch.phone)}` : null,
    challan.branch.email ? `Email: ${esc(challan.branch.email)}` : null,
  ]
    .filter(Boolean)
    .join(" &nbsp;•&nbsp; ");

  const totalQuantity = challan.items.reduce((sum, item) => sum + item.quantity, 0);

  const termsLines = (challan.terms ? challan.terms.split(/\r?\n/).filter(Boolean) : DEFAULT_TERMS);

  const itemRows = challan.items
    .map(
      (item, index) => `
        <tr>
          <td class="num">${index + 1}</td>
          <td>
            <div class="item-name">${esc(item.description)}</div>
            <div class="item-code">${esc(item.garmentCode)}</div>
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${esc(unitFor(item.garment?.service.pricingMode))}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Delivery Challan ${esc(challan.challanNumber)}</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #1f2937;
    background: #ffffff;
    font-size: 12px;
    line-height: 1.5;
  }
  .page { padding: 0; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0a3b2c;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .brand { display: flex; gap: 12px; align-items: center; }
  .brand img { width: 46px; height: 46px; object-fit: contain; }
  .brand-name { font-size: 20px; font-weight: 800; color: #0a3b2c; letter-spacing: 0.01em; }
  .brand-tagline { font-size: 10px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 1px; }
  .brand-contact { font-size: 9.5px; color: #6b7280; margin-top: 4px; max-width: 320px; }
  .header-right { text-align: right; }
  .doc-title {
    display: inline-block;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #0a3b2c;
    background: #ecfdf5;
    padding: 4px 12px;
    border-radius: 4px;
    margin-bottom: 8px;
  }
  .header-right .meta-row { font-size: 11px; color: #374151; }
  .header-right .meta-row b { color: #111827; }

  .cards { display: flex; gap: 14px; margin-bottom: 14px; }
  .card {
    flex: 1;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 10px 12px;
  }
  .card h4 {
    margin: 0 0 6px;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #0a3b2c;
  }
  .card .primary { font-size: 13px; font-weight: 700; color: #111827; }
  .card .line { font-size: 11px; color: #4b5563; margin-top: 2px; word-wrap: break-word; overflow-wrap: anywhere; }

  .info-grid { display: flex; gap: 14px; margin-bottom: 16px; }
  .info-block { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
  .info-block h4 {
    margin: 0 0 6px;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #0a3b2c;
  }
  .info-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
  .info-row span:first-child { color: #6b7280; }
  .info-row span:last-child { font-weight: 600; color: #111827; text-align: right; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  table.items thead th {
    background: #0a3b2c;
    color: #ffffff;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
    padding: 8px 10px;
  }
  table.items thead th.num { text-align: right; }
  table.items tbody td {
    padding: 7px 10px;
    border-bottom: 1px solid #f0f1f3;
    font-size: 11.5px;
    vertical-align: top;
  }
  table.items tbody td.num { text-align: right; white-space: nowrap; }
  table.items tbody tr:nth-child(even) { background: #fafbfa; }
  .item-name { font-weight: 600; color: #111827; }
  .item-code { font-size: 9.5px; color: #9ca3af; font-family: "Courier New", monospace; margin-top: 1px; }

  .total-row {
    display: flex;
    justify-content: flex-end;
    gap: 24px;
    padding: 10px 10px;
    border-top: 2px solid #0a3b2c;
    margin-bottom: 20px;
  }
  .total-row .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0a3b2c; }
  .total-row .value { font-size: 13px; font-weight: 800; color: #111827; }

  .terms {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 28px;
  }
  .terms h4 {
    margin: 0 0 6px;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #0a3b2c;
  }
  .terms ol { margin: 0; padding-left: 16px; }
  .terms li { font-size: 9.5px; color: #6b7280; margin-bottom: 3px; }

  .signatures {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-top: 40px;
    padding-top: 8px;
  }
  .sig { flex: 1; text-align: center; }
  .sig .line { border-top: 1px solid #9ca3af; margin-top: 34px; padding-top: 6px; font-size: 10px; font-weight: 700; color: #374151; }
  .sig .sub { font-size: 9px; color: #9ca3af; margin-top: 2px; }

  .footer {
    margin-top: 28px;
    border-top: 1px solid #e5e7eb;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #9ca3af;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        <img src="${getDocumentLogoDataUri()}" alt="AURCLEAN" />
        <div>
          <div class="brand-name">AURCLEAN</div>
          <div class="brand-tagline">The Organic Laundry</div>
          ${contactLine ? `<div class="brand-contact">${contactLine}</div>` : ""}
        </div>
      </div>
      <div class="header-right">
        <div class="doc-title">DELIVERY CHALLAN</div>
        <div class="meta-row">Challan No: <b>${esc(challan.challanNumber)}</b></div>
        <div class="meta-row">Date: <b>${esc(formatDate(challan.challanDate))}</b></div>
      </div>
    </div>

    <div class="cards">
      <div class="card">
        <h4>Delivery Challan For</h4>
        <div class="primary">${esc(challan.customerName)}</div>
        <div class="line">Contact No: ${esc(challan.customerPhone)}</div>
      </div>
      <div class="card">
        <h4>Ship To</h4>
        <div class="line">${esc(challan.customerAddress) || "Address not provided"}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-block">
        <h4>Transportation Details</h4>
        <div class="info-row"><span>Branch</span><span>${esc(challan.branch.name)}</span></div>
        <div class="info-row"><span>Pickup/Delivery</span><span>${esc(humanizeOrderType(challan.order.type))}</span></div>
        <div class="info-row"><span>Delivery Date</span><span>${
          challan.deliveryDate || challan.expectedDeliveryDate
            ? esc(formatDate(challan.deliveryDate || challan.expectedDeliveryDate!))
            : "—"
        }</span></div>
      </div>
      <div class="info-block">
        <h4>Challan Details</h4>
        <div class="info-row"><span>Challan No</span><span>${esc(challan.challanNumber)}</span></div>
        <div class="info-row"><span>Order No</span><span>${esc(challan.order.orderNumber)}</span></div>
        <div class="info-row"><span>Date</span><span>${esc(formatDate(challan.challanDate))}</span></div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width: 32px;">#</th>
          <th>Item Name</th>
          <th class="num" style="width: 70px;">Quantity</th>
          <th class="num" style="width: 60px;">Unit</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="total-row">
      <span class="label">Total</span>
      <span class="value">${totalQuantity}</span>
    </div>

    <div class="terms">
      <h4>Terms &amp; Conditions</h4>
      <ol>
        ${termsLines.map((line) => `<li>${esc(line)}</li>`).join("")}
      </ol>
    </div>

    <div class="signatures">
      <div class="sig">
        <div class="line">&nbsp;</div>
        <div class="sub">Customer Signature</div>
      </div>
      <div class="sig">
        <div class="line">&nbsp;</div>
        <div class="sub">Received By</div>
      </div>
      <div class="sig">
        <div class="line">For 'AURCLEAN' The Organic Laundry</div>
        <div class="sub">Authorized Signatory</div>
      </div>
    </div>

    <div class="footer">
      <span>AURCLEAN &bull; The Organic Laundry</span>
      <span>Delivery Challan No: ${esc(challan.challanNumber)}</span>
    </div>
  </div>
</body>
</html>`;
}
