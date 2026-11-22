import { prisma } from "@biletflow/db";

import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(request.headers, ["PLATFORM_ADMIN"]);
    const activations = await prisma.paidSalesActivation.findMany({
      where: { reviewedById: null, termsAcceptedAt: { not: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        feePaid: true,
        identityVerified: true,
        payoutAccountConnected: true,
        event: { select: { title: true } },
        organizer: { select: { name: true } },
      },
    });
    return json({ activations });
  } catch (error) {
    return errorResponse(error);
  }
}
