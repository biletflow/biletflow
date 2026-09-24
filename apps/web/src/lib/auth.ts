import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer } from "better-auth/plugins";
import { prisma } from "@biletflow/db";
import { signInSchema, signUpSchema } from "@biletflow/shared";
import {
  hashPassword,
  verifyPassword,
} from "@biletflow/shared/password.server";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Keep IDs compatible with the existing Prisma cuid() defaults.
  advanced: { database: { generateId: false } },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 200,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
  },
  user: {
    additionalFields: {
      role: {
        type: ["ATTENDEE", "ORGANIZER", "PLATFORM_ADMIN"],
        defaultValue: "ATTENDEE",
        input: false,
      },
      status: {
        type: ["ACTIVE", "SUSPENDED"],
        defaultValue: "ACTIVE",
        input: false,
      },
      locale: { type: ["kk", "ru", "en"], defaultValue: "ru" },
    },
  },
  session: { cookieCache: { enabled: false } },
  rateLimit: { enabled: true },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const schema =
        ctx.path === "/sign-up/email"
          ? signUpSchema
          : ctx.path === "/sign-in/email"
            ? signInSchema
            : null;
      if (!schema) return;
      // Native clients omit Origin; browser logins must come from our web app.
      const origin = ctx.headers?.get("origin");
      if (origin && origin !== new URL(baseURL).origin) {
        throw new APIError("FORBIDDEN", {
          code: "FORBIDDEN",
          message: "FORBIDDEN",
        });
      }
      const parsed = schema.safeParse(ctx.body);
      if (!parsed.success) {
        throw new APIError("BAD_REQUEST", {
          code: "VALIDATION_FAILED",
          message: "VALIDATION_FAILED",
        });
      }
      return { context: { body: { ...ctx.body, ...parsed.data } } };
    }),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });
          if (!user || user.status !== "ACTIVE") {
            throw new APIError("FORBIDDEN", {
              code: "FORBIDDEN",
              message: "FORBIDDEN",
            });
          }
        },
      },
    },
  },
  plugins: [bearer()],
});
