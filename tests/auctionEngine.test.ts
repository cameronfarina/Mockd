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
  buildOwnerRosterMaximums,
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
const fullMockReplacementBuffer = 160;

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

  it("defaults replacement-pool players to one-dollar fallback prices", () => {
    const pool = buildAuctionPlayerPool({
      pricedPlayers: [],
      projections: [
        projection(1, "Replacement RB", "RB", 80),
        projection(2, "Replacement WR", "WR", 70),
        projection(3, "Replacement TE", "TE", 60),
      ],
      targetCount: 3,
    });

    expect(pool.map(poolPlayer => poolPlayer.price)).toEqual([1, 1, 1]);
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

  it("keeps replacement-level player bids at the minimum bid without a late opening bump", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 10,
      rosterSize: 1,
      rosterMaximums: positionAmounts(1),
      starterMinimums: {
        ...positionAmounts(0),
        WR: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {
        Beaton: { WR: 1.4 },
        Hoody: { WR: 1.4 },
      },
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1.3,
          scarcityChase: 1.2,
          replacementPatience: 1.05,
        },
        Hoody: {
          priceAggression: 1.3,
          scarcityChase: 1.2,
          replacementPatience: 1.05,
        },
      },
      scarcity: {
        maxMultiplier: 1.15,
      },
      lateOpeningBid: {
        startRosterSlotsRemaining: 0,
      },
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const sale = resolveAuctionSale(
      player("Endgame WR", "WR", 1),
      ownerStates,
      [player("Other Endgame WR", "WR", 1)],
      config,
    );

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected replacement-level sale to resolve.");

    expect(Math.max(...sale.bids.map(bid => bid.amount))).toBe(1);
    expect(sale.price).toBe(1);
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

  it("derives owner-specific roster maximums from backup-position history", async () => {
    const historicalRecords = await loadHistoricalAuctionRecords();
    const maximums = buildOwnerRosterMaximums(buildOwnerProfiles(historicalRecords));

    expect(maximums.CJ?.QB).toBe(1);
    expect(maximums.Tye?.QB).toBeUndefined();
    expect(maximums.Seth?.TE).toBe(1);
    expect(maximums.PJ?.TE).toBeUndefined();
  });

  it("applies owner-specific roster maximums during bidding", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerRosterMaximums: {
        Beaton: { QB: 1 },
      },
      seed: "owner-roster-maximums",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [player("Beaton starter QB", "QB", 20)],
      },
    });
    const sale = resolveAuctionSale(player("Backup QB", "QB", 10), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.bids.some(bid => bid.owner === "Beaton")).toBe(false);
    expect(sale.bids.some(bid => bid.owner === "Hoody")).toBe(true);
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

  it("raises mid-auction bids for cash-heavy owners while depleted owners stay constrained", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 5,
      rosterMaximums: positionAmounts(5),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      scarcity: {
        maxMultiplier: 1,
      },
      endgameSpend: {
        startRosterSlotsRemaining: 2,
      },
      budgetPacing: {
        targetBudgetPerSlotAfterPurchase: 10,
        slope: 1,
        maxDiscount: 0.5,
        minimumPlayerPrice: 10,
      },
      roomPressure: {
        startRosterSlotsRemaining: 5,
        minRosterSlotsRemainingExclusive: 2,
        targetBudgetPerSlot: 10,
        slope: 0.6,
        maxMultiplier: 1.2,
        minimumPlayerPrice: 30,
        maximumPlayerPrice: 55,
      },
      seed: "mid-auction-pressure",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [player("Beaton early elite", "RB", 75)],
        Hoody: [player("Hoody early elite", "WR", 74)],
      },
    });
    const target = player("Good scarce RB", "RB", 45);
    const sale = resolveAuctionSale(target, ownerStates, [player("Fallback RB", "RB", 1)], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const pjBid = sale.bids.find(bid => bid.owner === "PJ");
    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    const hoodyBid = sale.bids.find(bid => bid.owner === "Hoody");
    expect(pjBid).toBeDefined();
    expect(beatonBid).toBeDefined();
    expect(hoodyBid).toBeDefined();
    expect(pjBid?.roomPressureMultiplier).toBeGreaterThan(1);
    expect(pjBid?.endgamePressureMultiplier).toBe(1);
    expect(pjBid?.uncappedAmount).toBeGreaterThan(target.price);
    expect(beatonBid?.roomPressureMultiplier).toBe(1);
    expect(beatonBid?.budgetPacingMultiplier).toBeLessThan(1);
    expect(beatonBid?.amount).toBeLessThan(target.price);
    expect(hoodyBid?.roomPressureMultiplier).toBe(1);
    expect(hoodyBid?.budgetPacingMultiplier).toBeLessThan(1);
    expect(hoodyBid?.amount).toBeLessThan(target.price);
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

  it("lets cash-heavy nominators open late depth players above anchor", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 20,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "late-opening-bid",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [player("Beaton anchor", "RB", 14)],
        Hoody: [player("Hoody anchor", "WR", 18)],
      },
    });
    const target = player("Late depth WR", "WR", 3);
    const sale = resolveAuctionSale(target, ownerStates, [], config, { nominator: "Beaton" });

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(sale.winner).toBe("Beaton");
    expect(beatonBid?.uncappedAmount).toBe(6);
    expect(sale.price).toBe(6);
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

  it("damps wide receiver overbids without changing the WR anchor", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const overrides = {
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
      seed: "wr-overbid-damping",
    };
    const config = buildAuctionConfig(overrides);
    const undampedConfig = buildAuctionConfig({
      ...overrides,
      positionOverbidDamping: {},
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const undampedOwnerStates = createAuctionOwnerStates({ config: undampedConfig });
    const target = player("Strong WR", "WR", 48);
    const sale = resolveAuctionSale(target, ownerStates, [], config);
    const undampedSale = resolveAuctionSale(target, undampedOwnerStates, [], undampedConfig);

    expect(sale).toBeDefined();
    expect(undampedSale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");
    if (!undampedSale) throw new Error("Expected undamped sale to resolve.");

    const bid = sale.bids[0];
    const undampedBid = undampedSale.bids[0];
    expect(bid).toBeDefined();
    expect(undampedBid).toBeDefined();
    expect(bid?.positionOverbidDampingMultiplier).toBeLessThan(1);
    expect(undampedBid?.positionOverbidDampingMultiplier).toBe(1);
    expect(bid?.uncappedAmount).toBeGreaterThanOrEqual(target.price);
    expect(bid?.uncappedAmount).toBeLessThan(undampedBid?.uncappedAmount ?? 0);
    expect(sale.marketPrice).toBe(48);
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

  it("keeps near-elite anchors from adding extra $75-plus sales", () => {
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
          priceAggression: 1.25,
          scarcityChase: 1,
          replacementPatience: 1,
        },
        Hoody: {
          priceAggression: 1.25,
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
        premiumThreshold: 72,
        capBelowPremiumThresholdAt: 74,
      },
      seed: "near-elite-sale-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Near elite RB", "RB", 70);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.marketPrice).toBe(70);
    expect(sale.price).toBe(74);
  });

  it("keeps sub-elite anchors from adding extra $80-plus sales", () => {
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
        startPrice: 50,
        fullEffectPrice: 75,
        maxOverbidDiscount: 0,
      },
      topEndSaleGuard: {
        eliteThreshold: 80,
        capBelowEliteThresholdAt: 79,
      },
      seed: "elite-sale-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Sub elite RB", "RB", 77);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.marketPrice).toBe(77);
    expect(sale.price).toBe(79);
  });

  it("keeps starter-tier anchors from adding extra $40-plus sales", () => {
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
      tierSaleGuard: {
        threshold: 40,
        capBelowThresholdAt: 39,
      },
      seed: "starter-tier-sale-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Starter WR", "WR", 39);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.marketPrice).toBe(39);
    expect(sale.price).toBe(39);
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
      targetCount: ownerOrder.length * 16 - keeperCount + fullMockReplacementBuffer,
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
      const counts = positions.reduce<Record<Position, number>>(
        (totals, position) => ({
          ...totals,
          [position]: roster.players.filter(player => player.position === position).length,
        }),
        { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      );
      expect(counts.QB, `${owner} QB count`).toBeLessThanOrEqual(2);
      expect(counts.K, `${owner} K count`).toBeLessThanOrEqual(1);
      expect(counts.DST, `${owner} DST count`).toBeLessThanOrEqual(1);
      for (const rosterPlayer of roster.players) draftedNames.add(rosterPlayer.name);
    }

    expect(draftedNames.size).toBe(ownerOrder.length * 16);
  });
});
