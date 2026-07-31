import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { normalizePlayerName } from "../src/data/normalizePlayerName.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildBasePrices } from "../src/modeling/basePricing.js";
import {
  buildKeeperScenarioSensitivityReport,
  keeperScenarioSensitivityCsv,
} from "../src/modeling/keeperScenarioSensitivity.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

describe("keeper scenario sensitivity report", () => {
  it("compares player availability and prices across keeper scenarios", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(projections, historicalRecords);
    const pricedNames = new Set(prices.map(price => price.normalizedName));
    const unpricedKeeperCount = new Set(
      keepers
        .map(keeper => normalizePlayerName(keeper.player))
        .filter(normalizedName => !pricedNames.has(normalizedName)),
    ).size;
    const report = buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: 60,
    });

    expect(report.summary).toMatchObject({
      scenarioKeys: ["confirmedOnly", "expected", "highRetention"],
      playerCount: prices.length + unpricedKeeperCount,
      reportedPlayerCount: 60,
      limit: 60,
      truncated: true,
      pricedPlayerCount: prices.length,
      unpricedKeeperCount,
    });
    expect(report.summary.availabilityChangeCount).toBeGreaterThan(0);
    expect(report.summary.reportedAvailabilityChangeCount).toBeGreaterThan(0);
    expect(report.summary.keeperRemovalChangeCount).toBeGreaterThan(report.summary.availabilityChangeCount);
    expect(report.summary.reportedKeeperRemovalChangeCount).toBeGreaterThan(
      report.summary.reportedAvailabilityChangeCount,
    );
    expect(report.summary.keeperRemovedCount).toBeGreaterThan(report.summary.availabilityChangeCount);
    expect(report.rows.length).toBeLessThanOrEqual(60);
    expect(report.rows[0]?.sortScore).toBeGreaterThanOrEqual(report.rows[1]?.sortScore ?? 0);

    const jaxon = report.rows.find(row => row.player === "Jaxon Smith-Njigba");
    expect(jaxon).toMatchObject({
      pricedPool: true,
      keeperRemoved: true,
      keeperRemovalChanged: true,
      availabilityChanged: true,
      unavailableScenarios: ["expected", "highRetention"],
      keeperRemovalScenarios: ["expected", "highRetention"],
      priceSpread: null,
      expectedVsConfirmedDelta: null,
      highRetentionVsExpectedDelta: null,
    });
    expect(jaxon?.scenarios.confirmedOnly).toMatchObject({
      available: true,
    });
    expect(jaxon?.scenarios.expected).toMatchObject({
      available: false,
      unavailableReason: "Seth assumed keeper at $42",
    });
    expect(jaxon?.scenarios.highRetention).toMatchObject({
      available: false,
      unavailableReason: "Seth assumed keeper at $42",
    });

    const csv = keeperScenarioSensitivityCsv(report);
    expect(csv).toContain("expected/highRetention: Seth assumed keeper at $42");

    const pat = report.rows.find(row => row.player === "Pat Freiermuth");
    expect(pat).toMatchObject({
      pricedPool: false,
      basePrice: null,
      publicAnchorValue: null,
      keeperRemoved: true,
      keeperRemovalChanged: true,
      availabilityChanged: false,
      unavailableScenarios: ["confirmedOnly", "expected", "highRetention"],
      keeperRemovalScenarios: ["expected", "highRetention"],
      priceSpread: null,
    });
    expect(pat?.scenarios.confirmedOnly).toMatchObject({
      available: false,
      keeperRemoved: false,
      unavailableReason: "outside priced auction pool",
    });
    expect(pat?.scenarios.expected).toMatchObject({
      available: false,
      keeperRemoved: true,
      unavailableReason: "Russ assumed keeper at $2",
    });

    const puka = report.rows.find(row => row.player === "Puka Nacua");
    expect(puka).toMatchObject({
      pricedPool: true,
      keeperRemoved: false,
      availabilityChanged: false,
    });
    expect(puka?.scenarios.expected.scenarioPrice).toBeGreaterThan(0);
    expect(puka?.priceSpread ?? -1).toBeGreaterThanOrEqual(0);
    expect(puka?.expectedVsConfirmedDelta).not.toBeNull();
  });

  it("keeps confirmed keeper removals visible even when availability does not change by scenario", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(projections, historicalRecords);
    const report = buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: prices.length,
    });
    const confirmedKeeper = keepers.find(keeper =>
      keeper.status === "confirmed" &&
      report.rows.some(row => row.player === keeper.player),
    );
    if (!confirmedKeeper) throw new Error("Expected at least one projected confirmed keeper.");

    const row = report.rows.find(candidate => candidate.player === confirmedKeeper.player);

    expect(row).toMatchObject({
      keeperRemoved: true,
      keeperRemovalChanged: false,
      availabilityChanged: false,
      unavailableScenarios: ["confirmedOnly", "expected", "highRetention"],
      keeperRemovalScenarios: ["confirmedOnly", "expected", "highRetention"],
      priceSpread: null,
    });
    expect(row?.scenarios.confirmedOnly).toMatchObject({
      available: false,
      unavailableReason: `${confirmedKeeper.owner} confirmed keeper at $${confirmedKeeper.newCost}`,
    });
  });
});
