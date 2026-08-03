import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildBasePrices } from "../src/modeling/basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
} from "../src/modeling/keeperInflation.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

const expectNear = (actual: number, expected: number, tolerance = 0.0001): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

const names = (players: { name: string }[]): Set<string> =>
  new Set(players.map(player => player.name));

describe("keeper inflation scenarios", () => {
  it("calculates confirmed-only, expected, and high-retention inflation factors", () => {
    const scenarios = buildKeeperScenarios(keepers);
    const confirmedOnly = scenarios.find(scenario => scenario.key === "confirmedOnly")!;
    const expected = scenarios.find(scenario => scenario.key === "expected")!;
    const highRetention = scenarios.find(scenario => scenario.key === "highRetention")!;

    expect(confirmedOnly.keeperCounts).toEqual({ QB: 0, RB: 4, WR: 0, TE: 0, K: 0, DST: 0 });
    expect(confirmedOnly.totalKeeperCost).toBe(61);
    expect(confirmedOnly.openAuctionDollars).toBe(2739);
    expectNear(confirmedOnly.globalFactor, 2739 / 2596.5);
    expect(confirmedOnly.positionFactors.RB).toBeLessThan(confirmedOnly.globalFactor);
    expect(confirmedOnly.positionFactors.WR).toBeLessThan(confirmedOnly.globalFactor);

    expect(expected.keeperCounts).toEqual({ QB: 1, RB: 6, WR: 6, TE: 1, K: 0, DST: 0 });
    expect(expected.totalKeeperCost).toBe(163);
    expect(expected.openAuctionDollars).toBe(2637);
    expectNear(expected.globalFactor, 2637 / 2596.5);
    expectNear(expected.positionFactors.RB, expected.globalFactor);
    expectNear(expected.positionFactors.WR, expected.globalFactor);

    expect(highRetention.keeperCounts).toEqual({ QB: 1, RB: 8, WR: 5, TE: 1, K: 0, DST: 0 });
    expect(highRetention.totalKeeperCost).toBe(159);
    expect(highRetention.openAuctionDollars).toBe(2641);
    expectNear(highRetention.globalFactor, 2641 / 2596.5);
    expect(highRetention.positionFactors.RB).toBeGreaterThan(highRetention.globalFactor);
    expect(highRetention.positionFactors.WR).toBeLessThan(highRetention.globalFactor);
    expectNear(highRetention.positionFactors.TE, highRetention.globalFactor);
  });

  it("removes known keepers from the auction pool by scenario status", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(projections, historicalRecords);
    const scenarios = buildKeeperScenarios(keepers);
    const baseNames = names(prices);

    const confirmedOnly = applyKeeperScenarioToPrices(
      prices,
      scenarios.find(scenario => scenario.key === "confirmedOnly")!,
      keepers,
    );
    const expected = applyKeeperScenarioToPrices(
      prices,
      scenarios.find(scenario => scenario.key === "expected")!,
      keepers,
    );

    const confirmedNames = names(confirmedOnly.availablePrices);
    expect(confirmedNames.has("Bucky Irving")).toBe(false);
    expect(confirmedNames.has("Rhamondre Stevenson")).toBe(false);
    expect(confirmedNames.has("De'Von Achane")).toBe(false);
    expect(confirmedNames.has("Justin Herbert")).toBe(true);
    expect(confirmedNames.has("Javonte Williams")).toBe(false);
    expect(confirmedNames.has("Jaxon Smith-Njigba")).toBe(true);

    const expectedNames = names(expected.availablePrices);
    expect(expectedNames.has("Jaxon Smith-Njigba")).toBe(false);
    if (baseNames.has("Pat Freiermuth")) {
      expect(confirmedNames.has("Pat Freiermuth")).toBe(true);
      expect(expectedNames.has("Pat Freiermuth")).toBe(false);
    }

    const pukaBasePrice = prices.find(price => price.name === "Puka Nacua")!;
    const pukaScenarioPrice = expected.availablePrices.find(price => price.name === "Puka Nacua")!;
    const expectedScenario = scenarios.find(scenario => scenario.key === "expected")!;
    expect(pukaScenarioPrice.scenarioPrice).toBe(
      Math.round(pukaBasePrice.price * expectedScenario.positionFactors.WR),
    );
  });
});
