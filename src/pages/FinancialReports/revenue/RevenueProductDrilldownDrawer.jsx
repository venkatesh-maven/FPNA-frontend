import React from "react";
import CustomerPlanDrilldownDrawer from "../customerPlan/CustomerPlanDrilldownDrawer";

// Revenue by Customer drilldown: the customer's revenue against its budget and
// forecast.
export default function RevenueProductDrilldown({
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
      endpoint="revenue_product_drilldown"
    />
  );
}
