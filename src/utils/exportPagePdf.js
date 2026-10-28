// Exports a page (e.g. the Financial Dashboard) to a downloadable PDF without
// cutting any card, chart or panel across a page break.
//
// The page is rendered once (html2canvas-pro, which understands Tailwind v4's
// oklch colours). Elements marked `data-pdf-keep` must stay whole: page
// breaks are placed only at heights that cross none of them. A kept element
// taller than a whole page gets a page of its own, scaled down to fit.
// Elements marked `data-pdf-hide` (buttons, chart action icons, filter
// panels) are left out of the PDF.

const MARGIN = 24; // pt
const HEADER = 34; // pt: title + filters line
const FOOTER = 16; // pt: page number
// A run of content more than this many pages tall is cut rather than shrunk.
const MAX_SHRINK_PAGES = 2.5;
// Kept blocks are padded so a break lands in the gap, clear of card shadows.
const KEEP_PAD = 5; // CSS px

/**
 * Page-break positions (CSS px from the top) that never cross a kept block.
 * `keeps` are [{ top, bottom }], `pageHeight` is the usable height of a page.
 * Returns [{ start, end, shrink }] slices; `shrink` marks a slice taller than
 * a page (a block that can't be split) that must be scaled to fit.
 */
export function planPageSlices(totalHeight, keeps, pageHeight) {
  const crosses = (y) => keeps.some((k) => k.top < y - 0.5 && k.bottom > y + 0.5);
  const candidates = [...new Set([...keeps.flatMap((k) => [k.top, k.bottom]), totalHeight])]
    .filter((y) => y > 0 && y <= totalHeight && !crosses(y))
    .sort((a, b) => a - b);

  const slices = [];
  let start = 0;
  while (start < totalHeight - 0.5) {
    const limit = start + pageHeight;
    if (limit >= totalHeight) {
      slices.push({ start, end: totalHeight, shrink: false });
      break;
    }
    const fits = candidates.filter((y) => y > start + 0.5 && y <= limit);
    if (fits.length) {
      const end = fits[fits.length - 1];
      slices.push({ start, end, shrink: false });
      start = end;
      continue;
    }
    // Something taller than a page starts here: give it its own page, shrunk,
    // unless it's so tall that shrinking would make it unreadable.
    const next = candidates.find((y) => y > limit);
    if (next != null && next - start <= pageHeight * MAX_SHRINK_PAGES) {
      slices.push({ start, end: next, shrink: true });
      start = next;
    } else {
      slices.push({ start, end: limit, shrink: false });
      start = limit;
    }
  }
  return slices;
}

/** Let the cloned page grow to its full height so nothing is clipped by a scroll container. */
function unclip(clonedRoot) {
  for (let el = clonedRoot; el && el.style; el = el.parentElement) {
    el.style.overflow = "visible";
    el.style.maxHeight = "none";
    if (el !== clonedRoot) el.style.height = "auto";
    el.scrollTop = 0;
  }
  clonedRoot.style.minHeight = "0";
  clonedRoot.querySelectorAll("*").forEach((el) => {
    const pos = el.ownerDocument.defaultView.getComputedStyle(el).position;
    if (pos === "sticky") el.style.position = "static";
  });
}

/**
 * Render `root` to a PDF and download it.
 * @param {HTMLElement} root
 * @param {{ filename: string, title: string, subtitle?: string, orientation?: "landscape" | "portrait" }} opts
 */
export async function exportPagePdf(root, { filename, title, subtitle = "", orientation = "landscape" }) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  let layout = null;
  const canvas = await html2canvas(root, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    onclone: (_doc, clonedRoot) => {
      clonedRoot.querySelectorAll("[data-pdf-hide]").forEach((el) => { el.style.display = "none"; });
      unclip(clonedRoot);
      // Measure in the clone, after the changes above, so breaks match what's drawn.
      const box = clonedRoot.getBoundingClientRect();
      layout = {
        width: box.width,
        height: box.height,
        keeps: [...clonedRoot.querySelectorAll("[data-pdf-keep]")]
          .filter((el) => el.offsetParent !== null)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              top: Math.max(0, r.top - box.top - KEEP_PAD),
              bottom: Math.min(box.height, r.bottom - box.top + KEEP_PAD),
            };
          }),
      };
    },
  });

  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const contentH = pageH - MARGIN * 2 - HEADER - FOOTER;
  const ptPerPx = contentW / layout.width;
  const pxPerCanvas = canvas.height / layout.height;
  const slices = planPageSlices(layout.height, layout.keeps, contentH / ptPerPx);
  const generated = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  slices.forEach((slice, i) => {
    if (i) pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(12, 74, 110);
    pdf.text(title, MARGIN, MARGIN + 10);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    if (subtitle) pdf.text(subtitle, MARGIN, MARGIN + 24, { maxWidth: contentW * 0.75 });
    pdf.text(`Generated ${generated}`, pageW - MARGIN, MARGIN + 10, { align: "right" });
    pdf.text(`Page ${i + 1} of ${slices.length}`, pageW - MARGIN, pageH - MARGIN + 4, { align: "right" });

    const srcY = Math.round(slice.start * pxPerCanvas);
    const srcH = Math.max(1, Math.round((slice.end - slice.start) * pxPerCanvas));
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = srcH;
    const ctx = part.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, part.width, part.height);
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    let w = contentW;
    let h = (slice.end - slice.start) * ptPerPx;
    if (h > contentH) {
      const f = contentH / h;
      w *= f;
      h = contentH;
    }
    pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN + (contentW - w) / 2, MARGIN + HEADER, w, h);
  });

  pdf.save(filename);
}
