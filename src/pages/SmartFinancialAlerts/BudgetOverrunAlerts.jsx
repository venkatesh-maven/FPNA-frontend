import React from 'react';
import AlertDetailTemplate from './AlertDetailTemplate';

const BudgetOverrunAlerts = () => (
  <AlertDetailTemplate
    title="Budget Overrun Alerts"
    subtitle="Real-time notifications when departments exceed allocated budgets with AI-driven corrective actions"
    endpointPath="budget-overrun"
    firstMetricLabel="Predicted Overrun"
    firstMetricNoneLabel="None"
    chartTitle="Budget Variance Projection"
  />
);

export default BudgetOverrunAlerts;
