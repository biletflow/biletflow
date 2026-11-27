import { describe, expect, it } from "vitest";
import { checkoutItems, retainAvailableSeats, toggleSeat, type SeatSection } from "./seat-selection";

const sections: SeatSection[] = [{ id: "section", name: "Stalls", rows: [{ id: "row", label: "A", seats: [{ id: "a1", number: "1", isAccessible: false }, { id: "a2", number: "2", isAccessible: true }] }] }];
describe("web checkout seat selection", () => {
  it("toggles seats without duplicates and enforces the order limit", () => {
    expect(toggleSeat([], "a1", 1)).toEqual(["a1"]);
    expect(toggleSeat(["a1"], "a2", 1)).toEqual(["a1"]);
    expect(toggleSeat(["a1"], "a1", 1)).toEqual([]);
  });
  it("removes unavailable seats on refresh and respects inventory limits", () => {
    expect(retainAvailableSeats(["gone", "a2", "a2", "a1"], sections, 1)).toEqual(["a2"]);
    expect(retainAvailableSeats(["a1"], [], 2)).toEqual([]);
  });
  it("includes seat IDs for assigned checkout only", () => {
    expect(checkoutItems("type", 2, true, ["a1", "a2"])).toEqual([{ ticketTypeId: "type", quantity: 2, seatIds: ["a1", "a2"] }]);
    expect(checkoutItems("type", 2, false, [])).toEqual([{ ticketTypeId: "type", quantity: 2 }]);
  });
});
