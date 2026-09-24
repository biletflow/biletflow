import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

import { parseScannedPayload, signInSchema, type ScannedPayload } from "@biletflow/shared";

const TOKEN_KEY = "biletflow.scanner.token";
const SCANNER_EMAIL = "scanner@biletflow.kz";
// A physical device needs the computer's LAN address, not localhost.
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

type ScannerUser = { email: string; name: string; staffAssignments: { eventId: string }[] };

function isScanner(user: ScannerUser) {
  return user.email.toLowerCase() === SCANNER_EMAIL && user.staffAssignments.length > 0;
}

async function getScanner(token: string): Promise<ScannerUser | null> {
  const response = await fetch(`${API_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Unable to verify session. Check your connection.");
  const data = await response.json();
  return data.user && isScanner(data.user) ? data.user : null;
}

/**
 * Week 4 scaffold: proves the camera works and that the shared payload classifier
 * runs on device. Real verification is server-side via POST /api/checkin — this
 * screen must never decide admission on its own.
 */
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [email, setEmail] = useState(SCANNER_EMAIL);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ScannedPayload | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          const current = await getScanner(saved);
          if (!active) return;
          if (current) { setToken(saved); setUser(current); }
          else await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to restore session.");
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function signIn() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) { setError("Enter a valid email and password."); return; }
    if (parsed.data.email !== SCANNER_EMAIL) { setError("Use the scanner account to sign in."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/mobile/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Incorrect email or password." : "Sign-in failed. Please try again.");
      const data = await response.json();
      if (typeof data.token !== "string" || !data.user || !isScanner(data.user)) {
        throw new Error("This account does not have scanner access.");
      }
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    setToken(null);
    setUser(null);
    setResult(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (result) return;
      setResult(parseScannedPayload(data));
    },
    [result],
  );

  if (restoring) return <Centered text="Checking your session…"><ActivityIndicator color="#fff" /></Centered>;

  if (!token || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.heading}>Scanner sign in</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#888" autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy} />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#888" secureTextEntry autoComplete="password" editable={!busy} onSubmitEditing={signIn} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.button} onPress={signIn} disabled={busy}>
            <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return <Centered text="Checking camera permission…" />;
  }

  if (!permission.granted) {
    return (
      <Centered text="BiletFlow needs the camera to scan tickets.">
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant permission</Text>
        </Pressable>
        <Pressable onPress={signOut}><Text style={styles.detail}>Sign out</Text></Pressable>
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
          <Pressable onPress={signOut}><Text style={styles.detail}>Sign out</Text></Pressable>
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
        <Pressable onPress={signOut} style={styles.signOut}><Text style={styles.overlayText}>Sign out · {user.name}</Text></Pressable>
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
  error: { color: "#fca5a5", fontSize: 14, textAlign: "center" },
  input: { width: "100%", borderWidth: 1, borderColor: "#777", borderRadius: 8, padding: 12, color: "#fff", fontSize: 16 },
  signOut: { alignSelf: "center", marginTop: 16, padding: 8 },
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
