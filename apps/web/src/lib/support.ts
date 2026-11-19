import { randomBytes } from "node:crypto";

import { prisma, type Prisma, type UserRole } from "@biletflow/db";
import {
  createSupportCaseSchema,
  supportStatusSchema,
} from "@biletflow/shared";
import type { z } from "zod";

import { ApiError } from "./api-error";

type SessionUser = {
  id: string;
  role: UserRole;
  staffAssignments: { eventId: string; role: string }[];
};

type CreateInput = z.infer<typeof createSupportCaseSchema>;
type SupportStatus = z.infer<typeof supportStatusSchema>;

const caseInclude = {
  messages: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      body: true,
      isSystem: true,
      createdAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
  },
  event: { select: { id: true, title: true, slug: true, organizerId: true } },
  order: { select: { id: true, reference: true, userId: true } },
  ticket: { select: { id: true } },
  requester: { select: { id: true, name: true, role: true } },
  assignee: { select: { id: true, name: true, role: true } },
} satisfies Prisma.SupportCaseInclude;

export type SupportCaseRecord = Prisma.SupportCaseGetPayload<{
  include: typeof caseInclude;
}>;

function caseReference() {
  return `CASE-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function presentSupportCase(supportCase: SupportCaseRecord) {
  return {
    id: supportCase.id,
    reference: supportCase.reference,
    audience: supportCase.audience,
    category: supportCase.category,
    status: supportCase.status,
    subject: supportCase.subject,
    lastMessageAt: supportCase.lastMessageAt.toISOString(),
    resolvedAt: supportCase.resolvedAt?.toISOString() ?? null,
    createdAt: supportCase.createdAt.toISOString(),
    event: supportCase.event
      ? {
          id: supportCase.event.id,
          title: supportCase.event.title,
          slug: supportCase.event.slug,
        }
      : null,
    order: supportCase.order
      ? { id: supportCase.order.id, reference: supportCase.order.reference }
      : null,
    ticketId: supportCase.ticketId,
    requester: supportCase.requester,
    assignee: supportCase.assignee,
    messages: supportCase.messages.map((message) => ({
      id: message.id,
      body: message.body,
      isSystem: message.isSystem,
      createdAt: message.createdAt.toISOString(),
      author: message.author,
    })),
  };
}

function staffOnEvent(user: SessionUser, eventId: string | null | undefined) {
  if (!eventId) return false;
  if (user.role === "PLATFORM_ADMIN") return true;
  return user.staffAssignments.some((assignment) => assignment.eventId === eventId);
}

export async function canAccessSupportCase(
  user: SessionUser,
  supportCase: {
    requesterId: string;
    assigneeId: string | null;
    audience: string;
    eventId: string | null;
    event?: { organizerId: string } | null;
  },
) {
  if (user.role === "PLATFORM_ADMIN") return true;
  if (supportCase.requesterId === user.id) return true;
  if (supportCase.assigneeId === user.id) return true;

  const organizerId =
    supportCase.event?.organizerId ??
    (supportCase.eventId
      ? (
          await prisma.event.findUnique({
            where: { id: supportCase.eventId },
            select: { organizerId: true },
          })
        )?.organizerId
      : undefined);

  if (
    supportCase.audience === "ATTENDEE_TO_ORGANIZER" &&
    organizerId === user.id
  ) {
    return true;
  }

  if (
    supportCase.audience === "ATTENDEE_TO_ORGANIZER" &&
    staffOnEvent(user, supportCase.eventId)
  ) {
    return true;
  }

  return false;
}

export async function canManageSupportCase(
  user: SessionUser,
  supportCase: {
    audience: string;
    eventId: string | null;
    event?: { organizerId: string } | null;
  },
) {
  if (user.role === "PLATFORM_ADMIN") return true;
  if (supportCase.audience === "ORGANIZER_TO_PLATFORM") return false;

  const organizerId =
    supportCase.event?.organizerId ??
    (supportCase.eventId
      ? (
          await prisma.event.findUnique({
            where: { id: supportCase.eventId },
            select: { organizerId: true },
          })
        )?.organizerId
      : undefined);

  if (organizerId === user.id) return true;
  return staffOnEvent(user, supportCase.eventId);
}

function listWhere(user: SessionUser): Prisma.SupportCaseWhereInput {
  if (user.role === "PLATFORM_ADMIN") return {};

  const staffEventIds = user.staffAssignments.map((assignment) => assignment.eventId);
  const or: Prisma.SupportCaseWhereInput[] = [
    { requesterId: user.id },
    { assigneeId: user.id },
  ];

  if (user.role === "ORGANIZER") {
    or.push({ event: { organizerId: user.id } });
    or.push({
      audience: "ORGANIZER_TO_PLATFORM",
      requesterId: user.id,
    });
  }

  if (staffEventIds.length > 0) {
    or.push({ eventId: { in: staffEventIds } });
  }

  return { OR: or };
}

export async function listSupportCases(user: SessionUser) {
  return prisma.supportCase.findMany({
    where: listWhere(user),
    orderBy: { lastMessageAt: "desc" },
    include: caseInclude,
  });
}

export async function getSupportCaseOrThrow(user: SessionUser, caseId: string) {
  const supportCase = await prisma.supportCase.findUnique({
    where: { id: caseId },
    include: caseInclude,
  });
  if (!supportCase || !(await canAccessSupportCase(user, supportCase))) {
    throw new ApiError(404, "NOT_FOUND");
  }
  return supportCase;
}

async function assertLinkedResources(user: SessionUser, input: CreateInput) {
  let eventId = input.eventId ?? null;
  let orderId = input.orderId ?? null;
  const ticketId = input.ticketId ?? null;

  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, eventId: true },
    });
    if (!order) throw new ApiError(404, "NOT_FOUND");
    if (order.userId !== user.id && user.role !== "PLATFORM_ADMIN") {
      throw new ApiError(404, "NOT_FOUND");
    }
    eventId = eventId ?? order.eventId;
    if (eventId && eventId !== order.eventId) {
      throw new ApiError(400, "VALIDATION_FAILED");
    }
  }

  if (ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        eventId: true,
        orderId: true,
        order: { select: { userId: true } },
      },
    });
    if (!ticket) throw new ApiError(404, "NOT_FOUND");
    if (ticket.order.userId !== user.id && user.role !== "PLATFORM_ADMIN") {
      throw new ApiError(404, "NOT_FOUND");
    }
    eventId = eventId ?? ticket.eventId;
    orderId = orderId ?? ticket.orderId;
    if (
      (eventId && eventId !== ticket.eventId) ||
      (orderId && orderId !== ticket.orderId)
    ) {
      throw new ApiError(400, "VALIDATION_FAILED");
    }
  }

  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new ApiError(404, "NOT_FOUND");
  }

  return { eventId, orderId, ticketId };
}

export async function createSupportCase(user: SessionUser, input: CreateInput) {
  const links = await assertLinkedResources(user, input);

  const audience =
    user.role === "ORGANIZER" || user.role === "PLATFORM_ADMIN"
      ? links.orderId || links.ticketId
        ? "ATTENDEE_TO_ORGANIZER"
        : "ORGANIZER_TO_PLATFORM"
      : "ATTENDEE_TO_ORGANIZER";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.supportCase.create({
        data: {
          reference: caseReference(),
          audience,
          category: input.category,
          status: "OPEN",
          subject: input.subject,
          requesterId: user.id,
          eventId: links.eventId,
          orderId: links.orderId,
          ticketId: links.ticketId,
          messages: {
            create: {
              authorId: user.id,
              body: input.body,
            },
          },
        },
        include: caseInclude,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new ApiError(500, "INTERNAL_ERROR");
}

export async function postSupportMessage(
  user: SessionUser,
  caseId: string,
  body: string,
) {
  const supportCase = await getSupportCaseOrThrow(user, caseId);
  if (supportCase.status === "RESOLVED") {
    throw new ApiError(409, "CONFLICT");
  }

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        caseId: supportCase.id,
        authorId: user.id,
        body,
      },
    }),
    prisma.supportCase.update({
      where: { id: supportCase.id },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  return getSupportCaseOrThrow(user, caseId);
}

export async function updateSupportStatus(
  user: SessionUser,
  caseId: string,
  status: SupportStatus,
) {
  const supportCase = await getSupportCaseOrThrow(user, caseId);
  if (!(await canManageSupportCase(user, supportCase))) {
    throw new ApiError(404, "NOT_FOUND");
  }

  await prisma.$transaction([
    prisma.supportCase.update({
      where: { id: supportCase.id },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
        lastMessageAt: new Date(),
      },
    }),
    prisma.supportMessage.create({
      data: {
        caseId: supportCase.id,
        authorId: user.id,
        body: `Status changed to ${status}.`,
        isSystem: true,
      },
    }),
  ]);

  return getSupportCaseOrThrow(user, caseId);
}

export async function updateSupportAssignee(
  user: SessionUser,
  caseId: string,
  assigneeId: string | null,
) {
  const supportCase = await getSupportCaseOrThrow(user, caseId);
  if (!(await canManageSupportCase(user, supportCase))) {
    throw new ApiError(404, "NOT_FOUND");
  }

  if (assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, status: true },
    });
    if (!assignee || assignee.status !== "ACTIVE") {
      throw new ApiError(404, "NOT_FOUND");
    }
  }

  const label = assigneeId ? `Assigned to staff.` : `Assignee cleared.`;

  await prisma.$transaction([
    prisma.supportCase.update({
      where: { id: supportCase.id },
      data: { assigneeId, lastMessageAt: new Date() },
    }),
    prisma.supportMessage.create({
      data: {
        caseId: supportCase.id,
        authorId: user.id,
        body: label,
        isSystem: true,
      },
    }),
  ]);

  return getSupportCaseOrThrow(user, caseId);
}
