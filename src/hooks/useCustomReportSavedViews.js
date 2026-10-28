import { useCallback, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config/config";
import { AuthContext } from "../context/AuthContext";

const SAVED_VIEWS_PATH = `${API_BASE_URL}/api/v1/company/financial/custom_report/saved_views`;

// Saved Custom Report Builder configurations, persisted server-side (see
// financial/controller.py's saved-view endpoints) so they can be listed in
// the Financial Reports sidebar, exported to CSV on demand, and referenced
// by a real recurring report_automation schedule — none of which a
// browser-only localStorage view could support.
export function useCustomReportSavedViews() {
  const { token } = useContext(AuthContext);
  const [savedViews, setSavedViews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchViews = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(SAVED_VIEWS_PATH, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load saved views");
      const data = await res.json();
      setSavedViews(Array.isArray(data) ? data : []);
    } catch {
      setSavedViews([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const saveView = useCallback(
    async (name, state, visibility) => {
      const res = await fetch(SAVED_VIEWS_PATH, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dimensions: state.selectedDimensions,
          metrics: state.selectedMetrics,
          agg_func: state.aggFunc,
          filters: state.filters,
          visibility,
          display_by: state.displayBy,
          compare_with: state.compareWith,
          gl_account_ids: state.glAccountIds || [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to save view");
      }
      const created = await res.json();
      await fetchViews();
      return created;
    },
    [token, fetchViews]
  );

  const updateView = useCallback(
    async (id, name, state, visibility) => {
      const res = await fetch(`${SAVED_VIEWS_PATH}/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dimensions: state.selectedDimensions,
          metrics: state.selectedMetrics,
          agg_func: state.aggFunc,
          filters: state.filters,
          visibility,
          display_by: state.displayBy,
          compare_with: state.compareWith,
          gl_account_ids: state.glAccountIds || [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update view");
      }
      const updated = await res.json();
      await fetchViews();
      return updated;
    },
    [token, fetchViews]
  );

  const deleteView = useCallback(
    async (id) => {
      const res = await fetch(`${SAVED_VIEWS_PATH}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete view");
      }
      await fetchViews();
    },
    [token, fetchViews]
  );

  const publishView = useCallback(
    async (id, published) => {
      const res = await fetch(`${SAVED_VIEWS_PATH}/${id}/publish`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ published }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update publish status");
      }
      const updated = await res.json();
      await fetchViews();
      return updated;
    },
    [token, fetchViews]
  );

  const pinView = useCallback(
    async (id) => {
      const res = await fetch(`${SAVED_VIEWS_PATH}/${id}/pin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 409) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to pin report to dashboard");
      }
    },
    [token]
  );

  const unpinView = useCallback(
    async (id) => {
      const res = await fetch(`${SAVED_VIEWS_PATH}/${id}/pin`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to unpin report from dashboard");
      }
    },
    [token]
  );

  return { savedViews, loading, saveView, updateView, deleteView, publishView, pinView, unpinView, refetch: fetchViews };
}
