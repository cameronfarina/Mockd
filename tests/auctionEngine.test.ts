import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { ownerOrder, positions, type Owner, type Position } from "../config/league.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import {
  buildAuctionConfig,
  buildAuctionPlayerPool,
  buildInitialRostersFromKeepers,
  buildOwnerAuctionBehaviors,
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

  it("lets owner behavior tune aggression and patience separately from market anchor", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1.12,
          scarcityChase: 1.15,
          replacementPatience: 1,
        },
        Hoody: {
          priceAggression: 0.92,
          scarcityChase: 0.85,
          replacementPatience: 0.9,
        },
      },
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        slope: 0.1,
        maxMultiplier: 1.2,
      },
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Contested RB", "RB", 40);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const aggressiveBid = sale.bids.find(bid => bid.owner === "Beaton")!;
    const patientBid = sale.bids.find(bid => bid.owner === "Hoody")!;
    expect(sale.winner).toBe("Beaton");
    expect(aggressiveBid.behaviorAggressionMultiplier).toBe(1.12);
    expect(aggressiveBid.amount).toBeGreaterThan(patientBid.amount);
    expect(target.price).toBe(40);
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
        ownerBehaviors: buildOwnerAuctionBehaviors(buildOwnerProfiles(historicalRecords)),
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
