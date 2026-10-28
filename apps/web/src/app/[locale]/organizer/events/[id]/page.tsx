import { setRequestLocale } from "next-intl/server";
import EventEditor from "@/components/organizer/event-editor";
import { requirePageRole } from "@/lib/auth-guard";

export default async function EditOrganizerEventPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requirePageRole(locale, ["ORGANIZER"]);
  return <EventEditor locale={locale} eventId={id} />;
}
