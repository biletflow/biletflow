export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  updatedAt: Date;
  status: string;
  venue: { name: string; address: string; city: string; country: string } | null;
};

export function eventLocation(event: Pick<CalendarEvent, "venue">) {
  const venue = event.venue;
  return venue ? [venue.name, venue.address, venue.city, venue.country].filter(Boolean).join(", ") : "";
}

export function mapsUrl(location: string) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location);
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function stamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldLine(line: string) {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += char;
    bytes += size;
  }
  return result;
}

export function eventCalendar(event: CalendarEvent) {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BiletFlow//Events//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + escapeText(event.id) + "@biletflow",
    "DTSTAMP:" + stamp(event.updatedAt),
    "LAST-MODIFIED:" + stamp(event.updatedAt),
    "DTSTART:" + stamp(event.startsAt),
    "DTEND:" + stamp(event.endsAt),
    "SUMMARY:" + escapeText(event.title),
    "LOCATION:" + escapeText(eventLocation(event)),
    "STATUS:" + (event.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"),
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(foldLine).join("\r\n");
}
