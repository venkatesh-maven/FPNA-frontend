import { Link, Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar/Navbar";
import Sidebar from "./Sidebar/Sidebar";
import { useSidebar } from "../hooks/useSidebar";
import { useState, useRef, useEffect } from "react";
import { BsStars } from "react-icons/bs";
import { FiMaximize2, FiMinimize2, FiX } from "react-icons/fi";
import SmallAIChatBot from "../pages/SmallAIChatBot";
import ErrorBoundary from "./ErrorBoundary";

const MainLayout = () => {
  const { isOpen, toggleSidebar, isLoading } = useSidebar();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  // SmallAIChatBot used to mount on every page load (just hidden via CSS),
  // costing every route a component tree + its effects even if Ask AI is
  // never opened. Mount it once the user opens the drawer for the first
  // time, then keep it mounted so the slide-in transition and chat state
  // keep working exactly as before on subsequent opens.
  const [hasOpenedDrawerOnce, setHasOpenedDrawerOnce] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const sidebarRef = useRef(null);
  const navbarRef = useRef(null);
  const mainRef = useRef(null); // 👈 main scrollable area
  const location = useLocation();

  // Scroll main content to top on route change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [location.pathname]);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        navbarRef.current &&
        !navbarRef.current.contains(event.target)
      ) {
        toggleSidebar();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, toggleSidebar]);

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
    if (!isDrawerOpen) setHasOpenedDrawerOnce(true);
  };
  // Closing the drawer (via X, overlay click, etc.) always returns it to the
  // default size so the next "Ask AI" click reopens in the default view.
  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setIsDrawerExpanded(false);
  };

  const handleSidebarHover = (hoverState) => {
    if (!isOpen) setIsHovered(hoverState);
  };

  // The full-page Ask AI chat (src/pages/AIChatBot.jsx) already is the Ask AI
  // experience, so the floating trigger + drawer would just duplicate it.
  const isAskAiPage = location.pathname === "/ask-ai";

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        onMouseEnter={() => handleSidebarHover(true)}
        onMouseLeave={() => handleSidebarHover(false)}
        className={`fixed h-full z-50 ${isOpen || isHovered ? "w-60" : "w-20"}`}
      >
        <Sidebar isOpen={isOpen || isHovered} toggleSidebar={toggleSidebar} />
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          isOpen || isHovered ? "ml-60" : "ml-15"
        }`}
      >
        <div ref={navbarRef} className="relative z-50">
          <Navbar toggleSidebar={toggleSidebar} />
        </div>

        <main
          ref={mainRef} // 👈 track scrollable div
          className="flex-1 overflow-y-auto p-6 bg-gray-50"
        >
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>

        {!isAskAiPage && (
          <>
            {/* Floating Ask AI Button */}
            <button
              onClick={toggleDrawer}
              className="fixed bottom-6 right-6 flex items-center gap-2 bg-sky-700 hover:bg-sky-900 text-white font-medium py-3 px-4 rounded-full shadow-lg transition-all duration-200 z-40"
              type="button"
            >
              <span className="flex items-center gap-1">
                <BsStars size={20} /> Ask AI
              </span>
            </button>

            {/* Drawer Overlay */}
            {isDrawerOpen && (
              <div
                className="fixed inset-0 bg-blend-overlay bg-opacity-50 z-30"
                onClick={closeDrawer}
              />
            )}

            {/* Drawer */}
            <div
              className={`fixed z-40 overflow-y-auto transition-all duration-300 bg-white border border-black rounded-l-xl shadow-xl dark:bg-gray-800 ${
                isDrawerOpen ? "translate-x-0" : "translate-x-full"
              } ${
                isDrawerExpanded
                  ? "top-16 right-0 w-[1100px] max-w-[95vw] h-[calc(100vh-4rem)]"
                  : "top-16 right-0 w-[600px] max-w-[90vw] h-[min(700px,calc(100vh-4rem))]"
              }`}
              tabIndex="-1"
            >
              <div className="absolute top-2.5 end-2.5 z-10 flex items-center gap-1">
                {isDrawerExpanded ? (
                  <button
                    type="button"
                    onClick={() => setIsDrawerExpanded(false)}
                    title="Minimize"
                    className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-s w-8 h-8 inline-flex items-center justify-center dark:hover:bg-gray-600 dark:hover:text-white"
                  >
                    <FiMinimize2 size={16} />
                    <span className="sr-only">Minimize</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsDrawerExpanded(true)}
                    title="Expand"
                    className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-s w-8 h-8 inline-flex items-center justify-center dark:hover:bg-gray-600 dark:hover:text-white"
                  >
                    <FiMaximize2 size={16} />
                    <span className="sr-only">Expand</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDrawer}
                  title="Close"
                  className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-s w-8 h-8 inline-flex items-center justify-center dark:hover:bg-gray-600 dark:hover:text-white"
                >
                  <FiX size={16} />
                  <span className="sr-only">Close menu</span>
                </button>
              </div>

              {hasOpenedDrawerOnce && <SmallAIChatBot isExpanded={isDrawerExpanded} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MainLayout;
