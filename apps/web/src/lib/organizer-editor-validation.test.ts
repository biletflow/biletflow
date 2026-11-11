import { describe, expect, it } from "vitest";
import { canPublish, hasEnoughInventory, validateEventDates } from "./organizer-editor-validation";

describe("organizer event editor validation", () => {
  it("requires both dates and a valid chronological order", () => {
    expect(validateEventDates("", "2026-11-15T15:00")).toBe("missing");
    expect(validateEventDates("2026-11-15T17:00", "2026-11-15T16:00")).toBe("order");
    expect(validateEventDates("2026-11-15T17:00", "2026-11-15T17:00")).toBe("order");
    expect(validateEventDates("2026-11-15T15:00", "2026-11-15T17:00")).toBeNull();
  });

  it("does not publish without a visible ticket type", () => {
    expect(canPublish([])).toBe(false);
    expect(canPublish([{ quantity: 100, isHidden: true }])).toBe(false);
    expect(canPublish([{ quantity: 0, isHidden: false }])).toBe(false);
    expect(canPublish([{ quantity: 100, isHidden: false }])).toBe(true);
  });

  it("does not allow stock below sold and reserved tickets", () => {
    expect(hasEnoughInventory(9, 6, 4)).toBe(false);
    expect(hasEnoughInventory(10, 6, 4)).toBe(true);
    expect(hasEnoughInventory(10.5, 0, 0)).toBe(false);
    expect(hasEnoughInventory(0, 0, 0)).toBe(false);
  });
});
