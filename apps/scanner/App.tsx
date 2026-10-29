import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  ScrollView,
  AppState,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  signInSchema,
  type CheckInResult,
} from "@biletflow/shared";

import { createScannerAuth, type ScannerEvent } from "./src/auth";
import { messages, type Locale } from "./src/messages";

const auth = createScannerAuth(
  SecureStore,
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
);

/**
 * Week 4 scaffold: proves the camera works and that the shared payload classifier
 * runs on device. Real verification is server-side via POST /api/checkin — this
 * screen must never decide admission on its own.
 */
export default function App() {
  const [locale, setLocale] = useState<Locale>("ru");
  const t = messages[locale];
  const session = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const [email, setEmail] = useState("scanner@biletflow.kz");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [scanPending, setScanPending] = useState(false);
  const [scanError, setScanError] = useState(false);
  const scanGeneration = useRef(0);
  const scanned = useRef(false);
  const [events, setEvents] = useState<ScannerEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventsReload, setEventsReload] = useState(0);
  useEffect(() => {
    if (session.phase !== "ready") { setSelectedEventId(null); setEvents([]); return; }
    let active = true;
    setEventsLoading(true);
    setEventsError(false);
    void auth.getEvents().then((list) => {
      if (!active) return;
      setEvents(list);
      setSelectedEventId((previous) => previous && list.some((event) => event.id === previous) ? previous : null);
    }).catch(() => { if (active) setEventsError(true); })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [session.phase, eventsReload]);

  useEffect(() => {
    void auth.restore();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        scanGeneration.current++;
        setScanPending(false);
        setResult(null);
        scanned.current = false;
        void auth.resume();
      } else auth.suspend();
    });
    return () => subscription.remove();
  }, []);

  async function signIn() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(t.input);
      return;
    }
    setError("");
    await auth.login(parsed.data.email, parsed.data.password);
    if (auth.getSnapshot().phase === "ready") setPassword("");
  }

  function signOut() {
    scanGeneration.current++;
    setScanPending(false);
    setScanError(false);
    setSelectedEventId(null);
    setEvents([]);
    setResult(null);
    scanned.current = false;
    setPassword("");
    setError("");
    void auth.logout();
  }

  const onBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scanned.current || !selectedEventId || auth.getSnapshot().phase !== "ready") return;
    scanned.current = true;
    const version = ++scanGeneration.current;
    setScanPending(true);
    setScanError(false);
    setResult(null);
    void auth.submitScan(selectedEventId, data)
      .then((serverResult) => { if (scanGeneration.current === version) setResult(serverResult); })
      .catch(() => { if (scanGeneration.current === version) setScanError(true); })
      .finally(() => { if (scanGeneration.current === version) setScanPending(false); });
  }, [selectedEventId]);

  if (session.phase === "checking")
    return (
      <Centered text={t.checking}>
        <ActivityIndicator color="#fff" />
      </Centered>
    );
  if (session.phase === "retry")
    return (
      <Centered text={session.error ? t[session.error] : t.verify}>
        <Pressable
          style={styles.button}
          onPress={() => {
            void auth.retry();
          }}
        >
          <Text style={styles.buttonText}>{t.retry}</Text>
        </Pressable>
        <Pressable onPress={signOut}>
          <Text style={styles.detail}>{t.signOut}</Text>
        </Pressable>
      </Centered>
    );

  if (session.phase !== "ready") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {(["ru", "kk", "en"] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  setError("");
                  setLocale(value);
                }}
              >
                <Text style={styles.detail}>{value.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.heading}>{t.title}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t.email}
            placeholderTextColor="#888"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={t.password}
            placeholderTextColor="#888"
            secureTextEntry
            autoComplete="password"
            onSubmitEditing={signIn}
          />
          {error || session.error ? (
            <Text style={styles.error}>
              {error || (session.error && t[session.error])}
            </Text>
          ) : null}
          <Pressable style={styles.button} onPress={signIn}>
            <Text style={styles.buttonText}>{t.signIn}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (eventsLoading) return <Centered text={t.checking}><ActivityIndicator color="#fff" /></Centered>;
  if (!selectedEventId || eventsError || !events.some((event) => event.id === selectedEventId)) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.eventList}>
          <Text style={styles.heading}>{t.chooseEvent}</Text>
          {eventsError ? <Text style={styles.error}>{t.eventsError}</Text> :
            events.length === 0 ? <Text style={styles.detail}>{t.noEvents}</Text> :
            events.map((event) => (
              <Pressable key={event.id} style={styles.eventButton} onPress={() => {
                scanGeneration.current++; setSelectedEventId(event.id); setResult(null); setScanError(false); scanned.current = false;
              }}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.detail}>{new Date(event.startsAt).toLocaleString(locale)}</Text>
              </Pressable>
            ))}
          <Pressable style={styles.button} onPress={() => setEventsReload((value) => value + 1)}>
            <Text style={styles.buttonText}>{t.retry}</Text>
          </Pressable>
          <Pressable onPress={signOut}><Text style={styles.detail}>{t.signOut}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (!permission) {
    return <Centered text={t.cameraChecking} />;
  }

  if (!permission.granted) {
    return (
      <Centered text={t.cameraNeeded}>
        <Pressable
          style={styles.button}
          onPress={() => {
            void (permission.canAskAgain
              ? requestPermission()
              : Linking.openSettings());
          }}
        >
          <Text style={styles.buttonText}>
            {permission.canAskAgain ? t.grant : t.settings}
          </Text>
        </Pressable>
        <Pressable onPress={signOut}>
          <Text style={styles.detail}>{t.signOut}</Text>
        </Pressable>
      </Centered>
    );
  }

  if (scanPending) return <Centered text={t.awaiting}><ActivityIndicator color="#fff" /></Centered>;
  if (scanError) return (
    <Centered text={t.scanFailed}>
      <Pressable style={styles.button} onPress={() => { scanned.current = false; setScanError(false); }}>
        <Text style={styles.buttonText}>{t.again}</Text>
      </Pressable>
    </Centered>
  );
  if (result) {
    return (
      <SafeAreaView style={[styles.container, result.result === "VALID" ? styles.ok : styles.reject]}>
        <View style={styles.center}>
          <Text style={styles.heading}>{resultHeading(result.result, t)}</Text>
          <Text style={styles.detail}>{result.message}</Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              scanned.current = false;
              setScanError(false);
              setResult(null);
            }}
          >
            <Text style={styles.buttonText}>{t.again}</Text>
          </Pressable>
          <Pressable onPress={signOut}>
            <Text style={styles.detail}>{t.signOut}</Text>
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
        <Text style={styles.overlayText}>{events.find((event) => event.id === selectedEventId)?.title}</Text>
        <Text style={styles.overlayText}>{t.point}</Text>
        <Pressable onPress={() => { scanGeneration.current++; setSelectedEventId(null); setResult(null); scanned.current = false; }} style={styles.signOut}>
          <Text style={styles.overlayText}>{t.changeEvent}</Text>
        </Pressable>
        <Pressable onPress={signOut} style={styles.signOut}>
          <Text style={styles.overlayText}>
            {t.signOut} · {session.user?.name}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function Centered({
  text,
  children,
}: {
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.detail}>{text}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

function resultHeading(result: CheckInResult["result"], t: typeof messages.en) {
  switch (result) {
    case "VALID": return t.admitted;
    case "ALREADY_CHECKED_IN": return t.alreadyIn;
    case "NOT_A_TICKET": return t.notTicket;
    case "WRONG_EVENT": return t.wrongEvent;
    case "CANCELLED": return t.cancelled;
    case "REFUNDED": return t.refunded;
    case "INVALID": return t.invalidTicket;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0c" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  overlay: { flex: 1, justifyContent: "flex-end", padding: 32 },
  eventList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  eventButton: { width: "100%", borderWidth: 1, borderColor: "#777", borderRadius: 8, padding: 16, gap: 8 },
  eventTitle: { color: "#fff", fontSize: 20, fontWeight: "600", textAlign: "center" },
  overlayText: { color: "#fff", fontSize: 16, textAlign: "center" },
  heading: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  detail: {
    color: "#e5e5e5",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  error: { color: "#fca5a5", fontSize: 14, textAlign: "center" },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#777",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
  },
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
