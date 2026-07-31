import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { ownerOrder, positions, type Owner, type Position } from "../config/league.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import {
  buildAuctionConfig,
  buildAuctionPlayerPool,
  buildInitialRostersFromKeepers,
  buildOwnerDemandMultipliers,
  createAuctionOwnerStates,
  resolveAuctionSale,
  simulateAuction,
} from "../src/modeling/auctionEngine.js";
import { buildBasePrices } from "../src/modeling/basePricing.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "../src/modeling/keeperInflation.js";
import { buildOwnerProfiles } from "../src/modeling/ownerProfiles.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";
import type { Player } from "../src/types.js";
import { validateRoster } from "../src/validateMocks.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

const positionAmounts = (value: number): Record<Position, number> =>
  positions.reduce<Record<Position, number>>(
    (amounts, position) => ({ ...amounts, [position]: value }),
    { QB: value, RB: value, WR: value, TE: value, K: value, DST: value },
  );

const player = (name: string, position: Position, price: number, weeks1To4 = price): Player => ({
  name,
  position,
  price,
  week1: weeks1To4 / 4,
  weeks1To4,
});

describe("auction engine economics", () => {
  it("caps overspent owners without globally discounting the next tier", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ", "Seth"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        slope: 0.12,
        maxMultiplier: 1.25,
      },
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [player("Beaton elite buy", "WR", 80)],
        Hoody: [player("Hoody elite buy", "WR", 80)],
      },
    });
    const goodPlayer = player("Good-but-not-elite WR", "WR", 50);
    const sale = resolveAuctionSale(
      goodPlayer,
      ownerStates,
      [player("Replacement WR 1", "WR", 1), player("Replacement WR 2", "WR", 1)],
      config,
    );

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(["PJ", "Seth"]).toContain(sale.winner);
    expect(sale.price).toBeGreaterThan(goodPlayer.price);
    expect(goodPlayer.price).toBe(50);
    expect(Math.max(...sale.bids.filter(bid => ["Beaton", "Hoody"].includes(bid.owner)).map(bid => bid.amount)))
      .toBeLessThan(goodPlayer.price);
  });

  it("builds valid full-roster mocks from expected keepers and owner-local budgets", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(projections, historicalRecords);
    const expectedScenario = buildKeeperScenarios(keepers).find(scenario => scenario.key === "expected")!;
    const adjustedPrices = applyKeeperScenarioToPrices(prices, expectedScenario, keepers);
    const initialRostersByOwner = buildInitialRostersFromKeepers(
      keepers,
      projections,
      expectedScenario.includedKeeperStatuses,
    );
    const keeperCount = Object.values(initialRostersByOwner)
      .reduce((count, roster) => count + (roster?.length ?? 0), 0);
    const auctionPlayers = buildAuctionPlayerPool({
      pricedPlayers: adjustedPrices.availablePrices,
      projections,
      excludedNames: adjustedPrices.unavailableKeepers.map(keeper => keeper.player),
      targetCount: ownerOrder.length * 16 - keeperCount + 24,
    });
    const result = simulateAuction({
      players: auctionPlayers,
      initialRostersByOwner,
      config: buildAuctionConfig({
        ownerDemandMultipliers: buildOwnerDemandMultipliers(buildOwnerProfiles(historicalRecords)),
        seed: "economic-regression",
      }),
    });

    expect(result.picks).toHaveLength(ownerOrder.length * 16 - keeperCount);

    const draftedNames = new Set<string>();
    for (const owner of ownerOrder) {
      const roster = result.rosters[owner];
      expect(roster).toBeDefined();
      if (!roster) throw new Error(`Missing roster for ${owner}.`);

      const validation = validateRoster(roster);
      expect(validation.valid, `${owner}: ${validation.errors.join(", ")}`).toBe(true);
      for (const rosterPlayer of roster.players) draftedNames.add(rosterPlayer.name);
    }

    expect(draftedNames.size).toBe(ownerOrder.length * 16);
  });
});
