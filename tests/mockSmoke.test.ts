import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { ownerOrder } from "../config/league.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { runMockBatch } from "../src/modeling/mockBatch.js";
import { buildMockSmokeReport } from "../src/modeling/mockSmoke.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("mock smoke report", () => {
  it("summarizes validity and the first two auction rounds from a real mock batch", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 2,
      seedPrefix: "smoke-report-test",
    });
    const run = batch.runs[0];
    if (!run) throw new Error("Expected at least one mock run.");

    const report = buildMockSmokeReport({ run, batch, rounds: 2 });

    expect(report.seed).toBe(run.seed);
    expect(report.scenarioKey).toBe("expected");
    expect(report.roundCount).toBe(2);
    expect(report.invalidRosterCount).toBe(0);
    expect(report.batch.invalidRosterCount).toBe(0);
    expect(report.firstTwoRounds).toHaveLength(ownerOrder.length * 2);
    expect(report.firstTwoRoundSummary.pickCount).toBe(ownerOrder.length * 2);
    expect(report.firstTwoRoundSummary.averageSalePrice).toBeGreaterThan(
      report.firstTwoRoundSummary.averageAnchorPrice,
    );
    expect(report.firstTwoRounds[0]).toMatchObject({
      pick: 1,
      round: 1,
      nominator: "Beaton",
    });
    expect(report.firstTwoRounds.every(pick => pick.anchorPrice > 0 && pick.salePrice > 0)).toBe(true);
    expect(report.warnings.some(warning => warning.includes("invalid roster"))).toBe(false);
    expect(report.warnings.some(warning => warning.includes("budget left"))).toBe(false);
  }, 15000);
});
