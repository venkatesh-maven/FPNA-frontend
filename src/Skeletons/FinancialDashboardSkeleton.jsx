import React from "react";
import { motion } from "framer-motion";

// Skeleton components with animations

const Skeletonbreadcums = () => (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className=" rounded-lg  mb-2"
  >
    <div className="flex justify-between items-center">
        
      <div className="flex items-center ">
        {/* <motion.div
          className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"
          animate={{
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
          }}
        /> */}
        <div className=" flex gap-3">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
      {/* <div className="flex space-x-3">
        <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse"></div>
        <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse"></div>
        <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
      </div> */}
    </div>
  </motion.div>
);





const SkeletonHeader = () => (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="bg-white p-6 rounded-lg shadow-sm mb-6"
  >
    <div className="flex justify-between items-center">
        
      <div className="flex items-center space-x-4">
        <motion.div
          className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"
          animate={{
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
          }}
        />
        <div className="space-y-2">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
      <div className="flex space-x-3">
        <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse"></div>
        <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse"></div>
        <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
    </div>
  </motion.div>
);

const SkeletonMetricCard = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.4 }}
    className="bg-white p-4 rounded-lg shadow-sm"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
    </div>
    <div className="h-8 w-24 bg-gray-300 rounded mb-2 animate-pulse"></div>
    <div className="h-3 w-32 bg-gray-200 rounded animate-pulse"></div>
  </motion.div>
);

const SkeletonChartCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100"
  >
    <div className="flex justify-between items-center mb-2">
      <div className="h-4 w-32 bg-gray-300 rounded animate-pulse"></div>
      <div className="flex space-x-2">
        <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
    <div className="h-48 flex items-center justify-center">
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 bg-white rounded-lg">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500 opacity-70"></div>
          <svg 
            className="absolute w-6 h-6 text-sky-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        
        <div className="text-center space-y-2">
          <div className="h-4 w-40 bg-gray-300 rounded mx-auto animate-pulse"></div>
          <div className="h-3 w-56 bg-gray-200 rounded mx-auto animate-pulse"></div>
        </div>
        
        <div className="h-10 w-44 bg-gray-300 rounded-full animate-pulse"></div>
      </div>
    </div>
  </motion.div>
);

const SkeletonTable = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.6, delay: 0.2 }}
    className="bg-white p-6 rounded-lg shadow-sm mt-6"
  >
    <div className="h-6 w-40 bg-gray-300 rounded mb-6 animate-pulse"></div>
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex justify-between items-center py-3 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-300 rounded animate-pulse"></div>
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="h-6 w-20 bg-gray-300 rounded animate-pulse"></div>
        </div>
      ))}
    </div>
  </motion.div>
);

// Main skeleton component
const FinancialDashboardSkeleton = () => {
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
        <Skeletonbreadcums />
      <SkeletonHeader />
      
      {/* Metrics Cards */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6"
      >
        {[...Array(4)].map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </motion.div>
      
      {/* Chart Cards */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"
      >
        {[...Array(3)].map((_, i) => (
          <SkeletonChartCard key={i} />
        ))}
      </motion.div>
      
      {/* Second Row of Charts */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
      >
        {[...Array(2)].map((_, i) => (
          <SkeletonChartCard key={i} />
        ))}
      </motion.div>
      
      {/* Transaction Table */}
      <SkeletonTable />
    </div>
  );
};

export default FinancialDashboardSkeleton;