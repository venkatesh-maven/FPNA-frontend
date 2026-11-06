import React, { useCallback, useContext, useEffect, useState } from "react";
import { FiCpu, FiRefreshCw, FiAlertTriangle, FiClock } from "react-icons/fi";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AuthContext } from "../../context/AuthContext";
import { fetchAiCredits, requestAiCredits, updateWarnThreshold } from "./aiCreditsApi";
import {
  formatDateTime,
  formatDay,
  formatInt,
  formatPct,
  formatUsd,
  grantSourceLabel,
  providerIssueText,
  requestStatusInfo,
  statusInfo,
  validateRequest,
} from "./creditFormat";

// Settings & Customization → AI Usage & Credits (company admins only).
// Each company has its own AI credits: remaining = credits given by the
// super admin − cost of the company's AI calls. AI pauses at $0; the admin
// requests more here; the super admin approves it in FPNA-Admin → AI Credits.
const SERIES_COLOR = "#0284c7"; // sky-600, the app's accent

const Card = ({ label, value, hint }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
  </div>
);

const Section = ({ title, children, right }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {right}
    </div>
    {children}
  </section>
);

const Pill = ({ tone, children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>{children}</span>
);

const DailyTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-gray-800">{formatDay(d.date)}</p>
      <p className="text-gray-600 tabular-nums">{formatUsd(d.cost_usd)} · {formatInt(d.requests)} calls</p>
    </div>
  );
};

const CreditMeter = ({ data }) => {
  const info = statusInfo(data.status);
  const used = data.used_pct ?? 0;
  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">AI credits remaining</p>
          <p className="text-4xl font-semibold text-gray-900 tabular-nums">{formatPct(data.remaining_pct)}</p>
          <p className="mt-1 text-sm text-gray-600 tabular-nums">
            {formatUsd(data.remaining_usd)} left of {formatUsd(data.granted_usd)} · {formatUsd(data.used_usd)} used
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${info.tone}`}>
          <span aria-hidden="true" className="font-bold">{info.icon}</span>
          {info.label}
        </span>
      </div>
      <div
        className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label="Credits used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={used}
      >
        <div className={`h-full rounded-full ${info.bar}`} style={{ width: `${used}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>Used {formatPct(data.used_pct)}</span>
        <span>Warning at {data.warn_threshold_pct}% remaining</span>
      </div>
      {data.status === "exhausted" && (
        <p className="mt-3 text-sm text-red-700">
          {data.provider_empty
            ? "AI features are paused until the AI account is topped up."
            : "AI features are paused for your company until more credits are added."}
        </p>
      )}
    </div>
  );
};

const RequestForm = ({ data, onRequest, busy }) => {
  const pending = (data.requests || []).find((r) => r.status === "pending");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState(null);

  if (pending) {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <FiClock className="mt-0.5 shrink-0" />
          <span>
            Your request for <b>{formatUsd(pending.amount_usd)}</b> is waiting for approval ({pending.reference},
            sent {formatDateTime(pending.created_at)}).
          </span>
        </div>
        <p className="text-xs text-gray-500">Credits appear here as soon as it's approved. You'll see the answer under Credit requests below.</p>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    const err = validateRequest(amount);
    setFormError(err);
    if (err) return;
    if (await onRequest(Number(amount), note.trim())) {
      setAmount("");
      setNote("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Amount (USD)</span>
        <input
          type="number"
          min="1"
          max="10000"
          step="1"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 20"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {[10, 25, 50, 100].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(String(v))}
            className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs text-gray-700 hover:border-sky-400 hover:text-sky-700"
          >
            ${v}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. Month-end reporting"
          className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
      </label>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Request credits"}
      </button>
      <p className="text-xs text-gray-500">Our team reviews it and adds the credits. AI keeps working until your balance reaches $0.</p>
    </form>
  );
};

const WarnSetting = ({ data, onSave, busy }) => {
  const [warn, setWarn] = useState(String(data.warn_threshold_pct));
  const [err, setErr] = useState(null);
  useEffect(() => setWarn(String(data.warn_threshold_pct)), [data.warn_threshold_pct]);

  const submit = async (e) => {
    e.preventDefault();
    const w = Number(warn);
    if (!Number.isInteger(w) || w < 1 || w > 90) return setErr("Use a whole number from 1 to 90.");
    setErr(null);
    await onSave(w);
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="text-sm text-gray-700">Warn when remaining falls to (%)</span>
        <input
          type="number"
          min="1"
          max="90"
          step="1"
          value={warn}
          onChange={(e) => setWarn(e.target.value)}
          className="mt-1 block w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
        />
      </label>
      <button
        type="submit"
        disabled={busy || Number(warn) === data.warn_threshold_pct}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Save
      </button>
      {err && <p className="w-full text-sm text-red-600">{err}</p>}
    </form>
  );
};

const AICreditsPage = () => {
  const { token } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAiCredits(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, okText) => {
    setBusy(true);
    setNotice(null);
    try {
      setData(await fn());
      setNotice({ ok: true, text: okText });
      return true;
    } catch (err) {
      setNotice({ ok: false, text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <div className="p-6 text-sm text-gray-500">Loading AI usage…</div>;
  if (error && !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Could not load AI usage: {error}</p>
        <button onClick={load} className="mt-2 text-sm font-medium text-sky-600 hover:underline">Try again</button>
      </div>
    );
  }

  const t = data.totals || {};
  const issue = providerIssueText(data.provider_issue);
  const maxFeature = Math.max(...(data.by_feature || []).map((f) => f.cost_usd), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FiCpu className="text-sky-600" size={22} />
          <h1 className="text-lg font-semibold text-gray-900">AI Usage & Credits</h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} size={14} /> Refresh
        </button>
      </div>

      {issue && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>{issue}</span>
        </div>
      )}
      {notice && (
        <p role="status" className={`text-sm ${notice.ok ? "text-emerald-700" : "text-red-600"}`}>{notice.text}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CreditMeter data={data} />
        </div>
        <Section title="Need more credits?">
          <RequestForm
            data={data}
            busy={busy}
            onRequest={(amount, note) =>
              run(() => requestAiCredits(token, amount, note), "Request sent. You'll see the credits here once it's approved.")
            }
          />
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Spent today" value={formatUsd(t.today_usd)} hint="UTC day" />
        <Card label="This month" value={formatUsd(t.month_usd)} />
        <Card
          label="Days left"
          value={data.projected_days_left == null ? "—" : formatInt(Math.floor(data.projected_days_left))}
          hint="At the last 7 days' pace"
        />
        <Card label="Avg cost / call" value={formatUsd(t.avg_cost_per_request_usd)} />
        <Card label="AI calls" value={formatInt(t.requests)} hint={`${formatInt(t.failed)} failed`} />
        <Card label="Tokens used" value={formatInt(t.total_tokens)} hint={`${formatInt(t.prompt_tokens)} in · ${formatInt(t.completion_tokens)} out`} />
        <Card label="Last 7 days" value={formatUsd(t.last_7d_usd)} />
        <Card label="Last AI call" value={<span className="text-base">{formatDateTime(t.last_call_at)}</span>} />
      </div>

      <Section title="Daily spend · last 30 days (UTC)">
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <BarChart data={data.daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<DailyTooltip />} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="cost_usd" name="Cost" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="By feature">
          {data.by_feature?.length ? (
            <ul className="space-y-2.5">
              {data.by_feature.map((f) => (
                <li key={f.feature}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="text-gray-700">{f.feature}</span>
                    <span className="tabular-nums text-gray-600">
                      {formatUsd(f.cost_usd)} · {formatInt(f.requests)} calls · {formatPct(f.share_pct)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${maxFeature ? (f.cost_usd / maxFeature) * 100 : 0}%`, background: SERIES_COLOR }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No AI calls yet.</p>
          )}
        </Section>

        <Section title="Top users">
          {data.by_user?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-2 font-medium">User</th>
                    <th className="py-2 pr-2 text-right font-medium">Calls</th>
                    <th className="py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_user.map((u) => (
                    <tr key={u.user_id || "background"} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-2">
                        <p className="text-gray-800">{u.name}</p>
                        {u.email && <p className="text-xs text-gray-500">{u.email}</p>}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-gray-700">{formatInt(u.requests)}</td>
                      <td className="py-2 text-right tabular-nums text-gray-700">{formatUsd(u.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No AI calls yet.</p>
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Credit history">
          {data.grants?.length ? (
            <ul className="divide-y divide-gray-100 text-sm">
              {data.grants.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="text-gray-800">{grantSourceLabel(g.source)}{g.reference ? ` · ${g.reference}` : ""}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(g.created_at)}{g.note ? ` · ${g.note}` : ""}</p>
                  </div>
                  <span className="font-medium tabular-nums text-emerald-700">+{formatUsd(g.amount_usd)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No credits yet.</p>
          )}
        </Section>

        <Section title="Credit requests">
          {data.requests?.length ? (
            <ul className="divide-y divide-gray-100 text-sm">
              {data.requests.map((r) => {
                const info = requestStatusInfo(r.status);
                return (
                  <li key={r.id} className="py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-800">
                        {formatUsd(r.amount_usd)} · {r.reference}
                      </span>
                      <Pill tone={info.tone}>{info.label}</Pill>
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.requested_by ? `${r.requested_by} · ` : ""}{formatDateTime(r.created_at)}
                      {r.status === "granted" && r.granted_amount_usd != null ? ` · ${formatUsd(r.granted_amount_usd)} added` : ""}
                      {r.resolution_note ? ` · "${r.resolution_note}"` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No requests yet.</p>
          )}
        </Section>
      </div>

      <Section title="Alerts">
        <WarnSetting
          data={data}
          busy={busy}
          onSave={(w) => run(() => updateWarnThreshold(token, w), "Warning level saved.")}
        />
      </Section>

      {data.cost_is_estimated && (
        <p className="text-xs text-gray-500">
          Some costs are estimated from token counts and Perplexity list prices, because Perplexity didn't report the exact cost for those calls.
        </p>
      )}
    </div>
  );
};

export default AICreditsPage;
