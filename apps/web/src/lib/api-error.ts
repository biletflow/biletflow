export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export function errorResponse(error: unknown) {
  const known = error instanceof ApiError;
  const code = known ? error.code : "INTERNAL_ERROR";
  return Response.json(
    { error: { code, message: code } },
    {
      status: known ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
