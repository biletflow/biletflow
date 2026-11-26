import { NextResponse } from "next/server";

/** Campaign QR landing. */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const incoming = new URL(request.url);
  const params = new URLSearchParams();
  const token = incoming.searchParams.get("c");

  if (token) params.set("c", token);

  const query = params.toString();
  const target = `/events/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`;

  return new NextResponse(null, {
    status: 307,
    headers: { Location: target },
  });
}