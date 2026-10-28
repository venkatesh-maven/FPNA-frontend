import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockConfig } from "../../../services/mockServer/handle";
import { forecastStore, scenarioStore, viewAsStore } from "../../../services/store/stores";
import { SalesAccessProvider } from "../../../access/SalesAccessContext";
import { SalesFiltersProvider } from "../../../filters/SalesFiltersContext";
import WhatIfPage from "../WhatIfPage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
mockConfig.latency = false;

const flush = async (n = 12) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};
const find = (root, selector, re) => [...root.querySelectorAll(selector)].find((el) => re.test(el.textContent.trim()));
const card = (root, label) => find(root, "span", new RegExp(`^${label}$`))?.parentElement?.children[1]?.textContent;
const click = (el) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const type = (el, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

let container;
let root;
beforeAll(async () => {
  forecastStore.reset();
  scenarioStore.reset();
  viewAsStore.write({ userId: "R03" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/sales-analytics/what-if"]}>
        <SalesAccessProvider>
          <SalesFiltersProvider>
            <Routes>
              <Route path="/sales-analytics/what-if" element={<WhatIfPage />} />
            </Routes>
          </SalesFiltersProvider>
        </SalesAccessProvider>
      </MemoryRouter>
    );
  });
  await flush(30);
});

afterAll(async () => {
  await act(async () => root.unmount());
  container.remove();
  forecastStore.reset();
  scenarioStore.reset();
  viewAsStore.reset();
});

describe("What-If page", { timeout: 60000 }, () => {
  it("models a change, saves it, makes it the forecast and submits it", async () => {
    expect(container.textContent).toMatch(/What-If & My Forecast/);
    const gpBefore = card(container, "Quarter GP");
    expect(gpBefore).toMatch(/\$/);

    await click(find(container, "button[role=tab]", /^Rates, hours & clients/));
    await type(container.querySelector('input[aria-label="Bill rate change for all clients"]'), 5);
    await flush();
    expect(card(container, "Quarter GP")).not.toBe(gpBefore);
    expect(container.textContent).toMatch(/1 change from baseline/);

    await type(container.querySelector('input[aria-label="Scenario name"]'), "Rates up 5%");
    await click(find(container, "button", /^Save scenario$/));
    await flush();
    expect(container.textContent).toMatch(/Saved “Rates up 5%”/);

    await click(find(container, "button", /Use as My Recruiting Forecast/));
    await flush();
    expect(container.textContent).toMatch(/is now your recruiting forecast/);

    await click(find(container, "button", /^(Resubmit to Account Manager|Submit to Account Manager|Submit a new version)$/));
    await click(find(container, "button", /Confirm submit/));
    await flush(20);
    expect(container.textContent).toMatch(/Version \d+ submitted to your account manager/);
    const latest = forecastStore
      .read()
      .submissions.filter((s) => s.repId === "R03" && s.status !== "superseded")
      .sort((a, b) => b.version - a.version)[0];
    expect(latest.status).toBe("submitted");
    expect(latest.scenarioName).toBe("Rates up 5%");
    expect(latest.snapshot.assumptions.global.billRatePct).toBe(5);
  });
});
