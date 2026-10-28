import React, { useState } from 'react';
import HelpSupportSidebar from './HelpSupportSidebar';
import KnowledgeBase from './KnowledgeBase';
import TicketingSystem from './TicketingSystem';
import TrainingWebinars from './TrainingWebinars';

const HelpSupport = () => {
  const [activeTab, setActiveTab] = useState('knowledge');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <HelpSupportSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 p-8">
        {activeTab === 'knowledge' && <KnowledgeBase />}
        {activeTab === 'tickets' && <TicketingSystem />}
        {activeTab === 'training' && <TrainingWebinars />}
      </div>
    </div>
  );
};

export default HelpSupport;