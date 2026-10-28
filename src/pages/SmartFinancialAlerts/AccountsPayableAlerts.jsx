import React from 'react';
import AlertDetailTemplate from './AlertDetailTemplate';

const AccountsPayableAlerts = () => (
  <AlertDetailTemplate
    title="Accounts Payable Alerts"
    subtitle="Track payable obligations proactively and avoid penalties with AI-supported actions"
    endpointPath="accounts-payable"
    firstMetricLabel="Projected AP Due"
    firstMetricNoneLabel="None"
    chartTitle="Payable Obligation Projection"
  />
);

export default AccountsPayableAlerts;
