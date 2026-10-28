import React from "react";
import { Link, Outlet } from "react-router-dom";
import ReportSidebar from "./ReportSidebar";

const FinancialReportsNew = () => {
  return (
    <div className="min-h-screen bg-sky-50 p-6">
      {/* Header */}

      
      {/* Layout */}
      <div className="flex gap-6">
        {/* LEFT SIDEBAR (constant) */}
        <ReportSidebar />

        {/* RIGHT SIDE (dynamic) */}
        <main className="w-3/4 bg-white p-6 rounded-xl shadow-md">
          <Outlet />   {/* 🔥 THIS IS THE KEY */}
        </main>
      </div>
    </div>
  );
};

export default FinancialReportsNew;
