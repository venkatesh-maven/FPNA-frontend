import * as XLSX from "xlsx";

// Report downloads with (or without) the saved commentary shown under the
// report: CSV exports get it as extra rows below the data; Excel exports get
// a "Commentary" sheet added to the server's workbook, leaving its existing
// sheets and formatting untouched.

const CATEGORY_LABEL = (c) => (c ? c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " ") : "");

/**
 * The commentary on screen, in table order.
 *   lineTitle   heading of the row-commentary section ("Customer Commentary"…)
 *   lines       [{ key, label }] — the table rows, so items follow the table
 *   byLine      saved row commentary by key (useLineItemCommentary().byLine)
 *   reportItems saved report commentary (useReportCommentary().items)
 */
export function collectCommentary({ lineTitle = "Line-item Variance Commentary", lines = [], byLine = {}, reportItems = [] }) {
  return {
    lineTitle,
    lineItems: (lines || [])
      .filter((line) => byLine?.[line.key])
      .map((line) => ({
        label: line.label,
        explanation: byLine[line.key].explanation || "",
        recommendation: byLine[line.key].recommendation || "",
      })),
    reportItems: (reportItems || []).map((item) => ({
      title: item.title || "",
      text: item.text || "",
      category: CATEGORY_LABEL(item.category),
      source: item.source === "ai" ? "AI" : CATEGORY_LABEL(item.source),
    })),
  };
}

export const commentaryCount = (c) => (c ? c.lineItems.length + c.reportItems.length : 0);

// [{ kind: "title" | "header" | "body" | "blank", cells }]
function commentaryLayout(c) {
  const rows = [];
  if (c.lineItems.length) {
    rows.push({ kind: "title", cells: [c.lineTitle] });
    rows.push({ kind: "header", cells: ["Line item", "Explanation", "Recommendation"] });
    c.lineItems.forEach((l) => rows.push({ kind: "body", cells: [l.label, l.explanation, l.recommendation] }));
  }
  if (c.reportItems.length) {
    if (rows.length) rows.push({ kind: "blank", cells: [] });
    rows.push({ kind: "title", cells: ["Report Commentary"] });
    rows.push({ kind: "header", cells: ["Title", "Commentary", "Category", "Source"] });
    c.reportItems.forEach((r) => rows.push({ kind: "body", cells: [r.title, r.text, r.category, r.source] }));
  }
  return rows;
}

/** Commentary as CSV rows, to append below a report's data rows. */
export const commentaryRows = (c) => commentaryLayout(c).map((r) => r.cells);

/* ---------------- downloads ---------------- */

export function triggerDownload(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Same output as react-csv's CSVLink (every cell quoted, UTF-8 BOM so Excel reads it). */
export function downloadCsv(rows, filename) {
  const text = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  triggerDownload(new Blob([text], { type: "text/csv;charset=utf-8;" }), filename);
}

/** A report's CSV rows, plus its commentary below them when asked for. */
export function csvWithCommentary(dataRows, commentary, include) {
  const extra = include ? commentaryRows(commentary) : [];
  return extra.length ? [...dataRows, [], ...extra] : dataRows;
}

/* ---------------- Excel: add a Commentary sheet ---------------- */

const enc = new TextEncoder();
const dec = new TextDecoder();

const xmlText = (v) =>
  String(v ?? "")
    // Characters XML 1.0 doesn't allow (a stray one would make Excel reject the file).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const colLetter = (i) => String.fromCharCode(65 + i); // A–D is all we need

// Appends a bold font and three cell formats (bold, wrapped, bold+wrapped)
// to styles.xml; returns their style indexes (null if styles.xml is unusual).
function addCommentaryStyles(stylesXml) {
  const fontsBlock = stylesXml.match(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/);
  const xfsBlock = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (!fontsBlock || !xfsBlock) return { xml: stylesXml, styles: null };

  const fontCount = (fontsBlock[1].match(/<font[\s>/]/g) || []).length;
  const xfCount = (xfsBlock[1].match(/<xf[\s>/]/g) || []).length;
  const wrap = '<alignment vertical="top" wrapText="1"/>';
  const fonts = fontsBlock[0]
    .replace(/(<fonts\b[^>]*count=")\d+/, `$1${fontCount + 1}`)
    .replace("</fonts>", '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>');
  const xfs = xfsBlock[0]
    .replace(/(<cellXfs\b[^>]*count=")\d+/, `$1${xfCount + 3}`)
    .replace(
      "</cellXfs>",
      `<xf numFmtId="0" fontId="${fontCount}" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
        `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">${wrap}</xf>` +
        `<xf numFmtId="0" fontId="${fontCount}" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">${wrap}</xf>` +
        "</cellXfs>"
    );
  return {
    xml: stylesXml.replace(fontsBlock[0], fonts).replace(xfsBlock[0], xfs),
    styles: { bold: xfCount, wrap: xfCount + 1, boldWrap: xfCount + 2 },
  };
}

function commentarySheetXml(layout, styles) {
  const styleFor = (kind) =>
    !styles ? null : kind === "title" ? styles.bold : kind === "header" ? styles.boldWrap : kind === "body" ? styles.wrap : null;
  const rows = layout
    .map((row, r) => {
      const s = styleFor(row.kind);
      const cells = row.cells
        .map((value, c) => {
          const ref = `${colLetter(c)}${r + 1}`;
          return `<c r="${ref}" t="inlineStr"${s == null ? "" : ` s="${s}"`}><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="2" width="90" customWidth="1"/>' +
    '<col min="3" max="3" width="70" customWidth="1"/><col min="4" max="4" width="14" customWidth="1"/></cols>' +
    `<sheetData>${rows}</sheetData></worksheet>`
  );
}

/**
 * The server's Excel download with a Commentary sheet added. Falls back to the
 * original file (still downloadable) if the sheet can't be added.
 */
export async function xlsxWithCommentary(blob, commentary) {
  try {
    const bytes = addCommentarySheet(await blob.arrayBuffer(), commentary);
    return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  } catch (err) {
    console.error("Could not add the commentary sheet to the Excel file:", err);
    return blob;
  }
}

/**
 * Adds a "Commentary" sheet to an .xlsx file (ArrayBuffer / Uint8Array) and
 * returns the new file as a Uint8Array. Only new parts are added and three
 * index files are extended, so the workbook's own sheets keep all formatting.
 */
export function addCommentarySheet(xlsxData, commentary, sheetName = "Commentary") {
  const layout = commentaryLayout(commentary);
  if (!layout.length) return new Uint8Array(xlsxData);

  // xlsx's ES build (what Vite bundles) exports CFB; its CommonJS build nests it under default.
  const CFB = XLSX.CFB || XLSX.default?.CFB;
  const zip = CFB.read(new Uint8Array(xlsxData), { type: "array" });
  const readPart = (path) => {
    const entry = CFB.find(zip, path);
    return entry ? dec.decode(entry.content) : null;
  };
  const writePart = (path, text) => {
    if (CFB.find(zip, path)) CFB.utils.cfb_del(zip, path);
    CFB.utils.cfb_add(zip, path, enc.encode(text));
  };

  const workbook = readPart("/xl/workbook.xml");
  const rels = readPart("/xl/_rels/workbook.xml.rels");
  const types = readPart("/[Content_Types].xml");
  if (!workbook || !rels || !types) throw new Error("Unexpected Excel file layout.");

  // A sheet file name, relationship id, sheet id and sheet name not in use yet.
  let n = 1;
  while (CFB.find(zip, `/xl/worksheets/sheet${n}.xml`)) n++;
  const sheetPath = `xl/worksheets/sheet${n}.xml`;
  let ridNum = Math.max(0, ...[...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))) + 1;
  while (rels.includes(`Id="rId${ridNum}"`)) ridNum++;
  const rid = `rId${ridNum}`;
  const sheetId = Math.max(0, ...[...workbook.matchAll(/<sheet\b[^>]*\bsheetId="(\d+)"/g)].map((m) => Number(m[1]))) + 1;
  const names = new Set([...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => m[1]));
  let name = sheetName;
  for (let i = 2; names.has(name); i++) name = `${sheetName} ${i}`;
  const relPrefix = (workbook.match(/<sheet\b[^>]*\s([A-Za-z0-9_]+):id="/) || [])[1] || "r";

  const styles = readPart("/xl/styles.xml");
  const styled = styles ? addCommentaryStyles(styles) : { xml: null, styles: null };

  writePart(`/${sheetPath}`, commentarySheetXml(layout, styled.styles));
  if (styled.xml) writePart("/xl/styles.xml", styled.xml);
  writePart(
    "/xl/workbook.xml",
    workbook.replace("</sheets>", `<sheet name="${xmlText(name)}" sheetId="${sheetId}" ${relPrefix}:id="${rid}"/></sheets>`)
  );
  writePart(
    "/xl/_rels/workbook.xml.rels",
    rels.replace(
      "</Relationships>",
      `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/${sheetPath}"/></Relationships>`
    )
  );
  writePart(
    "/[Content_Types].xml",
    types.replace(
      "</Types>",
      `<Override PartName="/${sheetPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
    )
  );

  return new Uint8Array(CFB.write(zip, { type: "array", fileType: "zip" }));
}
