import React, { useState } from "react";
import { FiSearch, FiUserPlus, FiEdit2, FiTrash2, FiEye, FiCheckCircle, FiXCircle } from "react-icons/fi";

const CompanyManagementTable = () => {
  // Sample company data - replace with your actual data
  const [companies, setCompanies] = useState([
    {
      id: 1,
      name: "Insient Consulting",
      email: "contact@Insient.com",
      industry: "Information Technology",
      employees: "150",
      status: "active",
      registrationDate: "2022-05-15",
      lastLogin: "2023-06-10 14:30",
      isVerified: true,
      admin: {
        name: "Shashi Konduru",
        email: "john@techsolutions.com"
      }
    },
    {
      id: 2,
      name: "Green Energy Ltd.",
      email: "info@greenenergy.com",
      industry: "Renewable Energy",
      employees: "85",
      status: "Login",
      registrationDate: "2023-01-20",
      lastLogin: "2023-06-08 09:15",
      isVerified: false,
      admin: {
        name: "Sarah Johnson",
        email: "sarah@greenenergy.com"
      }
    },
    // Add more companies as needed
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserRole] = useState("superadmin"); // Change based on actual auth

  // Filter companies based on search term
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.industry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this company?")) {
      setCompanies(companies.filter(company => company.id !== id));
    }
  };

//   const handleStatusChange = (id, newStatus) => {
//     setCompanies(companies.map(company =>
//       company.id === id ? { ...company, status: newStatus }) : ( company
//     );
//   };

  const handleVerify = (id) => {
    setCompanies(companies.map(company =>
      company.id === id ? { ...company, isVerified: true } : company
    ));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-sky-800 flex items-center">
          <FiUserPlus className="mr-2 text-blue-500" />All Company Management
        </h3>
        <button className="bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600 hover:from-sky-500 hover:via-sky-600 hover:to-sky-700 text-white px-4 py-2 rounded-md flex items-center shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02]">
  <FiUserPlus className="mr-2" /> Add New Company
</button>
      </div>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search companies..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Industry</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Admin</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Employees</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Verification</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
              <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCompanies.map((company) => (
              <tr key={company.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium">{company.name}</div>
                  <div className="text-gray-500 text-s">{company.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{company.industry}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium">{company.admin.name}</div>
                  <div className="text-gray-500 text-s">{company.admin.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{company.employees}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-x rounded-full ${
                    company.status === 'active' ? 'bg-green-100 text-green-800' :
                    company.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {company.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {company.isVerified ? (
                    <span className="flex items-center text-green-600">
                      <FiCheckCircle className="mr-1" /> Verified
                    </span>
                  ) : (
                    currentUserRole === "superadmin" ? (
                      <button 
                        onClick={() => handleVerify(company.id)}
                        className="flex items-center text-blue-600 hover:text-blue-800"
                      >
                        <FiCheckCircle className="mr-1" /> Verify
                      </button>
                    ) : (
                      <span className="flex items-center text-yellow-600">
                        <FiXCircle className="mr-1" /> Pending
                      </span>
                    )
                  )}
                </td>
                <td td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {company.lastLogin}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-s font-medium">
                  <div className="flex space-x-2">
                    <button 
                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                      title="View Details"
                    >
                      <FiEye />
                    </button>
                    {currentUserRole === "superadmin" && (
                      <>
                        <button 
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                          title="Edit"
                          onClick={() => console.log("Edit", company.id)}
                        >
                          <FiEdit2 />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Delete"
                          onClick={() => handleDelete(company.id)}
                        >
                          <FiTrash2 />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status management modal would go here */}
      {currentUserRole === "superadmin" && (
        <div className="mt-4 flex justify-between items-center">
          <div className="text-s text-gray-500">
            Showing {filteredCompanies.length} of {companies.length} companies
          </div>
          <div className="flex space-x-2">
            <button 
              className="px-3 py-1 border border-gray-300 rounded text-s"
              onClick={() => handleStatusChange(selectedCompanies, "active")}
            >
              Activate Selected
            </button>
            <button 
              className="px-3 py-1 border border-gray-300 rounded text-s"
              onClick={() => handleStatusChange(selectedCompanies, "suspended")}
            >
              Suspend Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManagementTable;