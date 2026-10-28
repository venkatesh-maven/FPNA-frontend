import React, { useState, useContext } from "react";
import { toast } from "react-toastify";
import { FiSave, FiBell, FiDollarSign } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext";

const AlertsNotificationPreferences = () => {
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    inAppNotifications: true,
  });
  const [loading, setLoading] = useState(false);

  const {
    currencies,
    selectedCurrency,
    setSelectedCurrency,
    decimalPrecision,
    setDecimalPrecision,
  } = useContext(AuthContext);

  const handleChange = (e) => {
    const { name, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 1000));
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className=" rounded-xl ">
      {/* ================= HEADER ================= */}
      <div className="mb-8
       bg-gradient-to-r from-sky-700 to-sky-900 text-white p-3
        rounded-xl">
        <h2 className="text-xl font-semibold">
          Alerts & Currency Settings
        </h2>
        <p className="text-sky-100 text-s mt-1">
          Manage notification alerts and your preferred reporting currency
        </p>
      </div>

      {/* ================= CURRENCY ================= */}
      <div className="flex justify-items-center  gap-5"> <div className="bg-white border border-sky-100 rounded-xl p-6 mb-6">
        <h3 className="text-sky-900 font-medium font-bold mb-4 flex items-center gap-2">
          <FiDollarSign className="text-sky-600  font-bold" />
          Preferred Currency
        </h3>

        <div className="flex items-center gap-4">
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="w-52 border border-sky-200 rounded-lg px-4 py-2
                       focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
            <br />

        </div>
         <span className="text-s text-sky-600">
            Used across dashboards, reports & alerts
          </span>

        {/* ── Decimal Precision ── */}
        <div className="mt-5">
          <h4 className="text-sky-800 font-semibold text-sm mb-2">
            Decimal Precision
          </h4>
          <select
            value={decimalPrecision}
            onChange={(e) => setDecimalPrecision(e.target.value)}
            className="w-52 border border-sky-200 rounded-lg px-4 py-2
                       focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            <option value={0}>No Decimal (e.g. 1,235)</option>
            <option value={1}>1 Decimal Place (e.g. 1,234.6)</option>
            <option value={2}>2 Decimal Places (e.g. 1,234.56)</option>
          </select>
          <p className="text-s text-sky-600 mt-1">
            Applied to all financial values across the application
          </p>
        </div>
      </div>

      {/* ================= ALERTS ================= */}
      <div className="bg-white border border-sky-100 rounded-xl p-6 mb-6">
        <h3 className="text-sky-900 font-medium mb-4 font-bold flex items-center gap-2">
          <FiBell className="text-sky-600" />
          Notification Alerts
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="emailNotifications"
              checked={preferences.emailNotifications}
              onChange={handleChange}
              className="h-4 w-4 accent-sky-700"
            />
            <div>
              <p className="text-s font-medium text-sky-900">
                Email Notifications
              </p>
              <p className="text-x text-sky-600">
                Receive important alerts via email
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="inAppNotifications"
              checked={preferences.inAppNotifications}
              onChange={handleChange}
              className="h-4 w-4 accent-sky-700"
            />
            <div>
              <p className="text-s font-medium text-sky-900">
                In-App Notifications
              </p>
              <p className="text-x text-sky-600">
                Get alerts directly inside the application
              </p>
            </div>
          </label>
        </div>
      </div></div>
     

      {/* ================= SAVE ================= */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 bg-sky-800 hover:bg-sky-900
                     text-white px-5 py-2 rounded-lg
                     disabled:opacity-50 transition"
        >
          <FiSave />
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default AlertsNotificationPreferences;
