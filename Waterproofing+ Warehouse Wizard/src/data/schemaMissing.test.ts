import { describe, expect, it } from "vitest";
import { schemaMissing } from "./repo";

/**
 * The app deploys the moment a commit lands; the migration is run by hand
 * afterwards. Everything added in that window has to survive the gap, so this
 * guard decides whether an error means "not migrated yet" or a real fault.
 * Getting it wrong in the permissive direction would swallow genuine errors.
 */
describe("schemaMissing", () => {
  it("recognises a missing column", () => {
    expect(schemaMissing({ code: "42703", message: 'column "weather" does not exist' })).toBe(true);
  });

  it("recognises a missing table", () => {
    expect(schemaMissing({ code: "42P01", message: 'relation "daily_log_media" does not exist' })).toBe(true);
  });

  it("recognises PostgREST's stale schema cache", () => {
    expect(schemaMissing({ code: "PGRST204", message: "Could not find the 'weather' column of 'daily_logs' in the schema cache" })).toBe(true);
    expect(schemaMissing({ code: "PGRST205", message: "Could not find the table in the schema cache" })).toBe(true);
  });

  it("does not swallow a real failure", () => {
    expect(schemaMissing({ code: "42501", message: "new row violates row-level security policy" })).toBe(false);
    expect(schemaMissing({ code: "23502", message: 'null value in column "work_completed" violates not-null constraint' })).toBe(false);
    expect(schemaMissing({ code: "23503", message: "insert or update violates foreign key constraint" })).toBe(false);
    expect(schemaMissing(new Error("Failed to fetch"))).toBe(false);
    expect(schemaMissing(null)).toBe(false);
    expect(schemaMissing(undefined)).toBe(false);
  });
});
