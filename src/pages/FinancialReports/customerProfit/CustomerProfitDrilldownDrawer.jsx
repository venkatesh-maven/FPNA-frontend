import React from "react";
import CustomerPlanDrilldownDrawer from "../customerPlan/CustomerPlanDrilldownDrawer";

// Customer Profitability drilldown: the customer's revenue, allocated cost and
// profit against its budget and forecast.
export default function CustomerProfitabilityDrilldown({
  open,
  onClose,
  token,
  year,
  currency = "USD",
  currencySymbol = "$",
  customerName
}) {
  return (
    <CustomerPlanDrilldownDrawer
      open={open}
      onClose={onClose}
      token={token}
      year={year}
      currency={currency}
      currencySymbol={currencySymbol}
      customerName={customerName}
      endpoint="customer-profitability-drilldown"
      includeProfit
    />
  );
}
