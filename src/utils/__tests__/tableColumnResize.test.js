import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { installColumnResize } from "../tableColumnResize";

/*
 * Every table in the app gets resize handles without any page-level changes,
 * including the key/value drill-down tables that have no <thead>.
 */

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const render = async (html) => {
  document.body.innerHTML = html;
  await nextFrame();
  await nextFrame();
  return document.body.querySelector("table");
};

const handleColumns = (el) =>
  Array.from(el.querySelectorAll(".col-resize-handle")).map((h) => h.dataset.col);

describe("installColumnResize", () => {
  let stop;
  beforeEach(() => {
    stop = installColumnResize();
  });
  afterEach(() => {
    stop();
    document.body.innerHTML = "";
  });

  it("puts a handle on each column of the bottom header row", async () => {
    const table = await render(`<table><thead>
      <tr><th rowspan="2">Metric</th><th colspan="2">Jan</th></tr>
      <tr><th>Actual</th><th>Budget</th></tr>
    </thead><tbody><tr><td>Revenue</td><td>1</td><td>2</td></tr></tbody></table>`);
    expect(handleColumns(table.tHead)).toEqual(["0", "1", "2"]);
    expect(handleColumns(table.tBodies[0])).toEqual([]);
  });

  it("uses the first row of a table with no <thead>", async () => {
    const table = await render(`<table><tbody>
      <tr><td>Invoice</td><td>INV-1</td></tr>
      <tr><td>Amount</td><td>100</td></tr>
    </tbody></table>`);
    expect(handleColumns(table.rows[0])).toEqual(["0", "1"]);
    expect(handleColumns(table.rows[1])).toEqual([]);
  });

  it("leaves an empty table and an opted-out table alone", async () => {
    document.body.innerHTML = `<table id="empty"><tbody></tbody></table>
      <table data-no-col-resize><tbody><tr><td>A</td></tr></tbody></table>`;
    await nextFrame();
    await nextFrame();
    expect(document.querySelectorAll(".col-resize-handle")).toHaveLength(0);
  });
});
