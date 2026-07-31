import { describe, expect, it } from "vitest";
import { createSeedState } from "./seed";
import { applyIntakeCsvTabs, parseCsv } from "./intakeImport";

describe("Crew+ intake importer", () => {
  it("parses quoted CSV cells", () => {
    expect(parseCsv('Reward,Point cost\n"Team lunch, hosted",600')).toEqual([
      ["Reward", "Point cost"],
      ["Team lunch, hosted", "600"],
    ]);
  });

  it("maps team members idempotently without touching ledger rows", () => {
    const state = createSeedState();
    const beforeEvents = state.pointsEvents;
    const csv = [
      "Employee ID,First name,Last name,Display name,Role,Department,Reports to,Status,Start date,Probationary Period End Date (offer benefits),Date Employment Agreement was signed,Birthday (MM-DD),Email,Phone",
      "EMP-004,Josh,Murray,Josh,Technician,Field,Crew Lead,Active,,,,46143,josh@example.com,250-000-0000",
    ].join("\n");
    const result = applyIntakeCsvTabs(state, [{ name: "3. Team Members", csv }]);
    const josh = result.state.users.find((user) => user.employeeId === "EMP-004")!;
    expect(josh.email).toBe("josh@example.com");
    expect(josh.birthday).toBe("05-01");
    expect(result.state.pointsEvents).toBe(beforeEvents);
    expect(result.report.imported).toBe(1);
  });

  it("maps earning caps and keeps the confirmed point anchor configurable", () => {
    const state = createSeedState();
    const csv = [
      "Action / trigger,Points,Source app,Weekly cap,Active",
      "Daily value ritual,30,Crew+,150,Y",
    ].join("\n");
    const result = applyIntakeCsvTabs(state, [{ name: "12. Rewards - Earning", csv }]);
    expect(result.state.earningRules.find((rule) => rule.id === "earn-daily")?.weeklyCap).toBe(150);
    expect(result.state.walletConfig.rewardDollarPerPoint).toBe(0.25);
  });
});
