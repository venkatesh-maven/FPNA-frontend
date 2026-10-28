import { describe, it, expect, vi, afterEach } from "vitest";
import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "../../config/config";
import {
  getTokenExpiry,
  isTokenExpired,
  msUntilExpiry,
  isSessionExpiredResponse,
  installSessionExpiryHandler,
  attachSessionInterceptor,
} from "../sessionExpiry";

/*
 * Session expiry: an expired / rejected token must send the user back to the
 * login page instead of leaving them on a dashboard full of failed requests.
 * Login, 2FA and password-reset endpoints (".../user/auth/...") return 401 for
 * a wrong password or code, so those must NOT be treated as an expired session.
 */

const b64url = (obj) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (payload) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.sig`;

const NOW = 1_800_000_000_000;

describe("getTokenExpiry / isTokenExpired", () => {
  it("reads the exp claim in ms", () => {
    expect(getTokenExpiry(jwt({ exp: 1_800_000_000 }))).toBe(NOW);
  });

  it("returns null for tokens it cannot read", () => {
    expect(getTokenExpiry("not-a-jwt")).toBeNull();
    expect(getTokenExpiry(jwt({ user_id: 1 }))).toBeNull();
    expect(isTokenExpired("not-a-jwt", NOW)).toBe(false);
  });

  it("is expired at or after exp", () => {
    const token = jwt({ exp: NOW / 1000 });
    expect(isTokenExpired(token, NOW - 1)).toBe(false);
    expect(isTokenExpired(token, NOW)).toBe(true);
  });
});

describe("msUntilExpiry", () => {
  it("returns the remaining time, clamped at 0", () => {
    const token = jwt({ exp: NOW / 1000 });
    expect(msUntilExpiry(token, NOW - 5000)).toBe(5000);
    expect(msUntilExpiry(token, NOW + 5000)).toBe(0);
  });

  it("skips scheduling when there is no exp or it is beyond setTimeout's range", () => {
    expect(msUntilExpiry(jwt({}), NOW)).toBeNull();
    expect(msUntilExpiry(jwt({ exp: NOW / 1000 + 60 * 60 * 24 * 30 }), NOW)).toBeNull();
  });
});

describe("isSessionExpiredResponse", () => {
  it("flags a 401 from the API", () => {
    expect(isSessionExpiredResponse(`${API_BASE_URL}/api/v1/alerts/`, 401)).toBe(true);
  });

  it("ignores other statuses, auth endpoints and other hosts", () => {
    expect(isSessionExpiredResponse(`${API_BASE_URL}/api/v1/alerts/`, 403)).toBe(false);
    expect(isSessionExpiredResponse(`${API_BASE_URL}/api/v1/company/user/auth/login`, 401)).toBe(false);
    expect(isSessionExpiredResponse(`${API_BASE_URL}/api/v1/company/user/auth/2fa/login/t/1`, 401)).toBe(false);
    expect(isSessionExpiredResponse("https://example.com/api", 401)).toBe(false);
    expect(isSessionExpiredResponse(undefined, 401)).toBe(false);
  });
});

describe("installSessionExpiryHandler", () => {
  let uninstall;
  afterEach(() => uninstall?.());

  const install = (fetchStatus) => {
    const onExpired = vi.fn();
    window.fetch = vi.fn(async () => ({ status: fetchStatus }));
    uninstall = installSessionExpiryHandler(onExpired);
    return onExpired;
  };

  it("fires on a 401 from fetch and still returns the response", async () => {
    const onExpired = install(401);
    const res = await window.fetch(`${API_BASE_URL}/api/v1/alerts/`);
    expect(res.status).toBe(401);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("handles URL and Request-like inputs", async () => {
    const onExpired = install(401);
    await window.fetch(new URL(`${API_BASE_URL}/api/v1/alerts/`));
    await window.fetch({ url: `${API_BASE_URL}/api/v1/alerts/` });
    expect(onExpired).toHaveBeenCalledTimes(2);
  });

  it("does not fire for a wrong password on login", async () => {
    const onExpired = install(401);
    await window.fetch(`${API_BASE_URL}/api/v1/company/user/auth/login`, { method: "POST" });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("restores fetch on cleanup", async () => {
    const onExpired = install(401);
    const wrapped = window.fetch;
    uninstall();
    uninstall = null;
    expect(window.fetch).not.toBe(wrapped);
    await window.fetch(`${API_BASE_URL}/api/v1/alerts/`);
    expect(onExpired).not.toHaveBeenCalled();
  });

  const reject401 = async (config) => {
    throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
      status: 401, data: {}, headers: {}, config,
    });
  };

  it("fires on a 401 from axios and still rejects", async () => {
    const onExpired = install(200);
    await expect(
      axios.get(`${API_BASE_URL}/api/v1/alerts/`, { adapter: reject401 })
    ).rejects.toThrow("Unauthorized");
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("covers axios.create() instances once attached", async () => {
    const onExpired = install(200);
    const api = attachSessionInterceptor(
      axios.create({ baseURL: `${API_BASE_URL}/api/v1/company/HR_and_CRM/crm/` })
    );
    await expect(api.get("details/", { adapter: reject401 })).rejects.toThrow();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
