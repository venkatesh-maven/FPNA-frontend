/**
 * Field-level protection, applied to every response before it leaves the
 * service: restricted keys come back null, KPI tiles keyed by a restricted
 * metric come back without values, and table rows list the cells they lost
 * in `__masked` (so exports print "Restricted" rather than a blank).
 */
export function maskFields(data, masked) {
  if (!masked || !masked.size) return data;
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      if (typeof v.key === "string" && masked.has(v.key) && "value" in v) {
        return { ...v, value: null, comparisons: [], series: null, sub: null, masked: true };
      }
      const out = {};
      let hit = null;
      for (const [k, x] of Object.entries(v)) {
        if (masked.has(k)) {
          out[k] = null;
          (hit ||= []).push(k);
        } else out[k] = walk(x);
      }
      if (hit) out.__masked = [...(v.__masked || []), ...hit];
      return out;
    }
    return v;
  };
  return walk(data);
}
