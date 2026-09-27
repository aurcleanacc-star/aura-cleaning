import "server-only";
import fs from "node:fs";

import type { Browser } from "playwright-core";

/**
 * Candidate Chromium executables, checked in order. The sandbox this app
 * develops in pre-installs Chromium for Playwright at a fixed path; a real
 * deployment sets PDF_CHROMIUM_PATH (or installs `playwright install
 * chromium`, which lands in the default cache directory playwright-core
 * already knows how to find without an explicit path).
 */
function resolveExecutablePath(): string | undefined {
  const candidates = [
    process.env.PDF_CHROMIUM_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    "/opt/pw-browsers/chromium",
  ].filter((path): path is string => Boolean(path));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Ignore and try the next candidate.
    }
  }
  return undefined;
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright-core");
      const executablePath = resolveExecutablePath();
      try {
        return await chromium.launch({
          headless: true,
          executablePath,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        });
      } catch (error) {
        browserPromise = null;
        throw new Error(
          `Could not start the PDF rendering browser${executablePath ? ` at ${executablePath}` : ""}. ` +
            `Install Chromium for Playwright (npx playwright install chromium) or set PDF_CHROMIUM_PATH. ` +
            `(${error instanceof Error ? error.message : String(error)})`,
        );
      }
    })();
  }
  return browserPromise;
}

export interface RenderPdfOptions {
  format?: "A4" | "A5";
  landscape?: boolean;
  /** Slim per-page footer: a left-aligned label plus "Page X of Y" on the right, printed on every page. */
  footer?: { label: string };
}

/**
 * Renders a standalone HTML document (its own <html>/<head>/<style>, no
 * external stylesheet or script dependency) to a PDF buffer. The caller's
 * HTML is the single source of truth for both the on-screen preview and the
 * generated file — this function does no layout work of its own.
 */
export async function renderHtmlToPdf(html: string, options: RenderPdfOptions = {}): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: options.format ?? "A4",
      landscape: options.landscape ?? false,
      printBackground: true,
      margin: {
        top: "12mm",
        right: "12mm",
        bottom: options.footer ? "16mm" : "14mm",
        left: "12mm",
      },
      displayHeaderFooter: Boolean(options.footer),
      headerTemplate: "<span></span>",
      footerTemplate: options.footer
        ? `<div style="width:100%;display:flex;justify-content:space-between;padding:0 12mm;font-size:8px;color:#9ca3af;font-family:Arial,sans-serif;">
             <span>${options.footer.label}</span>
             <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
           </div>`
        : "<span></span>",
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** True when the buffer starts with the PDF magic header — a cheap sanity check before handing it to anything downstream. */
export function isValidPdfBuffer(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}
