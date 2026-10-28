import React, { useState } from "react";
import Joyride from "react-joyride";

const DashboardTour = () => {
  const [run, setRun] = useState(true); // Run the tour when component mounts

  const steps = [
    {
      target: ".component-4", // Add this class to your 4th component
      content: (
        <div>
          <img src="/demo4.png" alt="Step 4" style={{ width: "100%" }} />
          <p>This is Component 4. Here's what it does...</p>
        </div>
      )
    },
    {
      target: ".component-5", // Add this class to your 5th component
      content: (
        <div>
          <img src="/demo5.png" alt="Step 5" style={{ width: "100%" }} />
          <p>This is Component 5. Here's what it does...</p>
        </div>
      )
    }
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      showSkipButton
      continuous
      styles={{
        options: {
          primaryColor: "#2563eb",
          zIndex: 10000
        }
      }}
    />
  );
};

export default DashboardTour;
