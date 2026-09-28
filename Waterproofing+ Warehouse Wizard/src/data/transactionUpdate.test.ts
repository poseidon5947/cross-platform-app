/**
 * transactions had RLS enabled with an INSERT and a SELECT policy and no
 * UPDATE policy, so Postgres matched no rows and PostgREST called that
 * success. Resolve reported "Item resolved" and wrote nothing from
 * 2026-09-04 until 2026-09-29 - 140 rows flagged, none ever resolved.
 * These pin the guard that turns that silence into a message.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { selectMock } = vi.hoisted(() => ({
  selectMock: vi.fn(async (): Promise<{ data: { id: string }[] | null; error: unknown }> => ({ data: [{ id: "tx1" }], error: null })),
}));

vi.mock("../integrations/supabase", () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: () => ({ select: selectMock }) }) }),
  },
  isSupabaseConfigured: () => true,
}));

import { dismissTransactionReview, updateResolvedTransaction } from "./repo";

const tx = { id: "tx1", qty: 2, type: "use" as const, userId: "u1", ts: "2026-09-29T00:00:00Z", materialId: "m1" };

describe("updating a transaction", () => {
  beforeEach(() => selectMock.mockClear());

  it("succeeds when a row actually changed", async () => {
    await expect(updateResolvedTransaction(tx)).resolves.toBeUndefined();
  });

  it("does not treat zero rows changed as success", async () => {
    selectMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(updateResolvedTransaction(tx)).rejects.toThrow(/did not save/i);
  });

  it("says so rather than silently dropping a dismiss", async () => {
    selectMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(dismissTransactionReview("tx1", "11111111-1111-1111-1111-111111111111"))
      .rejects.toThrow(/did not save/i);
  });

  it("still reports a genuine error", async () => {
    selectMock.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "row-level security" } });
    await expect(updateResolvedTransaction(tx)).rejects.toBeTruthy();
  });
});
