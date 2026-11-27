export type SeatSection = {
  id: string;
  name: string;
  rows: { id: string; label: string; seats: { id: string; number: string; isAccessible: boolean }[] }[];
};

export function retainAvailableSeats(selected: string[], sections: SeatSection[], limit: number) {
  const available = new Set(sections.flatMap((section) => section.rows.flatMap((row) => row.seats.map((seat) => seat.id))));
  return [...new Set(selected)].filter((id) => available.has(id)).slice(0, Math.max(0, limit));
}

export function toggleSeat(selected: string[], id: string, limit: number) {
  if (selected.includes(id)) return selected.filter((value) => value !== id);
  return selected.length < limit ? [...selected, id] : selected;
}

export function checkoutItems(ticketTypeId: string, quantity: number, assigned: boolean, selected: string[]) {
  return [{ ticketTypeId, quantity, ...(assigned ? { seatIds: selected } : {}) }];
}
