import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/i18n/navigation", () => ({
  redirect: mocks.redirect,
}));

import { ApiError } from "./api-error";
import { requirePageRole } from "./auth-guard";
import { safeNextPath } from "./auth-home";

describe("organizer and admin page access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
  });

  it.each(["ORGANIZER", "PLATFORM_ADMIN"] as const)(
    "allows users with the required %s role",
    async (role) => {
      const user = { id: "member-1", role };
      mocks.requireUser.mockResolvedValue(user);
      await expect(requirePageRole("en", [role])).resolves.toEqual({ user, role });
      expect(mocks.requireUser).toHaveBeenCalledWith(expect.any(Headers));
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );

  it.each(["ORGANIZER", "PLATFORM_ADMIN"] as const)(
    "redirects signed-out visitors to sign-in for %s dashboard",
    async (role) => {
      mocks.requireUser.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED"));
      await expect(requirePageRole("ru", [role])).rejects.toThrow("redirect");
      expect(mocks.redirect).toHaveBeenCalledWith({
        href: "/sign-in",
        locale: "ru",
      });
    },
  );

  it.each([
    ["ATTENDEE", "ORGANIZER", "/"],
    ["ORGANIZER", "PLATFORM_ADMIN", "/organizer"],
    ["PLATFORM_ADMIN", "ORGANIZER", "/admin"],
  ] as const)(
    "redirects %s away from %s dashboard to %s",
    async (actual, required, href) => {
      mocks.requireUser.mockResolvedValue({ id: "member-1", role: actual });
      await expect(requirePageRole("en", [required])).rejects.toThrow("redirect");
      expect(mocks.redirect).toHaveBeenCalledWith({ href, locale: "en" });
    },
  );

  it("blocks suspended sessions", async () => {
    mocks.requireUser.mockRejectedValue(new ApiError(403, "FORBIDDEN"));
    await expect(requirePageRole("en", ["PLATFORM_ADMIN"])).rejects.toThrow(
      "redirect",
    );
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: "/sign-in",
      locale: "en",
    });
  });

  it("accepts only in-app next paths after sign-in", () => {
    expect(safeNextPath("/tickets")).toBe("/tickets");
    expect(
      safeNextPath("/events/kbtu-freshers-welcome/checkout?quantity=1"),
    ).toBe("/events/kbtu-freshers-welcome/checkout?quantity=1");
    expect(safeNextPath("//evil.example")).toBeUndefined();
    expect(safeNextPath("https://evil.example")).toBeUndefined();
    expect(safeNextPath("events/no-slash")).toBeUndefined();
  });

  it("does not conceal unexpected server errors", async () => {
    mocks.requireUser.mockRejectedValue(new Error("database unavailable"));
    await expect(requirePageRole("en", ["ORGANIZER"])).rejects.toThrow(
      "database unavailable",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
