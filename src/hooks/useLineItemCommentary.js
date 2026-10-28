import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/config";
import { cleanFilters } from "./useReportCommentary";

const BASE = `${API_BASE_URL}/api/v1/ai/line-item-commentary`;

const errorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  return typeof detail === "string" && detail ? detail : fallback;
};

/**
 * Saved line-item variance commentary ("Refine with AI") for one filtered
 * report view — at most one explanation + recommendation per line item.
 */
export default function useLineItemCommentary({ token, reportId, year, currency, filters }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const filtersJson = JSON.stringify(cleanFilters(filters));
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token || !year || !currency) return;
    setLoading(true);
    try {
      const { data } = await axios.get(BASE, {
        headers: { Authorization: `Bearer ${token}` },
        params: { report_id: reportId, year, currency, filters: filtersJson },
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load line-item commentary:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, reportId, year, currency, filtersJson]);

  useEffect(() => {
    load();
  }, [load]);

  const byLine = useMemo(
    () => Object.fromEntries(items.map((i) => [i.line_item, i])),
    [items]
  );

  const save = async ({ lineItem, lineItemLabel, explanation, recommendation, refinements }) => {
    try {
      const { data } = await axios.put(
        BASE,
        {
          report_id: reportId,
          year,
          currency,
          filters: JSON.parse(filtersJson),
          line_item: lineItem,
          line_item_label: lineItemLabel,
          explanation,
          recommendation,
          refinements,
        },
        { headers }
      );
      setItems((prev) => [...prev.filter((i) => i.line_item !== data.line_item), data]);
      return data;
    } catch (err) {
      throw new Error(errorMessage(err, "Could not save the commentary."));
    }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`${BASE}/${id}`, { headers });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      throw new Error(errorMessage(err, "Could not remove the commentary."));
    }
  };

  // First draft when `instruction` is empty; otherwise refines `current`.
  const explain = async ({
    reportLabel,
    filterLabels,
    lineItem,
    lineItemLabel,
    context,
    current = null,
    previousInstructions = [],
    instruction = "",
  }) => {
    try {
      const { data } = await axios.post(
        `${BASE}/explain`,
        {
          report_id: reportId,
          report_label: reportLabel,
          year,
          currency,
          filters: JSON.parse(filtersJson),
          filter_labels: filterLabels,
          line_item: lineItem,
          line_item_label: lineItemLabel,
          context,
          current,
          previous_instructions: previousInstructions,
          instruction,
        },
        { headers, timeout: 90000 }
      );
      return data;
    } catch (err) {
      throw new Error(errorMessage(err, "Could not generate the explanation. Please try again."));
    }
  };

  return { items, byLine, loading, reload: load, save, remove, explain };
}
