import { describe, it, expect } from "vitest";
import { planPageSlices } from "../exportPagePdf";

const crossesAny = (slices, keeps) =>
  slices.some((s) => keeps.some((k) => !s.shrink && k.top < s.end - 0.5 && k.bottom > s.end + 0.5));

describe("PDF page breaks", () => {
  it("never breaks through a kept block", () => {
    // Header, KPI row, then rows of chart cards beside a tall alerts panel.
    const keeps = [
      { top: 0, bottom: 90 },
      { top: 114, bottom: 230 },
      { top: 254, bottom: 650 }, { top: 254, bottom: 640 }, // charts row 1
      { top: 254, bottom: 820 }, // alerts panel beside them
      { top: 674, bottom: 1070 }, { top: 674, bottom: 1060 }, // charts row 2
      { top: 1094, bottom: 1490 }, { top: 1094, bottom: 1480 }, // charts row 3
      { top: 1514, bottom: 1800 }, // executive insight
    ];
    const slices = planPageSlices(1800, keeps, 700);
    expect(crossesAny(slices, keeps)).toBe(false);
    expect(slices[0].start).toBe(0);
    expect(slices.at(-1).end).toBe(1800);
    slices.slice(1).forEach((s, i) => expect(s.start).toBe(slices[i].end));
    slices.forEach((s) => expect(s.end - s.start <= 700 || s.shrink).toBe(true));
  });

  it("gives a block taller than a page its own shrunk page", () => {
    const keeps = [{ top: 0, bottom: 100 }, { top: 120, bottom: 1000 }, { top: 1020, bottom: 1100 }];
    const slices = planPageSlices(1100, keeps, 600);
    expect(slices).toContainEqual({ start: 120, end: 1000, shrink: true });
    expect(crossesAny(slices, keeps)).toBe(false);
  });

  it("fits everything on one page when it's short enough", () => {
    expect(planPageSlices(500, [{ top: 0, bottom: 500 }], 700)).toEqual([{ start: 0, end: 500, shrink: false }]);
  });
});
