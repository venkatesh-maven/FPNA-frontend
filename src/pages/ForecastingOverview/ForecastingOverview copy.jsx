import React, { useState, useRef } from "react";
import { NavLink } from "react-router-dom";
import { FiFilter, FiEdit, FiCheckCircle, FiSend, FiDownload} from "react-icons/fi";
import { BsThreeDotsVertical, BsStars } from "react-icons/bs";
import { RiDragMove2Fill } from "react-icons/ri";
import Chart from "react-apexcharts";
import { getDecimalPrecision } from '../../utils/formatters';

const ForecastingOverviewCopy = () => {
	const [activeTab, setActiveTab] = useState("create");
	const [filters, setFilters] = useState({
		period: "Q1 2025",
		scenario: "Baseline",
		department: "All",
		entity: "All",
	});
	const [showFilters, setShowFilters] = useState(false);
	const [aiForecastData, setAiForecastData] = useState([
		{ client: "Client A", aiForecast: 100000, userForecast: 100000 },
		{ client: "Client B", aiForecast: 150000, userForecast: 150000 },
		{ client: "Client C", aiForecast: 200000, userForecast: 200000 },
	]);
	const [chartTypes, setChartTypes] = useState({
		accuracy: "line",
		trend: "line",
		coverage: "pie",
	});
	const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({});
	const [showAIDropdown, setShowAIDropdown] = useState(null);
	const [aiInput, setAiInput] = useState("");
	const aiChatbotRef = useRef(null);

	// Handle user forecast input
	const handleUserForecastChange = (index, value) => {
		const updatedData = [...aiForecastData];
		updatedData[index].userForecast = parseFloat(value) || 0;
		setAiForecastData(updatedData);
	};

	// Toggle chart type dropdown
	const toggleChartTypeDropdown = (widgetId) => {
		setShowChartTypeDropdown((prev) => ({
			...prev,
			[widgetId]: !prev[widgetId],
		}));
	};

	// Change chart type
	const toggleChartType = (widgetId, type) => {
		setChartTypes((prev) => ({ ...prev, [widgetId]: type }));
		setShowChartTypeDropdown((prev) => ({ ...prev, [widgetId]: false }));
	};

	// Toggle AI dropdown
	const handleClickOutside = (widgetId) => {
		setShowAIDropdown(showAIDropdown === widgetId ? null : widgetId);
		setAiInput("");
	};

	// Handle AI query (placeholder)
	const handleSendAIQuery = (widgetId) => {
		console.log(`AI Query for ${widgetId}: ${aiInput}`);
		setAiInput("");
		setShowAIDropdown(null);
	};

	// Chart Data
	const accuracyChartOptions = {
		chart: { type: chartTypes.accuracy, height: 250, toolbar: { show: false } },
		stroke: { curve: "smooth", width: 2 },
		colors: ["#1A56DB", "#FDBA8C"],
		xaxis: {
			categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
			labels: { style: { colors: "#616161", fontSize: "12px" } },
		},
		yaxis: {
			title: { text: "Deviation (%)" },
			labels: { style: { colors: "#616161", fontSize: "12px" } },
		},
		tooltip: { theme: "dark" },
	};
	const accuracyChartSeries = [
		{ name: "AI Forecast", data: [2, 3, 1, 4, 2, 3] },
		{ name: "User Forecast", data: [3, 2, 4, 3, 5, 2] },
	];

	const trendChartOptions = {
		chart: { type: chartTypes.trend, height: 250, toolbar: { show: false } },
		stroke: { curve: "smooth", width: 2 },
		colors: ["#1A56DB", "#FDBA8C", "#16BDCA"],
		xaxis: {
			categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
			labels: { style: { colors: "#616161", fontSize: "12px" } },
		},
		yaxis: {
			title: { text: "Amount ($M)" },
			labels: { style: { colors: "#616161", fontSize: "12px" } },
		},
		tooltip: { theme: "dark" },
	};
	const trendChartSeries = [
		{ name: "Revenue", data: [1.2, 1.5, 1.3, 1.7, 1.8, 2.0] },
		{ name: "Expense", data: [0.8, 0.9, 1.0, 1.1, 1.2, 1.3] },
		{ name: "Net Profit", data: [0.4, 0.6, 0.3, 0.6, 0.6, 0.7] },
	];

	const coverageChartOptions = {
		chart: { type: chartTypes.coverage, height: 250 },
		labels: ["Forecasted", "Not Forecasted"],
		colors: ["#1A56DB", "#E4E7EB"],
		legend: { position: "bottom", fontSize: "12px" },
		dataLabels: { enabled: false },
		tooltip: { theme: "dark" },
	};
	const coverageChartSeries = [75, 25];

	return (
		<div className="forecasting-pnl-theme space-y-6 p-4 min-h-screen relative bg-sky-50">
			{/* Header */}
			<div className="bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 p-4 rounded-lg shadow-sm">
				<div className="flex justify-between items-center">
					<div>
						<h1 className="text-lg font-bold text-white">Forecasting</h1>
						<p className="text-sky-100 text-x">
							Plan and analyze future financial scenarios with AI-driven
							insights
						</p>
					</div>
					<div className="flex space-x-2">
						{/* <div className="flex space-x-1 rounded-lg">
							<NavLink
								to="#"
								onClick={() => setActiveTab("create")}
								className={`px-4 py-2 rounded-lg text-s font-medium transition-colors duration-200 ${
									activeTab === "create"
										? "bg-sky-900 text-sky-50"
										: "text-sky-900 bg-sky-50 hover:bg-sky-700 hover:text-sky-50"
								}`}>
								Create Forecast
							</NavLink>
							<NavLink
								to="#"
								onClick={() => setActiveTab("import")}
								className={`px-4 py-2 rounded-lg text-s font-medium transition-colors duration-200 ${
									activeTab === "import"
										? "bg-sky-900 text-sky-50"
										: "text-sky-900 bg-sky-50 hover:bg-sky-700 hover:text-sky-50"
								}`}>
								Import Forecast
							</NavLink>
							<NavLink
								to="#"
								onClick={() => setActiveTab("compare")}
								className={`px-4 py-2 rounded-lg text-s font-medium transition-colors duration-200 ${
									activeTab === "compare"
										? "bg-sky-900 text-sky-50"
										: "text-sky-900 bg-sky-50 hover:bg-sky-700 hover:text-sky-50"
								}`}>
								Compare Scenarios
							</NavLink>
						</div> */}
						<button
							onClick={() => setShowFilters(!showFilters)}
							className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
							<FiFilter className="mr-2" size={16} />
							Filters
						</button>
						<button
													onClick={() => window.print()}
													className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white  bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-900 transition-colors duration-200">
													<FiDownload className="text-sky-50 hover:text-sky-900" />
													<span className="text-sky-50 hover:text-sky-900">Export</span>
												</button>
					</div>
				</div>
			</div>

			{/* Filters Dropdown */}
			{showFilters && (
				<div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div>
							<label className="block text-s font-medium text-gray-700 mb-1">
								Time Period
							</label>
							<select
								value={filters.period}
								onChange={(e) =>
									setFilters({ ...filters, period: e.target.value })
								}
								className="w-full p-2 border border-gray-300 rounded-lg text-s">
								<option>Q1 2025</option>
								<option>Q2 2025</option>
								<option>FY 2025</option>
							</select>
						</div>
						<div>
							<label className="block text-s font-medium text-gray-700 mb-1">
								Scenario
							</label>
							<select
								value={filters.scenario}
								onChange={(e) =>
									setFilters({ ...filters, scenario: e.target.value })
								}
								className="w-full p-2 border border-gray-300 rounded-lg text-s">
								<option>Baseline</option>
								<option>Best Case</option>
								<option>Worst Case</option>
							</select>
						</div>
						<div>
							<label className="block text-s font-medium text-gray-700 mb-1">
								Department
							</label>
							<select
								value={filters.department}
								onChange={(e) =>
									setFilters({ ...filters, department: e.target.value })
								}
								className="w-full p-2 border border-gray-300 rounded-lg text-s">
								<option>All</option>
								<option>Sales</option>
								<option>Operations</option>
								<option>Finance</option>
							</select>
						</div>
						<div>
							<label className="block text-s font-medium text-gray-700 mb-1">
								Entity
							</label>
							<select
								value={filters.entity}
								onChange={(e) =>
									setFilters({ ...filters, entity: e.target.value })
								}
								className="w-full p-2 border border-gray-300 rounded-lg text-s">
								<option>All</option>
								<option>Entity A</option>
								<option>Entity B</option>
							</select>
						</div>
					</div>
				</div>
			)}

			{/* Content based on Active Tab */}
			{activeTab === "create" ? (
				<div>
					{/* Create Forecast Section */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
						{/* AI Forecast Suggestions */}
						{/* <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FiEdit className="mr-2 text-blue-600" size={20} />
                AI Forecast Suggestions
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-s">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 text-left text-gray-600">
                        Client
                      </th>
                      <th className="py-3 px-4 text-left text-gray-600">
                        AI Forecast ($)
                      </th>
                      <th className="py-3 px-4 text-left text-gray-600">
                        User Forecast ($)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiForecastData.map((row, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 px-4 text-gray-700">
                          {row.client}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {row.aiForecast.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            value={row.userForecast}
                            onChange={(e) =>
                              handleUserForecastChange(index, e.target.value)
                            }
                            className="w-full p-2 border border-gray-300 rounded-lg text-s focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div> */}

						{/* Forecast Coverage */}
						<div className="bg-white p-4 rounded-lg shadow-sm">
							<div className="flex justify-between items-center mb-2">
								<h3 className="text-s font-semibold text-sky-800">
									Forecast Coverage
								</h3>
								<div className="flex space-x-2 relative">
									<div className="relative">
										<button
											onClick={() => toggleChartTypeDropdown("coverage")}
											className="p-1 rounded hover:bg-gray-100"
											title="Change chart type">
											<BsThreeDotsVertical size={16} />
										</button>
										{showChartTypeDropdown.coverage && (
											<div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-10 border border-gray-200">
												<div className="py-1">
													{["pie", "donut"].map((type) => (
														<button
															key={type}
															onClick={() => toggleChartType("coverage", type)}
															className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100">
															{type.charAt(0).toUpperCase() + type.slice(1)}{" "}
															Chart
														</button>
													))}
												</div>
											</div>
										)}
									</div>
									<button
										onClick={() => setShowAIDropdown("coverage")}
										className="p-1 rounded hover:bg-gray-100"
										title="Ask AI">
										<BsStars size={16} />
									</button>
									{showAIDropdown === "coverage" && (
										<div
											ref={aiChatbotRef}
											className="absolute right-0 top-8 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2">
											<div className="flex flex-col space-y-2">
												<h1 className="text-x text-gray-700">
													Ask about Forecast Coverage
												</h1>
												<div className="flex justify-between gap-2">
													<input
														type="text"
														value={aiInput}
														onChange={(e) => setAiInput(e.target.value)}
														placeholder="Ask AI..."
														className="w-full p-1 border border-gray-300 rounded text-x"
													/>
													<button
														onClick={() => handleSendAIQuery("coverage")}
														className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600 disabled:bg-gray-300"
														disabled={!aiInput.trim()}>
														<FiSend size={14} />
													</button>
												</div>
											</div>
										</div>
									)}
									<div className="p-1 rounded hover:bg-gray-100 cursor-move">
										<RiDragMove2Fill size={16} />
									</div>
								</div>
							</div>
							<Chart
								options={coverageChartOptions}
								series={coverageChartSeries}
								type={chartTypes.coverage}
								height={250}
							/>
						</div>
						{/* Forecast Accuracy Tracker */}
						<div className="bg-white p-4 rounded-lg shadow-sm">
							<div className="flex justify-between items-center mb-2">
								<h3 className="text-s font-semibold text-sky-800">
									Forecast Accuracy Tracker
								</h3>
								<div className="flex space-x-2 relative">
									<div className="relative">
										<button
											onClick={() => toggleChartTypeDropdown("accuracy")}
											className="p-1 rounded hover:bg-gray-100"
											title="Change chart type">
											<BsThreeDotsVertical size={16} />
										</button>
										{showChartTypeDropdown.accuracy && (
											<div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-10 border border-gray-200">
												<div className="py-1">
													{["line", "bar", "area"].map((type) => (
														<button
															key={type}
															onClick={() => toggleChartType("accuracy", type)}
															className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100">
															{type.charAt(0).toUpperCase() + type.slice(1)}{" "}
															Chart
														</button>
													))}
												</div>
											</div>
										)}
									</div>
									<button
										onClick={() => handleClickOutside("accuracy")}
										className="p-1 rounded hover:bg-gray-100"
										title="Ask AI">
										<BsStars size={16} />
									</button>
									{showAIDropdown === "accuracy" && (
										<div
											ref={aiChatbotRef}
											className="absolute right-0 top-8 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2">
											<div className="flex flex-col space-y-2">
												<h1 className="text-x text-gray-700">
													Ask about Forecast Accuracy
												</h1>
												<div className="flex justify-between gap-2">
													<input
														type="text"
														value={aiInput}
														onChange={(e) => setAiInput(e.target.value)}
														placeholder="Ask AI..."
														className="w-full p-1 border border-gray-300 rounded text-x"
													/>
													<button
														onClick={() => handleSendAIQuery("accuracy")}
														className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600 disabled:bg-gray-300"
														disabled={!aiInput.trim()}>
														<FiSend size={14} />
													</button>
												</div>
											</div>
										</div>
									)}
									<div className="p-1 rounded hover:bg-gray-100 cursor-move">
										<RiDragMove2Fill size={16} />
									</div>
								</div>
							</div>
							<Chart
								options={accuracyChartOptions}
								series={accuracyChartSeries}
								type={chartTypes.accuracy}
								height={250}
							/>
						</div>

						{/* Forecast Trend Graph */}
						<div className="bg-white p-4 rounded-lg shadow-sm">
							<div className="flex justify-between items-center mb-2">
								<h3 className="text-s font-semibold text-sky-800">
									Forecast Trend Graph
								</h3>
								<div className="flex space-x-2 relative">
									<div className="relative">
										<button
											onClick={() => toggleChartTypeDropdown("trend")}
											className="p-1 rounded hover:bg-gray-100"
											title="Change chart type">
											<BsThreeDotsVertical size={16} />
										</button>
										{showChartTypeDropdown.trend && (
											<div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-10 border border-gray-200">
												<div className="py-1">
													{["line", "bar", "area"].map((type) => (
														<button
															key={type}
															onClick={() => toggleChartType("trend", type)}
															className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100">
															{type.charAt(0).toUpperCase() + type.slice(1)}{" "}
															Chart
														</button>
													))}
												</div>
											</div>
										)}
									</div>
									<button
										onClick={() => setShowAIDropdown("trend")}
										className="p-1 rounded hover:bg-gray-100"
										title="Ask AI">
										<BsStars size={16} />
									</button>
									{showAIDropdown === "trend" && (
										<div
											ref={aiChatbotRef}
											className="absolute right-0 top-8 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2">
											<div className="flex flex-col space-y-2">
												<h1 className="text-x text-gray-700">
													Ask about Forecast Trends
												</h1>
												<div className="flex justify-between gap-2">
													<input
														type="text"
														value={aiInput}
														onChange={(e) => setAiInput(e.target.value)}
														placeholder="Ask AI..."
														className="w-full p-1 border border-gray-300 rounded text-x"
													/>
													<button
														onClick={() => handleSendAIQuery("trend")}
														className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600 disabled:bg-gray-300"
														disabled={!aiInput.trim()}>
														<FiSend size={14} />
													</button>
												</div>
											</div>
										</div>
									)}
									<div className="p-1 rounded hover:bg-gray-100 cursor-move">
										<RiDragMove2Fill size={16} />
									</div>
								</div>
							</div>
							<Chart
								options={trendChartOptions}
								series={trendChartSeries}
								type={chartTypes.trend}
								height={250}
							/>
						</div>
					</div>
				</div>
			) : activeTab === "import" ? (
				<div className="bg-white p-6 rounded-lg shadow-sm">
					<h2 className="text-lg font-semibold text-gray-800 mb-4">
						Import Forecast
					</h2>
					<p className="text-s text-gray-600">
						Placeholder for importing forecast data (e.g., CSV upload).
					</p>
				</div>
			) : (
				<div className="bg-white p-6 rounded-lg shadow-sm">
					<h2 className="text-lg font-semibold text-gray-800 mb-4">
						Compare Scenarios
					</h2>
					<p className="text-s text-gray-600">
						Placeholder for comparing forecast scenarios.
					</p>
				</div>
			)}

			{/* Widgets Section */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				
				{/* Scenario Summary Cards */}
				<div className="bg-white p-4 rounded-lg shadow-sm">
					<h2 className="text-s font-semibold text-sky-800 mb-4 flex items-center">
						<FiCheckCircle className="mr-2 text-blue-600" size={16} />
						Scenario Summary
					</h2>
					<div className="overflow-x-auto">
						<table className="w-full text-x">
							<thead>
								<tr className="border-b">
									<th className="py-2 px-3 text-left text-gray-600">
										Parameter
									</th>
									<th className="py-2 px-3 text-left text-gray-600">
										Baseline
									</th>
									<th className="py-2 px-3 text-left text-gray-600">
										Best Case
									</th>
									<th className="py-2 px-3 text-left text-gray-600">
										Worst Case
									</th>
								</tr>
							</thead>
							<tbody>
								<tr className="border-b">
									<td className="py-2 px-3 text-gray-700">Revenue</td>
									<td className="py-2 px-3 text-gray-700">$1.5M</td>
									<td className="py-2 px-3 text-gray-700">$1.8M</td>
									<td className="py-2 px-3 text-gray-700">$1.2M</td>
								</tr>
								<tr className="border-b">
									<td className="py-2 px-3 text-gray-700">Gross Profit</td>
									<td className="py-2 px-3 text-gray-700">$0.9M</td>
									<td className="py-2 px-3 text-gray-700">$1.1M</td>
									<td className="py-2 px-3 text-gray-700">$0.7M</td>
								</tr>
								<tr className="border-b">
									<td className="py-2 px-3 text-gray-700">EBITDA</td>
									<td className="py-2 px-3 text-gray-700">$0.4M</td>
									<td className="py-2 px-3 text-gray-700">$0.5M</td>
									<td className="py-2 px-3 text-gray-700">$0.3M</td>
								</tr>
								<tr className="border-b">
									<td className="py-2 px-3 text-gray-700">Net Profit</td>
									<td className="py-2 px-3 text-gray-700">$0.3M</td>
									<td className="py-2 px-3 text-gray-700">$0.4M</td>
									<td className="py-2 px-3 text-gray-700">$0.2M</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				{/* Approval Status */}
				<div className="bg-white p-4 rounded-lg shadow-sm">
					<h2 className="text-s font-semibold text-sky-800 mb-4 flex items-center">
						<FiCheckCircle className="mr-2 text-blue-600" size={16} />
						Approval Status
					</h2>
					<div className="overflow-x-auto">
						<table className="w-full text-x">
							<thead>
								<tr className="border-b">
									<th className="py-2 px-3 text-left text-gray-600">
										Department
									</th>
									<th className="py-2 px-3 text-left text-gray-600">Status</th>
								</tr>
							</thead>
							<tbody>
								<tr className="border-b">
									<td className="py-2 px-3 text-gray-700">Sales</td>
									<td className="py-2 px-3 text-green-600">Completed</td>
								</tr>
								<tr className="border-b">
									<td className="py-2 px-3 text-gray-700">Operations</td>
									<td className="py-2 px-3 text-yellow-600">Pending</td>
								</tr>
								<tr className="border-b">
									<td className="py-2 px-3 text-gray-700">Finance</td>
									<td className="py-2 px-3 text-yellow-600">Pending</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
      </div>
	);
};

export default ForecastingOverviewCopy;

