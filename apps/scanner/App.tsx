import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { parseScannedPayload, type ScannedPayload } from "@biletflow/shared";

/**
 * Week 4 scaffold: proves the camera works and that the shared payload classifier
 * runs on device. Real verification is server-side via POST /api/checkin — this
 * screen must never decide admission on its own.
 */
export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ScannedPayload | null>(null);

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (result) return;
      setResult(parseScannedPayload(data));
    },
    [result],
  );

  if (!permission) {
    return <Centered text="Checking camera permission…" />;
  }

  if (!permission.granted) {
    return (
      <Centered text="BiletFlow needs the camera to scan tickets.">
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant permission</Text>
        </Pressable>
      </Centered>
    );
  }

  if (result) {
    return (
      <SafeAreaView style={[styles.container, styles[resultStyle(result)]]}>
        <View style={styles.center}>
          <Text style={styles.heading}>{resultHeading(result)}</Text>
          <Text style={styles.detail}>{resultDetail(result)}</Text>
          <Pressable style={styles.button} onPress={() => setResult(null)}>
            <Text style={styles.buttonText}>Scan again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onBarcodeScanned}
      />
      <SafeAreaView style={styles.overlay}>
        <Text style={styles.overlayText}>Point the camera at a ticket QR code</Text>
      </SafeAreaView>
    </View>
  );
}

function Centered({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.detail}>{text}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

function resultStyle(result: ScannedPayload) {
  return result.kind === "ADMISSION_TICKET" ? ("ok" as const) : ("reject" as const);
}

function resultHeading(result: ScannedPayload) {
  switch (result.kind) {
    case "ADMISSION_TICKET":
      return "Ticket recognised";
    case "CAMPAIGN_QR":
      return "Not a ticket";
    default:
      return "Unrecognised code";
  }
}

function resultDetail(result: ScannedPayload) {
  switch (result.kind) {
    case "ADMISSION_TICKET":
      return `Ticket ${result.ticketId}\nAwaiting server verification.`;
    case "CAMPAIGN_QR":
      return "This is a promotional code, not a ticket. It cannot be used for entry.";
    default:
      return result.raw.slice(0, 120);
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0c" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  overlay: { flex: 1, justifyContent: "flex-end", padding: 32 },
  overlayText: { color: "#fff", fontSize: 16, textAlign: "center" },
  heading: { color: "#fff", fontSize: 28, fontWeight: "700", textAlign: "center" },
  detail: { color: "#e5e5e5", fontSize: 16, textAlign: "center", lineHeight: 22 },
  ok: { backgroundColor: "#14532d" },
  reject: { backgroundColor: "#7f1d1d" },
  button: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: "#0b0b0c", fontWeight: "600", fontSize: 16 },
});
