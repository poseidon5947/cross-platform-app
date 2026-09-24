/**
 * Signing out of Crew+ must not revoke the person's Warehouse Wizard and SOP+
 * sessions. supabase-js defaults signOut to scope "global"; live verification
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
});
