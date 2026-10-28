import React from 'react';
import AlertDetailTemplate from './AlertDetailTemplate';

const RevenueDropAlerts = () => (
  <AlertDetailTemplate
    title="Revenue Drop Alerts"
    subtitle="Detect unexpected revenue declines and receive AI-guided recovery actions"
    endpointPath="revenue-drop"
    firstMetricLabel="Predicted Revenue Drop"
    firstMetricNoneLabel="None"
    chartTitle="Revenue Trend Projection"
  />
);

export default RevenueDropAlerts;
