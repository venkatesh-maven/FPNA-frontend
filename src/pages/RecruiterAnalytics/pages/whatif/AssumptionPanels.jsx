import React, { useMemo, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { addDays, formatDate, formatYm, toYm } from "../../calc/dates";
import { money, pct, rate } from "../../utils/format";
import { Check, DateInput, Field, Grid, NumInput, td, tdLeft } from "./inputs";

const restrictedNote = (what) => (
  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
    {what} is restricted for your role, so GP is modeled with each client's cost ratio and pay inputs are hidden.
  </p>
);

/* ---------------- existing contractors ---------------- */

export function ExistingPanel({ baseline, a, set, costDetail }) {
  const [onlyEnding, setOnlyEnding] = useState(false);
  const [q, setQ] = useState("");
  const qEnd = baseline.quarter.to;
  const clientName = useMemo(() => new Map(baseline.clients.map((c) => [c.id, c.name])), [baseline]);
  const rows = baseline.assignments.filter(
    (x) =>
      (!onlyEnding || x.plannedEndDate <= qEnd) &&
      (!q || `${x.contractor} ${clientName.get(x.clientId)} ${x.title}`.toLowerCase().includes(q.toLowerCase()))
  );
  const ending = baseline.assignments.filter((x) => x.plannedEndDate <= qEnd).length;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Field label="Extension probability" hint={`For the ${ending} assignments ending this quarter. Historical rate ${baseline.defaults.extensionProbability}%.`}>
          <NumInput value={a.global.extensionProbability} placeholder={baseline.defaults.extensionProbability} onChange={(v) => set.global("extensionProbability", v)} min={0} max={100} suffix="%" label="Extension probability" />
        </Field>
        <Field label="Show" hint="Search by contractor, client or role">
          <span className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-32 rounded border border-sky-200 px-1.5 py-0.5 text-xs" />
            <Check checked={onlyEnding} onChange={setOnlyEnding}>Ending this quarter</Check>
          </span>
        </Field>
      </div>
      <Grid head={["Contractor · client", "Planned end", "Extension %", "End early", "Hrs / week", "Bill rate", ...(costDetail ? ["Pay rate"] : [])]}>
        {rows.map((x) => {
          const ov = a.assignments[x.id] || {};
          const endsInQ = x.plannedEndDate <= qEnd;
          return (
            <tr key={x.id} className="hover:bg-sky-50/50">
              <td className={tdLeft}>
                <span className="font-medium">{x.contractor}</span>
                <span className="block max-w-[200px] truncate text-[10px] text-slate-500" title={`${clientName.get(x.clientId)} · ${x.title} · ${x.placementType}`}>
                  {clientName.get(x.clientId)} · {x.title}
                </span>
              </td>
              <td className={`${td} ${endsInQ ? "font-semibold text-amber-700" : ""}`}>{formatDate(x.plannedEndDate)}</td>
              <td className={td}>
                {endsInQ ? (
                  <NumInput value={ov.extensionProbability} placeholder={a.global.extensionProbability ?? baseline.defaults.extensionProbability} onChange={(v) => set.assignment(x.id, "extensionProbability", v)} min={0} max={100} width="w-14" suffix="%" label={`Extension probability for ${x.contractor}`} />
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className={td}>
                <DateInput value={ov.endDate} onChange={(v) => set.assignment(x.id, "endDate", v)} min={addDays(baseline.quarter.asOf, 1)} max={x.plannedEndDate} label={`End date for ${x.contractor}`} />
              </td>
              <td className={td}>
                <NumInput value={ov.hoursPerWeek} placeholder={x.effWeeklyHours.toFixed(1)} onChange={(v) => set.assignment(x.id, "hoursPerWeek", v)} min={0} max={80} width="w-14" label={`Hours per week for ${x.contractor}`} />
              </td>
              <td className={td}>
                <NumInput value={ov.billRate} placeholder={x.billRate.toFixed(2)} onChange={(v) => set.assignment(x.id, "billRate", v)} min={0} width="w-16" prefix="$" label={`Bill rate for ${x.contractor}`} />
              </td>
              {costDetail ? (
                <td className={td}>
                  <NumInput value={ov.payRate} placeholder={x.payRate?.toFixed(2)} onChange={(v) => set.assignment(x.id, "payRate", v)} min={0} width="w-16" prefix="$" label={`Pay rate for ${x.contractor}`} />
                </td>
              ) : null}
            </tr>
          );
        })}
      </Grid>
      {!rows.length ? <p className="text-xs text-slate-500">No assignments match.</p> : null}
    </div>
  );
}

/* ---------------- rates, hours and client attrition ---------------- */

export function RatesPanel({ baseline, a, set, costDetail, highlight = [] }) {
  const months = baseline.quarter.months.filter((m) => m >= toYm(baseline.quarter.asOf));
  const active = useMemo(() => {
    const m = new Map();
    for (const x of baseline.assignments) m.set(x.clientId, (m.get(x.clientId) || 0) + 1);
    return m;
  }, [baseline]);
  const clients = [...baseline.clients].sort((x, y) => (active.get(y.id) || 0) - (active.get(x.id) || 0));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Field label="Bill rates, all clients" hint="Applies on top of any client change">
          <NumInput value={a.global.billRatePct} neutral={0} placeholder={0} onChange={(v) => set.global("billRatePct", v)} step={0.5} suffix="%" label="Bill rate change for all clients" />
        </Field>
        {costDetail ? (
          <Field label="Pay rates, all clients">
            <NumInput value={a.global.payRatePct} neutral={0} placeholder={0} onChange={(v) => set.global("payRatePct", v)} step={0.5} suffix="%" label="Pay rate change for all clients" />
          </Field>
        ) : null}
        <Field label="Hours worked, all clients" hint="Overtime, shorter weeks or holidays">
          <NumInput value={a.global.hoursPct} neutral={0} placeholder={0} onChange={(v) => set.global("hoursPct", v)} step={0.5} suffix="%" label="Hours change for all clients" />
        </Field>
        <Field label="Rate changes take effect">
          <select value={a.global.rateEffectiveYm || months[0]} onChange={(e) => set.global("rateEffectiveYm", e.target.value)} className="rounded border border-sky-200 bg-white px-1.5 py-0.5 text-xs">
            {months.map((m) => (
              <option key={m} value={m}>{formatYm(m)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Grid head={["Client", "Your GP share", "Active", "Bill rate %", ...(costDetail ? ["Pay rate %"] : []), "Hours %", "Client lost", "From", "Delay starts (wks)"]}>
        {clients.map((c) => {
          const r = a.clients[c.id] || {};
          return (
            <tr key={c.id} className={highlight.includes(c.id) ? "bg-amber-50/60" : "hover:bg-sky-50/50"}>
              <td className={tdLeft}>
                <span className="font-medium">{c.name}</span>
                <span className="block text-[10px] text-slate-500">{c.vertical} · {c.serviceType}{c.isMsp ? " · MSP" : ""}</span>
              </td>
              <td className={td}>{pct(c.share * 100, 0)}</td>
              <td className={td}>{active.get(c.id) || 0}</td>
              <td className={td}>
                <NumInput value={r.billRatePct} placeholder={0} onChange={(v) => set.client(c.id, "billRatePct", v)} step={0.5} width="w-16" suffix="%" label={`Bill rate change at ${c.name}`} />
              </td>
              {costDetail ? (
                <td className={td}>
                  <NumInput value={r.payRatePct} placeholder={0} onChange={(v) => set.client(c.id, "payRatePct", v)} step={0.5} width="w-16" suffix="%" label={`Pay rate change at ${c.name}`} />
                </td>
              ) : null}
              <td className={td}>
                <NumInput value={r.hoursPct} placeholder={0} onChange={(v) => set.client(c.id, "hoursPct", v)} step={1} width="w-16" suffix="%" label={`Hours change at ${c.name}`} />
              </td>
              <td className={td}>
                <Check checked={r.lose} onChange={(v) => set.client(c.id, "lose", v || null)} label={`Client ${c.name} lost`} />
              </td>
              <td className={td}>
                {r.lose ? <DateInput value={r.loseFrom} onChange={(v) => set.client(c.id, "loseFrom", v)} min={addDays(baseline.quarter.asOf, 1)} max={baseline.quarter.to} label={`${c.name} lost from`} /> : <span className="text-slate-400">—</span>}
              </td>
              <td className={td}>
                <NumInput value={r.delayStartsWeeks} placeholder={0} onChange={(v) => set.client(c.id, "delayStartsWeeks", v)} min={0} max={12} width="w-14" label={`Delay starts at ${c.name}`} />
              </td>
            </tr>
          );
        })}
      </Grid>
      <p className="text-[11px] text-slate-500">A lost client ends all its assignments and planned starts from the date given (the next day if left empty). Delays push new starts and pipeline starts at that client back.</p>
    </div>
  );
}

/* ---------------- new starts ---------------- */

export function StartsPanel({ baseline, a, set, costDetail }) {
  const avg = useMemo(() => {
    const by = new Map();
    for (const x of baseline.assignments) {
      const t = by.get(x.clientId) || { bill: 0, pay: 0, n: 0 };
      t.bill += x.billRate;
      t.pay += x.payRate || 0;
      t.n += 1;
      by.set(x.clientId, t);
    }
    const all = baseline.assignments;
    return { by, bill: all.reduce((s, x) => s + x.billRate, 0) / (all.length || 1), pay: all.reduce((s, x) => s + (x.payRate || 0), 0) / (all.length || 1) };
  }, [baseline]);
  const add = () => {
    const c = baseline.clients[0];
    const t = c && avg.by.get(c.id);
    set.addStart({
      id: `ns-${Date.now().toString(36)}`,
      clientId: c?.id || null,
      name: "",
      count: 1,
      startDate: addDays(baseline.quarter.asOf, 10),
      durationMonths: 6,
      hoursPerWeek: 40,
      billRate: Math.round((t ? t.bill / t.n : avg.bill) * 4) / 4,
      payRate: costDetail ? Math.round((t ? t.pay / t.n : avg.pay) * 100) / 100 : null,
      committed: false,
    });
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          Contractors you expect to place. Committed starts count as confirmed; the rest are upside.
        </p>
        <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-md bg-sky-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-800">
          <FiPlus size={12} /> Add start
        </button>
      </div>
      {a.newStarts.length ? (
        <Grid head={["Client", "Contractors", "Start", "Months", "Hrs / week", "Bill rate", ...(costDetail ? ["Pay rate"] : []), "Committed", ""]}>
          {a.newStarts.map((s, i) => (
            <tr key={s.id}>
              <td className={tdLeft}>
                <select
                  value={s.clientId || ""}
                  onChange={(e) => set.updateStart(i, { clientId: e.target.value || null })}
                  className="max-w-[180px] rounded border border-sky-200 bg-white px-1 py-0.5 text-xs"
                  aria-label="Client for new start"
                >
                  {baseline.clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="">New client…</option>
                </select>
                {!s.clientId ? (
                  <input value={s.name || ""} onChange={(e) => set.updateStart(i, { name: e.target.value })} placeholder="Client name" className="ml-1 w-28 rounded border border-sky-200 px-1 py-0.5 text-xs" />
                ) : null}
              </td>
              <td className={td}><NumInput value={s.count} onChange={(v) => set.updateStart(i, { count: v })} min={1} max={50} width="w-14" label="Contractors" /></td>
              <td className={td}><DateInput value={s.startDate} onChange={(v) => set.updateStart(i, { startDate: v })} min={addDays(baseline.quarter.asOf, 1)} max={baseline.quarter.to} label="Start date" /></td>
              <td className={td}><NumInput value={s.durationMonths} onChange={(v) => set.updateStart(i, { durationMonths: v })} min={1} max={24} width="w-14" label="Duration in months" /></td>
              <td className={td}><NumInput value={s.hoursPerWeek} onChange={(v) => set.updateStart(i, { hoursPerWeek: v })} min={1} max={80} width="w-14" label="Hours per week" /></td>
              <td className={td}><NumInput value={s.billRate} onChange={(v) => set.updateStart(i, { billRate: v })} min={0} width="w-20" prefix="$" label="Bill rate" /></td>
              {costDetail ? <td className={td}><NumInput value={s.payRate} onChange={(v) => set.updateStart(i, { payRate: v })} min={0} width="w-20" prefix="$" label="Pay rate" /></td> : null}
              <td className={td}><Check checked={s.committed} onChange={(v) => set.updateStart(i, { committed: v })} label="Committed start" /></td>
              <td className={td}>
                <button type="button" onClick={() => set.removeStart(i)} className="text-slate-400 hover:text-red-600" aria-label="Remove start">
                  <FiTrash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </Grid>
      ) : (
        <p className="rounded-md border border-dashed border-sky-200 px-3 py-4 text-center text-xs text-slate-500">No new starts modeled yet.</p>
      )}
    </div>
  );
}

/* ---------------- pipeline ---------------- */

export function PipelinePanel({ baseline, a, set, costDetail }) {
  if (!baseline.opportunities.length) return <p className="text-xs text-slate-500">No open job orders.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        Open job orders count at their stage probability. Raising a fill probability above stage history is shown as upside, not as probable.
      </p>
      <Grid head={["Job order", "Stage", "Include", "Fill %", "Start", "Contractors", "Ramp (months)", "Bill rate", ...(costDetail ? ["Pay rate"] : []), "Expected GP"]}>
        {baseline.opportunities.map((o) => {
          const ov = a.opportunities[o.id] || {};
          const out = ov.include === false;
          return (
            <tr key={o.id} className={out ? "opacity-50" : "hover:bg-sky-50/50"}>
              <td className={tdLeft}>
                <span className="font-medium">{o.name}</span>
                <span className="block text-[10px] text-slate-500">{o.type} · {o.vertical}</span>
              </td>
              <td className={td}>{o.stage} · {Math.round(o.probability)}%</td>
              <td className={td}><Check checked={!out} onChange={(v) => set.opp(o.id, "include", v ? null : false)} label={`Include ${o.name}`} /></td>
              <td className={td}><NumInput value={ov.probability} placeholder={Math.round(o.probability)} onChange={(v) => set.opp(o.id, "probability", v)} min={0} max={100} width="w-14" suffix="%" label={`Fill probability for ${o.name}`} /></td>
              <td className={td}><DateInput value={ov.startDate} onChange={(v) => set.opp(o.id, "startDate", v)} min={addDays(baseline.quarter.asOf, 1)} label={`Start date for ${o.name}`} /></td>
              <td className={td}><NumInput value={ov.headcount} placeholder={o.headcount} onChange={(v) => set.opp(o.id, "headcount", v)} min={0} max={50} width="w-14" label={`Contractors for ${o.name}`} /></td>
              <td className={td}><NumInput value={ov.rampMonths} placeholder={0} onChange={(v) => set.opp(o.id, "rampMonths", v)} min={0} max={6} width="w-14" label={`Ramp for ${o.name}`} /></td>
              <td className={td}><NumInput value={ov.billRate} placeholder={o.billRate.toFixed(2)} onChange={(v) => set.opp(o.id, "billRate", v)} min={0} width="w-20" prefix="$" label={`Bill rate for ${o.name}`} /></td>
              {costDetail ? <td className={td}><NumInput value={ov.payRate} placeholder={o.payRate?.toFixed(2)} onChange={(v) => set.opp(o.id, "payRate", v)} min={0} width="w-20" prefix="$" label={`Pay rate for ${o.name}`} /></td> : null}
              <td className={td}>{money(o.expectedGp)}</td>
            </tr>
          );
        })}
      </Grid>
      <p className="text-[11px] text-slate-500">Start defaults to the job order's expected start (at least a week from now). Job orders running past the quarter only count the months inside it.</p>
    </div>
  );
}

/* ---------------- direct costs ---------------- */

export function CostsPanel({ baseline, a, set, costDetail }) {
  if (!costDetail) return restrictedNote("Direct-cost detail");
  const d = baseline.defaults;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        Your desk's employer burden is currently {pct(d.burdenRate * 100)} of wages (payroll taxes, workers' compensation and benefits), with {money(d.odcPerContractorMonth)} of other
        direct costs per contractor per month. Changes here flow into GP.
      </p>
      <div className="flex flex-wrap gap-2">
        <Field label="Payroll taxes" hint="Change in SUTA / FUTA / FICA, as points of wages">
          <NumInput value={a.global.payrollTaxPp} neutral={0} placeholder={0} onChange={(v) => set.global("payrollTaxPp", v)} step={0.1} suffix="pp" label="Payroll tax change" />
        </Field>
        <Field label="Workers' compensation" hint="Change in rate, as points of wages">
          <NumInput value={a.global.wcPp} neutral={0} placeholder={0} onChange={(v) => set.global("wcPp", v)} step={0.1} suffix="pp" label="Workers' compensation change" />
        </Field>
        <Field label="Benefits" hint="Extra cost per paid hour">
          <NumInput value={a.global.benefitsPerHour} neutral={0} placeholder={0} onChange={(v) => set.global("benefitsPerHour", v)} step={0.25} prefix="$" label="Benefits per hour" />
        </Field>
        <Field label="Other direct costs" hint="Per contractor per month (VMS fees, screening, per diem)">
          <NumInput value={a.global.odcPerContractorMonth} neutral={0} placeholder={0} onChange={(v) => set.global("odcPerContractorMonth", v)} step={10} prefix="$" label="Other direct cost per contractor" />
        </Field>
      </div>
      <p className="text-[11px] text-slate-500">Average rates on this desk: bill {rate(avgOf(baseline.assignments, "billRate"))}, pay {rate(avgOf(baseline.assignments, "payRate"))}.</p>
    </div>
  );
}

const avgOf = (rows, k) => (rows.length ? rows.reduce((s, r) => s + (r[k] || 0), 0) / rows.length : null);

/* ---------------- personal recruiting expense ---------------- */

export function ExpensesPanel({ baseline, a, set }) {
  const ex = baseline.expenses;
  if (!ex || ex.toDate.travel == null) return restrictedNote("Expense detail");
  const def = ex.remainingDefaults;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        Travel, client entertainment and acquisition costs reduce your recruiting contribution; they don't change GP. Rest-of-quarter amounts default to your allowance.
      </p>
      <Grid head={["Expense", "Spent so far", "Rest of quarter"]} maxHeight="none">
        {[
          ["travel", "Travel", def.travel],
          ["entertainment", "Client entertainment", def.entertainment],
          ["acquisition", "Client acquisition", 0],
        ].map(([k, label, placeholder]) => (
          <tr key={k}>
            <td className={tdLeft}>{label}</td>
            <td className={td}>{money(ex.toDate[k])}</td>
            <td className={td}>
              <NumInput value={a.expenses?.[k]} placeholder={Math.round(placeholder)} onChange={(v) => set.expense(k, v)} min={0} width="w-24" prefix="$" label={`${label} for the rest of the quarter`} />
            </td>
          </tr>
        ))}
        <tr>
          <td className={tdLeft}>Salary & benefits allocation</td>
          <td className={td}>{money(ex.toDate.salary)}</td>
          <td className={td}>{money(def.salary)}</td>
        </tr>
      </Grid>
      <p className="text-[11px] text-slate-500">Commission is calculated from the plan on the quarter's GP and appears in the impact.</p>
    </div>
  );
}
