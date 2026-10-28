import React from 'react';
import AlertDetailTemplate from './AlertDetailTemplate';

const ExpenseSpikeDetection = () => (
  <AlertDetailTemplate
    title="Expense Spike Detection"
    subtitle="Highlight unusual spending patterns early with AI-based mitigation suggestions"
    endpointPath="expense-spike"
    firstMetricLabel="Predicted Expense Spike"
    firstMetricNoneLabel="None"
    chartTitle="Expense Trend Projection"
  />
);

export default ExpenseSpikeDetection;
