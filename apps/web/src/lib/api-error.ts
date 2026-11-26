export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public reason?:
      "REGISTRATION_CLOSED" | "TICKET_SALES_CLOSED" | "PAID_SALES_INACTIVE",
  ) {
    super(code);
  }
}

export function errorResponse(error: unknown) {
  const known = error instanceof ApiError;
  const code = known ? error.code : "INTERNAL_ERROR";
  return Response.json(
    {
      error: { code, message: code, reason: known ? error.reason : undefined },
    },
    {
      status: known ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
