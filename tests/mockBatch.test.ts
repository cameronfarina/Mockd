import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { ownerOrder } from "../config/league.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { runMockBatch } from "../src/modeling/mockBatch.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("mock batch simulation", () => {
  it("summarizes deterministic auction batches across seeds", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 2,
      seedPrefix: "batch-smoke",
    });

    expect(batch.runs).toHaveLength(2);
    expect(batch.summary.runCount).toBe(2);
    expect(batch.summary.scenarios).toEqual([
      {
        key: "expected",
        label: "Expected",
        runCount: 2,
        invalidRosterCount: 0,
        averagePickCount: 218,
      },
    ]);

    const jahmyr = batch.summary.players.find(player => player.name === "Jahmyr Gibbs");
    expect(jahmyr).toBeDefined();
    expect(jahmyr?.draftedCount).toBe(2);
    expect(jahmyr?.averageSalePrice).toBeGreaterThan(70);
    expect(jahmyr?.minimumSalePrice).toBeLessThanOrEqual(jahmyr?.maximumSalePrice ?? 0);

    expect(batch.summary.owners).toHaveLength(ownerOrder.length);
    expect(batch.summary.owners.every(owner => owner.invalidRosterCount === 0)).toBe(true);
    expect(batch.summary.owners.every(owner => owner.averageSpend <= 200)).toBe(true);

    const firstRun = batch.runs[0];
    if (!firstRun) throw new Error("Expected at least one run.");
    expect(firstRun.budgetTrajectory).toHaveLength((firstRun.pickCount + 1) * ownerOrder.length);
    expect(firstRun.budgetTrajectory[0]).toEqual(expect.objectContaining({
      event: "initial",
      pick: 0,
      owner: ownerOrder[0],
      budgetRemaining: expect.any(Number),
      initialSpend: expect.any(Number),
      auctionSpend: 0,
      rosterSlotsRemaining: expect.any(Number),
      maxBid: expect.any(Number),
    }));
    const finalSnapshots = firstRun.budgetTrajectory.filter(row => row.pick === firstRun.pickCount);
    expect(finalSnapshots).toHaveLength(ownerOrder.length);
    expect(finalSnapshots.every(row => row.rosterSlotsRemaining === 0)).toBe(true);
    for (const roster of firstRun.rosters) {
      const finalSnapshot = finalSnapshots.find(row => row.owner === roster.owner);
      expect(finalSnapshot?.spent).toBe(roster.spend);
      expect(finalSnapshot?.budgetRemaining).toBe(roster.budgetRemaining);
      expect(finalSnapshot?.initialSpend ?? 0).toBeGreaterThanOrEqual(0);
      expect(finalSnapshot?.auctionSpend ?? 0).toBeGreaterThanOrEqual(0);
      expect((finalSnapshot?.initialSpend ?? 0) + (finalSnapshot?.auctionSpend ?? 0)).toBe(roster.spend);
      expect(finalSnapshot?.budgetPerRosterSlot).toBeNull();
    }

    const exposure = batch.summary.ownerPlayerExposure.find(entry => entry.player === "Jahmyr Gibbs");
    expect(exposure).toBeDefined();
    expect(exposure?.draftedCount).toBeGreaterThan(0);
  }, 15000);

  it("can run lightweight batches for draft-plan mining without heavy diagnostics", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const baseOptions = {
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"] as const,
      runsPerScenario: 1,
      seedPrefix: "batch-lightweight",
    };
    const fullBatch = runMockBatch(baseOptions);
    const lightweightBatch = runMockBatch({
      ...baseOptions,
      diagnosticsMode: "summary",
    });
    const fullRun = fullBatch.runs[0];
    const lightweightRun = lightweightBatch.runs[0];
    if (!fullRun || !lightweightRun) throw new Error("Expected both batches to produce a run.");

    expect(lightweightRun.seed).toBe(fullRun.seed);
    expect(lightweightRun.pickCount).toBe(fullRun.pickCount);
    expect(lightweightRun.budgetTrajectory).toEqual([]);
    expect(lightweightRun.picks).toHaveLength(fullRun.picks.length);
    expect(lightweightRun.picks.every(pick => pick.topBids.length === 0)).toBe(true);
    expect(lightweightRun.picks.map(pick => ({
      owner: pick.owner,
      player: pick.player,
      price: pick.price,
    }))).toEqual(fullRun.picks.map(pick => ({
      owner: pick.owner,
      player: pick.player,
      price: pick.price,
    })));
    expect(lightweightRun.rosters.map(roster => ({
      owner: roster.owner,
      spend: roster.spend,
      budgetRemaining: roster.budgetRemaining,
      valid: roster.valid,
    }))).toEqual(fullRun.rosters.map(roster => ({
      owner: roster.owner,
      spend: roster.spend,
      budgetRemaining: roster.budgetRemaining,
      valid: roster.valid,
    })));
  }, 15000);
});
