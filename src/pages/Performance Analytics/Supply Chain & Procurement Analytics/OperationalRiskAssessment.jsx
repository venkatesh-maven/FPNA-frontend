import React, { useState, useEffect } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { FiInfo, FiDownload, FiAlertTriangle, FiFilter, FiChevronRight } from 'react-icons/fi';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { Link, useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { GrLinkNext } from "react-icons/gr";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import WorldMap from 'react-svg-worldmap';
import { ColorRing } from 'react-loader-spinner';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const OperationalRiskAssessment = () => {
  const [riskData, setRiskData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRiskType, setSelectedRiskType] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');

  // Sample data for world map
  const mapData = [
    { country: 'cn', value: 85 }, // China - high risk
    { country: 'ru', value: 75 }, // Russia - high risk
    { country: 'in', value: 45 }, // India - medium risk
    { country: 'br', value: 40 }, // Brazil - medium risk
    { country: 'us', value: 20 }, // USA - low risk
    { country: 'de', value: 15 }, // Germany - low risk
    { country: 'jp', value: 10 }, // Japan - low risk
  ];

  useEffect(() => {
    // Simulate API fetch
    const fetchData = async () => {
      try {
        // Replace with actual API call
        const data = generateSampleData();
        setRiskData(data);
        setLoading(false);
      } catch (error) {
        toast.error('Failed to load risk assessment data');
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedRiskType, selectedRegion]);

  const generateSampleData = () => {
    const suppliers = [
      'Alpha Components', 'Beta Materials', 'Gamma Logistics', 
      'Delta Manufacturing', 'Epsilon Technologies'
    ];
    const countries = ['China', 'Russia', 'India', 'Brazil', 'USA', 'Germany', 'Japan'];
    const riskTypes = ['Geopolitical', 'Financial', 'Operational', 'Compliance', 'Environmental'];
    
    return Array.from({ length: 15 }, (_, i) => {
      const riskScore = Math.floor(Math.random() * 50) + 30;
      const dependency = Math.floor(Math.random() * 40) + 10;
      const country = countries[Math.floor(Math.random() * countries.length)];
      
      return {
        id: i + 1,
        supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
        country,
        riskType: riskTypes[Math.floor(Math.random() * riskTypes.length)],
        riskScore,
        dependency: `${dependency}%`,
        financialImpact: `$${(Math.floor(Math.random() * 5) + 1)}M`,
        mitigationStatus: ['Active', 'Planned', 'Not Started'][Math.floor(Math.random() * 3)],
        lastAssessed: new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000).toLocaleDateString(),
        riskLevel: riskScore > 70 ? 'Critical' : riskScore > 50 ? 'High' : riskScore > 30 ? 'Medium' : 'Low',
        // Get color based on map data
        countryRisk: mapData.find(d => d.country === getCountryCode(country))?.value || 30
      };
    }).filter(item => 
      (selectedRiskType === 'all' || item.riskType === selectedRiskType) &&
      (selectedRegion === 'all' || item.country === selectedRegion)
    );
  };

  // Helper function to get country code
  const getCountryCode = (country) => {
    const codes = {
      'China': 'cn',
      'Russia': 'ru',
      'India': 'in',
      'Brazil': 'br',
      'USA': 'us',
      'Germany': 'de',
      'Japan': 'jp'
    };
    return codes[country];
  };

  // Chart data for risk distribution
  const riskDistributionData = {
    labels: Array.from(new Set(riskData.map(item => item.riskType))),
    datasets: [
      {
        label: 'Average Risk Score',
        data: Array.from(new Set(riskData.map(item => item.riskType))).map(type => {
          const typeData = riskData.filter(item => item.riskType === type);
          return typeData.reduce((sum, item) => sum + item.riskScore, 0) / typeData.length;
        }),
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(153, 102, 255, 0.5)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Chart data for supplier dependency
  const dependencyData = {
    labels: Array.from(new Set(riskData.map(item => item.supplier))),
    datasets: [
      {
        label: 'Supplier Dependency (%)',
        data: Array.from(new Set(riskData.map(item => item.supplier))).map(supplier => {
          const supplierData = riskData.filter(item => item.supplier === supplier);
          return parseFloat(supplierData[0]?.dependency || '0');
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        label: 'Risk Score',
        data: Array.from(new Set(riskData.map(item => item.supplier))).map(supplier => {
          const supplierData = riskData.filter(item => item.supplier === supplier);
          return supplierData.reduce((sum, item) => sum + item.riskScore, 0) / supplierData.length;
        }),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        yAxisID: 'y1',
      },
    ],
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(riskData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RiskAssessment');
    XLSX.writeFile(wb, 'Operational_Risk_Assessment.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Operational Risk Assessment', 14, 15);
    doc.autoTable({
      head: [['Supplier', 'Country', 'Risk Type', 'Risk Score', 'Dependency', 'Financial Impact', 'Risk Level']],
      body: riskData.map(item => [
        item.supplier,
        item.country,
        item.riskType,
        item.riskScore,
        item.dependency,
        item.financialImpact,
        item.riskLevel,
      ]),
    });
    doc.save('Operational_Risk_Assessment.pdf');
  };

  // Function to get risk color
  const getRiskColor = (score) => {
    if (score > 70) return 'bg-red-100 text-red-800';
    if (score > 50) return 'bg-orange-100 text-orange-800';
    if (score > 30) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  // Function to get mitigation color
  const getMitigationColor = (status) => {
    if (status === 'Active') return 'bg-green-100 text-green-800';
    if (status === 'Planned') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className=" bg-gray-50 min-h-screen">
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
                                      <Link to="/SupplyChainAnalytics" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                                        Supply Chain & Procurement
                                      </Link>
                                    </div>
                                  </li>
                                  <li aria-current="page">
                                    <div className="flex items-center">
                                      <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                                      <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Operational Risk Assessment</span>
                                    </div>
                                  </li>
                                </ol>
                              </nav>
      <div className="max-w-7xl mx-auto">
			<div className="flex justify-between items-center mb-5 bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold text-white">Operational Risk Assessment</h1>
          <div className="flex space-x-4">
            <button
              onClick={exportToExcel}
              className="bg-green-600 text-white px-3 py-1 rounded-md text-s hover:bg-green-700 flex items-center"
            >
              <FiDownload className="mr-1" /> Excel
            </button>
            <button
              onClick={exportToPDF}
              className="bg-red-600 text-white px-3 py-1 rounded-md text-s hover:bg-red-700 flex items-center"
            >
              <FiDownload className="mr-1" /> PDF
            </button>
            <Link to="/SupplyChainTable">
                                                              <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                                                                View More <GrLinkNext className="ml-1 w-5 h-5 hover:w-5 hover:h-5 transition-all" />
                                                              </button>
                                                            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Risk Type</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-s"
                value={selectedRiskType}
                onChange={(e) => setSelectedRiskType(e.target.value)}
              >
                <option value="all">All Risk Types</option>
                <option value="Geopolitical">Geopolitical</option>
                <option value="Financial">Financial</option>
                <option value="Operational">Operational</option>
                <option value="Compliance">Compliance</option>
                <option value="Environmental">Environmental</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Region/Country</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-s"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
              >
                <option value="all">All Regions</option>
                <option value="China">China</option>
                <option value="Russia">Russia</option>
                <option value="India">India</option>
                <option value="Brazil">Brazil</option>
                <option value="USA">USA</option>
                <option value="Germany">Germany</option>
                <option value="Japan">Japan</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-s hover:bg-blue-700">
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <ColorRing
              visible={true}
              height="80"
              width="80"
              ariaLabel="blocks-loading"
              colors={['#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6']}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Geopolitical Risk Exposure</h2>
                  <FiInfo
                    data-tooltip-id="geo-tooltip"
                    className="ml-2 text-gray-500 cursor-pointer"
                  />
                  <ReactTooltip id="geo-tooltip" place="right">
                    World map showing geopolitical risk levels by country. Darker colors indicate
                    higher risk exposure for suppliers in those regions.
                  </ReactTooltip>
                </div>
                <div className="h-64 mt-15 overflow-hidden flex items-center justify-center">
                  <WorldMap
                    color="red"
                    title="Geopolitical Risk Heatmap"
                    value-suffix="%"
                    size="responsive"
                    data={mapData}
                    richInteraction
                    tooltipBgColor="#000"
                    borderColor="#ffffff"
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Risk Type Distribution</h2>
                  <FiInfo
                    data-tooltip-id="risk-tooltip"
                    className="ml-2 text-gray-500 cursor-pointer"
                  />
                  <ReactTooltip id="risk-tooltip" place="right">
                    Breakdown of operational risks by type. Helps identify which risk categories
                    require the most attention and mitigation efforts.
                  </ReactTooltip>
                </div>
                <div className="h-64">
                  <Bar
                    data={riskDistributionData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                          title: {
                            display: true,
                            text: 'Risk Score',
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold">Supplier Dependency vs Risk</h2>
                <FiInfo
                  data-tooltip-id="supplier-tooltip"
                  className="ml-2 text-gray-500 cursor-pointer"
                />
                <ReactTooltip id="supplier-tooltip" place="right">
                  Analysis of supplier dependency versus associated risk scores. Highlights critical
                  suppliers where high dependency coincides with high risk.
                </ReactTooltip>
              </div>
              <div className="h-64">
                <Bar
                  data={dependencyData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        max: 100,
                        title: {
                          display: true,
                          text: 'Dependency (%)',
                        },
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        max: 100,
                        title: {
                          display: true,
                          text: 'Risk Score',
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-lg font-semibold">Detailed Risk Assessment</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-s text-gray-500">{riskData.length} risk items</span>
                  <FiFilter className="text-gray-500" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Country</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Risk Type</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Risk Score</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Dependency</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Financial Impact</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Mitigation Status</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Last Assessed</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {riskData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-s font-medium text-gray-900">{item.supplier}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">{item.country}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">{item.riskType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s">
                          <span className={`px-2 inline-flex text-x leading-5 font-semibold rounded-full ${getRiskColor(item.riskScore)}`}>
                            {item.riskScore} ({item.riskLevel})
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">{item.dependency}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.financialImpact}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s">
                          <span className={`px-2 inline-flex text-x leading-5 font-semibold rounded-full ${getMitigationColor(item.mitigationStatus)}`}>
                            {item.mitigationStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">{item.lastAssessed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <FiAlertTriangle className="text-yellow-500 mr-2" />
                  Critical Risks Requiring Attention
                </h2>
                <div className="space-y-3">
                  {riskData
                    .filter(item => item.riskLevel === 'Critical')
                    .slice(0, 3)
                    .map((item, index) => (
                      <div key={index} className="border-l-4 border-red-500 pl-3 py-2 bg-red-50">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.supplier}</span>
                          <span className="text-red-600 font-bold">{item.riskScore}</span>
                        </div>
                        <p className="text-s text-gray-600">{item.riskType} risk in {item.country}</p>
                        <p className="text-s mt-1">Dependency: {item.dependency} • Impact: {item.financialImpact}</p>
                      </div>
                    ))}
                  {riskData.filter(item => item.riskLevel === 'Critical').length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      No critical risks identified
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Risk Mitigation Strategies</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <span className="font-medium">Supplier Diversification:</span> Reduce dependency on Alpha Components from 45% to 30% by onboarding 2 new suppliers.
                  </li>
                  <li>
                    <span className="font-medium">Inventory Buffering:</span> Increase safety stock by 15% for high-risk components from Russia and China.
                  </li>
                  <li>
                    <span className="font-medium">Contract Renegotiation:</span> Add force majeure clauses for geopolitical risks in high-exposure regions.
                  </li>
                  <li>
                    <span className="font-medium">Localization:</span> Explore nearshoring options in lower-risk countries like Mexico and Poland.
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Risk Exposure Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-s text-gray-600">Critical Risks</p>
                  <p className="text-xl font-bold text-red-600">
                    {riskData.filter(item => item.riskLevel === 'Critical').length}
                  </p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <p className="text-s text-gray-600">High Risks</p>
                  <p className="text-xl font-bold text-orange-600">
                    {riskData.filter(item => item.riskLevel === 'High').length}
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-s text-gray-600">Suppliers 30% Dependency</p>
                  <p className="text-xl font-bold text-blue-600">
                    {riskData.filter(item => parseInt(item.dependency) > 30).length}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-s text-gray-600">Active Mitigations</p>
                  <p className="text-xl font-bold text-green-600">
                    {riskData.filter(item => item.mitigationStatus === 'Active').length}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OperationalRiskAssessment;