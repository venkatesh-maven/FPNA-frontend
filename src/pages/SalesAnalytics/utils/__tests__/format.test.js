import { afterEach, describe, expect, it } from "vitest";
import { compactMoney, money, rate, setCurrencyUnit, signedMoney } from "../format";

afterEach(() => setCurrencyUnit(null));

describe("Currency Unit", () => {
  it("leaves figures alone when the screen doesn't offer it", () => {
    expect(compactMoney(4772450)).toBe("$4.77M");
    expect(money(4772450)).toBe("$4,772,450");
  });

  it("Actual shows full dollars, even where a figure is normally compact", () => {
    setCurrencyUnit("actualvalue");
    expect(compactMoney(4772450)).toBe("$4,772,450");
  });

  it("Thousands and Millions scale every money figure the same way", () => {
    setCurrencyUnit("thousands");
    expect(compactMoney(4772450)).toBe("$4,772.5K");
    expect(money(-1500)).toBe("-$1.5K");
    setCurrencyUnit("millions");
    expect(money(4772450)).toBe("$4.77M");
    expect(signedMoney(-2500000)).toBe("-$2.50M");
  });

  it("keeps blanks and hourly rates as they are", () => {
    setCurrencyUnit("millions");
    expect(money(null)).toBe("—");
    expect(rate(45.5)).toBe("$45.50/hr");
  });
});
