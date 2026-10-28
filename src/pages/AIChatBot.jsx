import React, { useState, useEffect, useContext, useRef } from "react";
import { FiSend, FiMoreVertical, FiEdit2, FiTrash2 } from "react-icons/fi";
import { BsPin, BsPinFill, BsSignpostSplit } from "react-icons/bs";
import { FaRobot, FaUser } from "react-icons/fa"; // User and AI icons
import {
  sendAssistantMessage,
  findAWay,
  recalculateFindAWay,
  fetchProviders,
  fetchChatList,
  createChat as apiCreateChat,
  getChat as apiGetChat,
  updateChat as apiUpdateChat,
  deleteChat as apiDeleteChat,
} from "../utils/fpnaAssistant";
import { AuthContext } from "../context/AuthContext";
import FindAWayCard from "./FindAWayCard";

const MAX_HISTORY_TURNS = 10;

// Goal-seeking requests go to Find a Way even when typed in Ask mode.
const FIND_A_WAY_RE = /^\s*(please\s+)?find\s+(me\s+)?a\s+way\b/i;
// ~7-8 lines before the input box switches to internal scrolling instead of
// growing further — keeps a long question fully editable without letting
// the input area take over the screen.
const INPUT_MAX_HEIGHT = 160;

const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const greetingMessage = () => ({
  id: 1,
  text: "Hello! How can I assist you with financial analysis today?",
  sender: "ai",
  time: nowTime(),
});

// A chat that only exists in the browser — no server round trip until the
// user actually sends a message. Opening the page, hitting "New Chat", or
// switching away from an untouched chat all used to fire a POST to create a
// DB row immediately, which is exactly why load/refresh felt slow and why
// refreshing repeatedly left empty rows behind. Now nothing is persisted
// until there's an actual message worth saving.
const makeDraftChat = () => ({
  id: null,
  title: null,
  pinned: false,
  updated_at: new Date().toISOString(),
  messages: [greetingMessage()],
  conversation_history: [],
});

const formatListTime = (isoString) => {
  const d = new Date(isoString);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const AIChatBot = () => {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

  // historyList: lightweight summaries for the sidebar (id/title/pinned/updated_at).
  // activeChat: the full conversation currently shown (messages + AI memory).
  // Persisted server-side per logged-in user once it has a real message, so
  // history survives refresh, logout, and logging back in.
  const [historyList, setHistoryList] = useState([]);
  const [activeChat, setActiveChat] = useState(() => makeDraftChat());
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // "ask" = normal Q&A; "find" = Find a Way goal-seeking.
  const [mode, setMode] = useState("ask");
  const [busyMessageId, setBusyMessageId] = useState(null);

  // Which AI answers questions (see backend ai/providers.py). Perplexity is
  // the only one with a real API key today; the others are shown in the
  // dropdown but reply with a friendly "not configured yet" message until a
  // real key is added server-side — no frontend change needed at that point.
  const [providerOptions, setProviderOptions] = useState([{ id: "perplexity", label: "Perplexity", configured: true }]);
  const [provider, setProvider] = useState("perplexity");

  // Full chats already fetched this session, keyed by id — reopening a
  // previously-viewed chat is then instant instead of a repeat network call.
  const chatCacheRef = useRef(new Map());
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-grow the input box as the user types multiple lines, instead of a
  // fixed single-row height that just clips/scrolls the text. A plain
  // <textarea> doesn't resize itself from content — height has to be
  // recalculated by hand: reset to "auto" first so scrollHeight reflects
  // the CURRENT content (not the previously-set height), then grow to fit,
  // capped at INPUT_MAX_HEIGHT so a very long question scrolls internally
  // instead of pushing the send button off-screen.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`;
  }, [input]);

  // Auto-scroll to the latest message whenever the active chat's messages
  // change (new question, new reply) or the "Thinking..." indicator toggles.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, isSending]);

  const refreshHistoryList = async () => {
    try {
      setHistoryList(await fetchChatList(token));
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  };

  // On login (or refresh, once the auth token is restored): show a fresh
  // draft chat immediately (no network wait — the greeting is static), and
  // load the saved chat list in the background for the sidebar.
  useEffect(() => {
    if (!token) return;
    setActiveChat(makeDraftChat());
    chatCacheRef.current = new Map();
    refreshHistoryList();
  }, [token]);

  // Load the provider dropdown options once per login. Falls back silently
  // to the Perplexity-only default (already in state) if this fails — the
  // dropdown just won't show the other options, not a broken chat.
  useEffect(() => {
    if (!token) return;
    fetchProviders(token)
      .then((list) => {
        if (list.length) setProviderOptions(list);
      })
      .catch((err) => console.error("Failed to load AI provider list:", err));
  }, [token]);

  const handleSend = async () => {
    if (input.trim() === "" || isSending || !activeChat) return;

    const question = input.trim();
    const priorHistory = activeChat.conversation_history;
    const newTitle = activeChat.title ?? question;
    const newUserMessage = { id: Date.now(), text: question, sender: "user", time: nowTime() };
    const afterUser = { ...activeChat, title: newTitle, messages: [...activeChat.messages, newUserMessage] };

    setActiveChat(afterUser);
    setInput("");
    setIsSending(true);

    let chatId = activeChat.id;

    try {
      if (!chatId) {
        // First message in a draft chat: this is the one point it actually
        // gets persisted, title and question saved in the same call.
        const created = await apiCreateChat(token, afterUser.messages, newTitle);
        chatId = created.id;
        afterUser.id = chatId;
        afterUser.updated_at = created.updated_at;
        setActiveChat(afterUser);
      } else {
        // Save the question immediately (not just after the AI replies) so
        // it isn't lost if the completion call fails or the tab closes
        // mid-request.
        await apiUpdateChat(token, chatId, { title: newTitle, messages: afterUser.messages });
      }
      chatCacheRef.current.set(chatId, afterUser);
      refreshHistoryList();

      let reply;
      let aiMessage;
      if (mode === "find" || FIND_A_WAY_RE.test(question)) {
        // A follow-up ("what if revenue drops 12% instead") modifies the most
        // recent Find a Way result in this chat.
        const lastFind = [...activeChat.messages].reverse().find((m) => m.type === "find_a_way");
        const data = await findAWay(question, lastFind?.payload?.spec, token, selectedYear, selectedCurrency);
        if (data.understood === false) {
          reply = data.clarification;
          aiMessage = { id: Date.now() + 1, text: reply, sender: "ai", time: nowTime() };
        } else {
          reply = data.history_text;
          aiMessage = { id: Date.now() + 1, text: reply, sender: "ai", time: nowTime(), type: "find_a_way", payload: data };
        }
      } else {
        // Which report/page this question is about, and which real data to
        // fetch for it, is now decided server-side (classify topic -> fetch
        // only that topic's data in-process) — the frontend just sends the
        // question plus the app's currently-selected year/currency as defaults.
        reply = await sendAssistantMessage(question, priorHistory, token, selectedYear, selectedCurrency, provider);
        aiMessage = { id: Date.now() + 1, text: reply, sender: "ai", time: nowTime() };
      }

      const newConversationHistory = [
        ...priorHistory,
        { role: "user", content: question },
        { role: "assistant", content: reply },
      ].slice(-MAX_HISTORY_TURNS);
      const afterReply = {
        ...afterUser,
        messages: [...afterUser.messages, aiMessage],
        conversation_history: newConversationHistory,
      };

      // Show the reply and clear "Thinking..." right away — saving it is not
      // something the user needs to wait for. Previously this save was
      // awaited before isSending cleared, so "Thinking..." stayed on screen
      // under the already-visible reply until the save finished.
      setActiveChat(afterReply);
      chatCacheRef.current.set(chatId, afterReply);
      setIsSending(false);

      apiUpdateChat(token, chatId, {
        messages: afterReply.messages,
        conversation_history: newConversationHistory,
      })
        .then(() => refreshHistoryList())
        .catch((err) => console.error("Failed to save assistant reply:", err));
    } catch (err) {
      const isFind = mode === "find" || FIND_A_WAY_RE.test(question);
      const errorMessage = {
        id: Date.now() + 1,
        text:
          isFind && err?.message
            ? `Sorry, I couldn't work that out: ${err.message}`
            : "Sorry, I couldn't reach the assistant just now. Please try again.",
        sender: "ai",
        time: nowTime(),
      };
      setActiveChat((prev) => (prev && prev.id === chatId ? { ...prev, messages: [...prev.messages, errorMessage] } : prev));
      setIsSending(false);
    }
  };

  // Changes one saved message in the open chat (recalculated / selected
  // Find a Way paths) and persists the chat.
  const updateMessage = (messageId, changes) => {
    const chatId = activeChat.id;
    const updated = {
      ...activeChat,
      messages: activeChat.messages.map((m) => (m.id === messageId ? { ...m, ...changes } : m)),
    };
    setActiveChat(updated);
    chatCacheRef.current.set(chatId, updated);
    if (chatId) {
      apiUpdateChat(token, chatId, { messages: updated.messages }).catch((err) =>
        console.error("Failed to save chat:", err)
      );
    }
  };

  const recalculateMessage = async (message, spec) => {
    setBusyMessageId(message.id);
    try {
      const data = await recalculateFindAWay(spec, token, selectedYear, selectedCurrency);
      updateMessage(message.id, { text: data.history_text, payload: data });
    } catch (err) {
      console.error("Find a Way recalculation failed:", err);
      window.alert(err.message || "Could not recalculate. Please try again.");
    } finally {
      setBusyMessageId(null);
    }
  };

  const selectPath = (message, pathId) =>
    updateMessage(message.id, { payload: { ...message.payload, selected_path: pathId } });

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMenu = (id) => setOpenMenuId((prev) => (prev === id ? null : id));

  const togglePin = async (chat) => {
    setOpenMenuId(null);
    // Optimistic: flip it locally first, roll back only if the save fails.
    setHistoryList((prev) => prev.map((c) => (c.id === chat.id ? { ...c, pinned: !c.pinned } : c)));
    if (activeChat?.id === chat.id) setActiveChat((prev) => ({ ...prev, pinned: !chat.pinned }));
    try {
      const updated = await apiUpdateChat(token, chat.id, { pinned: !chat.pinned });
      chatCacheRef.current.set(chat.id, updated);
      refreshHistoryList();
    } catch (err) {
      console.error("Failed to pin/unpin chat:", err);
      refreshHistoryList();
    }
  };

  const startRename = (chat) => {
    setRenamingId(chat.id);
    setRenameValue(chat.title || "");
    setOpenMenuId(null);
  };

  const commitRename = async (id) => {
    setRenamingId(null);
    const title = renameValue.trim();
    if (!title) return;
    setHistoryList((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    if (activeChat?.id === id) setActiveChat((prev) => ({ ...prev, title }));
    try {
      const updated = await apiUpdateChat(token, id, { title });
      chatCacheRef.current.set(id, updated);
    } catch (err) {
      console.error("Failed to rename chat:", err);
      refreshHistoryList();
    }
  };

  const requestDelete = (id) => {
    setOpenMenuId(null);
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!id) return;

    // Optimistic removal — don't make the user wait on a full list refetch
    // for something that already visibly disappeared.
    const previousList = historyList;
    setHistoryList((prev) => prev.filter((c) => c.id !== id));
    chatCacheRef.current.delete(id);
    if (activeChat?.id === id) startNewChat();

    try {
      await apiDeleteChat(token, id);
    } catch (err) {
      console.error("Failed to delete chat:", err);
      setHistoryList(previousList);
    }
  };

  const startNewChat = () => {
    setInput("");
    setActiveChat(makeDraftChat());
  };

  const openChat = async (id) => {
    setOpenMenuId(null);
    if (id === activeChat?.id) return;
    setInput("");

    const cached = chatCacheRef.current.get(id);
    if (cached) {
      setActiveChat(cached);
      return;
    }

    setIsOpeningChat(true);
    try {
      const chat = await apiGetChat(token, id);
      chatCacheRef.current.set(id, chat);
      setActiveChat(chat);
    } catch (err) {
      console.error("Failed to open chat:", err);
    } finally {
      setIsOpeningChat(false);
    }
  };

  return (
    <div className="flex h-[85vh] bg-gradient-to-br from-gray-100 to-gray-200">
      {/* Left Sidebar - Conversation History */}
      <div className="w-60 shrink-0 bg-white border-r border-gray-300 shadow-lg flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-sky-800 to-sky-600">
          <h2 className="text-xl font-bold text-white drop-shadow-md">𝐅𝐏𝐧𝐀𝐈𝐧𝐬𝐢𝐠𝐡𝐭𝐬 𝐜𝐡𝐚𝐭</h2>
        </div>

        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <p className="text-s font-semibold text-gray-700">History</p>
          <button
            onClick={startNewChat}
            className="shrink-0 text-s font-medium text-gray-700 border border-sky-500 rounded-full px-4 py-1.5 hover:bg-sky-50 transition-colors"
          >
            New chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2">
          {historyList.length === 0 && (
            <p className="text-s text-gray-400 text-center mt-6 px-2">No conversations yet.</p>
          )}
          {historyList.map((chat) => (
            <div
              key={chat.id}
              onClick={() => openChat(chat.id)}
              className={`group relative flex items-start gap-1 p-3 border-b border-gray-100 hover:bg-gray-100 cursor-pointer transition-colors rounded-lg ${
                chat.id === activeChat?.id ? "bg-sky-50" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                {renamingId === chat.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(chat.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-s font-medium text-gray-800 border border-blue-300 rounded px-1 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-s font-medium text-gray-800 truncate">
                    {chat.pinned && <BsPinFill className="shrink-0 text-sky-500" size={11} />}
                    <span className="truncate">{chat.title}</span>
                  </div>
                )}
                <div className="text-x text-gray-500">{formatListTime(chat.updated_at)}</div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenu(chat.id);
                }}
                className={`shrink-0 p-1 rounded hover:bg-gray-200 text-gray-500 transition-opacity ${
                  openMenuId === chat.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <FiMoreVertical size={16} />
              </button>

              {openMenuId === chat.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                  <div className="absolute right-2 top-9 z-20 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(chat);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-s text-gray-700 hover:bg-gray-100"
                    >
                      <BsPin size={13} /> {chat.pinned ? "Unpin chat" : "Pin chat"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(chat);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-s text-gray-700 hover:bg-gray-100"
                    >
                      <FiEdit2 size={13} /> Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDelete(chat.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-s text-red-600 hover:bg-red-50"
                    >
                      <FiTrash2 size={13} /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="w-full space-y-4">
            {isOpeningChat ? (
              <p className="text-s text-gray-400 text-center mt-10">Opening conversation...</p>
            ) : (
              activeChat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.sender === "ai" && message.type === "find_a_way" ? (
                    <div className="flex items-start animate-slide-in-left w-full">
                      <spam className="border border-sky-200 rounded-full p-1 mr-3 mt-1"><FaRobot className="w-6  text-2xl  h-6 text-blue-500 " size={24}/></spam>
                      <div className="flex-1 min-w-0 max-w-5xl bg-gradient-to-br from-blue-50 to-gray-50 border border-gray-200 rounded-lg p-3 shadow-md">
                        <FindAWayCard
                          payload={message.payload}
                          busy={busyMessageId === message.id}
                          onRecalculate={(spec) => recalculateMessage(message, spec)}
                          onSelectPath={(pathId) => selectPath(message, pathId)}
                        />
                        <div className="text-x text-gray-500 mt-2">{message.time}</div>
                      </div>
                    </div>
                  ) : message.sender === "ai" ? (
                    <div className="flex items-start animate-slide-in-left">
                      <spam className="border border-sky-200 rounded-full p-1 mr-3 mt-1"><FaRobot className="w-6  text-2xl  h-6 text-blue-500 " size={24}/></spam>
                      <div className="bg-gradient-to-br from-blue-100 to-gray-100 border border-gray-200 rounded-lg p-3 max-w-xs md:max-w-md lg:max-w-lg xl:max-w-2xl shadow-md">
                        <div className="text-s text-gray-800 whitespace-pre-line">{message.text}</div>
                        <div className="text-x text-gray-500 mt-1">{message.time}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start animate-slide-in-right">
                      <div className="bg-sky-600 text-white rounded-lg p-3 max-w-xs md:max-w-md lg:max-w-lg shadow-md rounded-bl-none">
                        <div className="text-s whitespace-pre-line">{message.text}</div>
                        <div className="text-x text-blue-200 mt-1">{message.time}</div>
                      </div>
                      {/* <FaUser className="w-6 h-6 text-green-500 ml-3 mt-1" /> */}
                      <spam className="border border-sky-200 text-s rounded-full p-2 ml-3 mt-1"><FaUser className="w-6  text-s  h-6 text-blue-500 " /></spam>

                    </div>
                  )}
                </div>
              ))
            )}
            {isSending && (
              <div className="flex items-start animate-slide-in-left">
                <spam className="border border-sky-200 rounded-full p-1 mr-3 mt-1"><FaRobot className="w-6 text-2xl h-6 text-blue-500" size={24}/></spam>
                <div className="bg-gradient-to-br from-blue-100 to-gray-100 border border-gray-200 rounded-lg p-3 shadow-md">
                  <div className="text-s text-gray-500">Thinking...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="px-6 py-2 border-t z-50 border-gray-200 bg-white shadow-lg">
          <div className="w-full">
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 min-w-0 flex items-center gap-2 rounded-3xl border border-gray-200 bg-white shadow-sm px-3 py-2 focus-within:border-sky-300 focus-within:ring-1 focus-within:ring-sky-300">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    mode === "find"
                      ? "e.g. Find a way to maintain $6M EBITDA if revenue declines 8%, without reducing headcount"
                      : "Ask me anything about financial reports, forecasts, or insights"
                  }
                  rows="1"
                  disabled={isOpeningChat}
                  style={{ maxHeight: `${INPUT_MAX_HEIGHT}px` }}
                  className="flex-1 min-w-0 overflow-y-auto resize-none outline-none border-none bg-transparent text-s placeholder-gray-400 py-1 disabled:cursor-not-allowed leading-normal"
                />
                <button
                  onClick={handleSend}
                  disabled={input.trim() === "" || isSending || isOpeningChat}
                  className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                    input.trim() === "" || isSending || isOpeningChat
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-sky-600 hover:bg-sky-50"
                  }`}
                >
                  <FiSend size={18} />
                </button>
              </div>

              <div className="shrink-0 flex items-center rounded-full border border-gray-200 bg-white shadow-sm p-1">
                {[
                  ["ask", "Ask", null],
                  ["find", "Find a Way", <BsSignpostSplit key="i" size={12} />],
                ].map(([id, label, icon]) => (
                  <button
                    key={id}
                    onClick={() => setMode(id)}
                    title={
                      id === "find"
                        ? "Describe a financial outcome and constraints; get alternative paths to reach it"
                        : "Ask questions about your financial data"
                    }
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-x font-medium transition-colors ${
                      mode === id ? "bg-sky-600 text-white" : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-gray-200 bg-white shadow-sm px-2.5 py-2">
                <span className="text-x text-gray-400 shrink-0">Model:</span>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  title="Choose which AI answers your questions"
                  className="w-32 text-x text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 outline-none focus:border-sky-300 cursor-pointer truncate"
                >
                  {providerOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.configured === false ? " (not set up yet)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setConfirmDeleteId(null)}>
          <div
            className="bg-white rounded-xl shadow-xl p-5 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-s font-semibold text-gray-800">Delete this chat?</p>
            <p className="text-s text-gray-500 mt-1">This can't be undone.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 text-s font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-s font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatBot;
