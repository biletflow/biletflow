import { NextResponse } from "next/server";

import { routing } from "@/i18n/routing";

/** Campaign QR landing: `/e/:slug?c=token` → localized event page with the token. */
export function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return context.params.then(({ slug }) => {
    const incoming = new URL(request.url);
    const target = new URL(
      `/${routing.defaultLocale}/events/${encodeURIComponent(slug)}`,
      incoming.origin,
    );
    const token = incoming.searchParams.get("c");
    if (token) target.searchParams.set("c", token);
    return NextResponse.redirect(target, 307);
  });
}
