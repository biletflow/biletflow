import { formatKzt } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { paymentPage, processPaymentWebhook } from "@/lib/payments";
import { signWebhookBody } from "@/lib/payments-signature";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f7f4ff; color: #0f0f1a; }
    main { max-width: 32rem; margin: 0 auto; padding: 2.5rem 1.25rem; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 1.25rem; padding: 1.5rem; }
    .badge { display: inline-block; background: #fffbeb; color: #92400e; border-radius: 999px; padding: 0.2rem 0.7rem; font-size: 0.8rem; font-weight: 700; }
    h1 { font-size: 1.6rem; margin: 0.8rem 0 0.3rem; }
    p { color: #374151; line-height: 1.5; }
    .amount { font-size: 2rem; font-weight: 750; margin: 0.5rem 0 1rem; }
    form { display: inline; }
    button { border: 0; border-radius: 999px; padding: 0.75rem 1rem; font-weight: 700; cursor: pointer; margin: 0.3rem 0.3rem 0 0; }
    .approve { background: #10b981; color: white; }
    .decline { background: #ef4444; color: white; }
    .abandon { background: #e5e7eb; color: #1f2937; }
  </style>
</head>
<body>
  <main>
    <article class="card">
      <span class="badge">Simulated payment</span>
      ${body}
      <p>No real money moves. This gateway only exists so the demo can approve, decline, or abandon a payment.</p>
    </article>
  </main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function buttons(intentId: string) {
  const action = `/sandbox/pay/${encodeURIComponent(intentId)}`;
  return ["APPROVED", "DECLINED", "ABANDONED"]
    .map((outcome) => {
      const label = outcome === "APPROVED" ? "Approve" : outcome === "DECLINED" ? "Decline" : "Abandon";
      const tone = outcome === "APPROVED" ? "approve" : outcome === "DECLINED" ? "decline" : "abandon";
      return `<form method="post" action="${action}"><input type="hidden" name="outcome" value="${outcome}" /><button class="${tone}" type="submit">${label}</button></form>`;
    })
    .join("");
}

export async function GET(_request: Request, context: { params: Promise<{ intentId: string }> }) {
  const { intentId } = await context.params;
  const payment = await paymentPage(intentId);
  if (!payment) return page("Payment not found", "<h1>Payment not found</h1>", 404);
  const subject = payment.order?.reference ?? payment.activation?.event.title ?? "BiletFlow";
  return page(
    "Simulated payment",
    `<h1>Pay ${escapeHtml(subject)}</h1>
     <p class="amount">${escapeHtml(formatKzt(payment.amountKzt))}</p>
     <p>Status: ${escapeHtml(payment.status)}</p>
     ${payment.status === "CREATED" ? buttons(intentId) : ""}`,
  );
}

export async function POST(request: Request, context: { params: Promise<{ intentId: string }> }) {
  try {
    const { intentId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    let outcome = "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as { outcome?: string } | null;
      outcome = body?.outcome ?? "";
    } else {
      const form = await request.formData();
      outcome = String(form.get("outcome") ?? "");
    }
    if (outcome !== "APPROVED" && outcome !== "DECLINED" && outcome !== "ABANDONED") {
      return page("Simulated payment", "<h1>Choose Approve, Decline, or Abandon</h1>", 400);
    }
    const payload = JSON.stringify({
      intentId,
      outcome,
      eventKey: `${intentId}:${outcome}`,
    });
    const result = await processPaymentWebhook(payload, signWebhookBody(payload));
    if (contentType.includes("application/json")) {
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    const label = outcome === "APPROVED" ? "approved" : outcome === "DECLINED" ? "declined" : "abandoned";
    const ticketsNote =
      result.tickets > 0
        ? `<p>Tickets were issued.</p><p><a href="/tickets">View tickets</a></p>`
        : `<p>No ticket was issued.</p>`;
    return page(
      "Simulated payment",
      `<h1>Payment ${label}</h1>${ticketsNote}`,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
