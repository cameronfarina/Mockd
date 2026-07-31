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
import { loadEspnWeeksOneToFour, type ProjectionRecord } from "../src/projections.js";
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

const projection = (
  id: number,
  name: string,
  position: Position,
  weeks1To4: number,
): ProjectionRecord => ({
  id,
  name,
  position,
  weeks: { 1: weeks1To4 },
  weeks1To4,
});

describe("auction engine economics", () => {
  it("uses a descending price ladder for replacement-pool players before falling back to $1", () => {
    const pool = buildAuctionPlayerPool({
      pricedPlayers: [
        {
          id: 1,
          name: "Priced RB",
          position: "RB",
          price: 12,
          weeks1To4: 50,
        },
      ],
      projections: [
        projection(1, "Priced RB", "RB", 50),
        projection(2, "Replacement 1", "RB", 49),
        projection(3, "Replacement 2", "WR", 48),
        projection(4, "Replacement 3", "RB", 47),
        projection(5, "Replacement 4", "WR", 46),
        projection(6, "Replacement 5", "TE", 45),
        projection(7, "Replacement 6", "RB", 44),
      ],
      targetCount: 7,
      replacementPriceLadder: [
        { count: 2, price: 6 },
        { count: 2, price: 3 },
      ],
      replacementPrice: 1,
    });

    const replacementPrices = pool
      .filter(poolPlayer => poolPlayer.name.startsWith("Replacement"))
      .sort((left, right) => right.price - left.price || right.weeks1To4 - left.weeks1To4)
      .map(poolPlayer => poolPlayer.price);

    expect(replacementPrices).toEqual([6, 6, 3, 3, 1, 1]);
  });

  it("keeps replacement kickers and defenses at the fallback price", () => {
    const pool = buildAuctionPlayerPool({
      pricedPlayers: [],
      projections: [
        projection(1, "Replacement K", "K", 80),
        projection(2, "Replacement RB", "RB", 70),
        projection(3, "Replacement DST", "DST", 60),
      ],
      targetCount: 3,
      replacementPriceLadder: [{ count: 3, price: 6 }],
      replacementPrice: 1,
    });

    expect(pool.find(poolPlayer => poolPlayer.name === "Replacement RB")?.price).toBe(6);
    expect(pool.find(poolPlayer => poolPlayer.name === "Replacement K")?.price).toBe(1);
    expect(pool.find(poolPlayer => poolPlayer.name === "Replacement DST")?.price).toBe(1);
  });

  it("records the rotating nominator while elite market names come off early", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 1,
      rosterMaximums: positionAmounts(1),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "nomination-order",
    });

    const result = simulateAuction({
      players: [
        player("Later value WR", "WR", 35),
        player("Elite market RB", "RB", 70),
      ],
      config,
    });

    expect(result.picks[0]).toMatchObject({
      nominator: "Beaton",
      player: "Elite market RB",
    });
  });

  it("lets the current nominator target an affordable roster need instead of the next luxury player", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ"];
    const starterMinimums = {
      ...positionAmounts(0),
      RB: 1,
    };
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums,
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "nomination-needs",
    });

    const result = simulateAuction({
      players: [
        player("Elite opening WR", "WR", 70),
        player("Luxury QB", "QB", 60),
        player("Hoody reachable RB", "RB", 18),
        player("Fallback RB 1", "RB", 17),
        player("Fallback RB 2", "RB", 16),
      ],
      initialRostersByOwner: {
        Hoody: [player("Hoody kept QB", "QB", 80)],
      },
      config,
    });

    expect(result.picks[1]).toMatchObject({
      nominator: "Hoody",
      player: "Hoody reachable RB",
    });
  });

  it("continues the nomination rotation after skipping owners with full rosters", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ", "Seth"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 1,
      rosterMaximums: positionAmounts(1),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {
        Seth: {
          RB: 1.4,
        },
      },
      seed: "nomination-full-skip",
    });

    const result = simulateAuction({
      players: [
        player("Elite RB", "RB", 50),
        player("Value WR", "WR", 40),
        player("Fallback QB", "QB", 30),
      ],
      initialRostersByOwner: {
        Beaton: [player("Beaton kept TE", "TE", 1)],
      },
      config,
    });

    expect(result.picks.slice(0, 2).map(pick => pick.nominator)).toEqual(["Hoody", "PJ"]);
  });

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

  it("derives separate anchor and depth tendencies from owner build profiles", async () => {
    const historicalRecords = await loadHistoricalAuctionRecords();
    const profiles = buildOwnerProfiles(historicalRecords);
    const behaviors = buildOwnerAuctionBehaviors(profiles);

    const mello = behaviors.Mello;
    const tye = behaviors.Tye;
    expect(mello).toBeDefined();
    expect(tye).toBeDefined();
    if (!mello || !tye) throw new Error("Expected owner behaviors for Mello and Tye.");

    const melloAnchorAggression = mello.anchorAggression;
    const tyeAnchorAggression = tye.anchorAggression;
    const melloDepthAggression = mello.depthAggression;
    const tyeDepthAggression = tye.depthAggression;
    if (
      melloAnchorAggression === undefined ||
      tyeAnchorAggression === undefined ||
      melloDepthAggression === undefined ||
      tyeDepthAggression === undefined
    ) {
      throw new Error("Expected complete build-style behavior controls.");
    }

    expect(melloAnchorAggression).toBeGreaterThan(tyeAnchorAggression);
    expect(melloDepthAggression).toBeLessThan(tyeDepthAggression);
    expect(melloDepthAggression).toBeLessThan(1);
    expect(tyeDepthAggression).toBeGreaterThan(1);
  });

  it("applies build-style behavior differently to anchor and depth bids", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1.1,
          depthAggression: 0.9,
        },
        Hoody: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      seed: "build-style-bids",
    });
    const ownerStates = createAuctionOwnerStates({ config });

    const anchorSale = resolveAuctionSale(player("Anchor RB", "RB", 45), ownerStates, [], config);
    expect(anchorSale).toBeDefined();
    if (!anchorSale) throw new Error("Expected anchor sale to resolve.");

    const anchorTopHeavyBid = anchorSale.bids.find(bid => bid.owner === "Beaton")!;
    const anchorBalancedBid = anchorSale.bids.find(bid => bid.owner === "Hoody")!;
    expect(anchorTopHeavyBid.buildStyleMultiplier).toBe(1.1);
    expect(anchorTopHeavyBid.amount).toBeGreaterThan(anchorBalancedBid.amount);

    const depthSale = resolveAuctionSale(player("Depth RB", "RB", 12), ownerStates, [], config);
    expect(depthSale).toBeDefined();
    if (!depthSale) throw new Error("Expected depth sale to resolve.");

    const depthTopHeavyBid = depthSale.bids.find(bid => bid.owner === "Beaton")!;
    const depthBalancedBid = depthSale.bids.find(bid => bid.owner === "Hoody")!;
    expect(depthTopHeavyBid.buildStyleMultiplier).toBe(0.9);
    expect(depthTopHeavyBid.amount).toBeLessThan(depthBalancedBid.amount);
  });

  it("raises bids for cash-heavy owners late in the auction", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 4,
      rosterMaximums: positionAmounts(4),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "endgame-pressure",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [
          player("Beaton bench RB", "RB", 1),
          player("Beaton bench WR", "WR", 1),
          player("Beaton bench TE", "TE", 1),
        ],
        Hoody: [
          player("Hoody starter RB", "RB", 40),
          player("Hoody starter WR", "WR", 35),
          player("Hoody bench TE", "TE", 10),
        ],
      },
    });
    const target = player("Late useful WR", "WR", 20);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.endgamePressureMultiplier).toBeGreaterThan(1);
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(target.price);
  });

  it("discounts bids that would strand too little budget for remaining roster slots", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 5,
      rosterMaximums: positionAmounts(5),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      budgetPacing: {
        targetBudgetPerSlotAfterPurchase: 10,
        slope: 1,
        maxDiscount: 0.5,
        minimumPlayerPrice: 10,
      },
      seed: "budget-pacing",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [player("Beaton early star", "RB", 60)],
        Hoody: [player("Hoody value start", "WR", 10)],
      },
    });
    const target = player("Budget-stranding WR", "WR", 30);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.budgetPacingMultiplier).toBeLessThan(1);
    expect(beatonBid?.uncappedAmount).toBeLessThan(target.price);
  });

  it("damps only the over-anchor portion of elite bids", () => {
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
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
        },
        Hoody: {
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
        },
      },
      topEndOverbidDamping: {
        startPrice: 55,
        fullEffectPrice: 75,
        maxOverbidDiscount: 0.65,
      },
      seed: "top-end-damping",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Elite WR", "WR", 75);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const bid = sale.bids[0];
    expect(bid).toBeDefined();
    expect(bid?.topEndDampingMultiplier).toBeLessThan(1);
    expect(bid?.uncappedAmount).toBeGreaterThanOrEqual(target.price);
    expect(bid?.uncappedAmount).toBeLessThan(90);
  });

  it("damps quarterback overbids without changing the QB anchor", () => {
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
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
        },
        Hoody: {
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
        },
      },
      positionOverbidDamping: {
        QB: 0.75,
      },
      seed: "qb-overbid-damping",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Top QB", "QB", 36);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const bid = sale.bids[0];
    expect(bid).toBeDefined();
    expect(bid?.positionOverbidDampingMultiplier).toBeLessThan(1);
    expect(bid?.uncappedAmount).toBeGreaterThanOrEqual(target.price);
    expect(bid?.uncappedAmount).toBeLessThan(43);
    expect(sale.marketPrice).toBe(36);
  });

  it("discounts backup quarterback bids after an owner has a starter", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: {
        ...positionAmounts(0),
        QB: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      rosterNeed: {
        benchQuarterbackMultiplier: 0.5,
      },
      seed: "backup-qb-discount",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [player("Kept QB", "QB", 20)],
      },
    });
    const target = player("Backup QB", "QB", 18);
    const sale = resolveAuctionSale(target, ownerStates, [player("Fallback QB", "QB", 1)], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.rosterNeedMultiplier).toBe(0.5);
    expect(beatonBid?.uncappedAmount).toBeLessThan(target.price);
  });

  it("damps tight end overbids without changing the TE anchor", () => {
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
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
        },
        Hoody: {
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
        },
      },
      positionOverbidDamping: {
        TE: 0.75,
      },
      seed: "te-overbid-damping",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Elite TE", "TE", 39);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const bid = sale.bids[0];
    expect(bid).toBeDefined();
    expect(bid?.positionOverbidDampingMultiplier).toBeLessThan(1);
    expect(bid?.uncappedAmount).toBeGreaterThanOrEqual(target.price);
    expect(bid?.uncappedAmount).toBeLessThan(47);
    expect(sale.marketPrice).toBe(39);
  });

  it("discounts backup tight end bids after an owner has a starter", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: {
        ...positionAmounts(0),
        TE: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      rosterNeed: {
        benchTightEndMultiplier: 0.6,
      },
      seed: "backup-te-discount",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [player("Kept TE", "TE", 20)],
      },
    });
    const target = player("Backup TE", "TE", 18);
    const sale = resolveAuctionSale(target, ownerStates, [player("Fallback TE", "TE", 1)], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.rosterNeedMultiplier).toBe(0.6);
    expect(beatonBid?.uncappedAmount).toBeLessThan(target.price);
  });

  it("keeps sub-threshold anchors from crossing the high-price sale boundary", () => {
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
          priceAggression: 1.3,
          scarcityChase: 1,
          replacementPatience: 1,
        },
        Hoody: {
          priceAggression: 1.3,
          scarcityChase: 1,
          replacementPatience: 1,
        },
      },
      topEndOverbidDamping: {
        startPrice: 50,
        fullEffectPrice: 75,
        maxOverbidDiscount: 0,
      },
      topEndSaleGuard: {
        threshold: 70,
        capBelowThresholdAt: 69,
      },
      seed: "top-end-sale-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Nearly elite RB", "RB", 68);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.marketPrice).toBe(68);
    expect(sale.price).toBe(69);
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
    expect(result.picks.every(pick => ownerOrder.includes(pick.nominator))).toBe(true);

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
