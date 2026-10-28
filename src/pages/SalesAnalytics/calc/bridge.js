// GP variance bridge for staffing: explains GP(current) − GP(base) as volume,
// hours, client mix, bill rate, pay rate, burden, other direct costs and
// placement fees. Sequential substitution, so the steps sum exactly.
//
// Each segment (client or vertical) carries totals for the window:
//   H  billed hours           N  contractor-months (average active × months)
//   R  time revenue           W  wages
//   burden                    (ODC and fees are passed at the top level)
// Derived per segment: B = R/H (bill per billed hour), P = W/H (wage per
// billed hour), u = burden/W, spread s = B − P(1+u).

export const BRIDGE_STEPS = [
  { key: "volume", label: "Contractor volume" },
  { key: "hours", label: "Hours per contractor" },
  { key: "mix", label: "Client mix" },
  { key: "billRate", label: "Bill rate" },
  { key: "payRate", label: "Pay rate" },
  { key: "burden", label: "Payroll burden" },
  { key: "odc", label: "Other direct costs" },
  { key: "fees", label: "Placement fees" },
];

const derive = (seg) => {
  const H = seg.H || 0;
  const B = H ? seg.R / H : 0;
  const P = H ? seg.W / H : 0;
  const u = seg.W ? seg.burden / seg.W : 0;
  return { H, N: seg.N || 0, B, P, u, s: B - P * (1 + u) };
};

const timeGp = (segs) => {
  let sum = 0;
  for (const seg of segs.values()) sum += seg.R - seg.W - seg.burden;
  return sum;
};

/**
 * `base` and `current`: { segments: Map<key, {H, N, R, W, burden}>, odc, fees }.
 * Returns { baseGp, currentGp, steps: [{key, label, amount}] }.
 */
export function gpBridge(base, current) {
  const baseGp = timeGp(base.segments) - (base.odc || 0) + (base.fees || 0);
  const currentGp = timeGp(current.segments) - (current.odc || 0) + (current.fees || 0);
  const odcStep = -((current.odc || 0) - (base.odc || 0));
  const feeStep = (current.fees || 0) - (base.fees || 0);

  const d0 = new Map([...base.segments].map(([k, v]) => [k, derive(v)]));
  const d1 = new Map([...current.segments].map(([k, v]) => [k, derive(v)]));
  const sumBy = (map, f) => [...map.values()].reduce((s, v) => s + f(v), 0);

  const H0 = sumBy(d0, (v) => v.H);
  const H1 = sumBy(d1, (v) => v.H);
  const N0 = sumBy(d0, (v) => v.N);
  const N1 = sumBy(d1, (v) => v.N);
  const time0 = timeGp(base.segments);
  const time1 = timeGp(current.segments);

  const steps = { volume: 0, hours: 0, mix: 0, billRate: 0, payRate: 0, burden: 0, odc: odcStep, fees: feeStep };

  if (!H0 || !N0) {
    // Nothing billed in the base: every billed hour now is new volume.
    steps.volume = time1 - time0;
  } else if (!H1 || !N1) {
    steps.volume = time1 - time0;
  } else {
    const S0 = time0 / H0;
    const h0 = H0 / N0;
    const h1 = H1 / N1;
    steps.volume = (N1 - N0) * h0 * S0;
    steps.hours = N1 * (h1 - h0) * S0;

    // Segments new in the current window take their own current rates as the
    // base, so their whole effect lands in mix rather than in rate steps.
    let mixSpread = 0;
    for (const [k, c] of d1) {
      const b = d0.get(k) || c;
      const w = c.H / H1;
      mixSpread += w * b.s;
      steps.billRate += H1 * w * (c.B - b.B);
      steps.payRate += -H1 * w * (c.P - b.P) * (1 + b.u);
      steps.burden += -H1 * w * c.P * (c.u - b.u);
    }
    steps.mix = H1 * (mixSpread - S0);
  }

  return {
    baseGp,
    currentGp,
    steps: BRIDGE_STEPS.map(({ key, label }) => ({ key, label, amount: steps[key] })),
  };
}

/**
 * For comparisons without drivers (Board Plan, Finance Forecast): revenue
 * volume at the base margin, then the margin change on current revenue.
 */
export function twoFactorBridge({ revenue: R0, gp: GP0 }, { revenue: R1, gp: GP1 }) {
  const gm0 = R0 ? GP0 / R0 : 0;
  const volume = (R1 - R0) * gm0;
  return {
    baseGp: GP0,
    currentGp: GP1,
    steps: [
      { key: "volume", label: "Revenue volume", amount: volume },
      { key: "margin", label: "Gross margin rate", amount: GP1 - GP0 - volume },
    ],
  };
}
