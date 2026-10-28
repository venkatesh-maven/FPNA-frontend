import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/config";

const GENERATE_URL = `${API_BASE_URL}/api/v1/ai/table-insights/generate`;
const ITEMS_PER_REQUEST = 40; // backend accepts up to 60; smaller batches answer faster
const REQUEST_DELAY_MS = 200; // debounces filter changes and StrictMode's double effect

const errorMessage = (err) => {
  const detail = err?.response?.data?.detail;
  return typeof detail === "string" && detail ? detail : "Could not generate AI insights.";
};

/**
 * AI insights for the rows of one report table (POST /ai/table-insights/generate).
 * `request` is { report_id, report_label, table_id, table_label, year, currency,
 * filters, filter_labels, context, items: [{ id, focus }], max_words? } — or
 * null while there's nothing to analyze. Insights are fetched whenever the
 * request changes; the backend caches them by table data, so repeat views are
 * instant. `regenerate` bypasses that cache.
 *
 * Returns { insights: { [itemId]: text }, loading, error, regenerate }.
 */
export default function useTableInsights({ token, request }) {
  const [state, setState] = useState({ insights: {}, loading: false, error: "" });
  const requestKey = request && request.items?.length ? JSON.stringify(request) : "";
  const controllerRef = useRef(null);
  const timerRef = useRef(null);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();
  }, []);

  const run = useCallback(
    (refresh) => {
      cancel();
      if (!token || !requestKey) {
        setState({ insights: {}, loading: false, error: "" });
        return;
      }
      setState({ insights: {}, loading: true, error: "" });

      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        controllerRef.current = controller;
        const base = JSON.parse(requestKey);
        const chunks = [];
        for (let i = 0; i < base.items.length; i += ITEMS_PER_REQUEST) {
          chunks.push(base.items.slice(i, i + ITEMS_PER_REQUEST));
        }
        try {
          const results = await Promise.all(
            chunks.map((items) =>
              axios.post(
                GENERATE_URL,
                { ...base, items, refresh },
                {
                  headers: { Authorization: `Bearer ${token}` },
                  signal: controller.signal,
                  timeout: 100000,
                }
              )
            )
          );
          setState({
            insights: Object.assign({}, ...results.map((r) => r.data?.insights || {})),
            loading: false,
            error: "",
          });
        } catch (err) {
          if (axios.isCancel(err)) return;
          setState({ insights: {}, loading: false, error: errorMessage(err) });
        }
      }, REQUEST_DELAY_MS);
    },
    [token, requestKey, cancel]
  );

  useEffect(() => {
    run(false);
    return cancel;
  }, [run, cancel]);

  return { ...state, regenerate: () => run(true) };
}
