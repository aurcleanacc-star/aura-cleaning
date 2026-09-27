import "server-only";
import fs from "node:fs";
import path from "node:path";

let cached: string | null = null;

/**
 * Returns the AURCLEAN logo as a self-contained data: URI, sized for
 * documents (240x240, ~68KB) rather than the ~1.3MB source in public/logo.png
 * — every generated PDF and every PDF attached to a WhatsApp message embeds
 * this inline so rendering never depends on a network fetch.
 */
export function getDocumentLogoDataUri(): string {
  if (!cached) {
    const bytes = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf/assets/logo-240.png"));
    cached = `data:image/png;base64,${bytes.toString("base64")}`;
  }
  return cached;
}
