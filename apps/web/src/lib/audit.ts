import type { Prisma } from "@biletflow/db";

export type AuditInput = Pick<
  Prisma.AuditLogUncheckedCreateInput,
  | "actorUserId"
  | "eventId"
  | "action"
  | "entityType"
  | "entityId"
  | "description"
  | "metadata"
  | "ipAddress"
>;

// Pass the same transaction used by the mutation so both writes commit or roll back.
// Metadata must contain only explicitly selected, non-secret business fields.
export function audit(tx: Prisma.TransactionClient, entry: AuditInput) {
  return tx.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      eventId: entry.eventId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      description: entry.description,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
    },
  });
}
