import { signInSchema } from "@biletflow/shared";
import { auth } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/api-error";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = signInSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_FAILED");

    // Use the HTTP handler so Better Auth's origin checks and rate limiting run.
    // Preserve Origin rather than manufacturing a trusted one for the caller.
    const headers = new Headers(request.headers);
    headers.set("Content-Type", "application/json");
    headers.delete("content-length");
    headers.delete("cookie");
    headers.delete("authorization");
    const result = await auth.handler(
      new Request(
        new URL(
          "/api/auth/sign-in/email",
          process.env.BETTER_AUTH_URL ?? request.url,
        ),
        { method: "POST", headers, body: JSON.stringify(parsed.data) },
      ),
    );
    if (!result.ok) {
      const code =
        result.status === 429
          ? "RATE_LIMITED"
          : result.status === 403
            ? "FORBIDDEN"
            : result.status >= 500
              ? "INTERNAL_ERROR"
              : "UNAUTHENTICATED";
      const response = errorResponse(new ApiError(result.status, code));
      const retryAfter = result.headers.get("retry-after");
      if (retryAfter) response.headers.set("Retry-After", retryAfter);
      return response;
    }

    const token = result.headers.get("set-auth-token");
    if (!token) throw new Error("Missing bearer token");
    const user = await requireUser(
      new Headers({ Authorization: `Bearer ${token}` }),
    );
    // Native clients receive a token, not a browser cookie or a password hash.
    return Response.json(
      { token, user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
