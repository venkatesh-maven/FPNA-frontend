import axios from "axios";
import { API_BASE_URL } from "../config/config";

// Shared call used by every widget-level "Ask AI" popover (KPI tiles, chart
// cards, etc). Mirrors the same /api/v1/ai contract used by AskAI.jsx and
// SmallAIChatBot.jsx, so all entry points behave consistently.
export const askAI = async (message, context) => {
  const { data } = await axios.post(`${API_BASE_URL}/api/v1/ai`, {
    message,
    context: context || undefined,
  });
  return data?.reply || "Sorry, I could not generate a response.";
};
