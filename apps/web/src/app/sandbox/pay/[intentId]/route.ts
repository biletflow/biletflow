import { formatKzt } from "@biletflow/shared";

import { errorResponse } from "@/lib/api-error";
import { paymentPage, processPaymentWebhook } from "@/lib/payments";
import { signWebhookBody } from "@/lib/payments-signature";

export const runtime = "nodejs";

const copy = {
  en: {
    badge: "Simulated payment",
    pay: "Pay",
    notFound: "Payment not found",
    choose: "Choose Approve, Decline, or Abandon",
    waiting: "Waiting for you to confirm this simulated payment.",
    processing: "This payment is still processing.",
    succeeded: "This payment already succeeded.",
    failed: "This payment was declined.",
    abandoned: "This payment was cancelled.",
    refunded: "This payment was refunded.",
    approve: "Approve",
    decline: "Decline",
    abandon: "Abandon",
    footnote:
      "No real money moves. This gateway only exists so the demo can approve, decline, or abandon a payment.",
    approvedTickets: "Payment approved. Your tickets are ready.",
    approvedTicketsBody: "Open My tickets to show the admission QR at the door.",
    viewTickets: "View tickets",
    declined: "Payment declined. No ticket was issued and you were not charged.",
    cancelledPay: "You cancelled this payment. No ticket was issued.",
    expired: "The checkout hold expired, so no ticket was issued.",
    tryAgain: "Try checkout again",
    browse: "Browse events",
    approvedFee: "Activation fee paid.",
    declinedFee: "Activation fee was not paid. Paid sales stay inactive until this succeeds.",
    backOrganizer: "Back to organizer",
    alreadyDone: "This simulated payment is already finished.",
  },
  ru: {
    badge: "Симуляция оплаты",
    pay: "Оплата",
    notFound: "Платёж не найден",
    choose: "Выберите «Одобрить», «Отклонить» или «Отменить»",
    waiting: "Подтвердите этот тестовый платёж.",
    processing: "Платёж ещё обрабатывается.",
    succeeded: "Этот платёж уже прошёл.",
    failed: "Этот платёж отклонён.",
    abandoned: "Этот платёж отменён.",
    refunded: "Этот платёж возвращён.",
    approve: "Одобрить",
    decline: "Отклонить",
    abandon: "Отменить",
    footnote:
      "Реальных списаний нет. Шлюз нужен только чтобы в демо одобрить, отклонить или отменить оплату.",
    approvedTickets: "Оплата прошла. Билеты готовы.",
    approvedTicketsBody: "Откройте «Мои билеты» и покажите QR на входе.",
    viewTickets: "Мои билеты",
    declined: "Оплата отклонена. Билет не выдан, списания не было.",
    cancelledPay: "Вы отменили оплату. Билет не выдан.",
    expired: "Время брони истекло, поэтому билет не выдан.",
    tryAgain: "Повторить оформление",
    browse: "К мероприятиям",
    approvedFee: "Взнос за активацию оплачен.",
    declinedFee: "Взнос не оплачен. Платные продажи останутся выключены, пока оплата не пройдёт.",
    backOrganizer: "К кабинету организатора",
    alreadyDone: "Этот тестовый платёж уже завершён.",
  },
  kk: {
    badge: "Сынақ төлемі",
    pay: "Төлеу",
    notFound: "Төлем табылмады",
    choose: "Мақұлдау, Қабылдамау немесе Бас тартуды таңдаңыз",
    waiting: "Осы сынақ төлемін растаңыз.",
    processing: "Төлем әлі өңделуде.",
    succeeded: "Бұл төлем қазірдің өзінде өтті.",
    failed: "Бұл төлем қабылданбады.",
    abandoned: "Бұл төлем тоқтатылды.",
    refunded: "Бұл төлем қайтарылды.",
    approve: "Мақұлдау",
    decline: "Қабылдамау",
    abandon: "Бас тарту",
    footnote:
      "Нақты ақша қозғалмайды. Шлюз демода төлемді мақұлдау, қабылдамау немесе тоқтату үшін ғана бар.",
    approvedTickets: "Төлем өтті. Билеттер дайын.",
    approvedTicketsBody: "«Менің билеттерім» бетін ашып, кіреберісте QR көрсетіңіз.",
    viewTickets: "Менің билеттерім",
    declined: "Төлем қабылданбады. Билет берілген жоқ, ақша шешілген жоқ.",
    cancelledPay: "Сіз төлемнен бас тарттыңыз. Билет берілген жоқ.",
    expired: "Брондау уақыты бітті, сондықтан билет берілген жоқ.",
    tryAgain: "Рәсімдеуді қайталау",
    browse: "Іс-шаралар",
    approvedFee: "Іске қосу жарнасы төленді.",
    declinedFee: "Жарна төленген жоқ. Төлем өткенше ақылы сатылым жабық қалады.",
    backOrganizer: "Ұйымдастырушыға қайту",
    alreadyDone: "Бұл сынақ төлемі әлдеқашан аяқталған.",
  },
} as const;

type Locale = keyof typeof copy;

function localeOf(request: Request): Locale {
  const url = new URL(request.url);
  const query = url.searchParams.get("locale");
  if (query === "ru" || query === "kk" || query === "en") return query;
  const match = (request.headers.get("cookie") ?? "").match(
    /(?:^|;\s*)NEXT_LOCALE=(en|ru|kk)/,
  );
  return match?.[1] === "ru" || match?.[1] === "kk" ? match[1] : "en";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title: string, body: string, status = 200, locale: Locale = "en") {
  const html = `<!doctype html>
<html lang="${locale}">
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
    a { color: #5b21b6; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <article class="card">
      ${body}
    </article>
  </main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function statusMessage(
  t: (typeof copy)[Locale],
  status: string,
) {
  if (status === "CREATED") return t.waiting;
  if (status === "PROCESSING") return t.processing;
  if (status === "SUCCEEDED") return t.succeeded;
  if (status === "FAILED") return t.failed;
  if (status === "ABANDONED") return t.abandoned;
  if (status === "REFUNDED") return t.refunded;
  return t.alreadyDone;
}

function buttons(intentId: string, locale: Locale, t: (typeof copy)[Locale]) {
  const action = `/sandbox/pay/${encodeURIComponent(intentId)}?locale=${locale}`;
  return (
    [
      ["APPROVED", "approve", t.approve],
      ["DECLINED", "decline", t.decline],
      ["ABANDONED", "abandon", t.abandon],
    ] as const
  )
    .map(
      ([outcome, tone, label]) =>
        `<form method="post" action="${action}"><input type="hidden" name="outcome" value="${outcome}" /><button class="${tone}" type="submit">${escapeHtml(label)}</button></form>`,
    )
    .join("");
}

function eventHref(
  locale: Locale,
  payment: Awaited<ReturnType<typeof paymentPage>>,
) {
  const slug = payment?.order?.event.slug ?? payment?.activation?.event.slug;
  return slug ? `/${locale}/events/${encodeURIComponent(slug)}` : `/${locale}/events`;
}

function outcomeBody(
  t: (typeof copy)[Locale],
  locale: Locale,
  payment: NonNullable<Awaited<ReturnType<typeof paymentPage>>>,
  tickets: number,
) {
  if (payment.purpose === "ACTIVATION_FEE") {
    const next = `<p><a href="/${locale}/organizer">${escapeHtml(t.backOrganizer)}</a></p>`;
    if (payment.status === "SUCCEEDED") {
      return `<h1>${escapeHtml(t.approvedFee)}</h1>${next}`;
    }
    return `<h1>${escapeHtml(t.declinedFee)}</h1>${next}`;
  }
  const retry = `<p><a href="${eventHref(locale, payment)}">${escapeHtml(t.tryAgain)}</a></p>`;
  if (payment.status === "SUCCEEDED" && tickets > 0) {
    return `<h1>${escapeHtml(t.approvedTickets)}</h1><p>${escapeHtml(t.approvedTicketsBody)}</p><p><a href="/${locale}/tickets">${escapeHtml(t.viewTickets)}</a></p>`;
  }
  if (payment.order?.status === "EXPIRED") {
    return `<h1>${escapeHtml(t.expired)}</h1>${retry}`;
  }
  if (payment.status === "ABANDONED") {
    return `<h1>${escapeHtml(t.cancelledPay)}</h1>${retry}`;
  }
  return `<h1>${escapeHtml(t.declined)}</h1>${retry}`;
}

export async function GET(request: Request, context: { params: Promise<{ intentId: string }> }) {
  const locale = localeOf(request);
  const t = copy[locale];
  const { intentId } = await context.params;
  const payment = await paymentPage(intentId);
  if (!payment) {
    return page(
      t.notFound,
      `<span class="badge">${escapeHtml(t.badge)}</span><h1>${escapeHtml(t.notFound)}</h1>`,
      404,
      locale,
    );
  }
  const subject = payment.order?.reference ?? payment.activation?.event.title ?? "BiletFlow";
  const next =
    payment.status === "SUCCEEDED" && payment.purpose === "TICKET_ORDER"
      ? `<p><a href="/${locale}/tickets">${escapeHtml(t.viewTickets)}</a></p>`
      : payment.status !== "CREATED"
        ? `<p><a href="${eventHref(locale, payment)}">${escapeHtml(t.browse)}</a></p>`
        : "";
  return page(
    t.badge,
    `<span class="badge">${escapeHtml(t.badge)}</span>
     <h1>${escapeHtml(t.pay)} ${escapeHtml(subject)}</h1>
     <p class="amount">${escapeHtml(formatKzt(payment.amountKzt))}</p>
     <p>${escapeHtml(statusMessage(t, payment.status))}</p>
     ${payment.status === "CREATED" ? buttons(intentId, locale, t) : next}
     <p>${escapeHtml(t.footnote)}</p>`,
    200,
    locale,
  );
}

export async function POST(request: Request, context: { params: Promise<{ intentId: string }> }) {
  try {
    const locale = localeOf(request);
    const t = copy[locale];
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
      return page(
        t.badge,
        `<span class="badge">${escapeHtml(t.badge)}</span><h1>${escapeHtml(t.choose)}</h1>`,
        400,
        locale,
      );
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
    const payment = await paymentPage(intentId);
    if (!payment) {
      return page(
        t.notFound,
        `<span class="badge">${escapeHtml(t.badge)}</span><h1>${escapeHtml(t.notFound)}</h1>`,
        404,
        locale,
      );
    }
    const body = result.ignored
      ? `<span class="badge">${escapeHtml(t.badge)}</span><h1>${escapeHtml(t.alreadyDone)}</h1>`
      : `<span class="badge">${escapeHtml(t.badge)}</span>${outcomeBody(t, locale, payment, result.tickets)}`;
    return page(t.badge, `${body}<p>${escapeHtml(t.footnote)}</p>`, 200, locale);
  } catch (error) {
    return errorResponse(error);
  }
}
