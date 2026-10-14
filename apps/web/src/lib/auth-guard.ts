import { headers } from "next/headers";

import { redirect } from "@/i18n/navigation";
import { ApiError } from "./api-error";
import { requireUser } from "./session";
import { homePathForRole, roleOf, type SessionRole } from "./auth-home";

export { roleOf, type SessionRole } from "./auth-home";

export async function getSessionUser() {
  try {
    // Pages and API routes must enforce the same current account status.
    return await requireUser(await headers());
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return null;
    }
    throw error;
  }
}

export async function requirePageRole(
  locale: string,
  roles: readonly SessionRole[],
) {
  const user = await getSessionUser();
  const role = roleOf(user);
  if (!user || !role) {
    redirect({ href: "/sign-in", locale });
    throw new Error("redirect");
  }
  if (!roles.includes(role)) {
    redirect({ href: homePathForRole(role), locale });
    throw new Error("redirect");
  }
  return { user, role };
}
