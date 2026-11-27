-- A live hold is unique per seat and event, so two events in one venue can reserve the same chair.
DROP INDEX "SeatHold_seatId_activeKey_key";
CREATE UNIQUE INDEX "SeatHold_seatId_eventId_activeKey_key" ON "SeatHold"("seatId", "eventId", "activeKey");
