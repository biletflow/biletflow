import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { setRequestLocale } from "next-intl/server";

import { listOrganizerEvents } from "@/lib/dashboard";

export default async function OrganizerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const events = await listOrganizerEvents();

  return (
    <main className="bg-ink-100 min-h-[70vh]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div>
          <p className="text-brand text-xs font-bold tracking-wider uppercase">Organizer</p>
          <h1 className="font-display text-ink-900 mt-1 text-3xl font-extrabold tracking-tight">
            Events
          </h1>
          <p className="text-ink-600 mt-2 text-sm">
            Seeded events available in the local BiletFlow database.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="border-ink-300 mt-8 rounded-xl border border-dashed bg-white p-12 text-center">
            <p className="text-ink-900 font-bold">No events found</p>
            <p className="text-ink-600 mt-1 text-sm">Run the database seed to populate this view.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => {
              const quantity = event.ticketTypes.reduce((sum, type) => sum + type.quantity, 0);
              const sold = event.ticketTypes.reduce((sum, type) => sum + type.sold, 0);
              const reserved = event.ticketTypes.reduce((sum, type) => sum + type.reserved, 0);
              const remaining = Math.max(0, quantity - sold - reserved);
              const organizer =
                event.organizer.organizerProfile?.displayName ?? event.organizer.name;

              return (
                <article key={event.id} className="border-ink-300 rounded-xl border bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-ink-500 text-xs font-semibold uppercase">{organizer}</p>
                      <h2 className="text-ink-900 mt-1 text-lg font-bold">{event.title}</h2>
                    </div>
                    <span className="bg-brand-tint text-brand rounded-full px-2.5 py-1 text-xs font-bold">
                      {event.status}
                    </span>
                  </div>

                  <div className="text-ink-600 mt-5 space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="size-4" aria-hidden />
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(event.startsAt)}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4" aria-hidden />
                      {event.venue ? `${event.venue.name}, ${event.venue.city}` : "Venue TBA"}
                    </p>
                    <p className="flex items-center gap-2">
                      <Ticket className="size-4" aria-hidden />
                      {sold} sold · {remaining} remaining
                    </p>
                  </div>

                  <div className="border-ink-200 mt-5 flex justify-between border-t pt-4 text-xs">
                    <span className="text-ink-500">{event.visibility}</span>
                    <span className="text-ink-700 font-semibold">
                      Capacity: {event.capacity ?? (quantity || "—")}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
