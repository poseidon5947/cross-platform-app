/**
 * Signing out of one suite app must not revoke the person's sessions in the
 * other two. supabase-js defaults signOut to scope "global"; live verification
 * saw a Crew+ sign-out leave Warehouse Wizard on a JWT that PostgREST still
 * accepted while award-points answered 401, pinning a replayed daily log.
 */
import { describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn(async (): Promise<{ error: Error | null }> => ({ error: null })) }));
vi.mock("../integrations/supabase", () => ({ supabase: { auth: { signOut: signOutMock } }, isSupabaseConfigured: () => true }));

import { signOut } from "./repo";

describe("signOut", () => {
  it("ends only this app's session", async () => {
    await signOut();
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
  });

  it("surfaces the client's error", async () => {
    signOutMock.mockResolvedValueOnce({ error: new Error("network down") });
    await expect(signOut()).rejects.toThrow("network down");
  });
});

/**
 * A 401 from an edge function means GoTrue refused the token — the session is
 * gone, even though PostgREST keeps accepting the cached JWT for up to an hour.
 * sessionRejected confirms that against the server before anything acts on it,
 * so a stray 401 can never sign someone out mid-shift.
 */
describe("sessionRejected", () => {
  const err = (status: number) => ({ context: { status } });

  it("ignores anything that is not a 401", async () => {
    const { sessionRejected } = await import("./repo");
    expect(await sessionRejected(err(500))).toBe(false);
    expect(await sessionRejected(err(403))).toBe(false);
    expect(await sessionRejected(new Error("network"))).toBe(false);
  });

  it("treats a 401 as a dead session only when the server agrees", async () => {
    vi.resetModules();
    vi.doMock("../integrations/supabase", () => ({
      supabase: { auth: { getUser: async () => ({ data: { user: null }, error: { message: "bad jwt" } }) } },
      isSupabaseConfigured: () => true,
    }));
    const { sessionRejected } = await import("./repo");
    expect(await sessionRejected(err(401))).toBe(true);
    vi.doUnmock("../integrations/supabase");
    vi.resetModules();
  });

  it("leaves a still-valid session alone even on a 401", async () => {
    vi.resetModules();
    vi.doMock("../integrations/supabase", () => ({
      supabase: { auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) } },
      isSupabaseConfigured: () => true,
    }));
    const { sessionRejected } = await import("./repo");
    expect(await sessionRejected(err(401))).toBe(false);
    vi.doUnmock("../integrations/supabase");
    vi.resetModules();
  });
});
