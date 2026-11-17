/**
 * Jordan Rogers signed in as an admin and landed in J. Thorpe's crew account.
 *
 * The resolution used to end in `?? state.users[0]`. `profile` is null for the
 * first render after any sign-in - an effect fetches it - and on a shared device
 * the users list still belongs to whoever was signed in before, so the lookup
 * missed and the app fell through to the first row of `profiles`. That query has
 * no ORDER BY, so "first" is whatever Postgres returns and it moves as rows are
 * updated: it was J. Thorpe when the client hit this, and Ray by the time it was
 * investigated. The borrowed row carried its own role, so an admin was handed a
 * crew member's view of the company.
 *
 * The rule under test is therefore not "pick a user" but "name the person or
 * admit you do not know", and the dangerous case is the third test: a stale list
 * that does not contain the signed-in id must yield null, never a stranger.
 */
import { describe, expect, it } from "vitest";
import { signedInUser } from "./App";
import type { User } from "./types";

const user = (id: string, name: string, role: string) => ({ id, name, role } as unknown as User);

const ROGERS = user("71355a4a", "J. Rogers", "admin");
const THORPE = user("f5a9500c", "J. Thorpe", "crew");
const RAY = user("f3cb9e29", "Ray", "crew");

describe("who is signed in", () => {
  it("uses the fetched profile when there is one", () => {
    expect(signedInUser(ROGERS, [THORPE, RAY], "71355a4a")).toBe(ROGERS);
  });

  it("falls back to the users row whose id IS the session id", () => {
    expect(signedInUser(null, [THORPE, ROGERS, RAY], "71355a4a")).toBe(ROGERS);
  });

  it("returns null rather than a stranger when the list is stale", () => {
    // The exact shape of the bug: signed in as Rogers, list left over from the
    // previous person, no profile yet. users[0] is Thorpe and must not be used.
    expect(signedInUser(null, [THORPE, RAY], "71355a4a")).toBeNull();
  });

  it("returns null when there is no session at all", () => {
    expect(signedInUser(null, [THORPE, RAY], null)).toBeNull();
  });

  it("never returns somebody whose id differs from the session id", () => {
    for (const users of [[THORPE], [RAY, THORPE], []]) {
      const resolved = signedInUser(null, users, "71355a4a");
      expect(resolved === null || resolved.id === "71355a4a").toBe(true);
    }
  });

  it("prefers the profile even if a different row claims the session id", () => {
    // profile is fetched by id for this session, so it is the stronger source.
    expect(signedInUser(ROGERS, [user("71355a4a", "Impostor", "crew")], "71355a4a")).toBe(ROGERS);
  });
});
