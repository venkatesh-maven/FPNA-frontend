import axios from "axios";
import { API_BASE_URL } from "../config/config";

const BASE = `${API_BASE_URL}/api/v1/ai/analyze`;

const errorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  return typeof detail === "string" && detail ? detail : fallback;
};

/**
 * "Analyze with AI" calls for one report / dashboard. Stateless on the
 * server: the caller keeps the conversation and sends it with each question.
 */
export default function useAnalyzeWithAI({ token, reportId, reportLabel, year, currency }) {
  const headers = { Authorization: `Bearer ${token}` };
  const base = { report_id: reportId, report_label: reportLabel, year, currency };

  const analyze = async ({ target, filterLabels, context }) => {
    try {
      const { data } = await axios.post(
        BASE,
        { ...base, target, filter_labels: filterLabels, context },
        { headers, timeout: 100000 }
      );
      return data;
    } catch (err) {
      throw new Error(errorMessage(err, "Could not complete the analysis. Please try again."));
    }
  };

  const ask = async ({ target, filterLabels, context, history, question }) => {
    try {
      const { data } = await axios.post(
        `${BASE}/ask`,
        { ...base, target, filter_labels: filterLabels, context, history, question },
        { headers, timeout: 100000 }
      );
      return data.answer;
    } catch (err) {
      throw new Error(errorMessage(err, "Could not answer that. Please try again."));
    }
  };

  return { analyze, ask };
}
