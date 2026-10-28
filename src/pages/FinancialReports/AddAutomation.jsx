import React, { useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { FiClock, FiX } from 'react-icons/fi';
import { API_BASE_URL } from '../../config/config';
import { AuthContext } from '../../context/AuthContext';
import ActionHoverLabel from './ActionHoverLabel';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Detected once per page load — the Time field is interpreted in this
// timezone server-side, so what the user sees here must match what the
// server does with it.
const DETECTED_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
})();

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

const MONTHS_IN_QUARTER = [
  { value: 1, label: 'First Month' },
  { value: 2, label: 'Second Month' },
  { value: 3, label: 'Third Month' },
];

// Recipients can be separated by comma or semicolon; dedupe case-insensitively
// so "a@x.com, A@x.com" only counts once.
const parseRecipients = (raw) => {
  const seen = new Set();
  const unique = [];
  raw
    .split(/[,;]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .forEach((email) => {
      const key = email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(email);
      }
    });
  return unique;
};

const AddAutomation = ({ reportType, reportLabel, customReportViewId, year, currency, filters, compact = false, iconOnly = false }) => {
  const { token } = useContext(AuthContext);

  const [isOpen, setIsOpen] = useState(false);
  const [frequency, setFrequency] = useState('daily');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState('monday');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [monthInQuarter, setMonthInQuarter] = useState(1);
  const [recipients, setRecipients] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const recipientList = parseRecipients(recipients);
    if (recipientList.length === 0) {
      toast.error('Please enter at least one recipient email');
      return;
    }

    const invalidEmails = recipientList.filter((email) => !EMAIL_REGEX.test(email));
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email address${invalidEmails.length > 1 ? 'es' : ''}: ${invalidEmails.join(', ')}`);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/report-automation/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_type: customReportViewId ? 'custom_report' : reportType,
          ...(customReportViewId && { custom_report_view_id: customReportViewId }),
          // The report page's own current year/currency/filters, so the
          // scheduled send replays the same view the user was looking at
          // instead of the server's "latest year, no filters" default.
          ...(year != null && { year }),
          ...(currency && { currency }),
          ...(filters && Object.keys(filters).length > 0 && { filters }),
          frequency,
          time_of_day: timeOfDay,
          timezone: DETECTED_TIMEZONE,
          ...(frequency === 'weekly' && { day_of_week: dayOfWeek }),
          ...((frequency === 'monthly' || frequency === 'quarterly') && { day_of_month: dayOfMonth }),
          ...(frequency === 'quarterly' && { month_in_quarter: monthInQuarter }),
          recipients: recipientList,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to add report automation');
      }

      const newReport = await res.json();
      const sent = newReport.initial_send?.sent || [];
      const failed = newReport.initial_send?.failed || [];
      if (sent.length) {
        toast.success(`Schedule saved — first report sent now to ${sent.join(', ')}. Next send: ${frequency}.`);
      } else {
        toast.success('Report schedule saved successfully!');
      }
      if (failed.length) {
        toast.warn(`Could not deliver the first report to: ${failed.join(', ')}`);
      }

      setRecipients('');
      setFrequency('daily');
      setTimeOfDay('09:00');
      setDayOfWeek('monday');
      setDayOfMonth(1);
      setMonthInQuarter(1);
      setIsOpen(false);
    } catch (error) {
      toast.error(error.message || 'Failed to add report automation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {compact ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
          title="Schedule Report"
          aria-label="Schedule Report"
          className="p-1 rounded text-sky-500 hover:bg-sky-100 hover:text-sky-800"
        >
          <FiClock size={14} />
        </button>
      ) : iconOnly ? (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Schedule Report"
          className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
        >
          <FiClock />
          <ActionHoverLabel>Schedule Report</ActionHoverLabel>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-x font-medium bg-sky-100 text-sky-800 rounded-lg border border-sky-200"
        >
          <FiClock /> Schedule Report
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !loading && setIsOpen(false)}
            />

            <motion.div
              className="fixed top-0 right-0 z-50 h-full w-[380px] bg-white text-gray-900 shadow-2xl flex flex-col border-l border-sky-200"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="p-4 bg-sky-50 border-b border-sky-200 flex items-start justify-between">
                <div>
                  <h2 className="text-s font-semibold text-sky-900 flex items-center gap-2">
                    <FiClock /> Schedule Report
                  </h2>
                  <p className="text-x text-sky-600 mt-1">
                    Schedule recurring deliveries of this report
                  </p>
                </div>
                <button
                  onClick={() => !loading && setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-sky-100 text-sky-600"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="block text-s font-medium text-gray-700 mb-1">Report Name</label>
                  <input
                    type="text"
                    value={reportLabel}
                    disabled
                    className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-s font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                {frequency === 'weekly' && (
                  <div>
                    <label className="block text-s font-medium text-gray-700 mb-1">Day</label>
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {frequency === 'quarterly' && (
                  <div>
                    <label className="block text-s font-medium text-gray-700 mb-1">Month in Quarter</label>
                    <select
                      value={monthInQuarter}
                      onChange={(e) => setMonthInQuarter(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                    >
                      {MONTHS_IN_QUARTER.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(frequency === 'monthly' || frequency === 'quarterly') && (
                  <div>
                    <label className="block text-s font-medium text-gray-700 mb-1">Day of Month</label>
                    <select
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                    >
                      {DAYS_OF_MONTH.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-s font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                  />
                  <p className="text-x text-gray-500 mt-1">
                    Your timezone: {DETECTED_TIMEZONE}
                  </p>
                </div>

                <div>
                  <label className="block text-s font-medium text-gray-700 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="text"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                    placeholder="e.g., finance@company.com, accounting@company.com"
                  />
                  <p className="text-x text-gray-500 mt-1">
                    Enter multiple email addresses separated by commas or semicolons.
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-sky-200 bg-white">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full flex items-center justify-center bg-[#004a80] text-white px-4 py-2 rounded hover:bg-[#003366] disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AddAutomation;
