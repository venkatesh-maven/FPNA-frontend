import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";
import { QB_COMPANIES, QB_DEMO_USER } from "./demoData";

// Real names for the QuickBooks demo: the logged-in organization becomes the
// company being connected, and the top customers (by revenue) from the
// customer-profitability report replace the sample customer names.
// Anything unavailable falls back to the demo values in demoData.js.

const MAX_CUSTOMERS = 6;

// Stable, realistic-looking QuickBooks company ID derived from the name.
const demoRealmId = (name) => {
  const digits = [...name]
    .reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
    .toString()
    .padStart(8, "0")
    .slice(-8);
  return `9130 ${digits.slice(0, 4)} ${digits.slice(4)}`;
};

export default function useDemoCompanyData() {
  const { token, currentUser, userEmail, selectedYear, selectedCurrency } = useContext(AuthContext) || {};
  const [country, setCountry] = useState("");
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/v1/company/management/account/profile/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setCountry(data?.company?.home_country || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedYear || !selectedCurrency) return undefined;
    let cancelled = false;
    // Same defaults as the Customer Profitability report page, sorted by revenue.
    const params = new URLSearchParams({
      currency_filter: "actualvalue",
      period: "all",
      sort_by: "revenue",
      sort_order: "desc",
      page: "1",
      page_size: "50",
      excel_download: "false",
    });
    cachedFetch(
      `${API_BASE_URL}/api/v1/company/financial/customer-profitability/${selectedYear}/${selectedCurrency}?${params}`,
      { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
    )
      .then((data) => {
        if (cancelled || !data || typeof data !== "object") return;
        const fromRows = (Array.isArray(data.customers) ? data.customers : []).map((c) => c?.customer_name);
        const fromList = Array.isArray(data.customers_list) ? data.customers_list : [];
        const names = [...new Set([...fromRows, ...fromList])].filter(
          (n) => typeof n === "string" && n.trim() && n !== "Grand Total"
        );
        setCustomers(names.slice(0, MAX_CUSTOMERS));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, selectedYear, selectedCurrency]);

  const companyName = currentUser?.company_name;
  const companies = useMemo(
    () =>
      companyName
        ? [
            {
              id: "organization",
              name: companyName,
              country,
              currency: selectedCurrency || "USD",
              realmId: demoRealmId(companyName),
            },
          ]
        : QB_COMPANIES,
    [companyName, country, selectedCurrency]
  );

  const demoUser = currentUser?.user_email || userEmail || QB_DEMO_USER;

  return { companies, customers, demoUser };
}
