import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  FiAlertTriangle, 
  FiDollarSign, 
  FiTrendingDown, 
  FiCreditCard, 
  FiClock, 
  FiCalendar,
  FiChevronRight,
  FiBarChart2,
  FiBell,
  FiZap,
  FiPlus
} from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/config';

const SmartFinancialAlerts = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [resolvedAlerts, setResolvedAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [alertsLoadError, setAlertsLoadError] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [isProcessingRules, setIsProcessingRules] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [deletingRuleId, setDeletingRuleId] = useState(null);
  const [rules, setRules] = useState([]);
  const fetchingRef = useRef(false);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    alert_type: 'budget_variance',
    metric_name: '',
    operator: '>',
    threshold: '',
    severity: 'medium',
    is_active: true
  });
  
  const alertTypes = [
    {
      id: 'cash_flow',
      title: 'Cash Shortfall Warning',
      description: 'AI predicts potential liquidity issues and suggests corrective actions',
      icon: <FiDollarSign className="text-sky-500" size={24} />,
      color: 'bg-sky-50',
      textColor: 'text-sky-700',
      linkTo: '/CashShortfallWarning'
    },
    {
      id: 'budget_variance',
      title: 'Budget Overrun Alerts',
      description: 'Real-time notifications when departments exceed their allocated budgets',
      icon: <FiTrendingDown className="text-yellow-500" size={24} />,
      color: 'bg-yellow-50',
      textColor: 'text-yellow-600',
      linkTo: '/BudgetOverrunAlerts'
    },
    {
      id: 'revenue_drop',
      title: 'Revenue Drop Alerts',
      description: 'Identify unexpected drops in revenue & suggest corrective actions',
      icon: <FiBarChart2 className="text-purple-500" size={24} />,
      color: 'bg-purple-50',
      textColor: 'text-purple-600',
      linkTo: '/RevenueDropAlerts'
    },
    {
      id: 'expense_anomaly',
      title: 'Expense Spike Detection',
      description: 'Highlights unusual spending patterns for further investigation',
      icon: <FiCreditCard className="text-blue-500" size={24} />,
      color: 'bg-blue-50',
      textColor: 'text-blue-600',
      linkTo: '/ExpenseSpikeDetection'
    },
    {
      id: 'forecast_accuracy',
      title: 'Accounts Receivable Alerts',
      description: 'Notifies about overdue payments & suggests follow-ups',
      icon: <FiClock className="text-green-500" size={24} />,
      color: 'bg-green-50',
      textColor: 'text-green-600',
      linkTo: '/AccountsReceivableAlerts'
    },
    {
      id: 'data_integration',
      title: 'Accounts Payable Alerts',
      description: 'Reminds users about upcoming vendor payments to avoid penalties',
      icon: <FiCalendar className="text-indigo-500" size={24} />,
      color: 'bg-indigo-50',
      textColor: 'text-indigo-600',
      linkTo: '/AccountsPayableAlerts'
    }
  ];

  const fetchRules = async () => {
    if (!token) {
      setRules([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/alerts/rules`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rules: ${response.status}`);
      }

      const data = await response.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching alert rules:', error);
    }
  };

  const fetchAlerts = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/alerts/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status}`);
      }

      const apiAlerts = await response.json();

      const mapped = (apiAlerts || []).map((alert) => {
        const typeDef = alertTypes.find((t) => t.id === alert.alert_type);
        return {
          id: alert.id,
          type: alert.alert_type,
          title: alert.title,
          message: alert.message,
          severity: alert.severity || 'low',
          date: alert.created_at ? new Date(alert.created_at) : new Date(),
          resolved: alert.status === 'resolved',
          linkTo: typeDef?.linkTo || '/smart-financial-alerts',
          details: alert.metric_data || {}
        };
      });

      setAlerts(mapped.filter((a) => !a.resolved));
      setResolvedAlerts(mapped.filter((a) => a.resolved));
      setIsLoading(false);

      mapped.filter((a) => a.severity === 'high' && !a.resolved).forEach((alert) => {
        toast.error(alert.message, {
          position: 'top-right',
          autoClose: 6000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
      });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlertsLoadError(true);
      setIsLoading(false);
    } finally {
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchingRef.current = false;
    fetchAlerts();
  }, [token]);

  useEffect(() => {
    fetchRules();
  }, [token]);
  
  const getSeverityBadge = (severity) => {
    const classes = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${classes[severity] || 'bg-gray-100 text-gray-800'}`}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };
  
  const markAsResolved = async (id) => {
    if (!token) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/alerts/${id}/resolve?resolution=manually_resolved`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Resolve failed: ${response.status}`);
      }

      const resolvedItem = alerts.find((a) => a.id === id);
      if (resolvedItem) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        setResolvedAlerts((prev) => [{ ...resolvedItem, resolved: true }, ...prev]);
      }

      toast.success('Alert marked as resolved');
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    }
  };
  
  const filteredAlerts = activeTab === 'all'
    ? alerts
    : alerts.filter((alert) => alert.type === activeTab);
  
  const navigateToAlertDetails = (alert) => {
    navigate(`/smart-financial-alerts/insights/${alert.id}`, {
      state: { alertTitle: alert.title, severity: alert.severity }
    });
  };

  const handleRuleInputChange = (field, value) => {
    setRuleForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleForm({
      name: '',
      description: '',
      alert_type: 'budget_variance',
      metric_name: '',
      operator: '>',
      threshold: '',
      severity: 'medium',
      is_active: true
    });
  };

  const mapRuleToForm = (rule) => {
    const firstCondition = rule?.conditions?.conditions?.[0] || {};
    return {
      name: rule?.name || '',
      description: rule?.description || '',
      alert_type: rule?.alert_type || 'budget_variance',
      metric_name: firstCondition.metric_id || '',
      operator: firstCondition.operator || '>',
      threshold: firstCondition.threshold ?? '',
      severity: rule?.severity || 'medium',
      is_active: Boolean(rule?.enabled)
    };
  };

  const startEditRule = (rule) => {
    setEditingRuleId(rule.id);
    setRuleForm(mapRuleToForm(rule));
    setShowRuleForm(true);
  };

  const cancelEditRule = () => {
    setEditingRuleId(null);
    resetRuleForm();
    setShowRuleForm(false);
  };

  const saveRule = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Please login to manage alert rules');
      return;
    }

    if (!ruleForm.name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    const thresholdValue = Number(ruleForm.threshold);
    if (Number.isNaN(thresholdValue)) {
      toast.error('Threshold must be a valid number');
      return;
    }

    const payload = {
      name: ruleForm.name.trim(),
      description: ruleForm.description.trim() || null,
      alert_type: ruleForm.alert_type,
      metric_name: ruleForm.metric_name.trim() || 'custom_metric',
      operator: ruleForm.operator,
      threshold: thresholdValue,
      severity: ruleForm.severity,
      is_active: ruleForm.is_active,
      notification_channels: ['in_app']
    };

    try {
      setIsCreatingRule(true);
      const isEditMode = Boolean(editingRuleId);
      const endpoint = isEditMode
        ? `${API_BASE_URL}/api/v1/alerts/rules/${editingRuleId}`
        : `${API_BASE_URL}/api/v1/alerts/rules`;

      const response = await fetch(endpoint, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Rule save failed: ${response.status}`);
      }

      toast.success(isEditMode ? 'Alert rule updated successfully' : 'Alert rule created successfully');
      resetRuleForm();
      setShowRuleForm(false);
      fetchRules();
      fetchAlerts();
    } catch (error) {
      console.error('Error saving alert rule:', error);
      toast.error(editingRuleId ? 'Failed to update alert rule' : 'Failed to create alert rule');
    } finally {
      setIsCreatingRule(false);
    }
  };

  const deleteRule = async (ruleId) => {
    if (!token) {
      toast.error('Please login to manage alert rules');
      return;
    }

    const confirmed = window.confirm('Delete this alert rule?');
    if (!confirmed) return;

    try {
      setDeletingRuleId(ruleId);
      const response = await fetch(`${API_BASE_URL}/api/v1/alerts/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Rule delete failed: ${response.status}`);
      }

      if (editingRuleId === ruleId) {
        cancelEditRule();
      }

      toast.success('Alert rule deleted');
      fetchRules();
    } catch (error) {
      console.error('Error deleting alert rule:', error);
      toast.error('Failed to delete alert rule');
    } finally {
      setDeletingRuleId(null);
    }
  };

  const processRulesNow = async () => {
    if (!token) {
      toast.error('Please login to process alert rules');
      return;
    }

    try {
      setIsProcessingRules(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/alerts/process-rules`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Process rules failed: ${response.status}`);
      }

      const result = await response.json();
      toast.success(`Rules evaluated: ${result.total_rules_evaluated || 0}, Alerts triggered: ${result.alerts_triggered || 0}`);

      await Promise.all([fetchRules(), fetchAlerts()]);
    } catch (error) {
      console.error('Error processing rules:', error);
      toast.error('Failed to run rule evaluation');
    } finally {
      setIsProcessingRules(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* <ToastContainer /> */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-5 bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm w-full">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-white">Smart Financial Alerts</h1>
          </div>
          <p className="text-lg text-white">Automated notifications for key financial events with AI-driven insights</p>
        </div>
        
        {/* Alert Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {alertTypes.map((type) => (
            <Link
              key={type.id}
              to={type.linkTo}
              className={`${type.color} p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1`}
            >
              <div className="flex items-start">
                <div className={`p-3 rounded-lg ${type.color} mr-4`}>
                  {type.icon}
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold mb-1 ${type.textColor}`}>{type.title}</h3>
                  <p className="text-gray-600 text-sm">{type.description}</p>
                </div>
                <FiChevronRight className="text-gray-400 mt-1" />
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Alert Rules</h2>
              <p className="text-sm text-gray-600">Create and manage rule definitions that generate alerts automatically.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={processRulesNow}
                disabled={isProcessingRules}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                <FiZap className="mr-2" />
                {isProcessingRules ? 'Running...' : 'Run Rules Now'}
              </button>
              <button
                type="button"
                onClick={() => setShowRuleForm((prev) => !prev)}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                <FiPlus className="mr-2" />
                {showRuleForm ? 'Close Form' : 'Create Alert Rule'}
              </button>
            </div>
          </div>

          {showRuleForm && (
            <form onSubmit={saveRule} className="border border-gray-200 rounded-lg p-4 mb-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={ruleForm.name}
                    onChange={(e) => handleRuleInputChange('name', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Budget overspend alert"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alert Type</label>
                  <select
                    value={ruleForm.alert_type}
                    onChange={(e) => handleRuleInputChange('alert_type', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="budget_variance">Budget Variance</option>
                    <option value="cash_flow">Cash Flow</option>
                    <option value="revenue_drop">Revenue Drop</option>
                    <option value="expense_anomaly">Expense Anomaly</option>
                    <option value="forecast_accuracy">Forecast Accuracy</option>
                    <option value="data_integration">Data Integration</option>
                    <option value="headcount_anomaly">Headcount Anomaly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metric Name</label>
                  <select
                    value={ruleForm.metric_name}
                    onChange={(e) => handleRuleInputChange('metric_name', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select Metric</option>
                    <option value="budget_variance_pct">Budget Variance %</option>
                    <option value="budget_variance_amount">Budget Variance Amount</option>
                    <option value="total_revenue">Total Revenue</option>
                    <option value="total_expense">Total Expense</option>
                    <option value="net_cash_flow">Net Cash Flow</option>
                    <option value="operating_cash_flow">Operating Cash Flow</option>
                    <option value="gross_margin_pct">Gross Margin %</option>
                    <option value="operating_margin_pct">Operating Margin %</option>
                    <option value="revenue_growth_pct">Revenue Growth %</option>
                    <option value="expense_growth_pct">Expense Growth %</option>
                    <option value="ar_aging_days">AR Aging (Days)</option>
                    <option value="ap_aging_days">AP Aging (Days)</option>
                    <option value="headcount">Headcount</option>
                    <option value="payroll_expense">Payroll Expense</option>
                    <option value="custom_metric">Custom Metric</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
                  <select
                    value={ruleForm.operator}
                    onChange={(e) => handleRuleInputChange('operator', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                    <option value="contains">contains</option>
                    <option value="not_contains">not_contains</option>
                    <option value="in">in</option>
                    <option value="not_in">not_in</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Threshold</label>
                  <input
                    type="number"
                    step="any"
                    value={ruleForm.threshold}
                    onChange={(e) => handleRuleInputChange('threshold', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="100000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select
                    value={ruleForm.severity}
                    onChange={(e) => handleRuleInputChange('severity', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={ruleForm.description}
                    onChange={(e) => handleRuleInputChange('description', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Optional rule description"
                  />
                </div>

                <label className="md:col-span-2 inline-flex items-center text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={ruleForm.is_active}
                    onChange={(e) => handleRuleInputChange('is_active', e.target.checked)}
                    className="mr-2"
                  />
                  Keep this rule active after creation
                </label>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={isCreatingRule}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                >
                  {isCreatingRule ? (editingRuleId ? 'Updating...' : 'Creating...') : (editingRuleId ? 'Update Rule' : 'Create Rule')}
                </button>
                <button
                  type="button"
                  onClick={editingRuleId ? cancelEditRule : resetRuleForm}
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {editingRuleId ? 'Cancel Edit' : 'Reset'}
                </button>
              </div>
            </form>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Existing Rules ({rules.length})</h3>
            {rules.length === 0 ? (
              <p className="text-sm text-gray-500">No rules found for this company yet.</p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                      <p className="text-xs text-gray-500">{rule.alert_type} | {rule.severity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {rule.enabled ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditRule(rule)}
                        className="text-xs px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRule(rule.id)}
                        disabled={deletingRuleId === rule.id}
                        className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {deletingRuleId === rule.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Alerts Section */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${activeTab === 'all' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                All Alerts
              </button>
              {alertTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveTab(type.id)}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${activeTab === type.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  {type.title}
                </button>
              ))}
              <button
                onClick={() => setActiveTab('resolved')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${activeTab === 'resolved' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Resolved
              </button>
            </nav>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <>
              {activeTab !== 'resolved' && (
                <div className="divide-y divide-gray-200">
                  {filteredAlerts.length > 0 ? (
                    filteredAlerts.map(alert => {
                      const alertType = alertTypes.find(t => t.id === alert.type);
                      return (
                        <div 
                          key={alert.id} 
                          className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => navigateToAlertDetails(alert)}
                        >
                          <div className="flex items-start">
                            <div className={`flex-shrink-0 p-3 rounded-lg ${alertType?.color || 'bg-gray-50'} mr-4`}>
                              {alertType?.icon || <FiAlertTriangle className="text-gray-500" size={20} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <h3 className="text-lg font-medium text-gray-900">{alert.title}</h3>
                                {getSeverityBadge(alert.severity)}
                              </div>
                              <p className="text-gray-600 mb-3">{alert.message}</p>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">
                                  {alert.date.toLocaleDateString()} at {alert.date.toLocaleTimeString()}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsResolved(alert.id);
                                  }}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                  Mark as Resolved
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-gray-500">
                      <FiBell className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-lg font-medium">No alerts found</h3>
                      {alertsLoadError
                        ? <p className="mt-1 text-sm text-amber-600">Alert data could not be loaded from the server. Navigate to any module above to view live analytics.</p>
                        : <p className="mt-1">You're all caught up with no {activeTab === 'all' ? '' : 'active'} alerts in this category.</p>
                      }
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'resolved' && (
                <div className="divide-y divide-gray-200">
                  {resolvedAlerts.length > 0 ? (
                    resolvedAlerts.map(alert => {
                      const alertType = alertTypes.find(t => t.id === alert.type);
                      return (
                        <div 
                          key={alert.id} 
                          className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => navigateToAlertDetails(alert)}
                        >
                          <div className="flex items-start">
                            <div className={`flex-shrink-0 p-3 rounded-lg ${alertType?.color || 'bg-gray-50'} mr-4 opacity-60`}>
                              {alertType?.icon || <FiAlertTriangle className="text-gray-500" size={20} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <h3 className="text-lg font-medium text-gray-500 line-through">{alert.title}</h3>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                                  Resolved
                                </span>
                              </div>
                              <p className="text-gray-400 mb-3">{alert.message}</p>
                              <div className="text-sm text-gray-400">
                                {alert.date.toLocaleDateString()} at {alert.date.toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-gray-500">
                      <FiBell className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-lg font-medium">No resolved alerts</h3>
                      <p className="mt-1">All resolved alerts will appear here for your reference.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartFinancialAlerts;
