import { headers } from "next/headers";

import { redirect } from "@/i18n/navigation";
import { auth } from "./auth";
import {
  homePathForRole,
  roleOf,
  type SessionRole,
} from "./auth-home";

export { roleOf, type SessionRole } from "./auth-home";

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requirePageRole(locale: string, roles: readonly SessionRole[]) {
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
