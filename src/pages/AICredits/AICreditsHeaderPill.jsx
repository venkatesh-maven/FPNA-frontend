import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { fetchAiCredits } from "./aiCreditsApi";
import { headerPillFor, statusInfo } from "./creditFormat";

const REFRESH_MS = 2 * 60 * 1000;

// Compact "AI credits %" pill for the top header. Shown to every user;
// admins can click through to AI Usage & Credits. Refreshes on navigation,
// when the tab regains focus and every 2 minutes. Silent if it can't load.
const AICreditsHeaderPill = () => {
  const { token, isAdmin } = useContext(AuthContext);
  const { pathname } = useLocation();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const load = () =>
      fetchAiCredits(token)
        .then((data) => !cancelled && setSummary(data))
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [token, pathname]);

  const pill = headerPillFor(summary);
  if (!pill) return null;
  const info = statusInfo(summary.status);

  const body = (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium tabular-nums ${info.tone}`}
      title={pill.title}
      aria-label={pill.title}
    >
      {pill.text}
    </span>
  );
  return isAdmin ? (
    <Link to="/settings-customization/ai-credits" className="rounded-full focus:outline-none focus:ring-2 focus:ring-sky-300">
      {body}
    </Link>
  ) : (
    body
  );
};

export default AICreditsHeaderPill;
