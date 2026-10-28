// src/utils/idleLogout.js
import { toast } from "react-toastify";

export function createIdleLogoutManager({

 

   onLogout,
  idleMs = 500 * 60 * 1000,   //  5 minutes idle
  graceMs = 30 * 1000,     //  30 seconds grace
  toastId = "idle-logout-toast",


  // onLogout,
  // idleMs = 30 * 1000,  //  30 sec idle
  // graceMs = 15 * 1000,  // 15 sec idle
  // toastId = "idle-logout-toast",
}) {
  let idleTimer = null;
  let graceTimer = null;
  let started = false;

  // ✅ track toast/grace state
  let isPromptOpen = false;

  const ACTIVITY_EVENTS = [
    "mousemove",
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
    "pointermove",
  ];

  const clearTimers = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (graceTimer) clearTimeout(graceTimer);
    idleTimer = null;
    graceTimer = null;
  };

  const clearGraceOnly = () => {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = null;
  };

  const hardLogout = () => {
    clearTimers();
    isPromptOpen = false;
    toast.dismiss(toastId);
    onLogout?.();
  };

  // ✅ use this ONLY when user presses Continue
  const continueSession = () => {
    isPromptOpen = false;
    toast.dismiss(toastId);
    clearTimers();
    scheduleIdle();
  };

  const scheduleIdle = () => {
    if (!localStorage.getItem("token")) return;
    idleTimer = setTimeout(showIdleToast, idleMs);
  };

  const showIdleToast = () => {
    if (!localStorage.getItem("token")) return;
    if (toast.isActive(toastId)) return;

    isPromptOpen = true;

    const ToastUI = ({ closeToast }) => (
      <div style={{ minWidth: 260 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>You’re inactive</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>
          Do you want to sign out or continue?
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={() => {
              closeToast?.();
              continueSession(); // ✅ only here we dismiss + reset
            }}
            style={{
              border: "1px solid #cbd5e1",
              padding: "6px 10px",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Continue
          </button>

          <button
            onClick={() => {
              closeToast?.();
              hardLogout();
            }}
            style={{
              border: "1px solid #ef4444",
              padding: "6px 10px",
              borderRadius: 8,
              background: "#ef4444",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );

    toast.warn(<ToastUI />, {
      toastId,
      autoClose: false,
      closeOnClick: false,
      draggable: false,
      position: "top-right",
      // ✅ optional: prevent user clicking outside to dismiss
      // closeButton: false,
    });

    // ✅ auto logout after graceMs ONLY if they don't click Continue/Sign out
    clearGraceOnly();
    graceTimer = setTimeout(() => {
      hardLogout();
    }, graceMs);
  };

  // ✅ IMPORTANT: don't dismiss toast on mousemove when prompt is open
 const onActivity = () => {
  // ✅ When toast is open, ignore activity.
  // Auto logout should still happen after 15s unless they click Continue/Sign out.
  if (isPromptOpen) return;

  // normal mode: reset idle timer
  clearTimers();
  scheduleIdle();
};

  /** ---- your tab logic unchanged ---- */
  const TAB_KEY = "__tab_session_id__";
  const TAB_LAST_KEY = "__last_tab_session_id__";

  const ensureTabSession = () => {
    if (!localStorage.getItem("token")) return;

    let tabId = sessionStorage.getItem(TAB_KEY);
    const lastTabId = localStorage.getItem(TAB_LAST_KEY);

    if (!tabId && lastTabId) {
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("twoFASetupToken");
      localStorage.removeItem("twoFALoginToken");
      localStorage.removeItem("userId");
      localStorage.removeItem(TAB_LAST_KEY);
      return;
    }

    if (!tabId) {
      tabId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(TAB_KEY, tabId);
    }

    localStorage.setItem(TAB_LAST_KEY, tabId);
  };

  const onVisibilityChange = () => {};

  const start = () => {
    if (started) return;
    started = true;

    ensureTabSession();

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true })
    );
    document.addEventListener("visibilitychange", onVisibilityChange);

    scheduleIdle();
  };

  const stop = () => {
    if (!started) return;
    started = false;

    ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
    document.removeEventListener("visibilitychange", onVisibilityChange);

    isPromptOpen = false;
    toast.dismiss(toastId);
    clearTimers();
  };

  // keep your API the same
  const reset = () => {
    // if prompt is open, don't dismiss it automatically
    if (isPromptOpen) return;
    clearTimers();
    scheduleIdle();
  };

  return { start, stop, reset };
}