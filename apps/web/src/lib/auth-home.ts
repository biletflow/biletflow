export type SessionRole = "ATTENDEE" | "ORGANIZER" | "PLATFORM_ADMIN";

export function roleOf(user: unknown): SessionRole | undefined {
  if (!user || typeof user !== "object" || !("role" in user)) return;
  const role = (user as { role?: unknown }).role;
  if (role === "ATTENDEE" || role === "ORGANIZER" || role === "PLATFORM_ADMIN") {
    return role;
  }
}

export function homePathForRole(role: string | null | undefined) {
  if (role === "PLATFORM_ADMIN") return "/admin";
  if (role === "ORGANIZER") return "/organizer";
  return "/";
}

export function dashboardPathForRole(
  role: string | null | undefined,
): "/admin" | "/organizer" | undefined {
  if (role === "PLATFORM_ADMIN") return "/admin";
  if (role === "ORGANIZER") return "/organizer";
}

/** In-app path after sign-in. Rejects protocol-relative and absolute URLs. */
export function safeNextPath(value: string | null | undefined) {
  if (!value) return;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return;
  }
  return value;
}
