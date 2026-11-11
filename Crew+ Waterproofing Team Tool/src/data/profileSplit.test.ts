/**
 * The HR half of a profile moved to profile_private, because
 * "authenticated read profiles" is `using (true)` and RLS cannot hide a
 * column - every signed-in colleague could read pay weighting, discipline
 * dates and termination reasons straight off the profiles table.
 *
 * Two things have to hold for that split to be safe, and neither is visible
 * from the UI:
 *
 *  1. profileToRow must name no column that migration 202611120003 drops.
 *     One stale key there fails every profile save with "column does not
 *     exist", in all three apps at once.
 *  2. A crew member only loads their OWN private row, so colleagues read back
 *     empty. Writing those empty rows back would hit a table they cannot write
 *     to, and the rejection fails the whole sync.
 */
import { describe, expect, it } from "vitest";
import { profileToRow, profilePrivateToRow, profilePrivateFromRow } from "./repo";
import type { Profile } from "../types";

/** Exactly what 202611120003_profile_private_drop.sql removes. */
const DROPPED = [
  "bonus_role_weight", "under_notice", "disciplinary_action_at", "termination_reason",
  "next_quarterly_review_date", "review_eligibility", "probation_end_date",
  "vacation_days_annual", "employment_type", "agreement_signed_date",
  "new_hire_until", "access_upgraded_at", "gross_annual_wages", "pay_band",
];

const person = {
  id: "u1", name: "Ray", email: "ray@example.com", role: "crew", orgRole: "Technician",
  branch: "field", color: "#14A2A4", phone: "250-555-1234", status: "Active",
  underNotice: true, terminationReason: "resigned", bonusRoleWeight: 1.25,
  probationEndDate: "2026-03-01", employmentType: "Full-time",
} as unknown as Profile;

describe("the profile / profile_private split", () => {
  it("writes no column that the drop migration removes", () => {
    const keys = Object.keys(profileToRow(person));
    expect(keys.filter((key) => DROPPED.includes(key))).toEqual([]);
  });

  it("keeps employment_status on profiles, because the Wizard filters crew on it", () => {
    expect(Object.keys(profileToRow(person))).toContain("employment_status");
  });

  it("carries the HR fields to the private row instead", () => {
    const row = profilePrivateToRow(person);
    expect(row.user_id).toBe("u1");
    expect(row.under_notice).toBe(true);
    expect(row.termination_reason).toBe("resigned");
    expect(row.bonus_role_weight).toBe(1.25);
  });

  it("round-trips back into the flat Profile the app expects", () => {
    const { fields } = profilePrivateFromRow(profilePrivateToRow(person));
    expect(fields.underNotice).toBe(true);
    expect(fields.terminationReason).toBe("resigned");
    expect(fields.bonusRoleWeight).toBe(1.25);
    expect(fields.probationEndDate).toBe("2026-03-01");
  });

  it("reads a colleague's withheld row as empty rather than as false data", () => {
    // What a crew member gets for everyone but themselves: no row at all.
    const blank = profilePrivateToRow({ id: "u2" } as unknown as Profile);
    const empty = Object.entries(blank).every(([key, value]) =>
      key === "user_id" || value === null || value === false);
    expect(empty).toBe(true);
  });
});
