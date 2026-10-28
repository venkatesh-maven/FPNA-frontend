import React from 'react';
import { Tooltip } from 'react-tooltip';
import { FiInfo } from 'react-icons/fi';
import { getDecimalPrecision } from '../../utils/formatters';

const PLDataTable = ({ 
  title, 
  data, 
  columns, 
  timePeriods, 
  showVariance = false, 
  showPercentage = false,
  showForecast = false,
  showBudget = false
}) => {
  const renderCellValue = (value) => {
    if (typeof value === 'number') {
      return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: getDecimalPrecision(),
        maximumFractionDigits: getDecimalPrecision()
      });
    }
    return value;
  };

  const getRowClass = (rowIndex, isTotal = false) => {
    if (isTotal) return 'font-bold bg-gray-50';
    if (rowIndex % 2 === 0) return 'bg-white';
    return 'bg-gray-50';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-800">{title}</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider w-1/4">
                Category
              </th>
              {timePeriods.map((period, idx) => (
                <th 
                  key={idx} 
                  className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider"
                >
                  {period}
                </th>
              ))}
              {showVariance && (
                <th className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                  Variance
                </th>
              )}
              {showPercentage && (
                <th className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                  % Achievement
                </th>
              )}
              {showForecast && (
                <>
                  <th className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                    Forecast 1
                  </th>
                  <th className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                    Forecast 2
                  </th>
                </>
              )}
              {showBudget && (
                <th className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={getRowClass(rowIndex, row.isTotal)}>
                <td className="px-4 py-3 whitespace-nowrap text-s font-medium text-gray-900 flex items-center">
                  {row.category}
                  {row.tooltip && (
                    <>
                      <FiInfo 
                        className="ml-1 text-gray-400 cursor-pointer" 
                        data-tooltip-id={`tooltip-${rowIndex}`}
                        data-tooltip-content={row.tooltip}
                      />
                      <Tooltip id={`tooltip-${rowIndex}`} />
                    </>
                  )}
                </td>
                
                {timePeriods.map((_, colIndex) => (
                  <td 
                    key={colIndex} 
                    className={`px-4 py-3 whitespace-nowrap text-s text-right ${
                      row.isTotal ? 'text-blue-600 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    {renderCellValue(row.values[colIndex])}
                  </td>
                ))}
                
                {showVariance && (
                  <td className="px-4 py-3 whitespace-nowrap text-s text-right">
                    <span className={`${
                      row.variance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {renderCellValue(row.variance)}
                    </span>
                  </td>
                )}
                
                {showPercentage && (
                  <td className="px-4 py-3 whitespace-nowrap text-s text-right">
                    <span className={`${
                      row.percentage >= 100 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {row.percentage}%
                    </span>
                  </td>
                )}
                
                {showForecast && (
                  <>
                    <td className="px-4 py-3 whitespace-nowrap text-s text-right text-purple-600">
                      {renderCellValue(row.forecast1)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-s text-right text-purple-600">
                      {renderCellValue(row.forecast2)}
                    </td>
                  </>
                )}
                
                {showBudget && (
                  <td className="px-4 py-3 whitespace-nowrap text-s text-right text-gray-500">
                    {renderCellValue(row.budget)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PLDataTable;