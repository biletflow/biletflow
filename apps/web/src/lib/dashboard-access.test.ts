import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireRole: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/session", () => ({ requireRole: mocks.requireRole }));

import { ApiError } from "@/lib/api-error";
import { requireDashboardAccess } from "./dashboard-access";

describe("organizer and admin dashboard access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireRole.mockResolvedValue({ id: "user-1" });
  });

  it.each([
    ["ORGANIZER", "en"],
    ["PLATFORM_ADMIN", "ru"],
  ] as const)("allows a signed-in %s into the dashboard", async (role, locale) => {
    await expect(requireDashboardAccess(locale, role)).resolves.toBeUndefined();
    expect(mocks.requireRole).toHaveBeenCalledWith(expect.any(Headers), [role]);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each(["ORGANIZER", "PLATFORM_ADMIN"] as const)(
    "redirects unauthenticated %s visitors to localized sign-in",
    async (role) => {
      mocks.requireRole.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED"));
      await expect(requireDashboardAccess("ru", role)).rejects.toThrow(
        "NEXT_REDIRECT:/ru/sign-in",
      );
      expect(mocks.redirect).toHaveBeenCalledWith("/ru/sign-in");
    },
  );

  it.each(["ORGANIZER", "PLATFORM_ADMIN"] as const)(
    "redirects unauthorized %s visitors to the localized home page",
    async (role) => {
      mocks.requireRole.mockRejectedValue(new ApiError(403, "FORBIDDEN"));
      await expect(requireDashboardAccess("en", role)).rejects.toThrow(
        "NEXT_REDIRECT:/en",
      );
      expect(mocks.redirect).toHaveBeenCalledWith("/en");
    },
  );

  it("does not mask unexpected failures with a redirect", async () => {
    mocks.requireRole.mockRejectedValue(new Error("database unavailable"));
    await expect(requireDashboardAccess("en", "ORGANIZER")).rejects.toThrow(
      "database unavailable",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
