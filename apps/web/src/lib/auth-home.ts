export function homePathForRole(role: string | null | undefined) {
  if (role === "PLATFORM_ADMIN") return "/admin";
  if (role === "ORGANIZER") return "/organizer";
  return "/";
}
