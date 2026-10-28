// // src/pages/ForgotPasswordPage.js
// import React, { useState, useContext } from 'react';
// import { AuthContext } from '../context/AuthContext';
// import { useNavigate } from 'react-router-dom';
// import { FiMail, FiArrowLeft } from 'react-icons/fi';
// import { motion } from 'framer-motion';
// import { LoginBG, offRobo } from '../assets/Assets';
// import { toast } from 'react-toastify';

// const ForgotPasswordPage = () => {
//   const [email, setEmail] = useState('');
//   const { requestPasswordReset, loading } = useContext(AuthContext);
//   const navigate = useNavigate();

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (!email) {
//       toast.error('Please enter your email address');
//       return;
//     }

//     const success = await requestPasswordReset(email);
//     if (success) {
//       navigate('/login');
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
//       {/* Video Background with Overlay */}
//       <div className="absolute inset-0 z-0">
//         <video 
//           autoPlay 
//           loop 
//           muted 
//           className="w-full h-full object-cover"
//         >
//           <source src={LoginBG} type="video/mp4" />
//           Your browser does not support the video tag.
//         </video>
//         <div className="absolute inset-0 bg-sky-900 opacity-70"></div>
//       </div>

//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.8 }}
//         className="relative left-0 z-15 h-[500px] w-full max-w-md bg-opacity-90 rounded-xl"
//       >
//         <img src={offRobo} alt="Robot" className="h-full w-full object-contain" />
//       </motion.div>

//       {/* Forgot Password Form */}
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.8 }}
//         className="relative right-15 z-10 w-full max-w-md bg-white bg-opacity-90 backdrop-blur-sm rounded-xl shadow-xl p-8"
//       >
//         <div className="text-center mb-8">
//           <h1 className="text-3xl font-bold text-sky-900 mb-2">Reset Your Password</h1>
//           <p className="text-sky-600">Enter your email to receive a reset link</p>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-5">
//           <div>
//             <label htmlFor="email" className="block text-s font-medium text-sky-700 mb-1">
//               Email Address
//             </label>
//             <div className="relative">
//               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                 <FiMail className="h-5 w-5 text-sky-400" />
//               </div>
//               <input
//                 id="email"
//                 name="email"
//                 type="email"
//                 autoComplete="email"
//                 required
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sky-800 placeholder-sky-400"
//                 placeholder="you@example.com"
//                 disabled={loading}
//               />
//             </div>
//           </div>

//           <div>
//             <button
//               type="submit"
//               disabled={loading}
//               className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-s font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
//             >
//               {loading ? 'Sending...' : 'Send Reset Link'}
//             </button>
//           </div>

//           <div className="text-center">
//             <button
//               onClick={() => navigate('/login')}
//               className="text-s font-medium text-sky-600 hover:text-sky-500 flex items-center justify-center"
//             >
//               <FiArrowLeft className="mr-1" />
//               Back to login
//             </button>
//           </div>
//         </form>
//       </motion.div>
//     </div>
//   );
// };

// export default ForgotPasswordPage;



import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import Confetti from 'react-confetti';
import { mainLogo } from '../assets/Assets';
import { BsGraphUp, BsLightningFill, BsBellFill, BsStars } from 'react-icons/bs';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const { requestPasswordReset, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(true);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [activePopup, setActivePopup] = useState(null);

  const popups = [
    {
      id: 1,
      title: "Financial Overview",
      content: "Real-time revenue, expenses, and profitability insights.",
      color: "bg-gradient-to-br from-pink-400 to-pink-500",
      icon: <BsGraphUp size={18} />,
    },
    {
      id: 2,
      title: "AI Forecasting",
      content: "Predict future scenarios with confidence using our models.",
      color: "bg-gradient-to-br from-amber-400 to-amber-500",
      icon: <BsLightningFill size={18} />,
    },
    {
      id: 3,
      title: "Smart Alerts",
      content: "AI-powered notifications for critical financial events.",
      color: "bg-gradient-to-br from-blue-400 to-blue-500",
      icon: <BsBellFill size={18} />,
    },
  ];

  React.useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 4000);

    const popupInterval = setInterval(() => {
      const nextPopup = popups[Math.floor(Math.random() * popups.length)];
      setActivePopup(nextPopup);
      setTimeout(() => setActivePopup(null), 8000);
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(popupInterval);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    const success = await requestPasswordReset(email);
    if (success) {
      navigate('/login');
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-sky-500 overflow-hidden">
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={1000}
          colors={['#f472b6', '#fbbf24', '#38bdf8', '#a78bfa']}
        />
      )}

      {/* Floating Particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            x: Math.random() * windowSize.width,
            y: Math.random() * windowSize.height,
            scale: Math.random() * 0.5 + 0.5,
            opacity: 0,
          }}
          animate={{
            y: [0, Math.random() * 100 - 50],
            x: [0, Math.random() * 100 - 50],
            opacity: [0, 0.2, 0],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            repeatType: "reverse",
            delay: Math.random() * 5,
          }}
          className={`absolute rounded-full ${
            Math.random() > 0.66
              ? "bg-pink-300/30"
              : Math.random() > 0.33
              ? "bg-amber-300/30"
              : "bg-blue-300/30"
          }`}
          style={{
            width: `${Math.random() * 10 + 5}px`,
            height: `${Math.random() * 10 + 5}px`,
          }}
        />
      ))}

      <div className="container md:max-w-7xl lg:max-w-7xl px-10 mx-auto py-12 flex flex-col justify-center relative z-10">
        {/* Logo Section */}
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center justify-center mb-2"
        >
          <div className="relative">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 bg-clip-text text-transparent"
            >
              <img src={mainLogo} alt="FPnAInsights Logo" className="w-74 md:w-100 h-auto" />
            </motion.div>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="absolute flex gap-1 items-center -top-3 -right-6 text-x font-semibold bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-1.5 rounded-full shadow-md"
            >
              <BsStars size={16} className="text-amber-100" /> AI-Powered
            </motion.div>
          </div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-1 text-lg md:text-xl text-sky-700 max-w-2xl text-center font-medium"
          >
            Transform your financial management with intelligent insights and predictive analytics
          </motion.p>
        </motion.div>

        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-6 items-center justify-between mb-12">
          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.7 }}
            className="w-full lg:w-2/5 space-y-6"
          >
            <motion.h2 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-2xl md:text-3xl font-bold text-sky-900 mb-2"
            >
              Account Recovery
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-sky-700 mb-6"
            >
              Our secure password recovery process ensures your data remains protected at all times.
            </motion.p>

            <div className="space-y-4">
              {[
                {
                  title: "Secure Process",
                  icon: <BsGraphUp size={20} className="text-blue-500" />,
                  desc: "End-to-end encrypted password reset flow with time-limited links",
                  color: "from-blue-100 to-blue-50",
                },
                {
                  title: "Instant Delivery",
                  icon: <BsLightningFill size={20} className="text-amber-500" />,
                  desc: "Reset links delivered immediately to your registered email",
                  color: "from-amber-100 to-amber-50",
                },
                {
                  title: "24/7 Support",
                  icon: <BsBellFill size={20} className="text-pink-500" />,
                  desc: "Our team is always available to assist with account recovery",
                  color: "from-pink-100 to-pink-50",
                },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    transition: { 
                      delay: 1.1 + index * 0.15,
                      type: "spring",
                      stiffness: 100
                    }
                  }}
                  whileHover={{ 
                    y: -5,
                    scale: 1.02,
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)"
                  }}
                  className={`p-5 rounded-xl bg-gradient-to-br ${feature.color} border border-white shadow-sm cursor-pointer transition-all duration-300`}
                >
                  <div className="flex items-start gap-4">
                    <motion.div 
                      className="bg-white p-2 rounded-lg shadow-sm"
                      whileHover={{ rotate: 10, scale: 1.1 }}
                    >
                      {feature.icon}
                    </motion.div>
                    <div>
                      <h3 className="text-lg font-bold text-sky-900 mb-1">{feature.title}</h3>
                      <p className="text-s text-sky-700">{feature.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Forgot Password Form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2, duration: 0.7 }}
            className="w-full lg:w-2/5 bg-white bg-opacity-90 backdrop-blur-sm rounded-xl shadow-xl p-8"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-sky-900 mb-2">Forgot Password?</h1>
              <p className="text-sky-600">Enter your email to receive a reset link</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-s font-medium text-sky-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiMail className="h-5 w-5 text-sky-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-sky-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sky-800 placeholder-sky-400"
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-s font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => navigate('/login')}
                  className="text-s font-medium text-sky-600 hover:text-sky-500 flex items-center justify-center"
                >
                  <FiArrowLeft className="mr-1" />
                  Back to login
                </button>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Additional Content Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm mt-8 mb-12"
        >
          <h3 className="text-xl font-bold text-sky-900 mb-4">Account Security Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Encrypted Communications",
                content: "All password reset communications are end-to-end encrypted",
                icon: "🔐"
              },
              {
                title: "One-Time Links",
                content: "Reset links expire after first use or 24 hours for security",
                icon: "⏱️"
              },
              {
                title: "Activity Monitoring",
                content: "We monitor all account recovery attempts for suspicious activity",
                icon: "👁️"
              }
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9 + index * 0.1 }}
                className="p-4 rounded-lg bg-gradient-to-br from-sky-100 shadow-2xl to-white"
              >
                <div className="text-2xl mb-3 mt-2 bg-sky-900 inline p-1 rounded-full">{item.icon}</div>
                <h4 className="font-bold text-sky-900 mt-3">{item.title}</h4>
                <p className="text-s text-sky-700">{item.content}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Floating Popups */}
      <AnimatePresence>
        {activePopup && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              rotate: [0, 2, -2, 0]
            }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ 
              type: "spring", 
              stiffness: 300,
              rotate: {
                repeat: Infinity,
                repeatType: "reverse",
                duration: 3
              }
            }}
            className={`fixed z-50 top-8 right-8 ${activePopup.color} p-4 rounded-xl shadow-xl max-w-xs flex items-start gap-3 backdrop-blur-sm border border-white/20`}
          >
            <motion.span 
              className="text-white bg-white/20 p-2 rounded-lg"
              animate={{ y: [0, -3, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity
              }}
            >
              {activePopup.icon}
            </motion.span>
            <div>
              <h4 className="font-bold text-white text-s">{activePopup.title}</h4>
              <p className="text-white/90 text-x mt-1">{activePopup.content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ForgotPasswordPage;