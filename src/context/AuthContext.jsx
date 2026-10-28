// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE_URL } from "../config/config";
import { useRef } from "react";
import { createIdleLogoutManager } from "../utils/idleLogout";
import { getDecimalPrecision } from "../utils/formatters";
import {
  installSessionExpiryHandler,
  isTokenExpired,
  msUntilExpiry,
} from "../utils/sessionExpiry";


export const AuthContext = createContext();

const SESSION_EXPIRED_MSG = "Your session has expired. Please log in again.";
const SESSION_EXPIRED_TOAST_ID = "session-expired";

const clearStoredSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("twoFASetupToken");
  localStorage.removeItem("twoFALoginToken");
  localStorage.removeItem("userId");
};

export const AuthProvider = ({ children }) => {
 
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [resetToken, setResetToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [twoFASetupToken, setTwoFASetupToken] = useState(null);
  const [twoFALoginToken, setTwoFALoginToken] = useState(null);
  const [userId, setUserId] = useState(null);

  // Financial year api context
  const [years, setYears] = useState([]);
  const [selectedYearState, setSelectedYearState] = useState(
  localStorage.getItem("selectedYear")
    ? parseInt(localStorage.getItem("selectedYear"))
    : null
);

  // 💱 Currency api context
  const [currencies, setCurrencies] = useState([]);
  const [selectedCurrencyState, setSelectedCurrencyState] = useState(
    localStorage.getItem("selectedCurrency") || null
  );

  // 🔢 Decimal precision (0 | 1 | 2, default: no decimals)
  const [decimalPrecisionState, setDecimalPrecisionState] = useState(getDecimalPrecision);


  const idleMgrRef = useRef(null);
  const isAuthenticatedRef = useRef(false);
  const expireSessionRef = useRef(() => {});

  const navigate = useNavigate();






  // Wrapper functions to update state + localStorage
const setSelectedYear = useCallback((year) => {
  setSelectedYearState(year);
  localStorage.setItem("selectedYear", year); // store number as string
}, []);

  const setSelectedCurrency = useCallback((currency) => {
    setSelectedCurrencyState(currency);
    localStorage.setItem("selectedCurrency", currency);
  }, []);

  const setDecimalPrecision = useCallback((dp) => {
    const n = parseInt(dp, 10);
    setDecimalPrecisionState(n);
    localStorage.setItem("decimalPrecision", n);
  }, []);

  // Fetch financial years
const fetchYears = useCallback(async (authToken) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/financial/financial_year`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    setYears(data || []);

    // Pick latest year by default if nothing selected yet
    if (!selectedYearState && data.length > 0) {
      setSelectedYear(data[data.length - 1]);
    }
  } catch (error) {
    console.error("Error fetching years:", error);
  }
}, [selectedYearState, setSelectedYear]);

  // Fetch currencies
  const fetchCurrencies = useCallback(async (authToken) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/currency`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error("Failed to fetch currencies");

      setCurrencies(data || []);

      // Pick default currency if nothing selected yet
      if (!selectedCurrencyState && data.length > 0) {
        setSelectedCurrency(data[0]);
      }
    } catch (error) {
      console.error("Currency fetch error:", error);
    }
  }, [selectedCurrencyState, setSelectedCurrency]);





  

  // Check for token on initial load
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("currentUser");

    if (storedToken && isTokenExpired(storedToken)) {
      // Stale token from an earlier visit — don't render the app with it.
      clearStoredSession();
      // Deferred: in dev, StrictMode re-mounts the ToastContainer right after
      // this effect, which would drop a toast raised synchronously here.
      setTimeout(() =>
        toast.error(SESSION_EXPIRED_MSG, { toastId: SESSION_EXPIRED_TOAST_ID })
      );
    } else if (storedToken) {
      setToken(storedToken);
      setIsAuthenticated(true);

      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setCurrentUser(userData);
          setUserEmail(userData.user_email || "");
          setUserId(userData.user_id || null);
        } catch (e) {
          console.error("Failed to parse user data", e);
        }
      }

      fetchYears(storedToken);
      fetchCurrencies(storedToken);
    }
    setLoading(false);
  }, []);







  const login = useCallback(async (email, password, rememberMe) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/user/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();
      console.log("Login Response:", data);

      // if (!response.ok) {
      //   throw new Error(data.message || 'Login failed');
      // }

      if (!response.ok) {
        // Handle API error responses
        const errorMsg =
          data.message ||
          data.detail ||
          data.error ||
          "Invalid credentials. Please try again.";
        throw new Error(errorMsg);
      }

      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("currentUser", JSON.stringify(data));
        setToken(data.access_token);
        setIsAuthenticated(true);
        setCurrentUser(data);
        setUserEmail(email);
        setUserId(data.user_id || null);
        toast.success("Login successful");

        // ✅   Fetch financial years only when login success
        fetchYears(data.access_token);
        fetchCurrencies(data.access_token); // 👈 ADD THIS

        navigate("/");
        return true;
      } else if (data.password_reset_token) {
        // Password reset required
        localStorage.setItem("resetToken", data.password_reset_token);
        setResetToken(data.password_reset_token);
        setUserEmail(email);
        navigate(`/reset-password/${data.password_reset_token}`);
        return true;
      } else if (data.token_type === "2FA_setup_token") {
        // 2FA setup required
        localStorage.setItem("twoFASetupToken", data["2FA_setup_token"]);
        localStorage.setItem("userId", data.user_id);
        setTwoFASetupToken(data["2FA_setup_token"]);
        setUserEmail(email);
        setUserId(data.user_id);
        navigate(`/setup-2fa/${data["2FA_setup_token"]}`);
        return true;
      } else if (
        data.token_type === "2FA_login_token" ||
        data.token_type === "2FA_setup_login"
      ) {
        // 2FA verification required
        localStorage.setItem("twoFALoginToken", data["2FA_login_token"]);
        setTwoFALoginToken(data["2FA_login_token"]);
        setUserEmail(email);
        setUserId(data.user_id);
        navigate("/verify-2fa");
        return true;
      } else {
        throw new Error(data.message || "Login failed - unknown response");
      }
    } catch (error) {
      toast.error(error.message || "Login failed. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [navigate, fetchYears, fetchCurrencies]);

  const verify2FALogin = useCallback(async (code) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("twoFALoginToken");
      if (!token) {
        throw new Error("No 2FA token found");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/user/auth/2fa/login/${token}/${code}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (response.ok && data.access_token) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("currentUser", JSON.stringify(data));
        setToken(data.access_token);
        setIsAuthenticated(true);
        setCurrentUser(data);
        // setUserEmail(email);
        // setUserId(data.user_id || null);
        toast.success("Login successful");
        navigate("/");
        return true;
      } else {
        throw new Error(data.message || "2FA verification failed");
      }
    } catch (error) {
      toast.error(error.message || "2FA verification failed");
      return false;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const setup2FA = useCallback(async (twoFASetupToken) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/user/auth/2fa/setup/${twoFASetupToken}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      console.log("2FA Setup Response:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to setup 2FA");
      }

      return data;
    } catch (error) {
      toast.error(error.message || "Failed to setup 2FA");
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const complete2FASetup = useCallback(async (verificationCode) => {
    try {
      setLoading(true);
      const userId = localStorage.getItem("userId");
      const token = localStorage.getItem("twoFASetupToken");

      if (!userId || !token) {
        throw new Error("Missing required tokens for 2FA setup");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/user/auth/2fa/verify/${userId}/${verificationCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      // debugger
      if (response.ok) {
        // debugger
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("currentUser", JSON.stringify(data));
        localStorage.removeItem("twoFASetupToken");
        localStorage.removeItem("userId");
        setToken(data.access_token);
        setIsAuthenticated(true);
        setCurrentUser(data);
        setTwoFASetupToken(null);
        toast.success("2FA setup completed successfully!");
        return true;
      } else {
        throw new Error(data.message || "2FA setup failed");
      }
    } catch (error) {
      // debugger
      toast.error(error.message || "Failed to complete 2FA setup");
      // debugger
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/user/auth/request-reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Password reset link sent to your email");
        return true;
      } else {
        throw new Error(data.message || "Failed to request password reset");
      }
    } catch (error) {
      toast.error(error.message || "Failed to request password reset");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token, newPassword) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/user/auth/reset-password/${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ new_password: newPassword }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Password reset successfully");
        navigate("/login");
        return true;
      } else {
        throw new Error(data.message || "Failed to reset password");
      }
    } catch (error) {
      toast.error(error.message || "Failed to reset password");
      return false;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const clearSession = useCallback(() => {
    clearStoredSession();
    isAuthenticatedRef.current = false;
    setToken(null);
    setIsAuthenticated(false);
    setUserEmail("");
    setCurrentUser(null);
    setTwoFASetupToken(null);
    setTwoFALoginToken(null);
    setUserId(null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    navigate("/login");
    toast.success("Logged out successfully");
  }, [clearSession, navigate]);

  // Token past its expiry or rejected by the API: drop it and go to login.
  const expireSession = useCallback(() => {
    // Several requests can 401 at once — only act on the first.
    if (!isAuthenticatedRef.current) return;
    clearSession();
    navigate("/login", { replace: true });
    toast.error(SESSION_EXPIRED_MSG, { toastId: SESSION_EXPIRED_TOAST_ID });
  }, [clearSession, navigate]);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    expireSessionRef.current = expireSession;
  }, [expireSession]);

  // Any 401 from the API (fetch or axios) ends the session.
  useEffect(
    () => installSessionExpiryHandler(() => expireSessionRef.current()),
    []
  );

  // Log out when the token expires instead of waiting for API calls to fail.
  useEffect(() => {
    const delay = token ? msUntilExpiry(token) : null;
    if (delay === null) return;
    const timer = setTimeout(() => expireSessionRef.current(), delay);
    return () => clearTimeout(timer);
  }, [token]);



  

  useEffect(() => {
  // start only when authenticated
  if (isAuthenticated) {
    if (!idleMgrRef.current) {
      idleMgrRef.current = createIdleLogoutManager({ onLogout: logout });
    }
    idleMgrRef.current.start();
  } else {
    idleMgrRef.current?.stop();
  }

  return () => {
    // cleanup on provider unmount
    idleMgrRef.current?.stop();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isAuthenticated]);


  const contextValue = useMemo(() => ({
    token,
    isAuthenticated,
    loading,
    userEmail,
    resetToken,
    currentUser,
    twoFASetupToken,
    twoFALoginToken,
    userId,
    isAdmin: !!currentUser?.is_admin,
    login,
    logout,
    setup2FA,
    verify2FALogin,
    complete2FASetup,
    requestPasswordReset,
    resetPassword,

    years,
    selectedYear: selectedYearState, // ✅ FIXED
    setSelectedYear,

    currencies,
    selectedCurrency: selectedCurrencyState, // ✅ FIXED
    setSelectedCurrency,

    decimalPrecision: decimalPrecisionState,
    setDecimalPrecision,
  }), [
    token,
    isAuthenticated,
    loading,
    userEmail,
    resetToken,
    currentUser,
    twoFASetupToken,
    twoFALoginToken,
    userId,
    login,
    logout,
    setup2FA,
    verify2FALogin,
    complete2FASetup,
    requestPasswordReset,
    resetPassword,
    years,
    selectedYearState,
    setSelectedYear,
    currencies,
    selectedCurrencyState,
    setSelectedCurrency,
    decimalPrecisionState,
    setDecimalPrecision,
  ]);

  return (
   <AuthContext.Provider value={contextValue}>
  {children}
</AuthContext.Provider>

  );
};
