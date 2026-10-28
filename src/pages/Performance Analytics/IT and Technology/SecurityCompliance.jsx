import { getDecimalPrecision } from '../../../utils/formatters';
    import React, { useState, useRef, useEffect, useContext } from "react";
    import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
    import { Link, useNavigate } from "react-router-dom";

    import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    } from "chart.js";
    import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
    import { motion } from "framer-motion";
    import {
    FiAlertTriangle,
    FiCheckCircle,
    FiClock,
    FiDollarSign,
    FiFilter,
    FiDownload,
    FiChevronRight,
    FiPlus,
    FiChevronDown,
    FiSend,
    FiShield,
    FiTrendingUp,
    FiTrendingDown,
    } from "react-icons/fi";
    import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
    import { Tooltip as ReactTooltip } from "react-tooltip";
    import { RiDragMove2Fill } from "react-icons/ri";
    import { GrLinkNext } from "react-icons/gr";
    // import { AuthContext } from "../../context/AuthContext";
    // import { AuthContext } from "@/context/AuthContext";

    // Register ChartJS components
    ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
    );

    // Outside Click logic
    const useOutsideClick = (callback) => {
    const ref = useRef();

    useEffect(() => {
        const handleClick = (event) => {
        if (ref.current && !ref.current.contains(event.target)) {
            callback();
        }
        };

        document.addEventListener("mousedown", handleClick);
        return () => {
        document.removeEventListener("mousedown", handleClick);
        };
    }, [callback]);

    return ref;
    };

    // Animation variants
    const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    };

    // Static Data
    const kpiData = {
    totalIncidents: { 
        value: 36, 
        change: "+12%", 
        isPositive: false,
        componentPath: "/it-spend-table",
    },
    resolvedIncidents: { 
        value: 31, 
        percentage: "86%", 
        change: "+5%", 
        isPositive: true,
        componentPath: "/it-spend-table",
    },
    mttr: { 
        value: 4.2, 
        unit: "days", 
        change: "-0.8", 
        isPositive: true,
        componentPath: "/it-spend-table",
    },
    complianceStatus: { 
        value: 92, 
        unit: "%", 
        change: "+3%", 
        isPositive: true,
        componentPath: "/it-spend-table",
    },
    riskExposure: { 
        value: 820000, 
        change: "+18%", 
        isPositive: false,
        componentPath: "/it-spend-table",
    },
    nonComplianceCost: { 
        value: 120000, 
        change: "-5%", 
        isPositive: true,
        componentPath: "/it-spend-table",
    },
    };

    const charts = {
    incidentsByCategory: {
        title: "Incidents by Category",
        componentPath: "/it-spend-table",
        data: {
        labels: ["Phishing", "Malware", "Insider Threat", "DDoS", "Data Leak"],
        datasets: [
            {
            label: "Incidents",
            data: [15, 8, 5, 4, 4],
            backgroundColor: [
                "rgba(239, 68, 68, 0.7)",
                "rgba(59, 130, 246, 0.7)",
                "rgba(234, 179, 8, 0.7)",
                "rgba(16, 185, 129, 0.7)",
                "rgba(139, 92, 246, 0.7)",
            ],
            borderColor: [
                "rgba(239, 68, 68, 1)",
                "rgba(59, 130, 246, 1)",
                "rgba(234, 179, 8, 1)",
                "rgba(16, 185, 129, 1)",
                "rgba(139, 92, 246, 1)",
            ],
            borderWidth: 1,
            },
        ],
        },
        options: {
        maintainAspectRatio: false,
        plugins: { 
            legend: { position: "bottom" },
            tooltip: {
            callbacks: {
                label: function(context) {
                return `${context.label}: ${context.raw} incidents (${Math.round((context.parsed * 100) / context.dataset.data.reduce((a, b) => a + b, 0))}%)`;
                }
            }
            }
        },
        },
        defaultType: "bar",
    },
    incidentTrend: {
        title: "Incident Trend",
        componentPath: "/it-spend-table",
        data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [
            {
            label: "Detected",
            data: [8, 10, 12, 9, 11, 15],
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            borderColor: "rgba(239, 68, 68, 1)",
            borderWidth: 2,
            tension: 0.4,
            },
            {
            label: "Resolved",
            data: [6, 8, 10, 8, 9, 12],
            backgroundColor: "rgba(16, 185, 129, 0.2)",
            borderColor: "rgba(16, 185, 129, 1)",
            borderWidth: 2,
            tension: 0.4,
            },
            {
            label: "Open",
            data: [2, 2, 2, 1, 2, 3],
            backgroundColor: "rgba(234, 179, 8, 0.2)",
            borderColor: "rgba(234, 179, 8, 1)",
            borderWidth: 2,
            tension: 0.4,
            },
        ],
        },
        options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        },
        defaultType: "line",
    },
    complianceCoverage: {
        title: "Compliance Coverage",
        componentPath: "/it-spend-table",
        data: {
        labels: ["Fully Compliant", "Partially Compliant", "Non-Compliant"],
        datasets: [
            {
            label: "Systems",
            data: [92, 5, 3],
            backgroundColor: [
                "rgba(16, 185, 129, 0.7)",
                "rgba(234, 179, 8, 0.7)",
                "rgba(239, 68, 68, 0.7)",
            ],
            borderColor: [
                "rgba(16, 185, 129, 1)",
                "rgba(234, 179, 8, 1)",
                "rgba(239, 68, 68, 1)",
            ],
            borderWidth: 1,
            },
        ],
        },
        options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        },
        defaultType: "doughnut",
    },
    riskAssessment: {
        title: "Risk Assessment by Department",
        componentPath: "/it-spend-table",
        data: {
        labels: ["Finance", "HR", "Marketing", "IT", "Operations"],
        datasets: [
            {
            label: "High Risk",
            data: [8, 5, 3, 6, 4],
            backgroundColor: "rgba(239, 68, 68, 0.7)",
            },
            {
            label: "Medium Risk",
            data: [4, 6, 5, 3, 5],
            backgroundColor: "rgba(234, 179, 8, 0.7)",
            },
            {
            label: "Low Risk",
            data: [2, 3, 6, 5, 5],
            backgroundColor: "rgba(16, 185, 129, 0.7)",
            },
        ],
        },
        options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
            x: {
            stacked: true,
            },
            y: {
            stacked: true,
            },
        },
        },
        defaultType: "bar",
    },
    };

    const incidentsData = [
    {
        id: "INC-2031",
        date: "2025-05-12",
        type: "Phishing",
        department: "HR",
        severity: "High",
        status: "Resolved",
        timeToResolve: "2 days",
        financialRisk: 15000,
        aiRecommendation: "Strengthen user training",
    },
    {
        id: "INC-2032",
        date: "2025-05-13",
        type: "Ransomware",
        department: "Finance",
        severity: "Critical",
        status: "Open",
        timeToResolve: "-",
        financialRisk: 120000,
        aiRecommendation: "Isolate system, review backup integrity",
    },
    {
        id: "INC-2030",
        date: "2025-05-10",
        type: "Data Leak",
        department: "Marketing",
        severity: "High",
        status: "In Progress",
        timeToResolve: "3 days",
        financialRisk: 75000,
        aiRecommendation: "Review access controls for customer data",
    },
    {
        id: "INC-2029",
        date: "2025-05-08",
        type: "Insider Threat",
        department: "IT",
        severity: "Medium",
        status: "Resolved",
        timeToResolve: "5 days",
        financialRisk: 25000,
        aiRecommendation: "Implement stricter access logging",
    },
    ];

    const aiInsights = [
    {
        type: "warning",
        message: "Security incidents projected to rise 18% next quarter due to increased phishing attempts.",
        action: "Review phishing training schedule",
    },
    {
        type: "danger",
        message: "Non-compliance risk will reach $500K if remediation is not completed by Q3.",
        action: "Prioritize compliance tasks",
    },
    {
        type: "warning",
        message: "Compliance score in IT expected to drop due to upcoming policy renewal delays.",
        action: "Schedule policy review meeting",
    },
    ];

    const aiSuggestions = [
    {
        type: "recommendation",
        icon: "✅",
        message: "Reallocate $50K to security awareness training to reduce phishing incidents by 40%.",
        severity: "High Impact",
    },
    {
        type: "warning",
        icon: "⚠️",
        message: "Critical systems lack multi-factor authentication — enable to reduce breach risk.",
        severity: "Critical",
    },
    {
        type: "alert",
        icon: "🚨",
        message: "Audit overdue in Finance department — high likelihood of non-compliance fines.",
        severity: "High Urgency",
    },
    {
        type: "recommendation",
        icon: "🔁",
        message: "Vendor ABC has repeated incidents — recommend contract review or alternative vendor.",
        severity: "Medium",
    },
    ];

    const SecurityCompliance= () => {
    const navigate = useNavigate();
    const [showFilters, setShowFilters] = useState(false);
    // const { currentUser } = useContext(AuthContext);
    const [activeWidgets, setActiveWidgets] = useState([
        "incidentsByCategory",
        "incidentTrend",
        "complianceCoverage",
        "riskAssessment",
    ]);
    const [chartTypes, setChartTypes] = useState({
        incidentsByCategory: "bar",
        incidentTrend: "line",
        complianceCoverage: "doughnut",
        riskAssessment: "bar",
    });
    const [dropdownWidget, setDropdownWidget] = useState(null);
    const [hoveredChartType, setHoveredChartType] = useState(null);
    const [aiInput, setAiInput] = useState({});
    const [showAIDropdown, setShowAIDropdown] = useState(null);
    const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({});

    const filtersRef = useRef(null);
    const aiChatbotRef = useRef(null);

    // Toggle chart type
    const toggleChartType = (widgetId, type) => {
        setChartTypes((prev) => ({
        ...prev,
        [widgetId]: type,
        }));
    };

    // Toggle chart type dropdown
    const toggleChartTypeDropdown = (widgetId) => {
        setShowChartTypeDropdown((prev) => ({
        ...prev,
        [widgetId]: !prev[widgetId],
        }));
    };

    // Handle sending AI query
    const handleSendAIQuery = (widgetId) => {
        if (aiInput[widgetId]?.trim()) {
        console.log(`AI Query for ${widgetId}:`, aiInput[widgetId]);
        setAiInput((prev) => ({
            ...prev,
            [widgetId]: "",
        }));
        setShowAIDropdown(null);
        }
    };

    // Render chart based on type
    const renderChart = (type, data, options = {}) => {
        switch (type) {
        case "line":
            return <Line data={data} options={options} />;
        case "bar":
            return <Bar data={data} options={options} />;
        case "pie":
            return <Pie data={data} options={options} />;
        case "doughnut":
            return <Doughnut data={data} options={options} />;
        default:
            return <Bar data={data} options={options} />;
        }
    };

    // Enhanced ChartCard component with drag handle and AI dropdown
    const EnhancedChartCard = ({
        title,
        componentPath,
        chartType,
        chartData,
        widgetId,
        index,
    }) => {
        const dropdownRef = useOutsideClick(() => setDropdownWidget(null));

        return (
        <Draggable draggableId={widgetId} index={index}>
            {(provided) => (
            <div
                className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100"
                ref={provided.innerRef}
                {...provided.draggableProps}>
                <div className="flex justify-between items-center mb-2">
                <h3 className="text-s font-semibold text-sky-800">{title}</h3>
                <div className="flex space-x-2 relative">
                    <div className="relative chart-dropdown">
                    <button
                        onClick={(e) => {
                        e.stopPropagation();
                        setDropdownWidget(
                            dropdownWidget === widgetId ? null : widgetId
                        );
                        }}
                        className="p-1 rounded hover:bg-gray-100"
                        data-tooltip-id="chart-type-tooltip"
                        data-tooltip-content="Options">
                        <BsThreeDotsVertical />
                    </button>

                    {dropdownWidget === widgetId && (
                        <div
                        ref={dropdownRef}
                        className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                        <div className="py-1 text-x text-gray-800">
                            <div
                            className="relative"
                            onMouseEnter={() => setHoveredChartType(widgetId)}
                            onMouseLeave={() => setHoveredChartType(null)}>
                            <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                                All Chart Types
                                <FiChevronDown className="ml-1 text-x" />
                            </div>

                            {hoveredChartType === widgetId && (
                                <div
                                className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1"
                                style={{ marginLeft: "-1px" }}>
                                {["line", "bar", "pie", "doughnut"].map((type) => (
                                    <button
                                    key={type}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleChartType(widgetId, type);
                                        setDropdownWidget(null);
                                        setHoveredChartType(null);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100 transition">
                                    {type.charAt(0).toUpperCase() + type.slice(1)}{" "}
                                    Chart
                                    </button>
                                ))}
                                </div>
                            )}
                            </div>

                            <div
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(componentPath);
                                setDropdownWidget(null);
                                setHoveredChartType(null);
                            }}>
                            Analyze
                            </div>
                        </div>
                        </div>
                    )}
                    </div>

                    <button
                    onClick={() =>
                        setShowAIDropdown(
                        showAIDropdown === widgetId ? null : widgetId
                        )
                    }
                    className="p-1 rounded hover:bg-gray-100"
                    data-tooltip-id="ai-tooltip"
                    data-tooltip-content="Ask AI">
                    <BsStars />
                    </button>
                    {showAIDropdown === widgetId && (
                    <div
                        ref={aiChatbotRef}
                        className="absolute right-0 top-5 mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2">
                        <div className="flex flex-col items-center space-x-2">
                        <h1 className="text-x">Ask regarding the {title}</h1>
                        <div className="flex justify-between gap-3">
                            <input
                            type="text"
                            value={aiInput[widgetId] || ""}
                            onChange={(e) =>
                                setAiInput((prev) => ({
                                ...prev,
                                [widgetId]: e.target.value,
                                }))
                            }
                            placeholder="Ask AI..."
                            className="w-full p-1 border border-gray-300 rounded text-x"
                            />
                            <button
                            onClick={() => handleSendAIQuery(widgetId)}
                            className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600"
                            disabled={!aiInput[widgetId]?.trim()}>
                            <FiSend />
                            </button>
                        </div>
                        </div>
                    </div>
                    )}
                    <div
                    {...provided.dragHandleProps}
                    className="p-1 rounded hover:bg-gray-100 cursor-move">
                    <RiDragMove2Fill />
                    </div>
                </div>
                </div>

                <div className="h-48">
                {renderChart(chartType, chartData.data, chartData.options)}
                </div>
            </div>
            )}
        </Draggable>
        );
    };

    // KPI Card Component with AI Button
    const KPICard = ({ title, value, change, isPositive, icon, componentPath }) => {
        const [showAIDropdown, setShowAIDropdown] = useState(false);
        const [localAIInput, setLocalAIInput] = useState("");
        const dropdownRef = useRef(null);

        useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setShowAIDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
        }, []);

        const handleSendAIQuery = () => {
        if (localAIInput.trim()) {
            console.log(`AI Query for ${title}:`, localAIInput);
            setLocalAIInput("");
            setShowAIDropdown(false);
        }
        };

        const needsDollarSign = [
        "riskExposure",
        "nonComplianceCost",
        ].includes(title.replace(/ /g, ""));

        return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3 }}
            className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative"
            onClick={() => navigate(componentPath)}>
            <div className="flex justify-between items-start">
            <div>
                <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">
                    {title.replace(/([A-Z])/g, " $1")}
                </p>
                <button
                    onClick={(e) => {
                    e.stopPropagation();
                    setShowAIDropdown(!showAIDropdown);
                    }}
                    className="p-1 rounded hover:bg-gray-100"
                    data-tooltip-id="ai-tooltip"
                    data-tooltip-content="Ask AI">
                    <BsStars />
                </button>
                {showAIDropdown && (
                    <div
                    ref={dropdownRef}
                    className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2"
                    onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center space-x-2">
                        <input
                        type="text"
                        value={localAIInput}
                        onChange={(e) => setLocalAIInput(e.target.value)}
                        placeholder="Ask AI..."
                        className="w-full p-1 border border-gray-300 rounded text-x"
                        onClick={(e) => e.stopPropagation()}
                        />
                        <button
                        onClick={handleSendAIQuery}
                        className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600"
                        disabled={!localAIInput.trim()}>
                        <FiSend />
                        </button>
                    </div>
                    </div>
                )}
                </div>
                <p className="text-s font-bold text-sky-900 mt-1">
                {needsDollarSign && "$"}
                {typeof value === "number" ? value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : value}
                {kpiData[title]?.unit && kpiData[title].unit}
                </p>
                <div
                className={`flex items-center mt-2 ${
                    isPositive ? "text-green-500" : "text-red-500"
                }`}>
                {isPositive ? <FiTrendingUp className="mr-1" /> : <FiTrendingDown className="mr-1" />}
                <span className="text-[10px] font-medium">
                    {change} {isPositive ? "↑" : "↓"} vs last period
                </span>
                </div>
            </div>
            <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
                <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">
                {icon}
                </div>
            </div>
            </div>
            <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
        </motion.div>
        );
    };

    // Incident Table Component
    const IncidentTable = () => (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <h3 className="text-s font-semibold text-sky-800 mb-2">Security Incident Tracker</h3>
        <div className="overflow-x-auto">
            <table className="w-full text-x text-gray-700">
            <thead>
                <tr className="border-b">
                <th className="p-2 text-left">Incident ID</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Department</th>
                <th className="p-2 text-left">Severity</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Time to Resolve</th>
                <th className="p-2 text-left">Financial Risk ($)</th>
                <th className="p-2 text-left">AI Recommendation</th>
                </tr>
            </thead>
            <tbody>
                {incidentsData.map((incident, index) => (
                <tr 
                    key={index} 
                    className={`border-b ${
                    incident.severity === "Critical" ? "bg-red-50" : 
                    incident.severity === "High" ? "bg-orange-50" : ""
                    }`}
                >
                    <td className="p-2 font-medium">{incident.id}</td>
                    <td className="p-2">{incident.date}</td>
                    <td className="p-2">{incident.type}</td>
                    <td className="p-2">{incident.department}</td>
                    <td className="p-2">
                    <span className={`px-2 py-1 rounded-full text-x ${
                        incident.severity === "Critical" ? "bg-red-100 text-red-800" :
                        incident.severity === "High" ? "bg-orange-100 text-orange-800" :
                        "bg-yellow-100 text-yellow-800"
                    }`}>
                        {incident.severity}
                    </span>
                    </td>
                    <td className="p-2">
                    <span className={`px-2 py-1 rounded-full text-x ${
                        incident.status === "Resolved" ? "bg-green-100 text-green-800" :
                        incident.status === "In Progress" ? "bg-blue-100 text-blue-800" :
                        "bg-gray-100 text-gray-800"
                    }`}>
                        {incident.status}
                    </span>
                    </td>
                    <td className="p-2">{incident.timeToResolve}</td>
                    <td className="p-2">${incident.financialRisk.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                    <td className="p-2">
                    <div className="flex items-center">
                        <span className="mr-1">🧠</span>
                        <span 
                        className="truncate max-w-xs"
                        data-tooltip-id={`tooltip-${index}`}
                        data-tooltip-content={incident.aiRecommendation}
                        >
                        {incident.aiRecommendation}
                        </span>
                        <ReactTooltip id={`tooltip-${index}`} />
                    </div>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        </div>
    );

    // AI Insights Card
    const AIInsightsCard = () => (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <h3 className="text-s font-semibold text-sky-800 mb-2">AI Predictive Insights</h3>
        <div className="space-y-3">
            {aiInsights.map((insight, index) => (
            <div 
                key={index}
                className={`p-3 rounded-lg border-l-4 ${
                insight.type === "danger" ? "border-red-500 bg-red-50" :
                "border-yellow-500 bg-yellow-50"
                }`}
            >
                <div className="flex items-start">
                <span className="mr-2">🔮</span>
                <div>
                    <p className="text-x font-medium">{insight.message}</p>
                    <p className="text-x mt-1 text-gray-600">Suggested action: {insight.action}</p>
                </div>
                </div>
            </div>
            ))}
        </div>
        </div>
    );

    // AI Suggestions Card
    const AISuggestionsCard = () => (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <h3 className="text-s font-semibold text-sky-800 mb-2">AI Recommendations</h3>
        <div className="space-y-3">
            {aiSuggestions.map((suggestion, index) => (
            <div 
                key={index}
                className={`p-3 rounded-lg border-l-4 ${
                suggestion.type === "alert" ? "border-red-500 bg-red-50" :
                suggestion.type === "warning" ? "border-yellow-500 bg-yellow-50" :
                "border-green-500 bg-green-50"
                }`}
            >
                <div className="flex items-start">
                <span className="mr-2 text-lg">{suggestion.icon}</span>
                <div>
                    <p className="text-x font-medium">{suggestion.message}</p>
                    <p className="text-x mt-1 text-gray-600">
                    <span className={`px-2 py-1 rounded-full ${
                        suggestion.severity === "Critical" || suggestion.severity === "High Urgency" ? 
                        "bg-red-100 text-red-800" :
                        suggestion.severity === "High Impact" ?
                        "bg-green-100 text-green-800" :
                        "bg-yellow-100 text-yellow-800"
                    }`}>
                        {suggestion.severity}
                    </span>
                    </p>
                </div>
                </div>
            </div>
            ))}
        </div>
        </div>
    );

    // Handle drag and drop
    const onDragEnd = (result) => {
        if (!result.destination) return;

        const items = Array.from(activeWidgets);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setActiveWidgets(items);
    };

    return (
        <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
            {/* Breadcrumb Navigation */}
                                                <nav className="flex mb-4" aria-label="Breadcrumb">
                                                  <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
                                                    <li className="inline-flex items-center">
                                                      <Link to="/" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
                                                        <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                                                          <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/>
                                                        </svg>
                                                        Home
                                                      </Link>
                                                    </li>
                                                    <li>
                                                      <div className="flex items-center">
                                                        <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                                                        <Link to="/it-technology-spend" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                                                          IT & Technology
                                                        </Link>
                                                      </div>
                                                    </li>
                                                    <li aria-current="page">
                                                      <div className="flex items-center">
                                                        <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                                                        <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Security Compliance</span>
                                                      </div>
                                                    </li>
                                                  </ol>
                                                </nav>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-center">
            <div>
                <h1 className="text-lg font-bold text-white">
                Security & Compliance Analytics
                </h1>
                {/* <p className="text-sky-100 text-x">{currentUser.company_name}</p> */}
            </div>
            <div className="flex space-x-2">
                <button
                type="button"
                className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
                onClick={() => setShowFilters(!showFilters)}>
                <FiFilter className="mr-1" />
                Filters
                </button>
                <button
                                                                    onClick={() => window.print()}
                                                                    className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
                                                                    <FiDownload className="text-sky-50" />
                                                                    <span className="text-sky-50">Export</span>
                                                                </button>
                {/* <button
                type="button"
                className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                <FiPlus className="mr-1" />
                Add Widget
                </button> */}
                <Link to="/it-spend-table">
                              <button
                                type="button"
                                className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                                View More
                                <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
                              </button>
                            </Link>
            </div>
            </div>
        </div>

        {/* Filter Options (Collapsible) */}
        {showFilters && (
            <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                <label className="block text-x font-medium text-gray-700 mb-1">
                    Date Range
                </label>
                <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>YTD</option>
                    <option>Custom</option>
                </select>
                </div>
                <div>
                <label className="block text-x font-medium text-gray-700 mb-1">
                    Department
                </label>
                <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                    <option>All</option>
                    <option>IT</option>
                    <option>HR</option>
                    <option>Finance</option>
                    <option>Marketing</option>
                    <option>Operations</option>
                </select>
                </div>
                <div>
                <label className="block text-x font-medium text-gray-700 mb-1">
                    Incident Type
                </label>
                <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                    <option>All</option>
                    <option>Phishing</option>
                    <option>Malware</option>
                    <option>Insider Threat</option>
                    <option>Data Leak</option>
                    <option>DDoS</option>
                </select>
                </div>
                <div>
                <label className="block text-x font-medium text-gray-700 mb-1">
                    Severity
                </label>
                <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                    <option>All</option>
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                </select>
                </div>
            </div>
            </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KPICard
            title="totalIncidents"
            value={kpiData.totalIncidents.value}
            change={kpiData.totalIncidents.change}
            isPositive={kpiData.totalIncidents.isPositive}
            icon={<FiAlertTriangle size={16} />}
            componentPath={kpiData.totalIncidents.componentPath}
            />
            <KPICard
            title="resolvedIncidents"
            value={kpiData.resolvedIncidents.value}
            change={kpiData.resolvedIncidents.change}
            isPositive={kpiData.resolvedIncidents.isPositive}
            icon={<FiCheckCircle size={16} />}
            componentPath={kpiData.resolvedIncidents.componentPath}
            />
            <KPICard
            title="mttr"
            value={kpiData.mttr.value}
            change={kpiData.mttr.change}
            isPositive={kpiData.mttr.isPositive}
            icon={<FiClock size={16} />}
            componentPath={kpiData.mttr.componentPath}
            />
            <KPICard
            title="complianceStatus"
            value={kpiData.complianceStatus.value}
            change={kpiData.complianceStatus.change}
            isPositive={kpiData.complianceStatus.isPositive}
            icon={<FiShield size={16} />}
            componentPath={kpiData.complianceStatus.componentPath}
            />
            <KPICard
            title="riskExposure"
            value={kpiData.riskExposure.value}
            change={kpiData.riskExposure.change}
            isPositive={kpiData.riskExposure.isPositive}
            icon={<FiDollarSign size={16} />}
            componentPath={kpiData.riskExposure.componentPath}
            />
            <KPICard
            title="nonComplianceCost"
            value={kpiData.nonComplianceCost.value}
            change={kpiData.nonComplianceCost.change}
            isPositive={kpiData.nonComplianceCost.isPositive}
            icon={<FiDollarSign size={16} />}
            componentPath={kpiData.nonComplianceCost.componentPath}
            />
        </div>

        {/* Charts Section - Widgets with Drag and Drop */}
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="charts" isDropDisabled={false}>
            {(provided) => (
                <div
                className="grid gap-6"
                {...provided.droppableProps}
                ref={provided.innerRef}>
                {/* Row 1: 2 charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    <EnhancedChartCard
                    title={charts.incidentsByCategory.title}
                    chartType={chartTypes.incidentsByCategory}
                    chartData={charts.incidentsByCategory}
                    widgetId="incidentsByCategory"
                    index={activeWidgets.indexOf("incidentsByCategory")}
                    />
                    <EnhancedChartCard
                    title={charts.incidentTrend.title}
                    chartType={chartTypes.incidentTrend}
                    chartData={charts.incidentTrend}
                    widgetId="incidentTrend"
                    index={activeWidgets.indexOf("incidentTrend")}
                    />
                </div>
                {/* Row 2: 2 charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <EnhancedChartCard
                    title={charts.complianceCoverage.title}
                    chartType={chartTypes.complianceCoverage}
                    chartData={charts.complianceCoverage}
                    widgetId="complianceCoverage"
                    index={activeWidgets.indexOf("complianceCoverage")}
                    />
                    <EnhancedChartCard
                    title={charts.riskAssessment.title}
                    chartType={chartTypes.riskAssessment}
                    chartData={charts.riskAssessment}
                    widgetId="riskAssessment"
                    index={activeWidgets.indexOf("riskAssessment")}
                    />
                </div>
                {provided.placeholder}
                </div>
            )}
            </Droppable>
        </DragDropContext>

        {/* Incident Table */}
        <IncidentTable />

        {/* AI Insights & Suggestions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AIInsightsCard />
            <AISuggestionsCard />
        </div>
        </div>
    );
    };

    export default SecurityCompliance;
