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
    expect(audit.gates.summary.status).toBe("fail");
    expect(audit.gates.summary.failCount).toBeGreaterThan(0);
    expect(audit.gates.summary.credible).toBe(false);
    expect(audit.historicalSeasons).toEqual([2023, 2024, 2025]);
    expect(audit.priceTiers.map(tier => tier.key)).toEqual(["elite", "strong", "starter", "depth", "dollar"]);
    expect(audit.highPriceVolumes.map(volume => volume.threshold)).toEqual([70, 75, 80]);
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

    const dollarPlayerGate = audit.gates.items.find(gate => gate.key === "price-tier-count:dollar");
    expect(dollarPlayerGate).toMatchObject({
      category: "price_tier_count",
      label: "$1 player count",
      status: "warn",
      target: audit.overall.historicalAverageDollarPlayers,
      actual: audit.overall.mockAverageDollarPlayers,
      delta: audit.overall.dollarPlayerDelta,
    });
    expect(dollarPlayerGate?.warnThreshold).toBeLessThan(dollarPlayerGate?.failThreshold ?? 0);

    const eightyPlusVolume = audit.highPriceVolumes.find(volume => volume.threshold === 80);
    expect(eightyPlusVolume).toMatchObject({
      historicalAverageCount: 0.33,
      historicalMaxCount: 1,
    });
    expect(eightyPlusVolume?.mockMaxCount).toBeLessThanOrEqual(eightyPlusVolume?.historicalMaxCount ?? 0);

    const eightyPlusGate = audit.gates.items.find(gate => gate.key === "high-price-volume:80-plus");
    expect(eightyPlusGate).toMatchObject({
      category: "high_price_volume",
      label: "$80+ player count",
      status: "pass",
      target: eightyPlusVolume?.historicalMaxCount,
      actual: eightyPlusVolume?.mockMaxCount,
      delta: eightyPlusVolume?.maxCountDelta,
    });

    const invalidRosterGate = audit.gates.items.find(gate => gate.key === "roster-validity");
    expect(invalidRosterGate).toMatchObject({
      category: "roster_validity",
      status: "pass",
      target: 0,
      actual: 0,
      delta: 0,
    });
  });
});
