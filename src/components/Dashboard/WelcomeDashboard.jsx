import React from 'react'
// import { toast } from 'react-toastify';
import Loader from '../Loading/Loading';
import { toast } from 'react-toastify';
import { FaUser } from 'react-icons/fa';

const WelcomeDashboard = () => {
  return (
    <div>
         {/* <div className="w-full flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 "> */}
      <div className="w-full flex flex-col justify-center items-center rounded-2xl  text-center">
      <div className="w-full rounded-2xl text-center">
        {/* Animated illustration */}
        {/* <div className="mb-6">
          <svg className="w-32 h-32 mx-auto" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 180C144.183 180 180 144.183 180 100C180 55.8172 144.183 20 100 20C55.8172 20 20 55.8172 20 100C20 144.183 55.8172 180 100 180Z" fill="#E1F5FE"/>
            <path d="M140 90H120V70C120 67.8 118.2 66 116 66H84C81.8 66 80 67.8 80 70V90H60C57.8 90 56 91.8 56 94V134C56 136.2 57.8 138 60 138H140C142.2 138 144 136.2 144 134V94C144 91.8 142.2 90 140 90ZM100 128L80 108H96V98H104V108H120L100 128Z" fill="#29B6F6"/>
          </svg>
        </div> */}
        
        {/* Loader */}
        <div className="mb-4 ml-7 mx-auto w-au">
          <Loader />
        </div>
        
        {/* Message */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Data Available</h3>
          <p className="text-gray-600">
            We couldn't find any data to display. To get started, upload your financial files through the settings.
          </p>
        </div>
        
        {/* Steps guide */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <p className="text-s font-medium text-blue-800 mb-2">Follow these steps:</p>
          <ol className="text-s text-blue-600 list-decimal list-inside space-y-1">
            <li>Go to Settings & Customization</li>
            <li>Upload your GL Master Code file</li>
            <li>Upload your GL, HR, and CRM files</li>
            <li>Return here to view your analytics</li>
          </ol>
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => window.location.href = '/settings-customization'}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-sky-500 to-sky-900 text-white font-medium rounded-lg shadow-md hover:from-sky-900 hover:to-sky-500 transition-all duration-500 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Files Now</span>
          </button>
          
          <button
             onClick={() => window.location.href = '/profile-details'}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-sky-500 text-sky-600 font-medium rounded-lg hover:bg-sky-50 transition-colors duration-200"
          >
            <FaUser /> Profile Settings
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}

export default WelcomeDashboard