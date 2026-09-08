/**
 * Single source of truth for request validation. Route handlers, web forms, and the
 * scanner app all parse against these, so a rule is never enforced in only one layer.
 */

import { z } from "zod";

export const LOCALES = ["kk", "ru", "en"] as const;
export const localeSchema = z.enum(LOCALES);

// --- Auth -------------------------------------------------------------------

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
  locale: localeSchema.default("ru"),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

// --- Organizer profile ------------------------------------------------------

export const organizerProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  contactEmail: z.string().trim().toLowerCase().email(),
  contactPhone: z.string().trim().max(32).optional(),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
});

export const payoutAccountSchema = z.object({
  holderName: z.string().trim().min(2).max(120),
  bankName: z.string().trim().min(2).max(120),
  ibanLast4: z.string().regex(/^\d{4}$/, "Enter the last four digits only"),
});

// --- Events -----------------------------------------------------------------

export const eventVisibilitySchema = z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]);
export const seatingModeSchema = z.enum(["GENERAL_ADMISSION", "ASSIGNED"]);
export const refundPolicySchema = z.enum([
  "NO_REFUNDS",
  "UNTIL_48H_BEFORE",
  "UNTIL_24H_BEFORE",
]);

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(20000).optional(),
    category: z.string().trim().max(60).optional(),
    coverImageUrl: z.string().url().optional(),
    venueId: z.string().cuid().optional(),
    visibility: eventVisibilitySchema.default("PUBLIC"),
    seatingMode: seatingModeSchema.default("GENERAL_ADMISSION"),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    timezone: z.string().default("Asia/Almaty"),
    registrationOpensAt: z.coerce.date().optional(),
    registrationClosesAt: z.coerce.date().optional(),
    capacity: z.number().int().positive().max(1_000_000).optional(),
    refundPolicy: refundPolicySchema.default("NO_REFUNDS"),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: "Event must end after it starts",
    path: ["endsAt"],
  })
  .refine(
    (v) =>
      !v.registrationOpensAt ||
      !v.registrationClosesAt ||
      v.registrationClosesAt > v.registrationOpensAt,
    { message: "Registration must close after it opens", path: ["registrationClosesAt"] },
  );

// --- Ticket types -----------------------------------------------------------

export const ticketTypeInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    priceKzt: z.number().int().min(0).max(100_000_000),
    quantity: z.number().int().positive().max(1_000_000),
    maxPerOrder: z.number().int().positive().max(100).default(10),
    salesStartAt: z.coerce.date().optional(),
    salesEndAt: z.coerce.date().optional(),
    isHidden: z.boolean().default(false),
  })
  .refine((v) => !v.salesStartAt || !v.salesEndAt || v.salesEndAt > v.salesStartAt, {
    message: "Sales must end after they start",
    path: ["salesEndAt"],
  });

// --- Checkout ---------------------------------------------------------------

export const attendeeDetailsSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(32).optional(),
});

export const checkoutItemSchema = z.object({
  ticketTypeId: z.string().cuid(),
  quantity: z.number().int().positive().max(100),
  seatIds: z.array(z.string().cuid()).optional(),
});

export const createOrderSchema = z.object({
  eventId: z.string().cuid(),
  items: z.array(checkoutItemSchema).min(1).max(20),
  attendees: z.array(attendeeDetailsSchema).min(1).max(100),
  promoCode: z.string().trim().max(32).optional(),
  campaignToken: z.string().trim().max(64).optional(),
  // Required: replaying the same key must return the existing order, not create a second.
  clientIdempotencyKey: z.string().uuid(),
});

// --- Promotions -------------------------------------------------------------

export const campaignInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    discountType: z.enum(["PERCENT", "FIXED_KZT"]),
    discountValue: z.number().int().positive(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    maxRedemptions: z.number().int().positive().max(1_000_000).optional(),
    perUserLimit: z.number().int().positive().max(100).default(1),
    ticketTypeIds: z.array(z.string().cuid()).default([]),
  })
  .refine((v) => v.discountType !== "PERCENT" || v.discountValue <= 100, {
    message: "A percentage discount cannot exceed 100",
    path: ["discountValue"],
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, {
    message: "Campaign must end after it starts",
    path: ["endsAt"],
  });

export const applyPromoSchema = z.object({
  eventId: z.string().cuid(),
  code: z.string().trim().min(1).max(32).optional(),
  campaignToken: z.string().trim().min(1).max(64).optional(),
});

// --- Check-in ---------------------------------------------------------------

export const checkInSchema = z.object({
  eventId: z.string().cuid(),
  // The raw scanned string. The server classifies and verifies it; the client must
  // not pre-extract a ticket id, or a campaign token could be laundered into one.
  payload: z.string().min(1).max(512),
  deviceLabel: z.string().trim().max(80).optional(),
});

export const checkInResultSchema = z.object({
  result: z.enum([
    "VALID",
    "ALREADY_CHECKED_IN",
    "CANCELLED",
    "REFUNDED",
    "WRONG_EVENT",
    "NOT_A_TICKET",
    "INVALID",
  ]),
  ticket: z
    .object({
      id: z.string(),
      attendeeName: z.string(),
      ticketTypeName: z.string(),
      seatLabel: z.string().nullable(),
      checkedInAt: z.string().nullable(),
    })
    .optional(),
  message: z.string(),
});

export const reverseCheckInSchema = z.object({
  checkInRecordId: z.string().cuid(),
  reason: z.string().trim().min(3).max(500),
});

// --- Support ----------------------------------------------------------------

export const supportCategorySchema = z.enum([
  "TICKET_DELIVERY",
  "PAYMENT",
  "REFUND",
  "SEATING",
  "EVENT_INFORMATION",
  "CHECK_IN",
  "ACCOUNT",
  "TECHNICAL",
]);

export const supportStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "RESOLVED",
]);

export const createSupportCaseSchema = z.object({
  category: supportCategorySchema,
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(5000),
  eventId: z.string().cuid().optional(),
  orderId: z.string().cuid().optional(),
  ticketId: z.string().cuid().optional(),
});

export const postSupportMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

// --- Refunds and moderation -------------------------------------------------

export const refundOrderSchema = z.object({
  orderId: z.string().cuid(),
  reason: z.string().trim().max(500).optional(),
});

export const suspendSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

// --- Analytics --------------------------------------------------------------

export const analyticsQuerySchema = z.object({
  eventId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ticketTypeId: z.string().cuid().optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type TicketTypeInput = z.infer<typeof ticketTypeInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CampaignInput = z.infer<typeof campaignInputSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckInResult = z.infer<typeof checkInResultSchema>;
