import { DEFAULT_FILTERS, FILTER_FIELDS } from "./filterSchema";

/** Filters → URL params, leaving out defaults so links stay short. */
export function encodeFilters(filters) {
  const params = new URLSearchParams();
  for (const f of FILTER_FIELDS) {
    const v = filters?.[f.key];
    if (f.type === "multi") {
      if (Array.isArray(v) && v.length) params.set(f.url, v.join(","));
    } else if (v != null && v !== "" && v !== f.default) {
      params.set(f.url, String(v));
    }
  }
  return params;
}

/** URL params → full filter state (anything missing takes its default). */
export function decodeFilters(params) {
  const out = { ...DEFAULT_FILTERS };
  for (const f of FILTER_FIELDS) {
    const raw = params.get(f.url);
    if (raw == null) continue;
    out[f.key] = f.type === "multi" ? raw.split(",").filter(Boolean) : raw;
  }
  return out;
}

/** True when the params carry any filter at all. */
export const hasFilterParams = (params) => FILTER_FIELDS.some((f) => params.has(f.url));
