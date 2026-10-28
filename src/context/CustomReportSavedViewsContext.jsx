import React, { createContext, useContext } from "react";
import { useCustomReportSavedViews as useSavedViewsInternal } from "../hooks/useCustomReportSavedViews";

// A single shared saved-views list for everything under ReportsLayout
// (ReportSidebar + the Custom Report Builder page) — without this, each
// consumer would call useCustomReportSavedViews() independently and get its
// own copy of the list, so saving/updating/deleting a view in the builder
// wouldn't be reflected in the sidebar until an unrelated remount.
const CustomReportSavedViewsContext = createContext(null);

export function CustomReportSavedViewsProvider({ children }) {
  const value = useSavedViewsInternal();
  return (
    <CustomReportSavedViewsContext.Provider value={value}>
      {children}
    </CustomReportSavedViewsContext.Provider>
  );
}

export function useCustomReportSavedViewsContext() {
  const ctx = useContext(CustomReportSavedViewsContext);
  if (!ctx) {
    throw new Error("useCustomReportSavedViewsContext must be used within CustomReportSavedViewsProvider");
  }
  return ctx;
}
