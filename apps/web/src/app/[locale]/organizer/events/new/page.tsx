import { setRequestLocale } from "next-intl/server";
import EventEditor from "@/components/organizer/event-editor";
import { requirePageRole } from "@/lib/auth-guard";

export default async function NewOrganizerEventPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePageRole(locale, ["ORGANIZER"]);
  return <EventEditor locale={locale} />;
}
