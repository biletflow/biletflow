import { describe, expect, it } from "vitest";
import { eventCalendar, mapsUrl } from "./calendar";

const event = { id: "event1", title: "A, B; C\nD", startsAt: new Date("2026-11-28T10:00:00+05:00"), endsAt: new Date("2026-11-28T12:00:00+05:00"), updatedAt: new Date("2026-11-27T18:00:00Z"), status: "PUBLISHED", venue: null };
describe("calendar export", () => {
  it("keeps stable identity, UTC times and escaped text", () => {
    const result = eventCalendar(event);
    expect(result).toContain("UID:event1@biletflow\r\n");
    expect(result).toContain("DTSTART:20261128T050000Z");
    expect(result).toContain("SUMMARY:A\\, B\\; C\\nD");
    expect(eventCalendar({ ...event, status: "CANCELLED" })).toContain("STATUS:CANCELLED");
  });
  it("encodes map query", () => {
    expect(new URL(mapsUrl("Astana, Kazakhstan")).searchParams.get("query")).toBe("Astana, Kazakhstan");
  });
});
