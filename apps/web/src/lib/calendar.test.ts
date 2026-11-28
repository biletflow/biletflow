import { describe, expect, it } from "vitest";
import { eventCalendar, mapsUrl } from "./calendar";

const event = { id: "event1", title: "A, B; C\nD", startsAt: new Date("2026-11-28T10:00:00+05:00"), endsAt: new Date("2026-11-28T12:00:00+05:00"), updatedAt: new Date("2026-11-27T18:00:00Z"), status: "PUBLISHED", calendarSequence: 2, venue: null };
describe("calendar export", () => {
  it("keeps stable identity, UTC times and escaped text", () => {
    const result = eventCalendar(event);
    expect(result).toContain("UID:event1@biletflow\r\n");
    expect(result).toContain("SEQUENCE:2\r\n");
    expect(result).toContain("DTSTART:20261128T050000Z");
    expect(result).toContain("SUMMARY:A\\, B\\; C\\nD");
    const cancelled = eventCalendar({
      ...event,
      status: "CANCELLED",
      calendarSequence: 4,
      description: "Venue closed",
      url: "https://biletflow.kz/ru/events/jazz",
    });
    expect(cancelled).toContain("STATUS:CANCELLED");
    expect(cancelled).toContain("SEQUENCE:4\r\n");
    expect(cancelled).toContain("DESCRIPTION:Venue closed");
    expect(cancelled).toContain("URL:https://biletflow.kz/ru/events/jazz");
  });
  it("encodes map query", () => {
    expect(new URL(mapsUrl("Astana, Kazakhstan")).searchParams.get("query")).toBe("Astana, Kazakhstan");
  });
});
