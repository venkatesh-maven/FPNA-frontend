// Recruiting metrics for the recruiters in view: the candidate funnel (job
// orders, submittals, interviews, offers, placements), conversion and
// quality, speed, open job orders and retention. Every event belongs to the
// recruiter who worked the job order, so the same numbers roll up from
// recruiter to lead, account manager and director without double counting.

import { addDays, addMonths, dayDiff, minDate, monthEnd, monthRange, monthStart, toYm } from "../../calc/dates";

/** An assignment that ends this soon after starting, for a reason other than plan or conversion, is a fall-off. */
export const FALL_OFF_DAYS = 30;
/** Retention is measured this many days after start. */
export const RETENTION_DAYS = 90;
/** Open job orders older than this are aging. */
export const AGING_DAYS = 30;

const empty = () => ({
  opened: 0, submittals: 0, interviews: 0, offers: 0, accepted: 0, declined: 0, filled: 0, cancelled: 0,
  subDecided: 0, subInterviewed: 0, ivDecided: 0, ivOffered: 0,
  contractStarts: 0, permPlacements: 0, permFees: 0, fallOffs: 0, refunds: 0, redeployed: 0, extensions: 0, conversions: 0, ends: 0,
  submitDays: 0, submitN: 0, fillDays: 0, fillN: 0, startDays: 0, startN: 0,
});
const inRange = (d, from, to) => !!d && d >= from && d <= to;
const placementPass = (ctx, type) => !ctx.filters.placementType.length || ctx.filters.placementType.includes(type);

/**
 * Recruiting event counts between two dates (inclusive): the total, or a Map
 * per key when `keyOf(record)` is given (records carry recruiterId and clientId).
 */
export function recruitingCounts(ctx, from, to, keyOf = null) {
  const map = new Map();
  const add = (rec, field, n = 1) => {
    const k = keyOf ? keyOf(rec) : "_";
    if (k == null) return;
    let t = map.get(k);
    if (!t) map.set(k, (t = empty()));
    t[field] += n;
  };

  for (const r of ctx.ds.requisitions) {
    if (!ctx.requisitionPass(r)) continue;
    if (inRange(r.openedDate, from, to)) add(r, "opened");
    const first = r.submittals[0];
    if (first && inRange(first.date, from, to)) {
      add(r, "submitDays", dayDiff(r.openedDate, first.date));
      add(r, "submitN");
    }
    for (const s of r.submittals) {
      // Conversion follows each cohort to its outcome; candidates still awaiting a decision are left out.
      if (inRange(s.date, from, to)) {
        add(r, "submittals");
        if (s.interviewDate) {
          add(r, "subDecided");
          add(r, "subInterviewed");
        } else if (s.outcome !== "submitted") add(r, "subDecided");
      }
      if (inRange(s.interviewDate, from, to)) {
        add(r, "interviews");
        if (s.offerDate) {
          add(r, "ivDecided");
          add(r, "ivOffered");
        } else if (s.outcome !== "interviewing") add(r, "ivDecided");
      }
      if (inRange(s.offerDate, from, to)) {
        add(r, "offers");
        if (s.outcome === "placed") add(r, "accepted");
        else if (s.outcome === "declined") add(r, "declined");
      }
    }
    if (r.status === "filled" && inRange(r.filledDate, from, to)) {
      add(r, "filled");
      add(r, "fillDays", dayDiff(r.openedDate, r.filledDate));
      add(r, "fillN");
    }
    if (r.status === "cancelled" && inRange(r.closedDate, from, to)) add(r, "cancelled");
  }

  for (const a of ctx.ds.assignments) {
    if (!ctx.assignmentPass(a)) continue;
    if (inRange(a.startDate, from, to)) {
      add(a, "contractStarts");
      if (a.redeployedFrom) add(a, "redeployed");
      const req = ctx.index.requisitionById.get(a.requisitionId);
      if (req?.filledDate) {
        add(a, "startDays", dayDiff(req.filledDate, a.startDate));
        add(a, "startN");
      }
      if (a.actualEndDate && dayDiff(a.startDate, a.actualEndDate) <= FALL_OFF_DAYS && !["planned", "converted"].includes(a.endReason)) add(a, "fallOffs");
    }
    if (inRange(a.actualEndDate, from, to)) {
      add(a, "ends");
      if (a.endReason === "converted") add(a, "conversions");
    }
    if (a.extensions > 0 && inRange(a.originalPlannedEndDate, from, to)) add(a, "extensions");
  }

  if (placementPass(ctx, "direct")) {
    const fromYm = toYm(from);
    const toYmv = toYm(to);
    for (const p of ctx.ds.placements) {
      if (!ctx.repSet.has(p.recruiterId) || !ctx.credit.has(p.clientId)) continue;
      if (inRange(p.placementDate, from, to)) {
        add(p, "permPlacements");
        add(p, "permFees", p.fee);
      }
      if (p.refundYm && p.refundYm >= fromYm && p.refundYm <= toYmv) add(p, "refunds");
    }
  }
  return keyOf ? map : map.get("_") || empty();
}

const ratio = (a, b) => (b ? (a / b) * 100 : null);

/** Rates, averages and placements from raw counts. */
export function deriveRecruiting(t) {
  const placements = t.contractStarts + t.permPlacements;
  return {
    ...t,
    placements,
    subToInterview: ratio(t.subInterviewed, t.subDecided),
    interviewToOffer: ratio(t.ivOffered, t.ivDecided),
    offerAcceptance: ratio(t.accepted, t.accepted + t.declined),
    fillRate: ratio(t.filled, t.filled + t.cancelled),
    fallOffRate: ratio(t.fallOffs + t.refunds, placements),
    submittalsPerHire: t.accepted ? t.submittals / t.accepted : null,
    daysToSubmit: t.submitN ? t.submitDays / t.submitN : null,
    daysToFill: t.fillN ? t.fillDays / t.fillN : null,
    daysToStart: t.startN ? t.startDays / t.startN : null,
  };
}

/** Sum raw counts (e.g. recruiters into a team) before deriving rates. */
export function addCounts(into, t) {
  for (const k of Object.keys(into)) into[k] += t?.[k] || 0;
  return into;
}
export const emptyCounts = empty;

/** Furthest stage a job order had reached on a date. */
const stageOn = (r, date) => {
  const subs = r.submittals.filter((s) => s.date <= date);
  if (subs.some((s) => s.offerDate && s.offerDate <= date)) return "Offer";
  if (subs.some((s) => s.interviewDate && s.interviewDate <= date)) return "Interviewing";
  return subs.length ? "Submitted" : "Sourcing";
};

/** Job orders open on a date: count, aging count, and one row each. */
export function openJobOrders(ctx, date, keyOf = null) {
  const rows = [];
  for (const r of ctx.ds.requisitions) {
    if (!ctx.requisitionPass(r) || r.openedDate > date || (r.closedDate && r.closedDate <= date)) continue;
    const subs = r.submittals.filter((s) => s.date <= date);
    rows.push({
      id: r.id,
      key: keyOf ? keyOf(r) : "_",
      clientId: r.clientId,
      client: ctx.index.clientById.get(r.clientId)?.name,
      recruiterId: r.recruiterId,
      recruiter: ctx.index.repById.get(r.recruiterId)?.name,
      openedDate: r.openedDate,
      daysOpen: dayDiff(r.openedDate, date),
      stage: stageOn(r, date),
      submittals: subs.length,
      interviews: subs.filter((s) => s.interviewDate && s.interviewDate <= date).length,
      offers: subs.filter((s) => s.offerDate && s.offerDate <= date).length,
    });
  }
  rows.sort((a, b) => b.daysOpen - a.daysOpen);
  return { count: rows.length, aging: rows.filter((r) => r.daysOpen > AGING_DAYS).length, rows };
}

/** Share of contractors who started 90–180 days before `date` and were still on assignment (or converted) 90 days in. */
export function retention(ctx, date, keyOf = null) {
  const from = addDays(date, -2 * RETENTION_DAYS);
  const to = addDays(date, -RETENTION_DAYS);
  const map = new Map();
  for (const a of ctx.ds.assignments) {
    if (!ctx.assignmentPass(a) || !inRange(a.startDate, from, to)) continue;
    const k = keyOf ? keyOf(a) : "_";
    const t = map.get(k) || { cohort: 0, retained: 0 };
    t.cohort += 1;
    if (!a.actualEndDate || a.endReason === "converted" || dayDiff(a.startDate, a.actualEndDate) >= RETENTION_DAYS) t.retained += 1;
    map.set(k, t);
  }
  const rate = (t) => ({ ...t, rate: ratio(t.retained, t.cohort) });
  if (keyOf) return new Map([...map].map(([k, t]) => [k, rate(t)]));
  return rate(map.get("_") || { cohort: 0, retained: 0 });
}

/** Funnel activity for each of the last twelve months (the as-of month to date). */
export function recruitingByMonth(ctx, months = 12) {
  const { asOf, asOfYm } = ctx.ds.meta;
  return monthRange(addMonths(asOfYm, -(months - 1)), asOfYm).map((ym) => {
    const t = deriveRecruiting(recruitingCounts(ctx, monthStart(ym), minDate(monthEnd(ym), asOf)));
    return { ym, ...t };
  });
}
