import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { renderTicketPdf } from "./ticket-pdf";

describe("renderTicketPdf", () => {
  it("renders an A4 PDF with Cyrillic holder name", async () => {
    const qrPng = await QRCode.toBuffer("BF.TEST.CODE", {
      type: "png",
      width: 320,
      margin: 1,
    });
    const pdf = await renderTicketPdf({
      eventTitle: "Қазақша · Русский · English Night",
      eventWhen: "19 Nov 2026 · 19:00",
      venueLine: "Astana Arena · Астана",
      ticketTypeName: "General",
      holderName: "Айгерим Сыздықова",
      orderReference: "BF-SMOKE",
      statusLabel: "Valid",
      showQr: true,
      qrPng,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
