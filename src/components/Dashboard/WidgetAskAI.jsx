import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BsStars } from "react-icons/bs";
import { FiX } from "react-icons/fi";
import { askAI } from "../../utils/askAi";

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Sidebar "Ask AI" used by individual dashboard widgets (KPI tiles, chart
// cards). Mirrors the Reports' AskAI.jsx sidebar UX, but the context and
// predefined questions are supplied by the caller per-widget instead of a
// report-wide config, so it works for any metric/chart — including ones
// added later via Manage Widgets.
const WidgetAskAI = ({ title, context, questions = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([
        {
          id: 1,
          text: `Hi! Choose a question below — I'll answer using the current "${title}" data.`,
          sender: "ai",
          time: nowTime(),
        },
      ]);
    }
  }, [isOpen, title]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const askQuestion = async (question) => {
    if (isLoading) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: question, sender: "user", time: nowTime() },
    ]);
    setIsLoading(true);
    try {
      const reply = await askAI(question, context);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: reply, sender: "ai", time: nowTime() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Sorry, something went wrong while contacting the AI service. Please try again.",
          sender: "ai",
          time: nowTime(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="p-1 rounded hover:bg-gray-100 text-sky-700"
        title="Ask AI"
      >
        <BsStars />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              className="fixed top-0 right-0 z-50 h-full w-[360px] bg-white shadow-2xl flex flex-col border-l border-sky-200"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-sky-50 border-b border-sky-200 flex items-start justify-between">
                <div>
                  <h2 className="text-s font-semibold text-sky-900 flex items-center gap-1">
                    <BsStars className="text-sky-600" /> Ask AI
                  </h2>
                  <p className="text-x text-sky-600">{title}</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-sky-100 text-sky-600"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-sky-50 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-x ${
                        msg.sender === "user"
                          ? "bg-sky-600 text-white rounded-br-none"
                          : "bg-white border border-sky-200 text-sky-900 rounded-bl-none shadow-sm"
                      }`}
                    >
                      <div className="whitespace-pre-line">{msg.text}</div>
                      <div
                        className={`text-x mt-1 ${
                          msg.sender === "user" ? "text-sky-200" : "text-sky-400"
                        }`}
                      >
                        {msg.time}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-sky-200 rounded-lg rounded-bl-none px-3 py-2 shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-sky-200 bg-white">
                <p className="text-x font-semibold text-sky-900 mb-2 flex items-center gap-1">
                  <BsStars className="text-sky-600" />
                  {title}
                </p>
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {questions.map((q) => (
                    <button
                      key={q}
                      onClick={() => askQuestion(q)}
                      disabled={isLoading}
                      className="text-left px-3 py-2 text-x text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 disabled:opacity-50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-x text-sky-400 mt-3">
                  FPnAInsights may produce inaccurate information. Always verify critical insights.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default WidgetAskAI;
