import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { leagueConfig, ownerOrder, positions, type Owner, type Position } from "../config/league.js";
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

  it("carries context adjustment metadata from priced players into the auction pool", () => {
    const pool = buildAuctionPlayerPool({
      pricedPlayers: [
        {
          id: 1,
          name: "Context WR",
          position: "WR",
          price: 50,
          scenarioPrice: 52,
          weeks1To4: 80,
          contextAdjustmentPercent: -0.105,
          contextEvidence: [
            { category: "risk" },
            { category: "environment" },
          ],
        },
      ],
      projections: [],
      targetCount: 1,
    });

    expect(pool[0]).toMatchObject({
      name: "Context WR",
      price: 52,
      contextAdjustmentPercent: -0.105,
      contextEvidenceCount: 2,
    });
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
    expect(result.picks[0]?.nominationDiagnostics).toMatchObject({
      selectedPlayer: "Elite market RB",
      candidateCount: 2,
    });
    const openingNomination = result.picks[0]?.nominationDiagnostics;
    expect(openingNomination?.selectedScore).toBe(openingNomination?.topCandidates[0]?.score);
    expect(openingNomination?.topCandidates.length ?? 0).toBeLessThanOrEqual(3);
    expect(openingNomination?.topCandidates.every((candidate, index, candidates) =>
      index === 0 || candidate.score <= candidates[index - 1]!.score,
    )).toBe(true);
    expect(result.picks[0]?.nominationDiagnostics.topCandidates[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        player: "Elite market RB",
        position: "RB",
        marketPrice: 70,
        score: expect.any(Number),
        scoreComponents: expect.objectContaining({
          marketPrice: 1,
          ownerNeed: 0.2,
        }),
        weightedComponents: expect.objectContaining({
          marketPrice: expect.any(Number),
        }),
      }),
    );
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
    expect(result.picks[1]?.nominationDiagnostics.topCandidates[0]).toMatchObject({
      player: "Hoody reachable RB",
      scoreComponents: expect.objectContaining({
        ownerNeed: 1,
        affordability: 1,
      }),
    });
    expect(result.picks[1]?.player).toBe("Hoody reachable RB");
  });

  it("lets nominators attack scarce roster holes that opponents still need", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ"];
    const starterMinimums = {
      ...positionAmounts(0),
      RB: 1,
    };
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(3),
      starterMinimums,
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      nomination: {
        earlyEliteBiasPicks: 0,
        marketPriceWeight: 1,
        projectionWeight: 0,
        ownerNeedWeight: 0,
        affordabilityWeight: 0,
        scarcityWeight: 0,
        flushMoneyWeight: 0,
        tieBreakWeight: 0,
      },
      seed: "nomination-opponent-needs",
    });

    const result = simulateAuction({
      players: [
        player("Luxury QB", "QB", 24),
        player("Opponent-needed RB", "RB", 20),
        player("Useful WR", "WR", 8),
        player("Useful TE", "TE", 6),
        player("Fallback RB", "RB", 1),
      ],
      initialRostersByOwner: {
        Beaton: [player("Beaton kept RB", "RB", 10)],
      },
      config,
    });

    expect(result.picks[0]).toMatchObject({
      nominator: "Beaton",
      player: "Opponent-needed RB",
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

    expect(maximums.Beaton?.QB).toBe(2);
    expect(maximums.CJ?.QB).toBe(1);
    expect(maximums.Tye?.QB).toBe(2);
    expect(maximums.Seth?.TE).toBe(1);
    expect(maximums.PJ?.TE).toBeUndefined();
    expect(maximums.Hoody?.K).toBe(1);
    expect(maximums.Hoody?.DST).toBe(1);
    expect(maximums.Beaton?.DST).toBe(1);
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

  it("raises scarcity pressure when bidders have room for multiple same-tier players", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 150,
      rosterSize: 5,
      rosterMaximums: positionAmounts(5),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      positionOverbidDamping: {},
      scarcity: {
        comparablePriceRatio: 0.9,
        minimumComparablePrice: 20,
        slope: 0.15,
        maxMultiplier: 1.5,
      },
      endgameSpend: {
        startRosterSlotsRemaining: 0,
      },
      roomPressure: {
        startRosterSlotsRemaining: 0,
      },
      rosterNeed: {
        lastPositionSlotMultiplier: 1,
      },
      seed: "scarcity-bidder-depth",
    });
    const target = player("Scarce RB", "RB", 32);
    const remainingComparablePlayers = [player("Only comparable RB", "RB", 31)];
    const thinDepthStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [
          player("Beaton RB 1", "RB", 1),
          player("Beaton RB 2", "RB", 1),
          player("Beaton RB 3", "RB", 1),
          player("Beaton RB 4", "RB", 1),
        ],
        Hoody: [
          player("Hoody RB 1", "RB", 1),
          player("Hoody RB 2", "RB", 1),
          player("Hoody RB 3", "RB", 1),
          player("Hoody RB 4", "RB", 1),
        ],
        PJ: [
          player("PJ RB 1", "RB", 1),
          player("PJ RB 2", "RB", 1),
          player("PJ RB 3", "RB", 1),
          player("PJ RB 4", "RB", 1),
        ],
      },
    });
    const deepRosterStates = createAuctionOwnerStates({ config });
    const thinDepthSale = resolveAuctionSale(target, thinDepthStates, remainingComparablePlayers, config);
    const deepRosterSale = resolveAuctionSale(target, deepRosterStates, remainingComparablePlayers, config);

    expect(thinDepthSale).toBeDefined();
    expect(deepRosterSale).toBeDefined();
    if (!thinDepthSale) throw new Error("Expected thin-depth sale to resolve.");
    if (!deepRosterSale) throw new Error("Expected deep-roster sale to resolve.");

    const thinDepthTopBid = thinDepthSale.bids[0];
    const deepRosterTopBid = deepRosterSale.bids[0];
    expect(thinDepthTopBid).toBeDefined();
    expect(deepRosterTopBid).toBeDefined();
    expect(deepRosterTopBid?.scarcityMultiplier).toBeGreaterThan(
      thinDepthTopBid?.scarcityMultiplier ?? 0,
    );
    expect(deepRosterTopBid?.uncappedAmount).toBeGreaterThan(thinDepthTopBid?.uncappedAmount ?? 0);
  });

  it("does not count same-position depth that would strand required starters", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: {
        ...positionAmounts(0),
        RB: 1,
        WR: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      positionOverbidDamping: {},
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 20,
        bidderDepthWeight: 1,
        maxDemandSlotsPerOwner: 2,
        slope: 0.2,
        maxMultiplier: 1.5,
      },
      rosterNeed: {
        missingStarterMultiplier: 1,
        lastPositionSlotMultiplier: 1,
      },
      seed: "scarcity-required-starter-slots",
    });
    const target = player("Starter RB", "RB", 30);
    const sale = resolveAuctionSale(target, createAuctionOwnerStates({ config }), [
      player("Comparable RB 1", "RB", 30),
      player("Comparable RB 2", "RB", 30),
    ], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected required-starter sale to resolve.");

    expect(sale.bids[0]?.scarcityMultiplier).toBe(1);
  });

  it("downweights legal backup bidders in scarcity pressure", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ", "Seth"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: {
        ...positionAmounts(0),
        QB: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        bidderDepthWeight: 0,
        slope: 0.2,
        maxMultiplier: 1.5,
      },
      rosterNeed: {
        benchQuarterbackMultiplier: 0.5,
      },
      seed: "backup-qb-scarcity-depth",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [player("Beaton starter QB", "QB", 20)],
        Hoody: [player("Hoody starter QB", "QB", 20)],
        PJ: [player("PJ starter QB", "QB", 20)],
        Seth: [player("Seth starter QB", "QB", 20)],
      },
    });
    const sale = resolveAuctionSale(player("Backup QB", "QB", 18), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected backup QB sale to resolve.");

    expect(sale.bids[0]?.scarcityMultiplier).toBeLessThan(1.3);
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

    const winningState = ownerStates.find(state => state.owner === sale.winner);
    if (!winningState) throw new Error("Expected winning owner state.");
    const sortedMaxBids = sale.bids.map(bid => bid.maxBid).sort((left, right) => left - right);
    const middle = Math.floor(sortedMaxBids.length / 2);
    const medianMaxBid = sortedMaxBids.length % 2 === 0
      ? (sortedMaxBids[middle - 1]! + sortedMaxBids[middle]!) / 2
      : sortedMaxBids[middle]!;

    expect(sale.diagnostics.roomPressure).toMatchObject({
      legalBidderCount: sale.bids.length,
      biddersAtOrAboveReserve: sale.bids.filter(bid => bid.amount >= sale.diagnostics.reservePrice).length,
      biddersAtOrAboveAnchor: sale.bids.filter(bid => bid.amount >= target.price).length,
      biddersAtOrAboveSalePrice: sale.bids.filter(bid => bid.amount >= sale.price).length,
      maxBidderMaxBid: Math.max(...sale.bids.map(bid => bid.maxBid)),
      medianBidderMaxBid: medianMaxBid,
      winningOwnerMaxBid: sale.bids[0]?.maxBid,
      winningOwnerBudgetRemainingBefore: winningState.budgetRemaining,
      winningOwnerBudgetPerRosterSlotBefore: winningState.budgetRemaining / winningState.rosterSlotsRemaining,
    });
    expect(sale.diagnostics.roomPressure.cashHeavyBidderCount).toBeGreaterThan(0);
  });

  it("records owner budget trajectory from initial budgets through every sold pick", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 20,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "budget-trajectory",
    });
    const result = simulateAuction({
      players: [
        player("Trajectory RB 1", "RB", 10),
        player("Trajectory WR 1", "WR", 8),
        player("Trajectory RB 2", "RB", 2),
        player("Trajectory WR 2", "WR", 1),
      ],
      config,
    });

    expect(result.budgetTrajectory).toHaveLength((result.picks.length + 1) * owners.length);

    const initialRows = result.budgetTrajectory.filter(row => row.event === "initial");
    expect(initialRows).toHaveLength(owners.length);
    expect(initialRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pick: 0,
        owner: "Beaton",
        spent: 0,
        initialSpend: 0,
        auctionSpend: 0,
        budgetRemaining: 20,
        rosterSlotsRemaining: 2,
        maxBid: 19,
        rosterSize: 0,
        budgetPerRosterSlot: 10,
      }),
    ]));

    const firstPick = result.picks[0];
    if (!firstPick) throw new Error("Expected at least one pick.");
    const winnerAfterFirstPick = result.budgetTrajectory.find(row =>
      row.event === "after_pick" &&
      row.pick === firstPick.pick &&
      row.owner === firstPick.owner,
    );

    expect(winnerAfterFirstPick).toMatchObject({
      nominator: firstPick.nominator,
      winningOwner: firstPick.owner,
      player: firstPick.player,
      position: firstPick.position,
      marketPrice: firstPick.marketPrice,
      salePrice: firstPick.price,
      initialSpend: 0,
      auctionSpend: firstPick.price,
      budgetRemaining: firstPick.budgetAfterPick,
      rosterSlotsRemaining: firstPick.rosterSlotsAfterPick,
      rosterSize: 1,
    });
    expect(winnerAfterFirstPick?.positionCounts[firstPick.position]).toBe(1);

    const finalRows = result.budgetTrajectory.filter(row => row.pick === result.picks.length);
    expect(finalRows).toHaveLength(owners.length);
    expect(finalRows.every(row => row.event === "after_pick")).toBe(true);
    expect(finalRows.every(row => row.rosterSlotsRemaining === 0 && row.maxBid === 0)).toBe(true);
    for (const ownerState of result.ownerStates) {
      const finalRow = finalRows.find(row => row.owner === ownerState.owner);
      expect(finalRow).toMatchObject({
        spent: ownerState.spent,
        budgetRemaining: ownerState.budgetRemaining,
        rosterSlotsRemaining: ownerState.rosterSlotsRemaining,
        maxBid: ownerState.maxBid,
        rosterSize: ownerState.roster.length,
        budgetPerRosterSlot: null,
      });
    }
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

  it("can target same-position anchor counts for strategy-specific mock drafts", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1.35,
          depthAggression: 1,
        },
        Hoody: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      ownerPositionAnchorTargets: {
        Beaton: {
          RB: 3,
        },
      },
      seed: "position-anchor-targets",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [
          player("Existing WR anchor 1", "WR", 46),
          player("Existing WR anchor 2", "WR", 45),
        ],
      },
    });
    const sale = resolveAuctionSale(player("Third anchor RB target", "RB", 45), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.buildStyleMultiplier).toBe(1.35);
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(45);
  });

  it("suppresses non-target anchor bids while a position-anchor strategy is unmet", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1.35,
          depthAggression: 0.6,
        },
        Hoody: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      ownerPositionAnchorTargets: {
        Beaton: {
          RB: 3,
        },
      },
      seed: "position-anchor-target-suppression",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const sale = resolveAuctionSale(player("Non-target WR anchor", "WR", 45), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.buildStyleMultiplier).toBe(0.6);
    expect(beatonBid?.uncappedAmount).toBeLessThan(45);
  });

  it("caps target-position anchor bids to reserve budget for the remaining core", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1.5,
          depthAggression: 1,
        },
        Hoody: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      ownerPositionAnchorTargets: {
        Beaton: {
          RB: 3,
        },
      },
      ownerPositionCoreTargets: {
        Beaton: {
          RB: [60, 50, 40],
        },
      },
      seed: "position-core-budget-reserve",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [player("First elite RB", "RB", 74)],
      },
    });
    const sale = resolveAuctionSale(player("Second too-expensive RB", "RB", 74), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(73);
    expect(beatonBid?.strategyBudgetMaxBid).toBe(73);
    expect(beatonBid?.amount).toBe(73);
  });

  it("caps target-position anchor bids by planned core slot", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1.5,
          depthAggression: 1,
        },
        Hoody: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      ownerPositionAnchorTargets: {
        Beaton: {
          RB: 3,
        },
      },
      ownerPositionCoreTargets: {
        Beaton: {
          RB: [60, 50, 40],
        },
      },
      ownerPositionCoreMaxBids: {
        Beaton: {
          RB: [62, 54, 44],
        },
      },
      seed: "position-core-slot-max-bids",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const sale = resolveAuctionSale(player("Too-expensive first RB", "RB", 74), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(62);
    expect(beatonBid?.strategyBudgetMaxBid).toBe(62);
    expect(beatonBid?.amount).toBe(62);
  });

  it("caps later position slots so a strategy does not buy expensive depth", () => {
    const owners: Owner[] = ["Beaton", "Hoody"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
        Hoody: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      ownerPositionSlotMaxBids: {
        Beaton: {
          RB: [62, 54, 44, 8],
        },
      },
      seed: "position-slot-depth-max-bids",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Beaton: [
          player("RB slot 1", "RB", 58),
          player("RB slot 2", "RB", 53),
          player("RB slot 3", "RB", 39),
        ],
      },
    });
    const sale = resolveAuctionSale(player("Too-expensive depth RB", "RB", 28), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Beaton");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(8);
    expect(beatonBid?.strategyBudgetMaxBid).toBe(8);
    expect(beatonBid?.amount).toBe(8);
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

  it("keeps strong WR anchors from crossing into elite sale prices", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {
        Beaton: { WR: 1.08 },
        Hoody: { WR: 1.08 },
        PJ: { WR: 1.08 },
      },
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
        Hoody: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
        PJ: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
      },
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        slope: 0.12,
        maxMultiplier: 1.15,
      },
      roomPressure: {
        startRosterSlotsRemaining: 16,
        minRosterSlotsRemainingExclusive: 4,
        targetBudgetPerSlot: 12,
        slope: 0.35,
        maxMultiplier: 1.1,
        minimumPlayerPrice: 30,
        maximumPlayerPrice: 60,
      },
      seed: "strong-wr-elite-crossing-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Strong WR", "WR", 56);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.bids[0]?.uncappedAmount).toBeGreaterThanOrEqual(60);
    expect(sale.marketPrice).toBe(56);
    expect(sale.price).toBeGreaterThan(sale.marketPrice);
    expect(sale.price).toBeLessThan(60);
    expect(sale.price).toBeLessThanOrEqual(58);
  });

  it("dampens over-anchor bids when sourced context evidence already penalizes the player", () => {
    const owners: Owner[] = ["Beaton", "Hoody", "PJ"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {
        Beaton: { WR: 1.08 },
        Hoody: { WR: 1.08 },
        PJ: { WR: 1.08 },
      },
      ownerBehaviors: {
        Beaton: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
        Hoody: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
        PJ: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
      },
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        slope: 0.12,
        maxMultiplier: 1.15,
      },
      roomPressure: {
        startRosterSlotsRemaining: 16,
        minRosterSlotsRemainingExclusive: 4,
        targetBudgetPerSlot: 12,
        slope: 0.35,
        maxMultiplier: 1.1,
        minimumPlayerPrice: 30,
        maximumPlayerPrice: 60,
      },
      seed: "context-penalty-bid-damping",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const rawTarget = player("Raw Strong WR", "WR", 51);
    const penalizedTarget = {
      ...player("Penalized Strong WR", "WR", 51),
      contextAdjustmentPercent: -0.105,
      contextEvidenceCount: 5,
    };
    const lightlyPenalizedTarget = {
      ...player("Lightly Penalized Strong WR", "WR", 51),
      contextAdjustmentPercent: -0.045,
      contextEvidenceCount: 5,
    };
    const rawSale = resolveAuctionSale(rawTarget, ownerStates, [], config);
    const penalizedSale = resolveAuctionSale(penalizedTarget, ownerStates, [], config);
    const lightlyPenalizedSale = resolveAuctionSale(lightlyPenalizedTarget, ownerStates, [], config);

    expect(rawSale).toBeDefined();
    expect(penalizedSale).toBeDefined();
    expect(lightlyPenalizedSale).toBeDefined();
    if (!rawSale) throw new Error("Expected raw sale to resolve.");
    if (!penalizedSale) throw new Error("Expected penalized sale to resolve.");
    if (!lightlyPenalizedSale) throw new Error("Expected lightly penalized sale to resolve.");

    expect(rawSale.price).toBeGreaterThan(55);
    expect(penalizedSale.bids[0]?.contextPenaltyDampingMultiplier).toBeLessThan(1);
    expect(penalizedSale.price).toBeLessThan(rawSale.price);
    expect(penalizedSale.price).toBeGreaterThanOrEqual(penalizedTarget.price);
    expect(penalizedSale.price).toBeLessThanOrEqual(55);
    expect(penalizedSale.diagnostics.topBids[0]?.drivers).toContainEqual(
      expect.objectContaining({
        key: "context_penalty_damping",
        direction: "down",
      }),
    );
    expect(lightlyPenalizedSale.bids[0]?.contextPenaltyDampingMultiplier).toBeLessThan(1);
    expect(lightlyPenalizedSale.diagnostics.topBids[0]?.drivers).toContainEqual(
      expect.objectContaining({
        key: "context_penalty_damping",
        direction: "down",
      }),
    );
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
    const profiles = buildOwnerProfiles(historicalRecords);
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
    const ownerRosterMaximums = buildOwnerRosterMaximums(profiles);
    const result = simulateAuction({
      players: auctionPlayers,
      initialRostersByOwner,
      config: buildAuctionConfig({
        ownerDemandMultipliers: buildOwnerDemandMultipliers(profiles),
        ownerBehaviors: buildOwnerAuctionBehaviors(profiles),
        ownerRosterMaximums,
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
      for (const position of positions) {
        const maximum = ownerRosterMaximums[owner]?.[position] ?? leagueConfig.rosterMaximums[position];
        expect(counts[position], `${owner} ${position} count`).toBeLessThanOrEqual(maximum);
      }
      for (const rosterPlayer of roster.players) draftedNames.add(rosterPlayer.name);
    }

    expect(draftedNames.size).toBe(ownerOrder.length * 16);
  }, 15000);
});
