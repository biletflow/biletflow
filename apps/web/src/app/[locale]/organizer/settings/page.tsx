import { setRequestLocale } from "next-intl/server";

import OrganizerSettings from "@/components/organizer/organizer-settings";
import { requirePageRole } from "@/lib/auth-guard";

export default async function OrganizerSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePageRole(locale, ["ORGANIZER"]);
  return (
    <div className="bg-ink-100 min-h-[70vh]">
      <OrganizerSettings locale={locale} />
    </div>
  );
}
