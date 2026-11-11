export function validateEventDates(start: string, end: string): "missing" | "order" | null {
  if (!start || !end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) {
    return "missing";
  }
  return new Date(end).getTime() > new Date(start).getTime() ? null : "order";
}

export function canPublish(ticketTypes: { quantity: number; isHidden: boolean }[]): boolean {
  return ticketTypes.some((type) => !type.isHidden && type.quantity > 0);
}

export function hasEnoughInventory(quantity: number, sold: number, reserved: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity >= sold + reserved;
}
