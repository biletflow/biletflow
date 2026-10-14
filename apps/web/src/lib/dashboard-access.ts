import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/session";

type DashboardRole = "ORGANIZER" | "PLATFORM_ADMIN";

export async function requireDashboardAccess(
  locale: string,
  role: DashboardRole,
) {
  try {
    await requireRole(await headers(), [role]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/${locale}/sign-in`);
    }
    if (error instanceof ApiError && error.status === 403) {
      redirect(`/${locale}`);
    }
    throw error;
  }
}
