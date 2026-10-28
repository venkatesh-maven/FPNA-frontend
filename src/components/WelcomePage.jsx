import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboard, mainLogo } from '../assets/Assets';
import Confetti from 'react-confetti';
import { BsStars, BsArrowRight, BsLightningFill, BsGraphUp, BsBellFill } from 'react-icons/bs';
import LoginPage from '../pages/Login';

const WelcomePage = () => {
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(true);
  const [activePopup, setActivePopup] = useState(null);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [isHovered, setIsHovered] = useState(false);

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

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
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
      

      <div className="container mx-auto px-4 py-12 flex flex-col justify-center relative z-10">
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
                scale: [1, 1.03, 1],
                rotate: [0, 3, -3, 0],
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                repeatType: "reverse",
              }}
              className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 bg-clip-text text-transparent"
            >
              <img src={mainLogo} alt="FPnAInsights Logo" className="w-64 md:w-100 h-auto" />
              {/* <LoginPage /> */}

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
        <div className="flex flex-col p-5 lg:flex-row gap-8 items-center justify-between mb-12">
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
              Key Features
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-sky-700 mb-6"
            >
              Our platform provides everything you need to make informed financial decisions with confidence.
            </motion.p>

            <div className="space-y-4">
              {[
                {
                  title: "Comprehensive Dashboard",
                  icon: <BsGraphUp size={20} className="text-blue-500" />,
                  desc: "Customizable financial overview with real-time KPIs and metrics",
                  color: "from-blue-100 to-blue-50",
                },
                {
                  title: "AI Forecasting",
                  icon: <BsLightningFill size={20} className="text-amber-500" />,
                  desc: "Predictive revenue modeling with 95% accuracy",
                  color: "from-amber-100 to-amber-50",
                },
                {
                  title: "Smart Alerts",
                  icon: <BsBellFill size={20} className="text-pink-500" />,
                  desc: "Proactive notifications for financial events and anomalies",
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

          {/* Dashboard Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2, duration: 0.7 }}
            className="w-full lg:w-3/5 relative"
          >
            <div className="relative rounded-xl overflow-hidden shadow-2xl border-2 border-white">
              <img 
                src={dashboard} 
                alt="Dashboard Preview" 
                className="w-full h-auto"
              />
              <motion.div 
                className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
              />
            </div>
            
            {/* Floating stats */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6 }}
              className="absolute -bottom-6 left-0 right-0 flex justify-center gap-4"
            >
              {[
                { value: "95%", label: "Accuracy" },
                { value: "10x", label: "Faster" },
                { value: "24/7", label: "Monitoring" },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  whileHover={{ y: -5 }}
                  className="bg-white px-4 py-2 rounded-lg shadow-md border border-gray-100"
                >
                  <div className="text-xl font-bold text-sky-900">{stat.value}</div>
                  <div className="text-x text-sky-600">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Additional Content Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm mt-8 mb-12"
        >
          <h3 className="text-xl font-bold text-sky-900 mb-4">Why Choose FPnAInsights?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Data Security",
                content: "Encryption, SSO/MFA and compliance with global data security standards",
                icon: "🔒"
              },
              {
                title: "Easy Integration",
                content: "Connect with all your existing financial systems",
                icon: "🔗"
              },
              {
                title: "Expert Support",
                content: "24/7 assistance from financial technology specialists",
                icon: "👨‍💼"
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

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.1 }}
          className="flex flex-col items-center mt-8"
        >
          <motion.button
            onClick={() => navigate("/profile-details")}
            className="relative overflow-hidden px-8 py-4 rounded-full bg-gradient-to-r from-pink-500 to-amber-500 text-white font-bold text-lg shadow-lg"
            whileHover={{ 
              scale: 1.05,
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)"
            }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
          >
            <span className="relative z-10 flex items-center">
              Get Started Now
              <motion.span
                animate={{ 
                  x: isHovered ? 8 : 0,
                  opacity: isHovered ? 1 : 0.8
                }}
                transition={{ type: "spring", stiffness: 500 }}
                className="ml-3"
              >
                <BsArrowRight size={20} />
              </motion.span>
            </span>
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                repeat: Infinity, 
                repeatType: "reverse", 
                duration: 2,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-gradient-to-r from-pink-600 to-amber-600 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-full"
            />
          </motion.button>
          {/* <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2 }}
            className="mt-4 text-s text-sky-600"
          >
            No credit card required • 14-day free trial
          </motion.p> */}
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

export default WelcomePage;
