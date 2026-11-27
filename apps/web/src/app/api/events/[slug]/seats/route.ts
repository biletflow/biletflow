import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { listFreeSeats } from "@/lib/seats";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    return json(await listFreeSeats(slug, new URL(request.url).searchParams.get("view") === "all"));
  } catch (error) {
    return errorResponse(error);
  }
}
