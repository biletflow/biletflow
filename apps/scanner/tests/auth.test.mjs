import { test } from "node:test";
import assert from "node:assert/strict";
import { createScannerAuth, TOKEN_KEY } from "../src/auth.ts";

const user = {
  email: "scanner2@biletflow.kz",
  name: "Scanner",
  staffAssignments: [{ eventId: "event-1", role: "EVENT_ADMIN" }],
};
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });
function fixture(saved = null, request = async () => response({ user })) {
  const storage = {
    value: saved,
    writes: 0,
    async getItemAsync(key) {
      assert.equal(key, TOKEN_KEY);
      return this.value;
    },
    async setItemAsync(key, value) {
      assert.equal(key, TOKEN_KEY);
      this.writes++;
      this.value = value;
    },
    async deleteItemAsync(key) {
      assert.equal(key, TOKEN_KEY);
      this.value = null;
    },
  };
  const auth = createScannerAuth(storage, "https://example.test/", request);
  return { storage, auth };
}

test("fresh install stays signed out without contacting server", async () => {
  const { auth } = fixture(null, () => assert.fail("unexpected request"));
  await auth.restore();
  assert.equal(auth.getSnapshot().phase, "signedOut");
});
test("event-admin login stores bearer token and permits other assigned scanners", async () => {
  const { auth, storage } = fixture(null, async (url, init) => {
    assert.equal(url, "https://example.test/api/mobile/auth/login");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), {
      email: user.email,
      password: "test-input",
    });
    return response({ token: "opaque-token", user });
  });
  await auth.login(user.email, "test-input");
  assert.equal(storage.value, "opaque-token");
  assert.equal(auth.getSnapshot().phase, "ready");
});
test("restoring uses bearer authentication and rechecks current assignments", async () => {
  const { auth } = fixture("saved-token", async (url, init) => {
    assert.equal(url, "https://example.test/api/me");
    assert.equal(init.headers.Authorization, "Bearer saved-token");
    return response({ user });
  });
  await auth.restore();
  assert.equal(auth.getSnapshot().user.email, user.email);
});
for (const status of [401, 403])
  test(`expired or suspended session (${status}) is cleared`, async () => {
    const { auth, storage } = fixture("saved-token", async () =>
      response({}, status),
    );
    await auth.restore();
    assert.equal(auth.getSnapshot().phase, "signedOut");
    assert.equal(storage.value, null);
  });
for (const invalid of [
  {},
  { ...user, staffAssignments: [] },
  { ...user, staffAssignments: [{ eventId: "event-1", role: "OTHER" }] },
]) {
  test(`rejects missing or unauthorized assignment: ${JSON.stringify(invalid.staffAssignments)}`, async () => {
    const { auth, storage } = fixture(null, async () =>
      response({ token: "token", user: invalid }),
    );
    await auth.login(user.email, "test-input");
    assert.equal(auth.getSnapshot().phase, "signedOut");
    assert.equal(storage.writes, 0);
  });
}
test("temporary network failure locks scanning but preserves saved session for retry", async () => {
  let offline = true;
  const { auth, storage } = fixture("saved-token", async () => {
    if (offline) throw new TypeError("network failure");
    return response({ user });
  });
  await auth.restore();
  assert.equal(auth.getSnapshot().phase, "retry");
  assert.equal(storage.value, "saved-token");
  offline = false;
  await auth.retry();
  assert.equal(auth.getSnapshot().phase, "ready");
});
test("invalid password and rate limiting return actionable errors without saving tokens", async () => {
  for (const status of [401, 429]) {
    const { auth, storage } = fixture(null, async () => response({}, status));
    await auth.login(user.email, "test-input");
    assert.equal(
      auth.getSnapshot().error,
      status === 401 ? "credentials" : "rate",
    );
    assert.equal(storage.writes, 0);
  }
});
test("duplicate login requests are coalesced", async () => {
  let finish,
    calls = 0;
  const { auth, storage } = fixture(null, () => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const first = auth.login(user.email, "test-input");
  const second = auth.login(user.email, "test-input");
  finish(response({ token: "token", user }));
  await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(storage.writes, 1);
});
test("logout during pending token write cannot resurrect session", async () => {
  let finish;
  const { auth, storage } = fixture(null, async () =>
    response({ token: "token", user }),
  );
  storage.setItemAsync = async (_key, value) => {
    await new Promise((resolve) => {
      finish = resolve;
    });
    storage.value = value;
  };
  const login = auth.login(user.email, "test-input");
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  const logout = auth.logout();
  assert.equal(auth.getSnapshot().phase, "checking");
  finish();
  await Promise.all([login, logout]);
  assert.equal(auth.getSnapshot().phase, "signedOut");
  assert.equal(storage.value, null);
});
test("failed secure-store logout stays locked and retries deletion even on resume", async () => {
  const { auth, storage } = fixture("saved-token");
  await auth.restore();
  const remove = storage.deleteItemAsync;
  storage.deleteItemAsync = async () => {
    throw new Error("storage unavailable");
  };
  await auth.logout();
  assert.equal(auth.getSnapshot().phase, "retry");
  storage.deleteItemAsync = remove;
  await auth.resume();
  assert.equal(auth.getSnapshot().phase, "signedOut");
  assert.equal(storage.value, null);
});
test("resuming app revalidates revoked event access before reopening scanner", async () => {
  let revoked = false;
  const { auth, storage } = fixture("saved-token", async () =>
    response({ user: revoked ? { ...user, staffAssignments: [] } : user }),
  );
  await auth.restore();
  auth.suspend();
  assert.equal(auth.getSnapshot().phase, "checking");
  revoked = true;
  await auth.resume();
  assert.equal(auth.getSnapshot().phase, "signedOut");
  assert.equal(storage.value, null);
});

test("malformed API responses fail closed without saving a token", async () => {
  for (const bad of [
    null,
    { token: "", user },
    { token: "token", user: null },
  ]) {
    const { auth, storage } = fixture(null, async () => response(bad));
    await auth.login(user.email, "test-input");
    assert.equal(auth.getSnapshot().phase, "signedOut");
    assert.equal(storage.writes, 0);
  }
});
test("server failure preserves session and requires retry", async () => {
  const { auth, storage } = fixture("saved-token", async () =>
    response({}, 503),
  );
  await auth.restore();
  assert.equal(auth.getSnapshot().phase, "retry");
  assert.equal(storage.value, "saved-token");
});
test("secure-store write failure never grants scanner access", async () => {
  const { auth, storage } = fixture(null, async () =>
    response({ token: "token", user }),
  );
  storage.setItemAsync = async () => {
    throw new Error("storage unavailable");
  };
  await auth.login(user.email, "test-input");
  assert.equal(auth.getSnapshot().phase, "signedOut");
  assert.equal(auth.getSnapshot().error, "storage");
});

test("request timeout exits loading state and allows retry", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { auth } = fixture(
    "saved-token",
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  const restoring = auth.restore();
  await Promise.resolve();
  context.mock.timers.tick(10000);
  await restoring;
  assert.equal(auth.getSnapshot().phase, "retry");
  assert.equal(auth.getSnapshot().error, "network");
});
