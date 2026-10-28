import { ApiError } from "./api-error";

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

export function clientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip || undefined;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export function assertParsed<T>(
  parsed: { success: true; data: T } | { success: false },
): T {
  if (!parsed.success) throw new ApiError(400, "VALIDATION_FAILED");
  return parsed.data;
}
