import React from 'react'

const ChatSideBarAI = () => {
  return (
    <div>
        <div
        className={`fixed top-16 right-0 z-40   overflow-y-auto transition-transform bg-white w-100 h-[700px] dark:bg-gray-800 ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        tabIndex="-1"
      >
        
        <button
          type="button"
          onClick={toggleDrawer}
          className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-s w-8 h-8 absolute top-2.5 end-2.5 inline-flex items-center justify-center dark:hover:bg-gray-600 dark:hover:text-white"
        >
          <svg
            className="w-3 h-3"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 14 14"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
            />
          </svg>
          <span className="sr-only">Close menu</span>
        </button>

        <SmallAIChatBot />
     
      </div>
    </div>
  )
}

export default ChatSideBarAI
