import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/config";

const BASE = `${API_BASE_URL}/api/v1/ai/report-insights`;

// Only non-empty filter values identify a report "view" — the backend builds
// the same canonical key, so commentary added under one set of filters only
// shows up again under that same set.
export const cleanFilters = (filters = {}) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== null && v !== undefined && v !== "")
  );

const errorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  return typeof detail === "string" && detail ? detail : fallback;
};

/**
 * Saved commentary (added AI insights / manual notes) for one filtered report view.
 */
export default function useReportCommentary({ token, reportId, year, currency, filters }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const filtersJson = JSON.stringify(cleanFilters(filters));
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token || !year || !currency) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${BASE}/commentary`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { report_id: reportId, year, currency, filters: filtersJson },
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load report commentary:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, reportId, year, currency, filtersJson]);

  useEffect(() => {
    load();
  }, [load]);

  const addItems = async (newItems) => {
    try {
      const { data } = await axios.post(
        `${BASE}/commentary`,
        { report_id: reportId, year, currency, filters: JSON.parse(filtersJson), items: newItems },
        { headers }
      );
      setItems((prev) => [...prev, ...(data || [])]);
      return data;
    } catch (err) {
      throw new Error(errorMessage(err, "Could not add commentary to the report."));
    }
  };

  const updateItem = async (id, changes) => {
    try {
      const { data } = await axios.put(`${BASE}/commentary/${id}`, changes, { headers });
      setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
      return data;
    } catch (err) {
      throw new Error(errorMessage(err, "Could not update commentary."));
    }
  };

  const removeItem = async (id) => {
    try {
      await axios.delete(`${BASE}/commentary/${id}`, { headers });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      throw new Error(errorMessage(err, "Could not remove commentary."));
    }
  };

  const generateInsights = async ({ reportLabel, filterLabels, context }) => {
    try {
      const { data } = await axios.post(
        `${BASE}/generate`,
        {
          report_id: reportId,
          report_label: reportLabel,
          year,
          currency,
          filters: JSON.parse(filtersJson),
          filter_labels: filterLabels,
          context,
        },
        { headers, timeout: 90000 }
      );
      return data?.insights || [];
    } catch (err) {
      throw new Error(errorMessage(err, "Could not generate insights. Please try again."));
    }
  };

  return { items, loading, reload: load, addItems, updateItem, removeItem, generateInsights };
}
