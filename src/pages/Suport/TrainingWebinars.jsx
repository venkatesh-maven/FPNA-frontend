import React from 'react';
import { FiCalendar } from 'react-icons/fi';

const TrainingWebinars = () => {
  const upcomingEvents = [
    {
      id: 1,
      title: "New Feature Walkthrough",
      date: "June 20, 2023",
      time: "2:00 PM EST",
      type: "Webinar"
    },
    {
      id: 2,
      title: "Q2 Financial Planning Best Practices",
      date: "June 25, 2023",
      time: "11:00 AM EST",
      type: "Training"
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-xl font-semibold mb-6 flex items-center">
        <FiCalendar className="mr-2 text-blue-500" /> Training & Webinars
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {upcomingEvents.map(event => (
          <div key={event.id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <h4 className="font-bold text-lg mb-2">{event.title}</h4>
            <div className="flex items-center text-s text-gray-600 mb-3">
              <FiCalendar className="mr-2" />
              <span>{event.date} at {event.time}</span>
            </div>
            <span className="inline-block px-2 py-1 text-x rounded-full bg-blue-100 text-blue-800 mb-3">
              {event.type}
            </span>
            <button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-s">
              Register Now
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h4 className="font-semibold mb-4">Training Resources</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 text-left">
            <h5 className="font-medium mb-1">Onboarding Videos</h5>
            <p className="text-s text-gray-600">Get started with our platform</p>
          </button>
          <button className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 text-left">
            <h5 className="font-medium mb-1">Advanced Features</h5>
            <p className="text-s text-gray-600">Master our powerful tools</p>
          </button>
          <button className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 text-left">
            <h5 className="font-medium mb-1">Certification Program</h5>
            <p className="text-s text-gray-600">Become a certified expert</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingWebinars;