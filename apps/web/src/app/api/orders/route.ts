import { prisma } from "@biletflow/db";
import { createOrderSchema } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { createOrder, presentOrder } from "@/lib/checkout";
import { assertParsed, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        tickets: {
          include: {
            attendee: { select: { fullName: true, email: true } },
            ticketType: { select: { name: true } },
          },
        },
      },
    });
    return json({ orders: orders.map(presentOrder) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const input = assertParsed(createOrderSchema.safeParse(await readJson(request)));
    const order = await createOrder(user.id, input, request.headers);
    return json({ order }, order.status === "PAID" || order.status === "AWAITING_PAYMENT" ? 201 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}
