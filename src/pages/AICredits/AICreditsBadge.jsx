import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { fetchAiCredits } from "./aiCreditsApi";
import { badgeFor, statusInfo } from "./creditFormat";

// Small credit indicator for the Ask AI page header. Re-fetched after each
// answer (refreshKey) so it stays current; silent if the request fails.
const AICreditsBadge = ({ refreshKey }) => {
  const { token, isAdmin } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    fetchAiCredits(token)
      .then((data) => !cancelled && setSummary(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  const badge = badgeFor(summary, isAdmin);
  if (!badge) return null;
  const info = statusInfo(badge.status);
  const body = (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-x font-medium ${info.tone}`}
      title={isAdmin ? "Open AI Usage & Credits" : info.label}
      role="status"
    >
      <span aria-hidden="true" className="font-bold">{info.icon}</span>
      {badge.text}
    </span>
  );
  return isAdmin ? <Link to="/settings-customization/ai-credits">{body}</Link> : body;
};

export default AICreditsBadge;
