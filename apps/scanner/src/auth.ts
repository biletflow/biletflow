import type { CheckInResult } from "@biletflow/shared";
import type { MessageKey } from "./messages";
export const TOKEN_KEY = "biletflow.scanner.token";
export type ScannerEvent = { id: string; title: string; startsAt: string; endsAt: string; status: string };
export type ScannerUser = {
  email: string;
  name: string;
  staffAssignments: { eventId: string; role: string }[];
};
export type AuthState = {
  phase: "checking" | "signedOut" | "ready" | "retry";
  user?: ScannerUser;
  error?: MessageKey;
};
type Storage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

// Scanner access comes from event assignments, not a hardcoded email or global role.
function scannerUser(value: unknown): ScannerUser | null {
  if (!value || typeof value !== "object") return null;
  const user = value as ScannerUser;
  return typeof user.email === "string" &&
    typeof user.name === "string" &&
    Array.isArray(user.staffAssignments) &&
    user.staffAssignments.some(
      (assignment) =>
        assignment &&
        typeof assignment.eventId === "string" &&
        assignment.role === "EVENT_ADMIN",
    )
    ? user
    : null;
}

export function createScannerAuth(
  storage: Storage,
  baseUrl: string,
  request: typeof fetch = fetch,
) {
  let state: AuthState = { phase: "checking" };
  let token: string | null = null;
  let generation = 0;
  let logoutRequested = false;
  let pending: Promise<void> | undefined;
  let retry: () => Promise<void> = restore;
  const listeners = new Set<() => void>();
  function publish(next: AuthState) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  async function api(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      return await request(`${baseUrl.replace(/\/+$/, "")}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch {
      throw new Error("network");
    } finally {
      clearTimeout(timer);
    }
  }
  function run(
    task: (version: number) => Promise<void>,
    failure: "signedOut" | "retry",
  ) {
    if (pending) return pending;
    const version = ++generation;
    publish({ phase: "checking" });
    pending = task(version)
      .catch((error) => {
        if (version === generation)
          publish({
            phase: failure,
            error:
              error instanceof Error &&
              [
                "network",
                "verify",
                "access",
                "credentials",
                "rate",
                "failed",
              ].includes(error.message)
                ? (error.message as MessageKey)
                : "storage",
          });
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  }
  async function restore(): Promise<void> {
    if (logoutRequested) return logout();
    retry = restore;
    return run(async (version) => {
      const saved = token ?? (await storage.getItemAsync(TOKEN_KEY));
      if (!saved) {
        publish({ phase: "signedOut" });
        return;
      }
      const response = await api("/api/me", {
        headers: { Authorization: `Bearer ${saved}` },
      });
      if (version !== generation) return;
      if (response.status === 401 || response.status === 403) {
        await storage.deleteItemAsync(TOKEN_KEY);
        token = null;
        publish({ phase: "signedOut", error: "ended" });
        return;
      }
      if (!response.ok) throw new Error("verify");
      const data = await response.json().catch(() => {
        throw new Error("verify");
      });
      const user = scannerUser(data?.user);
      if (version !== generation) return;
      if (!user) {
        await storage.deleteItemAsync(TOKEN_KEY);
        token = null;
        publish({ phase: "signedOut", error: "access" });
        return;
      }
      if (version === generation) {
        token = saved;
        publish({ phase: "ready", user });
      }
    }, "retry");
  }
  function login(email: string, password: string) {
    return run(async (version) => {
      const response = await api("/api/mobile/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "credentials"
            : response.status === 429
              ? "rate"
              : "failed",
        );
      const data = await response.json().catch(() => {
        throw new Error("failed");
      });
      const user = scannerUser(data?.user);
      if (!user || typeof data?.token !== "string" || !data.token.trim())
        throw new Error("access");
      if (version !== generation) return;
      await storage.setItemAsync(TOKEN_KEY, data.token);
      if (version === generation) {
        token = data.token;
        publish({ phase: "ready", user });
      }
    }, "signedOut");
  }
  async function logout(): Promise<void> {
    logoutRequested = true;
    ++generation;
    token = null;
    publish({ phase: "checking" });
    // Wait for a pending storage write before clearing it, so it cannot resurrect a session.
    await pending;
    retry = logout;
    return run(async () => {
      await storage.deleteItemAsync(TOKEN_KEY);
      logoutRequested = false;
      publish({ phase: "signedOut" });
    }, "retry");
  }
  function suspend() {
    ++generation;
    if (state.phase !== "signedOut") publish({ phase: "checking" });
  }
  async function resume() {
    await pending;
    return restore();
  }
  async function getEvents(): Promise<ScannerEvent[]> {
    if (!token || state.phase !== "ready") throw new Error("Not authenticated");
    const response = await api("/api/mobile/events", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Unable to load events");
    const data = await response.json();
    if (!Array.isArray(data?.events)) throw new Error("Invalid response");
    return data.events as ScannerEvent[];
  }
  async function submitScan(eventId: string, payload: string): Promise<CheckInResult> {
    if (!token || state.phase !== "ready") throw new Error("Not authenticated");
    const response = await api("/api/checkin", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, payload }),
    });
    if (!response.ok) throw new Error("Server verification failed");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("result" in body) ||
      !("message" in body) || typeof body.message !== "string" ||
      !["VALID", "ALREADY_CHECKED_IN", "CANCELLED", "REFUNDED", "WRONG_EVENT", "NOT_A_TICKET", "INVALID"].includes(String(body.result))) {
      throw new Error("Invalid check-in response");
    }
    return body as CheckInResult;
  }
  return {
    submitScan,
    getEvents,
    resume,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    restore,
    login,
    logout,
    suspend,
    retry: () => retry(),
  };
}
