import { join } from "node:path";

import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

Font.register({
  family: "NotoSans",
  fonts: [
    {
      src: join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf"),
      fontWeight: 400,
    },
    {
      src: join(process.cwd(), "src/assets/fonts/NotoSans-Bold.ttf"),
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 11,
    color: "#1a1a1a",
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },
  brand: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#0f766e",
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 6,
  },
  meta: {
    color: "#525252",
    marginBottom: 4,
  },
  box: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 6,
    padding: 16,
  },
  row: {
    marginBottom: 10,
  },
  label: {
    fontSize: 9,
    fontWeight: 700,
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
  },
  qrWrap: {
    marginTop: 28,
    alignItems: "center",
  },
  qr: {
    width: 160,
    height: 160,
  },
  qrHint: {
    marginTop: 10,
    fontSize: 9,
    color: "#737373",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#a3a3a3",
  },
});

export type TicketPdfPayload = {
  eventTitle: string;
  eventWhen: string;
  venueLine: string | null;
  ticketTypeName: string;
  holderName: string;
  orderReference: string;
  ticketId?: string;
  statusLabel: string;
  showQr: boolean;
  qrPng: Buffer | null;
};

export async function renderTicketPdf(data: TicketPdfPayload): Promise<Buffer> {
  const qrDataUrl =
    data.showQr && data.qrPng
      ? `data:image/png;base64,${data.qrPng.toString("base64")}`
      : null;

  const buffer = await renderToBuffer(
    <Document title={`BiletFlow — ${data.eventTitle}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>BiletFlow</Text>
        <Text style={styles.title}>{data.eventTitle}</Text>
        <Text style={styles.meta}>{data.eventWhen}</Text>
        {data.venueLine ? (
          <Text style={styles.meta}>{data.venueLine}</Text>
        ) : null}

        <View style={styles.box}>
          <View style={styles.row}>
            <Text style={styles.label}>Ticket type</Text>
            <Text style={styles.value}>{data.ticketTypeName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Holder</Text>
            <Text style={styles.value}>{data.holderName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Order</Text>
            <Text style={styles.value}>{data.orderReference}</Text>
          </View>
          <View style={styles.row}>
            {data.ticketId ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.label}>Ticket ID</Text>
                <Text style={{ fontSize: 10 }}>{data.ticketId}</Text>
              </View>
            ) : null}
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{data.statusLabel}</Text>
          </View>
        </View>

        {qrDataUrl ? (
          <View style={styles.qrWrap}>
            {/* PDF Image has no DOM alt; QR meaning is in the caption below. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={styles.qr} src={qrDataUrl} />
            <Text style={styles.qrHint}>
              Present this QR at the entrance. Do not share publicly.
            </Text>
          </View>
        ) : (
          <View style={styles.qrWrap}>
            <Text style={styles.qrHint}>
              Admission QR is unavailable for this ticket status.
            </Text>
          </View>
        )}

        <Text style={styles.footer}>
          BiletFlow admission ticket · print or show on screen · no payment
          card data
        </Text>
      </Page>
    </Document>,
  );
  return Buffer.from(buffer);
}
