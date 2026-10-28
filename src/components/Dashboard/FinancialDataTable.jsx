import React from "react";
import { 
  FiArrowUp, 
  FiArrowDown, 
  FiTrendingUp, 
  FiTrendingDown, 
  FiDollarSign, 
  FiPercent,
  FiBarChart2,
  FiPieChart,
  FiActivity,
  FiUpload,
  FiClock
} from "react-icons/fi";
import { motion } from "framer-motion";

const FinancialDataTable = ({ kpiData }) => {
  // Metric configuration
  const metricConfig = {
    revenue: { 
      icon: <FiDollarSign className="text-blue-500" />,
      important: true,
      type: 'currency'
    },
    net_profit: { 
      icon: <FiDollarSign className="text-green-500" />,
      important: true,
      type: 'currency'
    },
    gross_profit: { 
      icon: <FiDollarSign className="text-teal-500" />,
      important: true,
      type: 'currency'
    },
    profit_margin: { 
      icon: <FiPercent className="text-purple-500" />,
      important: true,
      type: 'percentage'
    },
    cash_flow: { 
      icon: <FiActivity className="text-indigo-500" />,
      important: true,
      type: 'currency'
    },
    growth_rate: { 
      icon: <FiTrendingUp className="text-amber-500" />,
      type: 'percentage'
    },
    expenses: { 
      icon: <FiDollarSign className="text-rose-500" />,
      type: 'currency'
    },
    roi: { 
      icon: <FiBarChart2 className="text-emerald-500" />,
      type: 'percentage'
    }
  };

  // Animation variants
  const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3
      }
    })
  };

  // Format change values with color and arrow indicators
  const renderChange = (change) => {
    if (!change) return <span className="text-gray-400">-</span>;
    
    const isPositive = typeof change === 'string' 
      ? change.includes('+') || change === 'Up'
      : change > 0;
    
    const changeValue = typeof change === 'string' 
      ? change.replace('+', '').replace('%', '')
      : Math.abs(change);

    return (
      <span className={`inline-flex items-center font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
        {isPositive ? (
          <FiArrowUp className="mr-1" />
        ) : (
          <FiArrowDown className="mr-1" />
        )}
        {changeValue}
        {typeof change === 'string' && change.includes('%') ? '%' : ''}
      </span>
    );
  };

  // Format metric names for display
  const formatMetricName = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/(^|\s)\w/g, match => match.toUpperCase());
  };

  // Check if data is empty
  if (!kpiData || Object.keys(kpiData).length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-8 rounded-2xl shadow-lg border border-gray-50 hover:shadow-xl transition-all duration-300"
      >
        <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
          <div className="relative flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500 opacity-70"></div>
            <FiClock className="absolute w-6 h-6 text-sky-600" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-800">No Data Available</h3>
            <p className="text-s text-gray-500 max-w-md">
              We couldn't find any financial data to display. Please upload your financial statements to get started.
            </p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.location.href = '/settings-customization'}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-sky-500 to-sky-600 text-white font-medium shadow-sm hover:from-sky-600 hover:to-sky-700 transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              <FiUpload className="w-5 h-5" />
              <span>Upload Financial File</span>
            </div>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <></>
    // <motion.div 
    //   initial={{ opacity: 0, y: 20 }}
    //   animate={{ opacity: 1, y: 0 }}
    //   transition={{ duration: 0.5 }}
    //   className="bg-white p-6 rounded-2xl shadow-lg border border-gray-50 hover:shadow-xl transition-all duration-300"
    // >
    //   <div className="flex justify-between items-center mb-6">
    //     <div>
    //       <h3 className="text-xl font-bold text-gray-800">Financial Performance</h3>
    //       <p className="text-s text-gray-500">Key metrics and growth indicators</p>
    //     </div>
    //     <div className="flex space-x-3">
    //       <span className="text-x px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full flex items-center">
    //         <FiActivity className="mr-1.5" /> Live Data
    //       </span>
    //       <span className="text-x px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full">
    //         Updated Now
    //       </span>
    //     </div>
    //   </div>

    

    //   <div className="overflow-x-auto">
    //     <table className="w-full">
    //       <thead>
    //         <tr className="border-b border-gray-200">
    //           <th className="p-2 text-left font-medium text-gray-500 text-s">METRIC</th>
    //           <th className="p-2 text-right font-medium text-gray-500 text-s">VALUE</th>
    //           <th className="p-2 text-right font-medium text-gray-500 text-s">CHANGE</th>
    //           <th className="p-2 text-right font-medium text-gray-500 text-s">TREND</th>
    //         </tr>
    //       </thead>
    //       <tbody className="divide-y divide-gray-100">
    //         {Object.entries(kpiData).map(([key, value], index) => {
    //           const config = metricConfig[key] || {
    //             icon: <FiPieChart className="text-gray-400" />,
    //             type: 'number'
    //           };
    //           const isImportant = config.important;

    //           return (
    //             <motion.tr
    //               key={index}
    //               custom={index}
    //               initial="hidden"
    //               animate="visible"
    //               variants={rowVariants}
    //               className={`hover:bg-gray-50 ${isImportant ? 'bg-blue-0 bg-opacity-30' : ''}`}
    //             >
    //               <td className="p-2 font-medium text-gray-700">
    //                 <div className="flex items-center">
    //                   <span className="mr-3">{config.icon}</span>
    //                   {formatMetricName(key)}
    //                 </div>
    //               </td>
    //               <td className="p-2 text-right font-medium">
    //                 <div className="flex items-center justify-end">
    //                   {config.type === 'currency' && (
    //                     <FiDollarSign className="text-gray-400 mr-1" size={14} />
    //                   )}
    //                   {config.type === 'percentage' && (
    //                     <FiPercent className="text-gray-400 mr-1" size={14} />
    //                   )}
    //                   <span className="text-gray-800">
    //                     {typeof value.value === "number"
    //                       ? value.value.toLocaleString(undefined, {
    //                           minimumFractionDigits: config.type === 'currency' ? 0 : 2,
    //                           maximumFractionDigits: config.type === 'currency' ? 0 : 2
    //                         })
    //                       : value.value}
    //                   </span>
    //                 </div>
    //               </td>
    //               <td className="p-2 text-right">
    //                 {renderChange(value.change)}
    //               </td>
    //               <td className="p-2 text-right">
    //                 {value.change && (
    //                   <div className="flex justify-end">
    //                     {typeof value.change === 'string' 
    //                       ? value.change.includes('+') || value.change === 'Up'
    //                         ? (
    //                           <motion.div 
    //                             initial={{ scale: 0.8 }}
    //                             animate={{ scale: 1 }}
    //                             className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"
    //                           >
    //                             <FiTrendingUp className="text-emerald-500" size={16} />
    //                           </motion.div>
    //                         )
    //                         : (
    //                           <motion.div 
    //                             initial={{ scale: 0.8 }}
    //                             animate={{ scale: 1 }}
    //                             className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center"
    //                           >
    //                             <FiTrendingDown className="text-rose-500" size={16} />
    //                           </motion.div>
    //                         )
    //                       : null}
    //                   </div>
    //                 )}
    //               </td>
    //             </motion.tr>
    //           );
    //         })}
    //       </tbody>
    //     </table>
    //   </div>

    //   <div className="mt-2 pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-2">
    //     <div className="text-x text-gray-500 flex items-center">
    //       <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
    //       Highlighted metrics are key performance indicators
    //     </div>
    //     <div className="flex flex-wrap justify-center gap-3">
    //       <div className="flex items-center text-x">
    //         <div className="w-3 h-3 rounded-full bg-emerald-100 mr-1.5 flex items-center justify-center">
    //           <FiArrowUp className="text-emerald-500" size={10} />
    //         </div>
    //         <span className="text-gray-600">Positive</span>
    //       </div>
    //       <div className="flex items-center text-x">
    //         <div className="w-3 h-3 rounded-full bg-rose-100 mr-1.5 flex items-center justify-center">
    //           <FiArrowDown className="text-rose-500" size={10} />
    //         </div>
    //         <span className="text-gray-600">Negative</span>
    //       </div>
    //       <div className="flex items-center text-x">
    //         <FiDollarSign className="text-gray-400 mr-1.5" size={12} />
    //         <span className="text-gray-600">Currency</span>
    //       </div>
    //       <div className="flex items-center text-x">
    //         <FiPercent className="text-gray-400 mr-1.5" size={12} />
    //         <span className="text-gray-600">Percentage</span>
    //       </div>
    //     </div>
    //   </div>
    // </motion.div>
  );
};

export default FinancialDataTable;