import { useCallback, useEffect, useState } from "react";
import { commentary } from "../services/salesAnalyticsApi";

/** Saved insight commentary for one page view. */
export function useCommentary(pageKey, { savedBy, filtersLabel }) {
  const [items, setItems] = useState(() => commentary.list(pageKey));
  useEffect(() => {
    setItems(commentary.list(pageKey));
    return commentary.subscribe(() => setItems(commentary.list(pageKey)));
  }, [pageKey]);
  const save = useCallback(
    (item) => commentary.save(pageKey, { ...item, savedBy, filtersLabel, savedAt: new Date().toISOString() }),
    [pageKey, savedBy, filtersLabel]
  );
  const remove = useCallback((id) => commentary.remove(pageKey, id), [pageKey]);
  return { items, save, remove };
}
