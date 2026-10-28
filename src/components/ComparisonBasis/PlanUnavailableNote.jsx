// Shown instead of plan numbers when the basis can't be split the way the
// report is filtered: the forecast and scenarios are company-level only.
export default function PlanUnavailableNote({ label, reason }) {
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-x text-amber-800">
      {reason || `${label} is available at company level only.`} Plan and variance columns are empty while an Entity,
      Cost Center, Profit Center, Customer, Region or Product filter is applied.
    </div>
  );
}
