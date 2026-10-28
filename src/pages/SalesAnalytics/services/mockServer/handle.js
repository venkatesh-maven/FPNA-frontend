import { getDataset } from "../../mock/dataset";
import { resolveEffectiveAccess, canAny } from "../../access/accessEngine";
import { accessStore } from "../store/stores";
import { buildQueryContext } from "./queryContext";
import { maskFields } from "./masking";
import { APPLIES_TO } from "../../filters/filterSchema";
import { DATASET_CURRENCY, DATASET_VERSION, MOCK_LATENCY_MS } from "../../config/dataset";

export class ForbiddenError extends Error {
  constructor(message = "You don't have access to this view.") {
    super(message);
    this.name = "ForbiddenError";
    this.status = 403;
  }
}

export const mockConfig = { latency: true };

const latency = () =>
  mockConfig.latency
    ? new Promise((r) => setTimeout(r, MOCK_LATENCY_MS.min + Math.random() * (MOCK_LATENCY_MS.max - MOCK_LATENCY_MS.min)))
    : Promise.resolve();

/** What the server would derive from the session token. */
export function resolveAccess(viewer) {
  const ds = getDataset();
  return resolveEffectiveAccess(accessStore.read(), ds.org, viewer?.userId, ds.meta.asOf);
}

/**
 * One gate for every read: resolve the viewer's access, check capability,
 * build the scoped query context, run the view, mask restricted fields and
 * wrap the result with the context the footer shows.
 */
export function handle(requiredAny, view, { contextOptions } = {}) {
  return async (filters, viewer, args = {}) => {
    await latency();
    const ds = getDataset();
    const access = resolveAccess(viewer);
    if (requiredAny.length && !canAny(access, requiredAny)) throw new ForbiddenError();
    const ctx = buildQueryContext(ds, filters, access, contextOptions ? contextOptions(args, access, ds) : undefined);
    const { data, families = ["actuals"], sources = [], notes = [] } = view(ctx, args);
    return {
      data: maskFields(data, access.maskedFields),
      meta: buildMeta(ctx, { families, sources, notes }),
    };
  };
}

export function buildMeta(ctx, { families, sources, notes }) {
  const active = new Set(families.flatMap((fam) => ctx.notApplied(fam)));
  const ignoredFilters = [...active].filter((k) => families.every((fam) => !APPLIES_TO[fam].includes(k)));
  const allNotes = [...notes];
  if (ctx.sliceActive && families.includes("expenses")) {
    allNotes.push("Sales expenses are allocated to the filtered clients in proportion to the GP they produced.");
  }
  return {
    period: {
      label: ctx.period.label,
      from: ctx.period.from,
      to: ctx.period.to,
      endDate: ctx.endDate,
      isPartial: ctx.period.isPartial,
    },
    compareBasis: ctx.compare.label,
    compareKind: ctx.compare.kind,
    unit: "USD",
    currency: DATASET_CURRENCY,
    asOf: ctx.ds.meta.asOf,
    sources,
    scope: { label: ctx.access.scope.label, kind: ctx.access.scope.kind, repCount: ctx.reps.length },
    maskedFields: [...ctx.access.maskedFields],
    ignoredFilters,
    notes: allNotes,
    datasetVersion: DATASET_VERSION,
  };
}
