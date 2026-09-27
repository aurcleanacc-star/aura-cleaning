import "server-only";

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/dates";

// Palette matching AURCLEAN ERP visual identity
export const COLORS = {
  primary: "#064e3b", // Forest Green
  primaryDark: "#022c22",
  emerald: "#059669", // Emerald Accent
  emeraldLight: "#dcfce7",
  charcoal: "#0f172a", // Text Main
  slate: "#475569", // Text Muted
  lightBg: "#f8fafc",
  border: "#cbd5e1",
  white: "#ffffff",
  statusPaid: "#059669",
  statusUnpaid: "#dc2626",
  statusPartial: "#d97706",
};

import type { CompanyProfile } from "./types";
export type { CompanyProfile };

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const settings = await prisma.setting.findMany({
    where: {
      category: { in: ["company", "documents", "general"] },
    },
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));

  return {
    name: map.get("company_name") || map.get("app_name") || "AURCLEAN Laundry Management",
    address: map.get("company_address") || "123 Clean Tech Park, Indiranagar, Bengaluru, KA 560038",
    phone: map.get("company_phone") || "+91 9876543210",
    email: map.get("company_email") || "support@aurclean.com",
    website: map.get("company_website") || "www.aurclean.com",
    gstin: map.get("company_gstin") || "29AAAAA0000A1Z5",
    logoUrl: map.get("company_logo") || "/logo.png",
    footerText: map.get("document_footer_text") || "Thank you for choosing AURCLEAN. Dedicated to laundry excellence.",
    termsConditions:
      map.get("document_terms") ||
      "1. Goods once delivered in good condition cannot be returned.\n2. Any claims regarding missing/damaged items must be reported within 24 hours.\n3. All disputes are subject to local jurisdiction.",
    invoicePrefix: map.get("invoice_prefix") || "INV",
    challanPrefix: map.get("challan_prefix") || "DC",
    receiptPrefix: map.get("receipt_prefix") || "REC",
  };
}

export interface PDFTableColumn {
  id: string;
  header: string;
  width: number; // percentage or fixed pt
  align?: "left" | "center" | "right";
}

export interface PDFTableRow {
  [key: string]: string | number;
}

/**
 * PDFDocumentBuilder encapsulates PDFKit creation and reusable component rendering.
 */
export class PDFDocumentBuilder {
  doc: InstanceType<typeof PDFDocument>;
  company: CompanyProfile;
  pageWidth = 595.28; // A4 pt
  pageHeight = 841.89;
  margin = 36;
  contentWidth: number;
  currentY: number;

  constructor(company: CompanyProfile) {
    this.company = company;
    this.contentWidth = this.pageWidth - this.margin * 2; // 523.28 pt
    this.doc = new PDFDocument({
      size: "A4",
      margin: this.margin,
      bufferPages: true,
      info: {
        Title: "AURCLEAN Document",
        Author: company.name,
        Creator: "AURCLEAN ERP Document System",
      },
    });
    this.currentY = this.margin;
  }

  /**
   * Renders standardized AURCLEAN Document Header
   */
  renderHeader(title: string, documentNumber: string, dateStr?: string) {
    const startY = this.margin;

    // Draw Top Decorative Primary Bar
    this.doc
      .rect(this.margin, startY, this.contentWidth, 4)
      .fill(COLORS.primary);

    this.currentY = startY + 12;

    // Try embedding official logo image if exists
    let logoDrawn = false;
    const projectLogoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(projectLogoPath)) {
      try {
        this.doc.image(projectLogoPath, this.margin, this.currentY, { width: 36 });
        logoDrawn = true;
      } catch {}
    }

    const textX = logoDrawn ? this.margin + 44 : this.margin;

    // Left Side: Brand Name & Tagline
    this.doc
      .fillColor(COLORS.primary)
      .fontSize(18)
      .font("Helvetica-Bold")
      .text(this.company.name.toUpperCase(), textX, this.currentY);

    this.doc
      .fillColor(COLORS.emerald)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("LAUNDRY MANAGEMENT ERP", textX, this.currentY + 20);

    // Right Side: Document Title & Document Number
    const rightMargin = this.pageWidth - this.margin;
    this.doc
      .fillColor(COLORS.primary)
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(title.toUpperCase(), this.margin, this.currentY, {
        width: this.contentWidth,
        align: "right",
      });

    this.doc
      .fillColor(COLORS.charcoal)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(documentNumber, this.margin, this.currentY + 18, {
        width: this.contentWidth,
        align: "right",
      });

    if (dateStr) {
      this.doc
        .fillColor(COLORS.slate)
        .fontSize(9)
        .font("Helvetica")
        .text(`Date: ${dateStr}`, this.margin, this.currentY + 32, {
          width: this.contentWidth,
          align: "right",
        });
    }

    this.currentY += 46;

    // Divider
    this.doc
      .moveTo(this.margin, this.currentY)
      .lineTo(rightMargin, this.currentY)
      .strokeColor(COLORS.border)
      .lineWidth(0.75)
      .stroke();

    this.currentY += 12;
  }

  /**
   * Renders 2-column info grid (Company Info & Customer / Target Info)
   */
  renderInfoGrid(params: {
    customerTitle?: string;
    customerName: string;
    customerPhone?: string;
    customerAddress?: string;
    customerEmail?: string;
    metaItems: Array<{ label: string; value: string }>;
  }) {
    const startY = this.currentY;
    const colWidth = (this.contentWidth - 16) / 2;

    // Left Column: Company & Customer Info Box
    this.doc
      .roundedRect(this.margin, startY, colWidth, 90, 4)
      .fillAndStroke(COLORS.lightBg, COLORS.border);

    this.doc
      .fillColor(COLORS.slate)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text((params.customerTitle || "CUSTOMER / BILL TO").toUpperCase(), this.margin + 10, startY + 8);

    this.doc
      .fillColor(COLORS.charcoal)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(params.customerName, this.margin + 10, startY + 20, { width: colWidth - 20 });

    if (params.customerPhone) {
      this.doc
        .fillColor(COLORS.slate)
        .fontSize(9)
        .font("Helvetica")
        .text(`Phone: ${params.customerPhone}`, this.margin + 10, startY + 36);
    }

    if (params.customerAddress) {
      this.doc
        .fillColor(COLORS.slate)
        .fontSize(8.5)
        .font("Helvetica")
        .text(params.customerAddress, this.margin + 10, startY + 48, {
          width: colWidth - 20,
          height: 32,
          ellipsis: true,
        });
    }

    // Right Column: Document Metadata Box
    const rightX = this.margin + colWidth + 16;
    this.doc
      .roundedRect(rightX, startY, colWidth, 90, 4)
      .fillAndStroke(COLORS.lightBg, COLORS.border);

    this.doc
      .fillColor(COLORS.slate)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("DOCUMENT DETAILS", rightX + 10, startY + 8);

    let metaY = startY + 22;
    params.metaItems.forEach((item) => {
      this.doc
        .fillColor(COLORS.slate)
        .fontSize(9)
        .font("Helvetica")
        .text(`${item.label}:`, rightX + 10, metaY);

      this.doc
        .fillColor(COLORS.charcoal)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(item.value, rightX + 10, metaY, {
          width: colWidth - 20,
          align: "right",
        });

      metaY += 15;
    });

    this.currentY = startY + 102;
  }

  /**
   * Renders clean vector Items Table with automatic multi-page headers
   */
  renderItemsTable(columns: PDFTableColumn[], rows: PDFTableRow[]) {
    const tableTop = this.currentY;
    const MAX_USABLE_Y = 750;

    // Compute column pixel widths
    const widths = columns.map((col) => (col.width / 100) * this.contentWidth);

    const renderTableHeader = (y: number) => {
      // Table Header Background Bar
      this.doc
        .rect(this.margin, y, this.contentWidth, 20)
        .fill(COLORS.primary);

      let currentX = this.margin;
      columns.forEach((col, idx) => {
        const w = widths[idx];
        this.doc
          .fillColor(COLORS.white)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(col.header, currentX + 6, y + 5, {
            width: w - 12,
            align: col.align || "left",
          });
        currentX += w;
      });
      return y + 20;
    };

    let y = renderTableHeader(tableTop);

    rows.forEach((row, rowIdx) => {
      const rowHeight = 20;

      // Page Break Check: move row to next page if it exceeds max usable height
      if (y + rowHeight > MAX_USABLE_Y) {
        this.doc.addPage();
        this.currentY = this.margin;
        y = renderTableHeader(this.margin);
      }

      const bg = rowIdx % 2 === 0 ? COLORS.white : COLORS.lightBg;

      this.doc.rect(this.margin, y, this.contentWidth, rowHeight).fill(bg);

      let currentX = this.margin;
      columns.forEach((col, colIdx) => {
        const w = widths[colIdx];
        const val = row[col.id] !== undefined ? String(row[col.id]) : "";

        this.doc
          .fillColor(COLORS.charcoal)
          .fontSize(8.5)
          .font(colIdx === 1 ? "Helvetica-Bold" : "Helvetica")
          .text(val, currentX + 6, y + 5, {
            width: w - 12,
            align: col.align || "left",
            ellipsis: true,
          });

        currentX += w;
      });

      // Bottom Row Border Line
      this.doc
        .moveTo(this.margin, y + rowHeight)
        .lineTo(this.margin + this.contentWidth, y + rowHeight)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();

      y += rowHeight;
    });

    this.currentY = y + 12;
  }

  /**
   * Renders Right-Aligned Totals Block (Subtotal, Tax, Discount, Total, Paid, Balance)
   */
  renderTotalsBlock(totals: {
    subtotal: number;
    discount?: number;
    gstRate?: number;
    gstAmount?: number;
    grandTotal: number;
    paidAmount?: number;
    balanceAmount?: number;
  }) {
    const boxWidth = 220;
    const startX = this.margin + this.contentWidth - boxWidth;
    let y = this.currentY;
    const MAX_USABLE_Y = 750;

    // Dynamically calculate exact height of totals block
    let lineCount = 2; // Subtotal + Grand Total
    if (totals.discount && totals.discount > 0) lineCount++;
    if (totals.gstAmount && totals.gstAmount > 0) lineCount++;
    if (totals.paidAmount !== undefined) lineCount++;
    if (totals.balanceAmount !== undefined) lineCount++;

    const totalsHeight = lineCount * 16 + 10 + 16;
    const signaturesHeight = 95;

    // Check if totals block fits on current page.
    // If table is substantial (y > 520) and totals + signatures will overflow, move totals & signatures together to next page.
    if (y + totalsHeight > MAX_USABLE_Y || (y > 520 && y + totalsHeight + signaturesHeight > MAX_USABLE_Y)) {
      this.doc.addPage();
      y = this.margin;
    }

    const renderLine = (label: string, value: string, isBold = false, isHighlight = false, color = COLORS.charcoal) => {
      if (isHighlight) {
        this.doc.rect(startX, y, boxWidth, 22).fill(COLORS.emeraldLight);
      }

      this.doc
        .fillColor(color)
        .fontSize(isBold ? 10 : 9)
        .font(isBold ? "Helvetica-Bold" : "Helvetica")
        .text(label, startX + 8, y + (isHighlight ? 5 : 2));

      this.doc
        .fillColor(color)
        .fontSize(isBold ? 10 : 9)
        .font(isBold ? "Helvetica-Bold" : "Helvetica")
        .text(value, startX + 8, y + (isHighlight ? 5 : 2), {
          width: boxWidth - 16,
          align: "right",
        });

      y += isHighlight ? 26 : 16;
    };

    renderLine("Subtotal:", formatCurrency(totals.subtotal));

    if (totals.discount && totals.discount > 0) {
      renderLine("Discount:", `-${formatCurrency(totals.discount)}`, false, false, COLORS.emerald);
    }

    if (totals.gstAmount && totals.gstAmount > 0) {
      renderLine(`GST (${totals.gstRate || 18}%):`, formatCurrency(totals.gstAmount));
    }

    renderLine("Grand Total:", formatCurrency(totals.grandTotal), true, true, COLORS.primary);

    if (totals.paidAmount !== undefined) {
      renderLine("Paid Amount:", formatCurrency(totals.paidAmount), false, false, COLORS.emerald);
    }

    if (totals.balanceAmount !== undefined) {
      const balanceColor = totals.balanceAmount > 0 ? "#9a3412" : COLORS.emerald;
      renderLine("Balance Due:", formatCurrency(totals.balanceAmount), true, false, balanceColor);
    }

    this.currentY = y + 16;
  }

  /**
   * Renders Terms, Remarks, and Signature Boxes
   */
  renderTermsAndSignatures(params: {
    terms?: string;
    remarks?: string;
    signatures?: Array<{ title: string; name?: string }>;
  }) {
    let y = this.currentY;
    const MAX_USABLE_Y = 750;
    const blockHeight = 95;

    if (y + blockHeight > MAX_USABLE_Y) {
      this.doc.addPage();
      y = this.margin;
    }

    // Terms Box Left
    if (params.terms || params.remarks) {
      this.doc
        .roundedRect(this.margin, y, 280, 85, 4)
        .fillAndStroke(COLORS.lightBg, COLORS.border);

      this.doc
        .fillColor(COLORS.slate)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("TERMS & REMARKS", this.margin + 8, y + 6);

      const bodyText = params.terms || params.remarks || "";
      this.doc
        .fillColor(COLORS.slate)
        .fontSize(7.5)
        .font("Helvetica")
        .text(bodyText, this.margin + 8, y + 18, {
          width: 264,
          height: 60,
          ellipsis: true,
        });
    }

    // Signatures Right
    const sigX = this.margin + 300;
    const sigWidth = this.contentWidth - 300;

    const signers = params.signatures || [
      { title: "Customer Signature" },
      { title: "Authorized Signatory", name: this.company.name },
    ];

    const itemWidth = sigWidth / signers.length;

    signers.forEach((s, idx) => {
      const sx = sigX + idx * itemWidth;
      const sy = y + 45;

      this.doc
        .moveTo(sx + 10, sy)
        .lineTo(sx + itemWidth - 10, sy)
        .strokeColor(COLORS.border)
        .lineWidth(0.75)
        .stroke();

      if (s.name) {
        this.doc
          .fillColor(COLORS.charcoal)
          .fontSize(8)
          .font("Helvetica-Bold")
          .text(s.name, sx + 5, sy - 14, { width: itemWidth - 10, align: "center" });
      }

      this.doc
        .fillColor(COLORS.slate)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(s.title, sx + 5, sy + 6, { width: itemWidth - 10, align: "center" });
    });

    this.currentY = y + 95;
  }

  /**
   * Finalizes document and adds page numbers ("Page X of Y") to all pages.
   */
  async build(): Promise<Buffer> {
    const pages = this.doc.bufferedPageRange();

    for (let i = 0; i < pages.count; i++) {
      this.doc.switchToPage(i);

      // Bottom Footer Bar
      const footerY = this.pageHeight - 32;

      this.doc
        .moveTo(this.margin, footerY)
        .lineTo(this.pageWidth - this.margin, footerY)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();

      this.doc
        .fillColor(COLORS.slate)
        .fontSize(8)
        .font("Helvetica")
        .text(
          `${this.company.name} • Phone: ${this.company.phone} • Email: ${this.company.email} • GSTIN: ${this.company.gstin}`,
          this.margin,
          footerY + 6,
          { width: this.contentWidth - 80 },
        );

      this.doc
        .fillColor(COLORS.slate)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(`Page ${i + 1} of ${pages.count}`, this.margin, footerY + 6, {
          width: this.contentWidth,
          align: "right",
        });
    }

    this.doc.end();

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.doc.on("data", (chunk) => chunks.push(chunk));
      this.doc.on("end", () => resolve(Buffer.concat(chunks)));
      this.doc.on("error", (err) => reject(err));
    });
  }
}
