// src/utils/sessionExpiry.js
import axios from "axios";
import { API_BASE_URL } from "../config/config";

// Login / 2FA / password-reset endpoints answer 401 for a wrong password or
// code — that is not an expired session, so never log the user out on those.
const AUTH_PATH = "/user/auth/";

// setTimeout overflows (fires immediately) past ~24.8 days.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

let onSessionExpired = null;

// Expiry of a JWT in epoch ms, or null if it has none / can't be decoded.
export function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token, now = Date.now()) {
  const expiry = getTokenExpiry(token);
  return expiry !== null && expiry <= now;
}

// ms until the token expires, or null when no timer should be scheduled
// (no/unreadable expiry, or too far out for setTimeout).
export function msUntilExpiry(token, now = Date.now()) {
  const expiry = getTokenExpiry(token);
  if (expiry === null) return null;
  const delay = Math.max(0, expiry - now);
  return delay > MAX_TIMEOUT_MS ? null : delay;
}

export function isSessionExpiredResponse(url, status) {
  return (
    status === 401 &&
    typeof url === "string" &&
    url.startsWith(API_BASE_URL) &&
    !url.includes(AUTH_PATH)
  );
}

function report(url, status) {
  if (onSessionExpired && isSessionExpiredResponse(url, status)) {
    onSessionExpired();
  }
}

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input?.url;
}

function axiosSessionInterceptor(error) {
  if (error?.config) report(axios.getUri(error.config), error.response?.status);
  return Promise.reject(error);
}

// Pages call the API directly with fetch/axios (no shared client), so hook both
// globally: any 401 from our API means the token is no longer accepted.
// Returns a cleanup function that restores fetch and ejects the interceptor.
export function installSessionExpiryHandler(handler) {
  onSessionExpired = handler;

  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch.apply(window, args);
    report(requestUrl(args[0]), response.status);
    return response;
  };

  const interceptorId = axios.interceptors.response.use(
    undefined,
    axiosSessionInterceptor
  );

  return () => {
    onSessionExpired = null;
    window.fetch = originalFetch;
    axios.interceptors.response.eject(interceptorId);
  };
}

// axios.create() instances don't inherit global interceptors — attach explicitly.
export function attachSessionInterceptor(instance) {
  instance.interceptors.response.use(undefined, axiosSessionInterceptor);
  return instance;
}
