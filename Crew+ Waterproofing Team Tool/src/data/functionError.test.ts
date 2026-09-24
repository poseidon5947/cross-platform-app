/**
 * supabase-js reports any non-2xx from an edge function as "Edge Function returned
 * a non-2xx status code" and leaves the real reason in the response body. Crew who
 * hit a refused award saw only that sentence.
 */
import { describe, expect, it } from "vitest";
import { __functionErrorMessage as read } from "./repo";

const httpError = (body: unknown, ok = true) => ({
  message: "Edge Function returned a non-2xx status code",
  context: {
    clone: () => ({ json: async () => { if (!ok) throw new Error("not json"); return body; } }),
    json: async () => body,
  },
});

describe("edge function error messages", () => {
  it("reads the reason the function actually gave", async () => {
    const msg = await read(httpError({ error: "This award requires manager/admin approval" }), "fallback");
    expect(msg).toBe("This award requires manager/admin approval");
  });

  it("falls back to plain language when the body is not JSON", async () => {
    expect(await read(httpError(null, false), "Those points could not be awarded.")).toBe("Those points could not be awarded.");
  });

  it("does not pass the generic supabase wording through", async () => {
    expect(await read(new Error("Edge Function returned a non-2xx status code"), "Plain reason")).toBe("Plain reason");
  });

  it("keeps a genuine error message that is not the generic one", async () => {
    expect(await read(new Error("Network request failed"), "fallback")).toBe("Network request failed");
  });
});
