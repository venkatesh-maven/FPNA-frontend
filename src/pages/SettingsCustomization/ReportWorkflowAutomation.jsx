import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { API_BASE_URL } from '../../config/config';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const formatTime = (timeOfDay) => {
  if (!timeOfDay) return '';
  const [hour, minute] = timeOfDay.split(':');
  return `${Number(hour)}:${minute}`;
};

const describeSchedule = (report) => {
  const parts = [report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1)];
  if (report.frequency === 'weekly' && report.day_of_week) {
    parts.push(report.day_of_week.charAt(0).toUpperCase() + report.day_of_week.slice(1));
  } else if (report.frequency === 'monthly' && report.day_of_month) {
    parts.push(`Day ${report.day_of_month}`);
  } else if (report.frequency === 'quarterly') {
    const monthLabel = MONTHS_IN_QUARTER.find((m) => m.value === report.month_in_quarter)?.label;
    if (monthLabel) parts.push(monthLabel);
    if (report.day_of_month) parts.push(`Day ${report.day_of_month}`);
  }
  if (report.time_of_day) parts.push(`at ${formatTime(report.time_of_day)}`);
  return parts.join(' - ');
};

const ReportWorkflowAutomation = ({ token }) => {
  const [availableReports, setAvailableReports] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [reportType, setReportType] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState('monday');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [monthInQuarter, setMonthInQuarter] = useState(1);
  const [recipients, setRecipients] = useState('');

  const [savedReports, setSavedReports] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const fetchAvailableReports = async () => {
    try {
      setCatalogLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/report-automation/available-reports`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Failed to load available reports');
      const data = await res.json();
      setAvailableReports(data);
      if (data.length > 0) setReportType(data[0].code);
    } catch (error) {
      toast.error(error.message || 'Failed to load available reports');
    } finally {
      setCatalogLoading(false);
    }
  };

  const fetchSavedReports = async () => {
    try {
      setListLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/report-automation/`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Failed to load report automations');
      const data = await res.json();
      setSavedReports(data);
    } catch (error) {
      toast.error(error.message || 'Failed to load report automations');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchAvailableReports();
    fetchSavedReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAddReport = async () => {
    if (!reportType) {
      toast.error('Please select a report');
      return;
    }

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
        headers: authHeaders,
        body: JSON.stringify({
          report_type: reportType,
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
        throw new Error(errorData.detail || 'Failed to save report schedule');
      }

      const newReport = await res.json();
      setSavedReports([newReport, ...savedReports]);
      setRecipients('');
      setFrequency('daily');
      setTimeOfDay('09:00');
      setDayOfWeek('monday');
      setDayOfMonth(1);
      setMonthInQuarter(1);

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
    } catch (error) {
      toast.error(error.message || 'Failed to save report schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/report-automation/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Failed to delete report schedule');

      setSavedReports(savedReports.filter((report) => report.id !== id));
      toast.success('Report schedule deleted');
    } catch (error) {
      toast.error(error.message || 'Failed to delete report schedule');
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#004a80] mb-4">Report & Workflow Schedule</h2>
      <p className="text-gray-600 mb-6">Configure automated reports and financial workflows.</p>

      <div className="bg-gray-50 p-6 rounded-lg mb-6">
        <h3 className="font-medium text-gray-700 mb-4">Create New Schedule</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-s font-medium text-gray-700 mb-1">Report Name</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              disabled={catalogLoading || availableReports.length === 0}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80] disabled:bg-gray-100"
            >
              {catalogLoading && <option value="">Loading reports...</option>}
              {!catalogLoading && availableReports.length === 0 && (
                <option value="">No reports available</option>
              )}
              {availableReports.map((report) => (
                <option key={report.code} value={report.code}>
                  {report.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-s font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {frequency === 'weekly' && (
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
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
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
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
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
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
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
            />
            <p className="text-x text-gray-500 mt-1">Your timezone: {DETECTED_TIMEZONE}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-s font-medium text-gray-700 mb-1">Recipient Email</label>
          <input
            type="text"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
            placeholder="e.g., finance@company.com, accounting@company.com"
          />
          <p className="text-x text-gray-500 mt-1">
            Enter multiple email addresses separated by commas or semicolons.
          </p>
        </div>

        <button
          onClick={handleAddReport}
          disabled={loading || catalogLoading}
          className="flex items-center bg-[#004a80] text-white px-4 py-2 rounded hover:bg-[#003366] disabled:opacity-50"
        >
          <FiPlus className="mr-2" />
          {loading ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>

      <div>
        <h3 className="font-medium text-gray-700 mb-4">Saved Report Schedules</h3>
        {listLoading ? (
          <p className="text-gray-500 italic">Loading report automations...</p>
        ) : savedReports.length === 0 ? (
          <p className="text-gray-500 italic">No report automations configured yet</p>
        ) : (
          <div className="space-y-4">
            {savedReports.map((report) => (
              <div key={report.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-[#004a80]">{report.report_name}</h4>
                    <p className="text-s text-gray-600">Schedule: {describeSchedule(report)}</p>
                    <p className="text-s text-gray-600">
                      Recipients: {report.recipients.join(', ')}
                    </p>
                    <p className="text-x text-gray-500 mt-1">
                      Created: {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Delete"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportWorkflowAutomation;
