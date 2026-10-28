import React from 'react';
import AlertDetailTemplate from './AlertDetailTemplate';

const AccountsReceivableAlerts = () => (
  <AlertDetailTemplate
    title="Accounts Receivable Alerts"
    subtitle="Monitor receivable risk and overdue exposure with AI follow-up recommendations"
    endpointPath="accounts-receivable"
    firstMetricLabel="Projected AR Exposure"
    firstMetricNoneLabel="None"
    chartTitle="Receivable Exposure Projection"
  />
);

export default AccountsReceivableAlerts;
