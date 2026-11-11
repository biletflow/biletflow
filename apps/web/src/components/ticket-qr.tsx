"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function TicketQr({
  src,
  alt,
  show,
}: {
  src: string;
  alt: string;
  show: boolean;
}) {
  const t = useTranslations("tickets");
  const [failed, setFailed] = useState(false);

  if (!show) {
    return (
      <p className="text-ink-600 border-ink-200 flex size-40 shrink-0 items-center rounded-lg border border-dashed bg-white p-3 text-center text-xs">
        {t("qrUnavailable")}
      </p>
    );
  }

  if (failed) {
    return (
      <p
        role="alert"
        className="text-error border-ink-200 flex size-40 shrink-0 items-center rounded-lg border bg-white p-3 text-center text-xs"
      >
        {t("qrFailed")}
      </p>
    );
  }

  return (
    // Session cookie must go with the PNG; next/image fetches without it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={160}
      height={160}
      onError={() => setFailed(true)}
      className="border-ink-200 size-40 shrink-0 rounded-lg border bg-white p-2"
    />
  );
}
