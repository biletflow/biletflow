import { prisma, type UserRole } from "@biletflow/db";
import { auth } from "./auth";
import { ApiError } from "./api-error";

export async function requireUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new ApiError(401, "UNAUTHENTICATED");

  // Read current permissions: suspension must also block existing sessions.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      status: true,
      locale: true,
      organizerProfile: {
        select: { id: true, displayName: true, verificationStatus: true },
      },
      staffAssignments: { select: { eventId: true, role: true } },
    },
  });
  if (!user) throw new ApiError(401, "UNAUTHENTICATED");
  if (user.status !== "ACTIVE") throw new ApiError(403, "FORBIDDEN");
  return user;
}

export async function requireRole(
  headers: Headers,
  roles: readonly UserRole[],
) {
  const user = await requireUser(headers);
  if (!roles.includes(user.role)) throw new ApiError(403, "FORBIDDEN");
  return user;
}
