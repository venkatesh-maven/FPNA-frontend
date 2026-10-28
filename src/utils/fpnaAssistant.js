import { API_BASE_URL } from "../config/config";

// Dedicated client for the full-page FPnAInsights chat (src/pages/AIChatBot.jsx).
// Hits the new /api/v1/ai/assistant/chat endpoint, kept separate from the
// existing askAi.js helper used by the report-drawer Ask AI integrations.
//
// Context-building (which report's data is relevant, with which filters) now
// happens entirely server-side: the backend classifies the question's topic
// first, then fetches only that topic's real data in-process (no browser
// fetch fan-out at all). This replaced an earlier design where the frontend
// prefetched ~5 endpoint groups for EVERY question regardless of topic —
// that approach couldn't scale to the app's ~24 real report/forecast/budget
// endpoints and had already needed two rounds of browser connection-limit
// fixes just for 5. The frontend's job now is just to send the question
// (plus the user's auth token and currently-selected year/currency as
// defaults) and show the reply.
export const sendAssistantMessage = async (message, history, token, year, currency, provider) => {
  const res = await fetch(`${API_BASE_URL}/api/v1/ai/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      history: history && history.length ? history : undefined,
      year: year || undefined,
      currency: currency || undefined,
      provider: provider || undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(`Assistant request failed (${res.status})`);
  }

  const data = await res.json();
  return data?.reply || "Sorry, I could not generate a response.";
};

// "Find a Way" goal-seeking: the backend parses the goal + constraints,
// computes alternative paths through the controllable drivers and explains
// them. `previousSpec` lets a follow-up ("what if revenue drops 12% instead")
// modify the last goal instead of starting over.
const postJson = async (path, body, token) => {
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`);
  }
  return data;
};

export const findAWay = (message, previousSpec, token, year, currency) =>
  postJson(
    "/ai/find-a-way",
    { message, previous_spec: previousSpec || undefined, year: year || undefined, currency: currency || undefined },
    token
  );

export const recalculateFindAWay = (spec, token, year, currency) =>
  postJson("/ai/find-a-way/recalculate", { spec, year: year || undefined, currency: currency || undefined }, token);

// Find a Way on one Scenario Modeling scenario. `scenarioRef` is
// { year, quarter, scenario_id } for a custom scenario or
// { year, quarter, scenario_name } for Base/Best/Worst Case; paths are
// computed from that scenario's own drivers.
export const findAWayForScenario = (scenarioRef, message, previousSpec, token, currency) =>
  postJson(
    "/ai/find-a-way/scenario",
    { ...scenarioRef, message, previous_spec: previousSpec || undefined, currency: currency || undefined },
    token
  );

export const recalculateScenarioFindAWay = (scenarioRef, spec, token, currency) =>
  postJson("/ai/find-a-way/scenario/recalculate", { ...scenarioRef, spec, currency: currency || undefined }, token);

// P&L to compare a Find a Way path against, on the scenario's lines. basis:
// "prev_quarter_actuals" | "prev_quarter_scenario" | "last_year_actuals".
export const compareScenarioPnl = (scenarioRef, basis, token) =>
  postJson("/ai/find-a-way/scenario/compare", { ...scenarioRef, basis }, token);

// Backend is the single source of truth for which providers exist and
// whether each has a real API key yet (see ai/providers.py) — fetched
// instead of hardcoding the list here so adding a real key later doesn't
// also require a frontend change.
export const fetchProviders = async (token) => {
  const res = await fetch(`${API_BASE_URL}/api/v1/ai/assistant/providers`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Failed to load providers (${res.status})`);
  const data = await res.json();
  return data?.providers || [];
};

// Chat persistence — so history survives refresh/logout/login instead of
// living only in React state. Scoped server-side to the logged-in user.
const authHeaders = (token) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

const chatsUrl = (path = "") => `${API_BASE_URL}/api/v1/ai/assistant/chats${path}`;

export const fetchChatList = async (token) => {
  const res = await fetch(chatsUrl(), { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load chat history (${res.status})`);
  return res.json();
};

export const createChat = async (token, messages = [], title = null) => {
  const res = await fetch(chatsUrl(), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ messages, title }),
  });
  if (!res.ok) throw new Error(`Failed to create chat (${res.status})`);
  return res.json();
};

export const getChat = async (token, id) => {
  const res = await fetch(chatsUrl(`/${id}`), { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load chat (${res.status})`);
  return res.json();
};

export const updateChat = async (token, id, patch) => {
  const res = await fetch(chatsUrl(`/${id}`), {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to save chat (${res.status})`);
  return res.json();
};

export const deleteChat = async (token, id) => {
  const res = await fetch(chatsUrl(`/${id}`), { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to delete chat (${res.status})`);
};
