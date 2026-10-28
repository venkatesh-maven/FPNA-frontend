// Excel-style column resizing for every <table> in the app: drag the right
// edge of a header cell to resize that column, double-click it to fit the
// column to its content. Tables need no changes — a document-wide
// MutationObserver finds them (and notices React re-renders) and attaches
// the handles. Opt a table out with the `data-no-col-resize` attribute.
//
// The first drag "freezes" the table: every column keeps its current width
// (via a <colgroup>) and the table switches to `table-layout: fixed`, so a
// column can be made narrower than its content (clipped with an ellipsis,
// see index.css). Sticky (pinned) columns get their offsets recomputed so
// they stay flush after a neighbour is resized. Widths are remembered per
// page + header row in localStorage; a table whose columns change goes back
// to its natural layout.

const HANDLE_CLASS = "col-resize-handle";
const COLGROUP_CLASS = "col-resize-cols";
const FROZEN_ATTR = "data-col-resized";
const STICKY_ATTR = "data-col-resize-sticky";
const OPT_OUT_ATTR = "data-no-col-resize";
const MIN_WIDTH = 40;
const MAX_FIT_WIDTH = 600;
const MAX_FIT_ROWS = 300;
const STORAGE_PREFIX = "fpna:colWidths:";

// table -> { signature, widths, cols, colgroup, sticky: [{ col, side }] }
const frozen = new WeakMap();

/* ---------------- header layout ---------------- */

// Header cells laid out on a grid (rowSpan / colSpan resolved). Each column's
// resize handle sits on the cell covering it in the bottom header row; a
// cell spanning several columns resizes its last one.
function headerLayout(table) {
  const head = table.tHead;
  if (!head || !head.rows.length) return null;
  const grid = [];
  Array.from(head.rows).forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    for (const cell of tr.cells) {
      while (grid[r][c]) c++;
      const colSpan = Math.max(1, cell.colSpan || 1);
      const rowSpan = Math.max(1, cell.rowSpan || 1);
      for (let i = 0; i < rowSpan; i++) {
        const row = (grid[r + i] = grid[r + i] || []);
        for (let j = 0; j < colSpan; j++) row[c + j] = cell;
      }
      c += colSpan;
    }
  });
  const last = grid[head.rows.length - 1] || [];
  const count = last.length;
  if (!count || last.includes(undefined)) return null;

  const edges = [];
  for (let c = 0; c < count; c++) {
    if (last[c + 1] !== last[c]) edges.push({ cell: last[c], col: c });
  }
  // Sort arrows (⇅ ↑ ↓) change on every sort — leave them out of the signature.
  const label = (cell) =>
    (cell.textContent || "").replace(/[^\p{L}\p{N}%&\-\s]/gu, "").replace(/\s+/g, " ").trim();
  const signature = `${count}|${last.filter((cell, c) => last[c - 1] !== cell).map(label).join("|")}`;
  return { grid, last, count, edges, signature };
}

function ensureHandles(layout) {
  for (const { cell, col } of layout.edges) {
    let handle = Array.from(cell.children).find((el) => el.classList.contains(HANDLE_CLASS));
    if (!handle) {
      handle = document.createElement("span");
      handle.className = HANDLE_CLASS;
      handle.title = "Drag to resize · double-click to fit";
      handle.setAttribute("aria-hidden", "true");
      if (getComputedStyle(cell).position === "static") cell.style.position = "relative";
      cell.appendChild(handle);
    }
    handle.dataset.col = String(col);
  }
}

/* ---------------- freezing / widths ---------------- */

function measureColumns(table, layout) {
  const widths = layout.last.map((cell) => (cell.colSpan === 1 ? cell.getBoundingClientRect().width : 0));
  if (widths.some((w) => !w)) {
    // Columns under a spanning bottom-row cell: take them from a body row
    // with one cell per column, else split the spanning cell evenly.
    const fullRow = Array.from(table.tBodies)
      .flatMap((body) => Array.from(body.rows))
      .find((row) => row.cells.length === layout.count);
    widths.forEach((w, c) => {
      if (w) return;
      const cell = layout.last[c];
      widths[c] = fullRow
        ? fullRow.cells[c].getBoundingClientRect().width
        : cell.getBoundingClientRect().width / Math.max(1, cell.colSpan);
    });
  }
  return widths.map((w) => Math.max(MIN_WIDTH, Math.round(w)));
}

const sum = (list) => list.reduce((s, n) => s + n, 0);

function applyWidths(table, layout, widths) {
  const sticky = [];
  layout.last.forEach((cell, col) => {
    if (cell.colSpan !== 1) return;
    const style = getComputedStyle(cell);
    if (style.position !== "sticky") return;
    if (style.right !== "auto" && style.left === "auto") sticky.push({ col, side: "right" });
    else if (style.left !== "auto") sticky.push({ col, side: "left" });
  });

  let colgroup = Array.from(table.children).find((el) => el.classList?.contains(COLGROUP_CLASS));
  if (!colgroup) {
    colgroup = document.createElement("colgroup");
    colgroup.className = COLGROUP_CLASS;
    table.insertBefore(colgroup, table.firstChild);
  }
  const cols = widths.map((w) => {
    const col = document.createElement("col");
    col.style.width = `${w}px`;
    return col;
  });
  colgroup.replaceChildren(...cols);

  table.setAttribute(FROZEN_ATTR, "");
  table.style.tableLayout = "fixed";
  table.style.width = `${sum(widths)}px`;
  table.style.minWidth = "0px";
  table.style.maxWidth = "none";

  const state = { signature: layout.signature, widths: [...widths], cols, colgroup, sticky };
  frozen.set(table, state);
  updateSticky(table, state, layout);
  return state;
}

function unfreeze(table) {
  const state = frozen.get(table);
  state?.colgroup.remove();
  frozen.delete(table);
  table.removeAttribute(FROZEN_ATTR);
  table.style.tableLayout = "";
  table.style.width = "";
  table.style.minWidth = "";
  table.style.maxWidth = "";
  table.querySelectorAll(`:scope > * > tr > [${STICKY_ATTR}]`).forEach((cell) => {
    cell.style.left = "";
    cell.style.right = "";
    cell.removeAttribute(STICKY_ATTR);
  });
}

// Freezes the table at its current column widths (once per column layout).
function freeze(table) {
  const layout = headerLayout(table);
  if (!layout) return null;
  const state = frozen.get(table);
  if (state && state.signature === layout.signature && state.colgroup.isConnected) return state;
  if (state) unfreeze(table);
  return applyWidths(table, layout, measureColumns(table, layout));
}

function setWidth(table, state, col, width) {
  const w = Math.max(MIN_WIDTH, Math.round(width));
  if (state.widths[col] === w) return;
  state.widths[col] = w;
  state.cols[col].style.width = `${w}px`;
  table.style.width = `${sum(state.widths)}px`;
  if (state.sticky.length) updateSticky(table, state);
}

/* ---------------- sticky columns ---------------- */

const isSticky = (cell) => cell.classList.contains("sticky") || cell.style.position === "sticky";

// Pinned columns sit at the summed width of the pinned columns between them
// and their edge (e.g. Insights pinned the width of Recommendation in from
// the right) — recomputed from the current widths.
function updateSticky(table, state, layout = headerLayout(table)) {
  if (!state.sticky.length || !layout) return;
  const offsets = new Map();
  let left = 0;
  state.sticky.filter((s) => s.side === "left").sort((a, b) => a.col - b.col).forEach(({ col }) => {
    offsets.set(col, { side: "left", px: left });
    left += state.widths[col];
  });
  let right = 0;
  state.sticky.filter((s) => s.side === "right").sort((a, b) => b.col - a.col).forEach(({ col }) => {
    offsets.set(col, { side: "right", px: right });
    right += state.widths[col];
  });

  const place = (cell, col) => {
    const o = offsets.get(col);
    if (!o || !isSticky(cell)) return;
    const value = `${o.px}px`;
    if (cell.style[o.side] !== value) cell.style[o.side] = value;
    cell.setAttribute(STICKY_ATTR, "");
  };
  // Header cells covering exactly one pinned column…
  const seen = new Set();
  layout.grid.forEach((row) =>
    row.forEach((cell, col) => {
      if (cell.colSpan !== 1 || seen.has(cell)) return;
      seen.add(cell);
      place(cell, col);
    })
  );
  // …and the body / footer cells under them.
  [...table.tBodies, table.tFoot].filter(Boolean).forEach((section) => {
    for (const row of section.rows) {
      let col = 0;
      for (const cell of row.cells) {
        if (cell.colSpan === 1) place(cell, col);
        col += Math.max(1, cell.colSpan || 1);
      }
    }
  });
}

/* ---------------- remembered widths ---------------- */

const storageKey = (signature) => `${STORAGE_PREFIX}${window.location.pathname}|${signature}`;

function loadWidths(signature, count) {
  try {
    const widths = JSON.parse(window.localStorage.getItem(storageKey(signature)) || "null");
    return Array.isArray(widths) && widths.length === count && widths.every((w) => Number.isFinite(w)) ? widths : null;
  } catch {
    return null;
  }
}

function saveWidths(state) {
  try {
    window.localStorage.setItem(storageKey(state.signature), JSON.stringify(state.widths));
  } catch {
    // Storage full or blocked — widths just won't be remembered.
  }
}

/* ---------------- fit to content ---------------- */

// Widest content in the column (ignoring its current width), plus padding.
function contentWidth(table, layout, col) {
  const cells = [];
  layout.grid.forEach((row) => row[col]?.colSpan === 1 && cells.push(row[col]));
  let rows = 0;
  for (const section of table.tBodies) {
    for (const row of section.rows) {
      if (rows++ >= MAX_FIT_ROWS) break;
      let c = 0;
      for (const cell of row.cells) {
        if (c === col && cell.colSpan === 1) cells.push(cell);
        c += Math.max(1, cell.colSpan || 1);
      }
    }
  }

  const range = document.createRange();
  let widest = MIN_WIDTH;
  for (const cell of new Set(cells)) {
    let left = Infinity;
    let right = -Infinity;
    cell.childNodes.forEach((node) => {
      if (node.nodeType === 1 && node.classList.contains(HANDLE_CLASS)) return;
      range.selectNode(node);
      const rect = range.getBoundingClientRect();
      if (!rect.width) return;
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    });
    if (right <= left) continue;
    const style = getComputedStyle(cell);
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    widest = Math.max(widest, Math.ceil(right - left + padding + 2));
  }
  return Math.min(widest, MAX_FIT_WIDTH);
}

/* ---------------- events ---------------- */

const handleFrom = (target) => (target instanceof Element ? target.closest(`.${HANDLE_CLASS}`) : null);
let swallowNextClick = false;

function onPointerDown(e) {
  const handle = handleFrom(e.target);
  if (!handle || e.button !== 0) return;
  const table = handle.closest("table");
  const col = Number(handle.dataset.col);
  // Keeps the header's own handlers (sorting) and text selection out of it.
  e.preventDefault();
  e.stopPropagation();
  const state = table && freeze(table);
  if (!state || !Number.isInteger(col) || col >= state.widths.length) return;

  const startX = e.clientX;
  const startWidth = state.widths[col];
  let latestX = startX;
  let moved = false;
  let frame = 0;
  handle.classList.add("is-active");
  document.documentElement.classList.add("col-resizing");

  const apply = () => {
    frame = 0;
    setWidth(table, state, col, startWidth + latestX - startX);
  };
  const onMove = (ev) => {
    latestX = ev.clientX;
    if (Math.abs(latestX - startX) > 2) moved = true;
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const onUp = () => {
    if (frame) cancelAnimationFrame(frame);
    apply();
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onUp, true);
    handle.classList.remove("is-active");
    document.documentElement.classList.remove("col-resizing");
    if (moved) {
      saveWidths(state);
      // The click that ends a drag must not sort the column it lands on.
      swallowNextClick = true;
      setTimeout(() => {
        swallowNextClick = false;
      }, 0);
    }
  };
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", onUp, true);
}

function onClick(e) {
  if (swallowNextClick || handleFrom(e.target)) {
    e.preventDefault();
    e.stopPropagation();
    swallowNextClick = false;
  }
}

function onDoubleClick(e) {
  const handle = handleFrom(e.target);
  if (!handle) return;
  e.preventDefault();
  e.stopPropagation();
  const table = handle.closest("table");
  const col = Number(handle.dataset.col);
  const state = table && freeze(table);
  const layout = state && headerLayout(table);
  if (!layout || col >= state.widths.length) return;
  setWidth(table, state, col, contentWidth(table, layout, col));
  saveWidths(state);
}

/* ---------------- discovery ---------------- */

function enhance(table) {
  if (!table.isConnected || table.hasAttribute(OPT_OUT_ATTR)) return;
  const layout = headerLayout(table);
  if (!layout) return;
  ensureHandles(layout);

  const state = frozen.get(table);
  if (state) {
    if (state.signature === layout.signature && state.colgroup.isConnected) {
      // A re-render can drop the attribute or add rows; keep both in step.
      if (!table.hasAttribute(FROZEN_ATTR)) table.setAttribute(FROZEN_ATTR, "");
      updateSticky(table, state, layout);
      return;
    }
    unfreeze(table);
  }
  const saved = loadWidths(layout.signature, layout.count);
  if (saved) applyWidths(table, layout, saved);
}

/**
 * Starts column resizing for every table on the page, now and as they
 * render. Returns a function that stops it.
 */
export function installColumnResize() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return () => {};

  let dirty = new Set();
  let scanAll = true;
  let scheduled = 0;
  const flush = () => {
    scheduled = 0;
    const tables = scanAll ? document.querySelectorAll("table") : dirty;
    scanAll = false;
    dirty = new Set();
    tables.forEach(enhance);
  };
  const schedule = () => {
    if (!scheduled) scheduled = requestAnimationFrame(flush);
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const table = target?.closest("table");
      if (table) dirty.add(table);
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.tagName === "TABLE") dirty.add(node);
        else node.querySelectorAll("table").forEach((t) => dirty.add(t));
      });
    }
    if (dirty.size) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("dblclick", onDoubleClick, true);
  schedule();

  return () => {
    observer.disconnect();
    if (scheduled) cancelAnimationFrame(scheduled);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("dblclick", onDoubleClick, true);
  };
}
