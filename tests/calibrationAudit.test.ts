import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { ownerOrder, positions } from "../config/league.js";
import { buildHistoricalCalibrationAudit } from "../src/modeling/calibrationAudit.js";
import { runMockBatch } from "../src/modeling/mockBatch.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("historical calibration audit", () => {
  it("compares batch mock economics to historical league auctions", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 2,
      seedPrefix: "calibration-test",
    });
    const audit = buildHistoricalCalibrationAudit({ historicalRecords, batch });

    expect(audit.runCount).toBe(2);
    expect(audit.summary.runCount).toBe(2);
    expect(audit.summary.scenarioKeys).toEqual(["expected"]);
    expect(audit.summary.runsPerScenario).toBe(2);
    expect(audit.historicalSeasons).toEqual([2023, 2024, 2025]);
    expect(audit.priceTiers.map(tier => tier.key)).toEqual(["elite", "strong", "starter", "depth", "dollar"]);
    expect(audit.positionSpend.map(position => position.position)).toEqual([...positions]);
    expect(audit.ownerSpend).toHaveLength(ownerOrder.length);
    expect(audit.overall.mockAverageAuctionSpend).toBeGreaterThan(0);
    expect(audit.overall.historicalAverageAuctionSpend).toBeGreaterThan(0);

    const rbSpend = audit.positionSpend.find(position => position.position === "RB");
    expect(rbSpend).toBeDefined();
    expect(Number.isFinite(rbSpend?.delta ?? Number.NaN)).toBe(true);

    const beaton = audit.ownerSpend.find(owner => owner.owner === "Beaton");
    expect(beaton).toBeDefined();
    expect(Number.isFinite(beaton?.mockAverageAuctionSpend ?? Number.NaN)).toBe(true);

    expect(audit.summary.largestPriceTierCountDeltas).toHaveLength(3);
    expect(audit.summary.largestPositionSpendDeltas).toHaveLength(3);
    expect(audit.summary.largestOwnerSpendDeltas).toHaveLength(5);
    expect(audit.summary.budgetRemaining.leagueAverageBudgetRemaining).toBeGreaterThanOrEqual(0);
    expect(audit.summary.budgetRemaining.ownersWithAverageBudgetRemaining.every(owner =>
      owner.averageBudgetRemaining > 0,
    )).toBe(true);
  });
});
