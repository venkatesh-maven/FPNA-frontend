  // src/AllRoutes.js
  import { lazy, Suspense } from 'react';
  import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
  import ProtectedRoute from '../components/ProtectedRoute';
  import AdminProtectedRoute from '../components/AdminProtectedRoute';
  import MainLayout from '../components/MainLayout';
  const FinancialOverview = lazy(() => import('../components/Dashboard/FinancialOverview'));
  const KeyFinancialKPIs = lazy(() => import('../pages/KeyFinancialKPIs'));
  const RevenueForecasting = lazy(() => import('../pages/ForecastingOverview/RevenueForecasting'));
  const AIChatBot = lazy(() => import('../pages/AIChatBot'));
  const LoginPage = lazy(() => import('../pages/Login'));
  const ExpenseForecastingDashboard = lazy(() => import('../pages/ForecastingOverview/ExpenseForecastingDashboard'));
  const DebtInterestForecasting = lazy(() => import('../pages/ForecastingOverview/DebtInterestForecasting'));
  const ScenarioModeling = lazy(() => import('../pages/ForecastingOverview/ScenarioModeling'));
  const BreakEvenAnalysis = lazy(() => import('../pages/ForecastingOverview/BreakEvenAnalysis'));
  const HelpSupport = lazy(() => import('../pages/Suport/HelpSupport'));
  const CashFlowProjections = lazy(() => import('../pages/ForecastingOverview/CashFlowProjections'));
  const SmartFinancialAlerts = lazy(() => import('../pages/SmartFinancialAlerts/SmartFinancialAlerts'));
  const AlertInsightDetails = lazy(() => import('../pages/SmartFinancialAlerts/AlertInsightDetails'));
  const AIFinancialRecommendations = lazy(() => import('../pages/AI-driven Insights & Alerts/AI-Financial Recommendations/AIFinancialRecommendations'));
  const CompanyManagementTable = lazy(() => import('../pages/All Company management/CompanyManagementTable'));
  const ForecastingOverview = lazy(() => import('../pages/ForecastingOverview/ForecastingOverview'));
  const CAPEXForecastScreen = lazy(() => import('../pages/ForecastingOverview/CAPEXForecastScreen'));

  import { AuthProvider } from '../context/AuthContext';
  const FixedVariableExpense = lazy(() => import('../pages/Budgeting/Operational-Budgeting/FixedVariableExpense'));
  const DepartmentBudgeting = lazy(() => import('../pages/Budgeting/Operational-Budgeting/DepartmentBudgeting'));
  const AICostOptimization = lazy(() => import('../pages/Budgeting/Operational-Budgeting/AICostOptimization'));
  const BudgetVsActuals = lazy(() => import('../pages/Budgeting/Operational-Budgeting/BudgetVsActuals'));
  const CapitalInvestmentPlanning = lazy(() => import('../pages/Budgeting/CAPEX-Budgeting/CapitalInvestmentPlanning'));
  const ROIAllocation = lazy(() => import('../pages/Budgeting/CAPEX-Budgeting/ROIAllocation'));
  const DepreciationForecast = lazy(() => import('../pages/Budgeting/CAPEX-Budgeting/DepreciationForecast'));
  const UploadGL = lazy(() => import('../pages/Financial Reports/UploadGL'));
  const RegisterPage = lazy(() => import('../pages/RegisterPage'));
  const OrganizationsListScreen = lazy(() => import('../pages/Organizations List Screen/OrganizationsListScreen'));
  const RevenueComponent = lazy(() => import('../components/Dashboard/FinancialOverview items/RevenueComponent'));
  const ExpenseComponent = lazy(() => import('../components/Dashboard/FinancialOverview items/ExpenseComponent'));
  // import ProfileDetailsScreen from '../pages/Organizations List Screen/OrganizationsListScreen';
  const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
  const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));

  const ProfileDetailsScreen = lazy(() => import('../pages/Organizations List Screen/OrganizationsListScreen'));
  const SalesPerformanceDashboard = lazy(() => import('../pages/Performance Analytics/Sales and Marketing/SalesPerformanceDashboard'));
  const SalesPerformanceTable = lazy(() => import('../pages/Performance Analytics/Sales and Marketing/SalesPerformanceTable'));
  const HRworkForce = lazy(() => import('../pages/Performance Analytics/HR and Workforce/HRworkForce'));
  const HRWorkforceTable = lazy(() => import('../pages/Performance Analytics/HR and Workforce/HRWorkforceTable'));
  const ITandTechnology = lazy(() => import('../pages/Performance Analytics/IT and Technology/ITandTechnology'));
  const PipelineConversion = lazy(() => import('../pages/Performance Analytics/Sales and Marketing/PipelineConversion'));
  const CACandCLV = lazy(() => import('../pages/Performance Analytics/Sales and Marketing/CACandCLV'));
  const ChurnRetention = lazy(() => import('../pages/Performance Analytics/Sales and Marketing/ChurnRetention'));
  const MarketingCampaign = lazy(() => import('../pages/Performance Analytics/Sales and Marketing/MarketingCampaign'));
  const RevenueBreakdown = lazy(() => import('../pages/Performance Analytics/Sales and Marketing/RevenueBreakdown'));
  const EmployeeProductivityReport = lazy(() => import('../pages/Performance Analytics/HR and Workforce/EmployeeProductivityReport'));
  const UtilizationRateReport = lazy(() => import('../pages/Performance Analytics/HR and Workforce/UtilizationRate'));
  const RetentionAttritionRate = lazy(() => import('../pages/Performance Analytics/HR and Workforce/RetentionAttritionRate'));

  const ITSpendBreakdown = lazy(() => import('../pages/Performance Analytics/IT and Technology/ITSpendBreakdown'));
  const ITSpendTable = lazy(() => import('../pages/Performance Analytics/IT and Technology/ITSpendTable'));
  const SoftwareLicenseUtilization = lazy(() => import('../pages/Performance Analytics/IT and Technology/SoftwareLicenseutilization'));
  const InfrastructureCostEfficiency = lazy(() => import('../pages/Performance Analytics/IT and Technology/InfrastructureEfficiency'));
  const ITBudgetVsActuals = lazy(() => import('../pages/Performance Analytics/IT and Technology/ITBudgetVsActuals'));
  const SecurityCompliance = lazy(() => import('../pages/Performance Analytics/IT and Technology/SecurityCompliance'));
  const TechDebtModernization = lazy(() => import('../pages/Performance Analytics/IT and Technology/TechDebtModernization'));
  const FinanceAccountingDashboard = lazy(() => import('../pages/Performance Analytics/Finance and Accounting/FinanceAccountingDashboard'));
  const FinanceAccountingTable = lazy(() => import('../pages/Performance Analytics/Finance and Accounting/FinanceAccountingTable'));
  const LiquidityWorkingCapital = lazy(() => import('../pages/Performance Analytics/Finance and Accounting/LiquidityWorkingCapital'));
  const TaxCompliance = lazy(() => import('../pages/Performance Analytics/Finance and Accounting/TaxCompliance'));
  const BudgetUtilization = lazy(() => import('../pages/Performance Analytics/Finance and Accounting/BudgetUtilization'));
  const ProfitabilityRatios = lazy(() => import('../pages/Performance Analytics/Finance and Accounting/ProfitabilityRatios'));
  const DebtCoverage = lazy(() => import('../pages/Performance Analytics/Finance and Accounting/DebtCoverage'));


  const CostOptimizationSuggestions = lazy(() => import('../pages/AI-driven Insights & Alerts/AI-Financial Recommendations/CostOptimizationSuggestions'));
  const RevenueGrowthStrategies = lazy(() => import('../pages/AI-driven Insights & Alerts/AI-Financial Recommendations/RevenueGrowthStrategies'));
  const InvestmentCapitalAllocation = lazy(() => import('../pages/AI-driven Insights & Alerts/AI-Financial Recommendations/InvestmentCapitalAllocation'));
  const ProfitabilityEnhancement = lazy(() => import('../pages/AI-driven Insights & Alerts/AI-Financial Recommendations/ProfitabilityEnhancement'));
  const ForecastAccuracyMonitoring = lazy(() => import('../pages/AI-driven Insights & Alerts/Forecast Accuracy Monitoring/ForecastAccuracyMonitoring'));
  const BenchmarkingPeerComparisons = lazy(() => import('../pages/AI-driven Insights & Alerts/BenchmarkingDashboard/BenchmarkingDashboard'));
  const PredictiveRiskManagement = lazy(() => import('../pages/AI-driven Insights & Alerts/PredictiveRiskManagement/PredictiveRiskManagement'));
  const SupplyChainAnalytics = lazy(() => import('../pages/Performance Analytics/Supply Chain & Procurement Analytics/SupplyChainAnalytics'));
  const SupplyChainTable = lazy(() => import('../pages/Performance Analytics/Supply Chain & Procurement Analytics/SupplyChainTable'));
  const RecruitmentPerformanceDashboard = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/RecruitmentPerformanceDashboard'));
  const RecruiterAnalytics = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/RecruiterAnalytics'));
  const RehireRedeployment = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/RehireRedeployment'));
  const RecruitmentRevenueAnalytics = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/RecruitmentRevenueAnalytics'));
  const GrossMarginProfitability = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/GrossMarginProfitability'));
  const CostOperatingLeverage = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/CostOperatingLeverage'));
  const RecruitmentPerformanceTable = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/RecruitmentPerformanceTable'));
  const ExecutiveDashboard = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/ExecutiveDashboard'));
  const SalesDashboard = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/SalesDashboard'));
  const AccountManagerDashboard = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/AccountManagerDashboard'));
  const RecruiterDashboard = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/RecruiterDashboard'));
  const PositionFulfillmentReport = lazy(() => import('../pages/Performance Analytics/Recruitment Performance Analytics/PositionFulfillmentReport'));
  const SupplierPerformanceScorecard = lazy(() => import('../pages/Performance Analytics/Supply Chain & Procurement Analytics/SupplierPerformanceScorecard'));
  const InventoryTurnoverAnalysis = lazy(() => import('../pages/Performance Analytics/Supply Chain & Procurement Analytics/InventoryTurnoverAnalysis'));
  const ProcurementSpendBreakdown = lazy(() => import('../pages/Performance Analytics/Supply Chain & Procurement Analytics/ProcurementSpendBreakdown'));
  const FreightLogisticsOptimization = lazy(() => import('../pages/Performance Analytics/Supply Chain & Procurement Analytics/FreightLogisticsOptimization'));
  const OperationalRiskAssessment = lazy(() => import('../pages/Performance Analytics/Supply Chain & Procurement Analytics/OperationalRiskAssessment'));
  const CostSavingOpportunities = lazy(() => import('../pages/Performance Analytics/Supply Chain & Procurement Analytics/CostSavingOpportunities'));
  const CashShortfallWarning = lazy(() => import('../pages/SmartFinancialAlerts/CashShortfallWarning'));
  const BudgetOverrunAlerts = lazy(() => import('../pages/SmartFinancialAlerts/BudgetOverrunAlerts'));
  const RevenueDropAlerts = lazy(() => import('../pages/SmartFinancialAlerts/RevenueDropAlerts'));
  const ExpenseSpikeDetection = lazy(() => import('../pages/SmartFinancialAlerts/ExpenseSpikeDetection'));
  const AccountsReceivableAlerts = lazy(() => import('../pages/SmartFinancialAlerts/AccountsReceivableAlerts'));
  const AccountsPayableAlerts = lazy(() => import('../pages/SmartFinancialAlerts/AccountsPayableAlerts'));
  const UserManagement = lazy(() => import('../pages/Suport/User Management/UserManagement'));
  const SettingsCustomization = lazy(() => import('../pages/SettingsCustomization/SettingsCustomization'));
  const ExpenseTrendAnalysis = lazy(() => import('../pages/Performance Analytics/Finance and Accounting/ExpendTrendAnalysis'));
  const HeadcountPayroll = lazy(() => import('../pages/ForecastingOverview/HeadcountPayroll'));
  const HiringFunnelMetrics = lazy(() => import('../pages/Performance Analytics/HR and Workforce/HiringFunnelMetrics'));
  const DiversityInclusionMetrics = lazy(() => import('../pages/Performance Analytics/HR and Workforce/DiversityInclusionMetrics'));
  const CompensationBenefits = lazy(() => import('../pages/Performance Analytics/HR and Workforce/CompensationBenefits'));
  const GLUploadScreen = lazy(() => import('../pages/Gl-Data-upload-screen/GLDataUploadScreen'));
  import ScrollToTop from '../ScrollToTop';
  const OperationalBudgeting = lazy(() => import('../pages/Budgeting/Operational-Budgeting/OperationalBudgeting'));
  const RevenueBasedBudgeting = lazy(() => import('../pages/Budgeting/RevenueBased-Budgeting/RevenuebasedBudgeting'));
  const RevenueDrivenExpenseAllocation = lazy(() => import('../pages/Budgeting/RevenueBased-Budgeting/RevenueDrivenExpense'));
  const SalesGrowthBudgetAdjustments = lazy(() => import('../pages/Budgeting/RevenueBased-Budgeting/SaleGrowthBudget'));
  const CustomerAcquisitionRetentionBudgeting = lazy(() => import('../pages/Budgeting/RevenueBased-Budgeting/CustomerAcquisitionRetention'));
  const SubscriptionRevenueBudgeting = lazy(() => import('../pages/Budgeting/RevenueBased-Budgeting/SubscriptionRevenue'));
  const ScenarioBasedCapexModeling = lazy(() => import('../pages/Budgeting/CAPEX-Budgeting/ScenarioBasedCapex'));
  const HeadcountPlanning = lazy(() => import('../pages/Budgeting/WorkforcePayroll-Budgeting/HeadcountPlanning'));
  const SalaryCompensationBudgeting = lazy(() => import('../pages/Budgeting/WorkforcePayroll-Budgeting/SalaryCompensation'));
  const AttritionReplacementCostProjections = lazy(() => import('../pages/Budgeting/WorkforcePayroll-Budgeting/AttritionReplacement'));
  const WorkforceEfficiencyAnalysis = lazy(() => import('../pages/Budgeting/WorkforcePayroll-Budgeting/orkforceEfficiency'));
  const JustificationBasedBudgeting = lazy(() => import('../pages/Budgeting/ZeroBased-Budgeting/JustificationBased'));
  const CostControlWasteReduction = lazy(() => import('../pages/Budgeting/ZeroBased-Budgeting/CostControlWasteReduction'));
  const DepartmentZBBImplementation = lazy(() => import('../pages/Budgeting/ZeroBased-Budgeting/DepartmentZBBImplementation'));
  const SpendingEfficiencyRecommendations = lazy(() => import('../pages/Budgeting/ZeroBased-Budgeting/SpendingEfficiency'));
  const ContinuousBudgetUpdates = lazy(() => import('../pages/Budgeting/Rolling&Flexible-Budgeting/ContinuousBudgetUpdates'));
  const ScenarioBasedRollingForecasts = lazy(() => import('../pages/Budgeting/Rolling&Flexible-Budgeting/ScenarioBasedRollingForecasts'));
  const EmergencyContingencyBudgeting = lazy(() => import('../pages/Budgeting/Rolling&Flexible-Budgeting/EmergencyContigency'));
  const AutomatedVarianceAlerts = lazy(() => import('../pages/Budgeting/Rolling&Flexible-Budgeting/AutomatedVarianceAlerts'));
  const RevenueVsBudgetExpansion = lazy(() => import('../pages/Budgeting/ScenarioModelling/RevenueVsBudgetExpansion'));
  const CostCuttingScenarioTesting = lazy(() => import('../pages/Budgeting/ScenarioModelling/CostCuttingScenarioTesting'));
  const MarketEconimicConditionSimulations = lazy(() => import('../pages/Budgeting/ScenarioModelling/InvestmentTradeOffs'));
  const InvestmentTradeOffs = lazy(() => import('../pages/Budgeting/ScenarioModelling/InvestmentTradeOffs'));
  const MarketEconomicSimulations = lazy(() => import('../pages/Budgeting/ScenarioModelling/MarketEconomicSimulations'));
  const AICostOptimizationSuggestions = lazy(() => import('../pages/Budgeting/Operational-Budgeting/AICostOptimization'));
  const CapexBudgeting = lazy(() => import('../pages/Budgeting/CAPEX-Budgeting/CapexBudgeting'));
  const WorkforceBudgeting = lazy(() => import('../pages/Budgeting/WorkforcePayroll-Budgeting/WorkforceBudgeting'));
  const ZeroBasedBudgeting = lazy(() => import('../pages/Budgeting/ZeroBased-Budgeting/ZeroBasedBudgeting'));
  const RollingBudgeting = lazy(() => import('../pages/Budgeting/Rolling&Flexible-Budgeting/RollingBudgeting'));
  const ScenarioModelingBudgeting = lazy(() => import('../pages/Budgeting/ScenarioModelling/ScenarioModellingBudgeting'));

  const BudgetingHub = lazy(() => import('../pages/Budgeting/BudgetingHub'));
  const CorporateBudgetGuidelines = lazy(() => import('../pages/Budgeting/CorporateBudgetGuidelines'));

  // New AI-Powered Budget module (mock/frontend-only, separate from legacy Budgeting above)
  const BudgetOverview = lazy(() => import('../pages/Budget/BudgetOverview'));
  const BudgetSetupGuidelines = lazy(() => import('../pages/Budget/BudgetSetupGuidelines'));
  const BudgetRevenueBudgeting = lazy(() => import('../pages/Budget/RevenueBudgeting'));
  const BudgetWorkforcePlanning = lazy(() => import('../pages/Budget/WorkforcePlanning'));
  const BudgetOpexBudgeting = lazy(() => import('../pages/Budget/OpexBudgeting'));
  const BudgetCapexBudgeting = lazy(() => import('../pages/Budget/CapexBudgeting'));
  const BudgetPnLStatement = lazy(() => import('../pages/Budget/BudgetPnLStatement'));
  const BudgetReviewApproval = lazy(() => import('../pages/Budget/BudgetReviewApproval'));

  const Setup2FA = lazy(() => import('../context/Setup2FA'));
  const Verify2FA = lazy(() => import('../context/Verify2FA'));
  const CashFlow = lazy(() => import('../components/Dashboard/FinancialOverview items/CashFlow'));
  const ProfitAnalysis = lazy(() => import('../components/Dashboard/FinancialOverview items/ProfitAnalysis'));
  const IntegrationDetails = lazy(() => import('../pages/SettingsCustomization/GL-Uploads/ExcelIntegrationDetailsView'));
  const FinancialReports = lazy(() => import('../pages/FinancialCustomeCoreResult/FinancialReportsCoreResult'));
  const PLDashboard = lazy(() => import('../pages/FinancialCustomeCoreResult/PLDashboard'));
  const CashFlowStatement = lazy(() => import('../pages/FinancialCustomeCoreResult/CashFlowStatement'));
  const BalanceSheet = lazy(() => import('../pages/FinancialCustomeCoreResult/BalanceSheet'));
  const ARAgingReport = lazy(() => import('../pages/FinancialCustomeCoreResult/ARAgingReport'));
  const APAgingReport = lazy(() => import('../pages/FinancialCustomeCoreResult/APAgingReport'));
  const CustomRevenueReport = lazy(() => import('../pages/FinancialCustomeCoreResult/CustomRevenueReport'));
  const CustomerProfitabilityReport = lazy(() => import('../pages/FinancialCustomeCoreResult/CustomerProfitabilityReport'));
  const RevenueReportDashboard = lazy(() => import('../pages/FinancialCustomeCoreResult/RevenueReportDashboard'));
  const ProjectCostingReport = lazy(() => import('../pages/FinancialCustomeCoreResult/ProjectCostingReport'));
  const OpexReport = lazy(() => import('../pages/FinancialCustomeCoreResult/OpexReport'));
  const FixedAssetRegister = lazy(() => import('../pages/FinancialCustomeCoreResult/FixedAssetRegister'));
  const CapexReport = lazy(() => import('../pages/FinancialCustomeCoreResult/CapexReport'));
  const PayrollReconciliation = lazy(() => import('../pages/FinancialCustomeCoreResult/PayrollReconciliation'));
  const MarketingSpendReport = lazy(() => import('../pages/FinancialCustomeCoreResult/MarketingSpendReport'));
  const SalesFunnelReport = lazy(() => import('../pages/FinancialCustomeCoreResult/SalesFunnelReport'));
  const ExcelMappingValidator = lazy(() => import('../ExcelMappingValidator'));
  const ExcelMappingValidator2 = lazy(() => import('../ExcelMappingValidator2'));
  const CalculateMetrics = lazy(() => import('../CalculateMetrics'));
  const WelcomePage = lazy(() => import('../components/WelcomePage'));
import FinancialYearProvider from '../context/FinancialYearContext';
import BudgetYearProvider from '../context/BudgetYearContext';
import BudgetMethodologyProvider from '../context/BudgetMethodologyContext';
import BudgetGuidelinesProvider from '../context/BudgetGuidelinesContext';
const FinancialHeader = lazy(() => import('../components/Dashboard/FinancialHeader'));
const FinancialReportsNew = lazy(() => import('../pages/FinancialReports/FinancialReportsNew'));
const ReportsLayout = lazy(() => import('../pages/FinancialReports/ReportsLayout'));
const PnLPage = lazy(() => import('../pages/FinancialReports/pnl/PnLPage'));
const CashFlowPage = lazy(() => import('../pages/FinancialReports/cashflow/CashFlowPage'));
const RevenuePage = lazy(() => import('../pages/FinancialReports/revenue/revenuePage'));
const CustomerProfitPage = lazy(() => import('../pages/FinancialReports/customerProfit/CustomerProfitPage'));
const BalanceSheetPage = lazy(() => import('../pages/FinancialReports/balancesheet/BalanceSheetPage'));
const RoportProjectCostingReport = lazy(() => import('../pages/FinancialReports/ProjectCosting/ProjectCostingReport'));
const OperatingExpenses = lazy(() => import('../pages/FinancialReports/OperatingExpenses/OperatingExpenses'));
const ReportsPayrollReconciliation = lazy(() => import('../pages/FinancialReports/PayrollReconciliation/PayrollReconciliation'));
const FixedAssetReportPage = lazy(() => import('../pages/FinancialReports/FixedAssetReportPage/FixedAssetReportPage.jsx'));
const FinancialCustomReportBuilder = lazy(() => import('../pages/FinancialReports/CustomReportBuilder/CustomReportBuilder'));
const BalanceSheetDashboard = lazy(() => import('../pages/FinancialCustomeCoreResult/BalanceSheetDashboard'));
const CustomerProfitabilityDashboard = lazy(() => import('../pages/FinancialCustomeCoreResult/CustomerProfitabilityDashboard'));
const ProjectCostingReportDashboard = lazy(() => import('../pages/FinancialCustomeCoreResult/ProjectCostingReportDashboard'));
const OperatingExpensesDashboard = lazy(() => import('../pages/FinancialCustomeCoreResult/OperatingExpensesDashboard'));
const PayrollReconciliationDashboard = lazy(() => import('../pages/FinancialCustomeCoreResult/PayrollReconciliationDashboard'));
const SalesFunnelReportData = lazy(() => import('../pages/FinancialReports/Sales Report/SalesFunnelReport'));
const PerformanceAnalyticsOverview = lazy(() => import('../pages/Performance Analytics/PerformanceAnalyticsOverview'));
const ForcastPnLReports = lazy(() => import('../pages/ForecastingOverview/ForcastPnLReports'));
const PnLForecastReport = lazy(() => import('../pages/ForecastingOverview/PnLForecastReport'));
// Sales Performance Analytics (sample data, frontend only)
const SalesAnalyticsLayout = lazy(() => import('../pages/SalesAnalytics/SalesAnalyticsLayout'));
const SalesAnalyticsIndexRedirect = lazy(() => import('../pages/SalesAnalytics/SalesAnalyticsIndexRedirect'));
const SalesCapabilityRoute = lazy(() => import('../pages/SalesAnalytics/access/SalesCapabilityRoute'));
const SalesExecutiveOverview = lazy(() => import('../pages/SalesAnalytics/pages/executive/ExecutiveOverviewPage'));
const SalesDirectorPage = lazy(() => import('../pages/SalesAnalytics/pages/director/SalesDirectorPage'));
const SalesSalespersonPage = lazy(() => import('../pages/SalesAnalytics/pages/salesperson/SalespersonPage'));
const SalesHealthPage = lazy(() => import('../pages/SalesAnalytics/pages/health/SalesHealthPage'));
const SalesWhatIfPage = lazy(() => import('../pages/SalesAnalytics/pages/whatif/WhatIfPage'));
const SalesTeamForecastPage = lazy(() => import('../pages/SalesAnalytics/pages/forecast/TeamForecastPage'));
const SalesAccessAdminPage = lazy(() => import('../pages/SalesAnalytics/pages/access/AccessAdminPage'));
// Staffing Recruiter Analytics: a copy of the sales module on the four-layer recruiting hierarchy.
const RecruiterAnalyticsLayout = lazy(() => import('../pages/RecruiterAnalytics/SalesAnalyticsLayout'));
const RecruiterAnalyticsIndexRedirect = lazy(() => import('../pages/RecruiterAnalytics/SalesAnalyticsIndexRedirect'));
const RecruiterCapabilityRoute = lazy(() => import('../pages/RecruiterAnalytics/access/SalesCapabilityRoute'));
const RecruiterDirectorOverview = lazy(() => import('../pages/RecruiterAnalytics/pages/executive/ExecutiveOverviewPage'));
const RecruiterTeamPage = lazy(() => import('../pages/RecruiterAnalytics/pages/director/SalesDirectorPage'));
const RecruiterMyPerformancePage = lazy(() => import('../pages/RecruiterAnalytics/pages/salesperson/SalespersonPage'));
const RecruiterHealthPage = lazy(() => import('../pages/RecruiterAnalytics/pages/health/SalesHealthPage'));
const RecruiterWhatIfPage = lazy(() => import('../pages/RecruiterAnalytics/pages/whatif/WhatIfPage'));
const RecruiterTeamForecastPage = lazy(() => import('../pages/RecruiterAnalytics/pages/forecast/TeamForecastPage'));
const RecruiterAccessAdminPage = lazy(() => import('../pages/RecruiterAnalytics/pages/access/AccessAdminPage'));




  function AllRoutes() {
    return (
      <Router>

        <AuthProvider>

          <FinancialYearProvider>
          <BudgetYearProvider>
          <BudgetMethodologyProvider>
          <BudgetGuidelinesProvider>
                          <ScrollToTop />

          <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/register-page" element={<RegisterPage />} />
            <Route path="/setup-2fa/:token" element={<Setup2FA />} />
            <Route path="/verify-2fa" element={<Verify2FA />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/FinancialHeader" element={<FinancialHeader />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<FinancialOverview />} />
                <Route path="/financial-overview" element={<FinancialOverview />} />
                <Route path="/sales-analytics" element={<SalesAnalyticsLayout />}>
                  <Route index element={<SalesAnalyticsIndexRedirect />} />
                  <Route element={<SalesCapabilityRoute any={['view_executive_analytics']} />}>
                    <Route path="executive" element={<SalesExecutiveOverview />} />
                  </Route>
                  <Route element={<SalesCapabilityRoute any={['view_team_analytics']} />}>
                    <Route path="director" element={<SalesDirectorPage />} />
                  </Route>
                  <Route element={<SalesCapabilityRoute any={['view_own_analytics']} />}>
                    <Route path="salesperson" element={<SalesSalespersonPage />} />
                  </Route>
                  <Route element={<SalesCapabilityRoute any={['view_executive_analytics', 'view_team_analytics', 'view_own_analytics']} />}>
                    <Route path="health" element={<SalesHealthPage />} />
                  </Route>
                  <Route element={<SalesCapabilityRoute any={['create_scenario']} />}>
                    <Route path="what-if" element={<SalesWhatIfPage />} />
                  </Route>
                  <Route element={<SalesCapabilityRoute any={['review_team_forecast']} />}>
                    <Route path="team-forecast" element={<SalesTeamForecastPage />} />
                  </Route>
                  <Route element={<SalesCapabilityRoute any={['manage_access']} />}>
                    <Route path="access" element={<SalesAccessAdminPage />} />
                  </Route>
                </Route>
                <Route path="/recruiter-analytics" element={<RecruiterAnalyticsLayout />}>
                  <Route index element={<RecruiterAnalyticsIndexRedirect />} />
                  <Route element={<RecruiterCapabilityRoute any={['view_executive_analytics']} />}>
                    <Route path="director" element={<RecruiterDirectorOverview />} />
                  </Route>
                  <Route element={<RecruiterCapabilityRoute any={['view_manager_analytics']} />}>
                    <Route path="account-manager" element={<RecruiterTeamPage level="manager" key="manager" />} />
                  </Route>
                  <Route element={<RecruiterCapabilityRoute any={['view_team_analytics']} />}>
                    <Route path="lead" element={<RecruiterTeamPage level="lead" key="lead" />} />
                  </Route>
                  <Route element={<RecruiterCapabilityRoute any={['view_own_analytics']} />}>
                    <Route path="recruiter" element={<RecruiterMyPerformancePage />} />
                  </Route>
                  <Route element={<RecruiterCapabilityRoute any={['view_executive_analytics', 'view_manager_analytics', 'view_team_analytics', 'view_own_analytics']} />}>
                    <Route path="health" element={<RecruiterHealthPage />} />
                  </Route>
                  <Route element={<RecruiterCapabilityRoute any={['create_scenario']} />}>
                    <Route path="what-if" element={<RecruiterWhatIfPage />} />
                  </Route>
                  <Route element={<RecruiterCapabilityRoute any={['review_team_forecast']} />}>
                    <Route path="team-forecast" element={<RecruiterTeamForecastPage />} />
                  </Route>
                  <Route element={<RecruiterCapabilityRoute any={['manage_access']} />}>
                    <Route path="access" element={<RecruiterAccessAdminPage />} />
                  </Route>
                </Route>
                <Route path="/key-financial" element={<KeyFinancialKPIs />} />
                {/* <Route path="/financial-core-reports" element={<FinancialReports />} /> */}
                {/* <Route path="/financial-core-reports" element={<FinancialReportsNew />} /> */}
                <Route path="/financial-core-reports" element={<ReportsLayout />} />
                <Route path="/revenueForecasting" element={<RevenueForecasting />} />
                <Route path="/forecastPnLReports" element={<ForcastPnLReports />} />
                <Route path="/pnl-forecast" element={<PnLForecastReport />} />
                <Route path="debt-interest-Forecasting" element={<DebtInterestForecasting />} />
                <Route path="/ask-ai" element={<AIChatBot />} />
                <Route path="/help-Support" element={<HelpSupport />} />
                <Route element={<AdminProtectedRoute />}>
                  <Route path="/user-management" element={<UserManagement />} />
                </Route>
                <Route path="/cashFlow-projections" element={<CashFlowProjections />} />
                <Route path="/smart-financial-alerts" element={<SmartFinancialAlerts />} />
                <Route path="/smart-financial-alerts/insights/:alertId" element={<AlertInsightDetails />} />
                <Route path="/CashShortfallWarning" element={<CashShortfallWarning />} />
                <Route path="/BudgetOverrunAlerts" element={<BudgetOverrunAlerts />} />
                <Route path="/RevenueDropAlerts" element={<RevenueDropAlerts />} />
                <Route path="/ExpenseSpikeDetection" element={<ExpenseSpikeDetection />} />
                <Route path="/AccountsReceivableAlerts" element={<AccountsReceivableAlerts />} />
                <Route path="/AccountsPayableAlerts" element={<AccountsPayableAlerts />} />



                <Route path="/expenseForecasting" element={<ExpenseForecastingDashboard />} />
                <Route path="/aI-financial-recommendations" element={<AIFinancialRecommendations />} />


                <Route path="/cost-optimization-suggestions" element={<CostOptimizationSuggestions />} />
                <Route path="/revenue-growth-strategies" element={<RevenueGrowthStrategies />} />
                <Route path="/InvestmentCapitalAllocation" element={<InvestmentCapitalAllocation />} />
                <Route path="/ProfitabilityEnhancement" element={<ProfitabilityEnhancement />} />
                <Route path="/ForecastAccuracyMonitoring" element={<ForecastAccuracyMonitoring />} />
                <Route path="/BenchmarkingPeerComparisons" element={<BenchmarkingPeerComparisons />} />
                <Route path="/PredictiveRiskManagement" element={<PredictiveRiskManagement />} />



                <Route path="/SupplyChainAnalytics" element={<SupplyChainAnalytics />} />
                <Route path="/SupplyChainTable" element={<SupplyChainTable />} />
                <Route path="/SupplierPerformanceScorecard" element={<SupplierPerformanceScorecard />} />
                <Route path="/InventoryTurnoverAnalysis" element={<InventoryTurnoverAnalysis />} />
                <Route path="/ProcurementSpendBreakdown" element={<ProcurementSpendBreakdown />} />
                <Route path="/FreightLogisticsOptimization" element={<FreightLogisticsOptimization />} />
                <Route path="/OperationalRiskAssessment" element={<OperationalRiskAssessment />} />
                <Route path="/CostSavingOpportunities" element={<CostSavingOpportunities />} />


                <Route path="/budgeting-hub" element={<BudgetingHub />} />
                <Route path="/corporate-budget-guidelines" element={<CorporateBudgetGuidelines/>} />

                {/* New AI-Powered Budget module (mock/frontend-only) */}
                <Route path="/budget" element={<BudgetOverview />} />
                <Route path="/budget-overview" element={<BudgetOverview />} />
                <Route path="/budget-setup-guidelines" element={<BudgetSetupGuidelines />} />
                <Route path="/budget-revenue" element={<BudgetRevenueBudgeting />} />
                <Route path="/budget-workforce" element={<BudgetWorkforcePlanning />} />
                <Route path="/budget-opex" element={<BudgetOpexBudgeting />} />
                <Route path="/budget-capex" element={<BudgetCapexBudgeting />} />
                <Route path="/budget-pnl" element={<BudgetPnLStatement />} />
                <Route path="/budget-review-approval" element={<BudgetReviewApproval />} />
                <Route path="/company-management-table" element={<CompanyManagementTable />} />
                <Route path="/forecasting-overview" element={<ForecastingOverview />} />
                <Route path="/CAPEX-forecast-screen" element={<CAPEXForecastScreen />} />
                <Route path="/scenario-modeling" element={<ScenarioModeling/>} />
                <Route path="/break-even-analysis" element={<BreakEvenAnalysis/>} />
                <Route path="/headcount-payroll" element={<HeadcountPayroll />} />
                <Route path="/operational-budgeting" element={<OperationalBudgeting />} />
                <Route path="/fixed-variable-expense" element={<FixedVariableExpense />} />
                <Route path="/capex-budgeting" element={<CapexBudgeting />} />
                <Route path="/revenue-based-budgeting" element={<RevenueBasedBudgeting />} />
                <Route path="/workforce-budgeting" element={<WorkforceBudgeting />} />
                <Route path="/zeroBased-budgeting" element={<ZeroBasedBudgeting />} />
                <Route path="/rolling-budgeting" element={<RollingBudgeting />} />
                <Route path="/scenario-modelling-budgeting" element={<ScenarioModelingBudgeting />} />
                <Route path="/department-budgeting" element={<DepartmentBudgeting />} />
                {/* <Route path="/department-budgeting" element={<AICostOptimization />} /> */}
                <Route path="/aI-cost-optimization" element={<AICostOptimizationSuggestions />} />
                <Route path="/budget-vs-actuals" element={<BudgetVsActuals />} />
                <Route path="/revenue-driven-expense" element={<RevenueDrivenExpenseAllocation />} />
                <Route path="/sale-growth-budget" element={<SalesGrowthBudgetAdjustments />} />
                <Route path="/customer-acquisition-retention" element={<CustomerAcquisitionRetentionBudgeting />} />
                <Route path="/subscription-recurring-revenue" element={<SubscriptionRevenueBudgeting />} />
                <Route path="/salary-compensation" element={<SalaryCompensationBudgeting />} />
                <Route path="/attrition-replacement" element={<AttritionReplacementCostProjections />} />
                <Route path="/workforce-efficiency" element={<WorkforceEfficiencyAnalysis />} />
                <Route path="/justification-based" element={<JustificationBasedBudgeting />} />
                <Route path="/costControl-wasteReduction" element={<CostControlWasteReduction />} />
                <Route path="/department-ZBB-implementation" element={<DepartmentZBBImplementation />} />
                <Route path="/spending-efficiency-recommendations" element={<SpendingEfficiencyRecommendations />} />
                <Route path="/continuous-budget-updates" element={<ContinuousBudgetUpdates />} />
                <Route path="/scenarioBased-rollingForecasts" element={<ScenarioBasedRollingForecasts />} />
                <Route path="/emergency-contigency" element={<EmergencyContingencyBudgeting />} />
                <Route path="/automated-variance-alerts" element={<AutomatedVarianceAlerts />} />
                <Route path="/revenue-budget-expansion" element={<RevenueVsBudgetExpansion />} />
                <Route path="/costCutting-scenario-testing" element={<CostCuttingScenarioTesting />} />
                <Route path="/investment-tradeOffs" element={<InvestmentTradeOffs/>} />
                <Route path="/market-economic-simulations" element={<MarketEconomicSimulations/>} />
                <Route path="/p&l-Dashboard" element={<PLDashboard />} />
                <Route path="/balancesheet-report" element={<BalanceSheetDashboard />} />
                <Route path="/customer-profit-dashboard" element={<CustomerProfitabilityDashboard />} />
                <Route path="/project-costing-report-dashboard" element={<ProjectCostingReportDashboard />} />
                <Route path="/operating-expenses-report-dashboard" element={<OperatingExpensesDashboard />} />
                {/* <Route path="/payroll-reconciliation-dashboard" element={<PayrollReconciliationDashboard />} /> */}
                <Route path="/capital-investment-planning" element={<CapitalInvestmentPlanning />} />
                <Route path="/budget-roi-allocation" element={<ROIAllocation />} />
                <Route path="/budget-depreciation-forecast" element={<DepreciationForecast  />} />
                <Route path="/scenario-based-capex" element={<ScenarioBasedCapexModeling  />} />
                <Route path="/headcount-planning" element={<HeadcountPlanning  />} />
                <Route path="/financial-gl-upload" element={<UploadGL  />} />
                {/* <Route path="/profile-details" element={<OrganizationsListScreen  />} /> */}
                <Route path='/revenue-component' element={<RevenueComponent />} />
                <Route path='/expense-component' element={<ExpenseComponent />} />
                <Route path="/profile-details" element={<ProfileDetailsScreen  />} />

                {/* Performance Analytics */}
                <Route path="/performance-analytics-dashboard" element={<PerformanceAnalyticsOverview  />} />
                <Route path="/sales-performance-dashboard" element={<SalesPerformanceDashboard  />} />
                <Route path="/sales-performance-table" element={<SalesPerformanceTable  />} />
                <Route path="/pipeline-conversion" element={<PipelineConversion  />} />
                <Route path="/cac-clv" element={<CACandCLV  />} />
                <Route path="/churn-retention" element={<ChurnRetention />} />
                <Route path="/marketing-campaign" element={<MarketingCampaign />} />
                <Route path="/revenue-breakdown" element={<RevenueBreakdown />} />
                <Route path="/hr-workforce" element={<HRworkForce  />} />
                <Route path="/hr-workforce-table" element={<HRWorkforceTable  />} />
                <Route path="/employee-productivity-report" element={<EmployeeProductivityReport  />} />
                <Route path="/utilization-rate-report" element={<UtilizationRateReport  />} />
                <Route path="/retention-attrition-rate" element={<RetentionAttritionRate  />} />
                <Route path="/hiring-funnel-metrics" element={<HiringFunnelMetrics  />} />
                <Route path="/diversity-inclusion-metrics" element={<DiversityInclusionMetrics  />} />
                <Route path="/compensation-benefits" element={<CompensationBenefits  />} />
                <Route path="/it-technology-spend" element={<ITandTechnology  />} />
                <Route path="/it-spend-table" element={<ITSpendTable  />} />
                <Route path="/it-spend-breakdown" element={<ITSpendBreakdown />} />
                <Route path="/software-license-utilization" element={<SoftwareLicenseUtilization />} />
                <Route path="/infrastructure-cost-efficiency" element={<InfrastructureCostEfficiency />} />
                <Route path="/it-budget-tracker" element={<ITBudgetVsActuals />} />
                <Route path="/security-compliance" element={<SecurityCompliance />} />
                <Route path="/tech-debt-modernization" element={<TechDebtModernization />} />
                <Route path="/finance-accounting-dashboard" element={<FinanceAccountingDashboard />} />
                <Route path="/finance-accounting-table" element={<FinanceAccountingTable />} />
                <Route path="/tax-compliance" element={<TaxCompliance />} />
                <Route path="/expense-trend-analysis" element={<ExpenseTrendAnalysis />} />
                <Route path="/liquidity-working-capital" element={<LiquidityWorkingCapital />} />
                <Route path="/budget-utilization" element={<BudgetUtilization />} />
                <Route path="/profitability-ratios" element={<ProfitabilityRatios />} />
                <Route path="/debt-coverage" element={<DebtCoverage />} />
                <Route path="/recruitment-performance-dashboard" element={<RecruitmentPerformanceDashboard />} />
                <Route path="/recruiter-analytics" element={<RecruiterAnalytics />} />
                <Route path="/rehire-redeployment" element={<RehireRedeployment />} />
                <Route path="/recruitment-revenue-analytics" element={<RecruitmentRevenueAnalytics />} />
                <Route path="/recruitment-gross-margin" element={<GrossMarginProfitability />} />
                <Route path="/recruitment-cost-leverage" element={<CostOperatingLeverage />} />
                <Route path="/recruitment-performance-table" element={<RecruitmentPerformanceTable />} />
                <Route path="/recruitment-executive-dashboard" element={<ExecutiveDashboard />} />
                <Route path="/recruitment-sales-dashboard" element={<SalesDashboard />} />
                <Route path="/recruitment-account-manager-dashboard" element={<AccountManagerDashboard />} />
                <Route path="/recruiter-dashboard" element={<RecruiterDashboard />} />
                <Route path="/position-fulfillment-report" element={<PositionFulfillmentReport />} />
                <Route path="/settings-customization" element={<SettingsCustomization />} />
                <Route path="/settings-customization/:tab" element={<SettingsCustomization />} />


                {/* GLUploadScreen */}
              <Route path="/gl-upload-screen" element={<GLUploadScreen />} />
              <Route path="/cash-flow" element={<CashFlow />} />
              <Route path="/profit-analysis" element={<ProfitAnalysis />} />
              <Route path="/cash-flow-dashboard" element={<CashFlowStatement />} />
                          <Route path="/balance-sheet-dashboard" element={<BalanceSheet />} />
                          <Route path="/ar-aging-dashboard" element={<ARAgingReport />} />
                          <Route path="/ap-aging-dashboard" element={<APAgingReport />} />
                          <Route path="/customer-profitability-dashboard" element={<CustomerProfitabilityReport />} />
                          <Route path="/revenue-dashboard" element={<RevenueReportDashboard />} />
                          <Route path="/project-costing-dashboard" element={<ProjectCostingReport/>} />
                          <Route path="/opex-dashboard" element={<OpexReport/>} />
                          <Route path="/fixed-assets-dashboard" element={<FixedAssetRegister/>} />
                          <Route path="/capex-dashboard" element={<CapexReport/>} />
                          {/* <Route path="/payroll-dashboard" element={<PayrollReconciliation/>} /> */}
                          <Route path="/marketing-dashboard" element={<MarketingSpendReport/>} />
                          <Route path="/sales-funnel-dashboard" element={<SalesFunnelReport/>} />
                          <Route path="/mapping" element={<ExcelMappingValidator/>} />
                          <Route path="/mapping2" element={<ExcelMappingValidator2/>} />
                          <Route path="/CalculateMetrics" element={<CalculateMetrics/>} />
                          {/* <Route path="/fpna-reposrts" element={<ReportsLayout/>} /> */}





                       {/* <Route path="/reports" element={<FinancialReportsNew />}> */}
  {/* <Route index element={<ReportsHome />} /> */}

  <Route path="/reports/pnl" element={<PnLPage />} />
  <Route path="/reports/cashflow" element={<CashFlowPage />} />
  <Route path="/reports/revenue" element={<RevenuePage />} />
  <Route path="/reports/customer-profit" element={<CustomerProfitPage />} />
  <Route path="/reports/balance-sheet" element={<BalanceSheetPage />} />
  <Route path="/reports/project-costing" element={<RoportProjectCostingReport />} />
  <Route path="/reports/operating-expenses" element={<OperatingExpenses />} />
  {/* <Route path="/reports/payroll-reconciliation" element={<ReportsPayrollReconciliation />} /> */}
  <Route path="/reports/sales-funnel-report-data" element={<SalesFunnelReportData />} />
  <Route path="/reports/fixed-asset-report" element={<FixedAssetReportPage />} />
  <Route path="/reports/custom-report-builder" element={<FinancialCustomReportBuilder />} />





  {/* // In your main routing file (e.g., App.js) */}
  <Route path="/gl-uploads/integration/:integrationId" element={<IntegrationDetails/>} />


              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </Suspense>

          </BudgetGuidelinesProvider>
          </BudgetMethodologyProvider>
          </BudgetYearProvider>
          </FinancialYearProvider>
        </AuthProvider>
      </Router>
    );
  }

  export default AllRoutes;
