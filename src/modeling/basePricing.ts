import { positions, type Position } from "../../config/league.js";
import {
  defaultPlayerContextConfig,
  type PlayerContextConfig,
  type PlayerContextNotes,
  type PlayerContextSignals,
} from "../../config/playerContext.js";
import { playerOverrides, type PlayerOverride } from "../../config/playerOverrides.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../projections.js";
import { buildLeagueOpenAuctionSpendTargets } from "./ownerProfiles.js";
import { calculatePlayerContextAdjustment } from "./playerContext.js";
import { buildProjectionRankings, type ProjectionRanking } from "./projectionRankings.js";

type PositionAmounts = Record<Position, number>;

export interface ProjectionFloorRule {
  triggerAtRankGapOrBelow: number;
  topRankPrice: number;
  referenceRank: number;
  referenceRankPrice: number;
  tailDecay: number;
}

export interface ProjectionRankPriceFloor {
  maxProjectionRank: number;
  price: number;
}

export interface TopAnchorMinimum {
  espnAuctionValueAtLeast: number;
  shareOfAnchoredPrice: number;
}

export interface PricingConfig {
  draftedPoolCounts: PositionAmounts;
  positionMarketMultipliers: PositionAmounts;
  marketPressureByPosition: PositionAmounts;
  hardPriceCeilings: PositionAmounts;
  auditedSpendTargets: PositionAmounts;
  rankGapAdjustmentPerRank: number;
  rankGapAdjustmentCap: number;
  topAnchorMinimum: TopAnchorMinimum;
  projectionFloorRules: Partial<Record<Position, ProjectionFloorRule>>;
  projectionRankPriceFloors: Partial<Record<Position, readonly ProjectionRankPriceFloor[]>>;
  playerContext: PlayerContextConfig;
  spendTargetRoundingPriority: readonly Position[];
}

export interface BasePrice extends ProjectionRanking {
  publicAnchorValue: number;
  positionMultiplier: number;
  rankGapAdjustment: number;
  marketPressure: number;
  anchoredPrice: number;
  projectionFloorPrice: number;
  preSustainabilityPrice: number;
  sustainabilityFactor: number;
  sustainabilityNote?: string;
  contextAdjustmentFactor: number;
  contextAdjustmentPercent: number;
  contextSignals: PlayerContextSignals;
  contextNotes?: PlayerContextNotes;
  rawPrice: number;
  minimumPrice: number;
  hardCeiling: number;
  spendTarget: number;
  price: number;
}

export interface PricePoolSummary {
  counts: PositionAmounts;
  spend: PositionAmounts;
  total: number;
}

interface PriceCandidate extends Omit<BasePrice, "price"> {
  allocationWeight: number;
}

export const defaultPricingConfig = {
  draftedPoolCounts: {
    QB: 22,
    RB: 70,
    WR: 70,
    TE: 20,
    K: 14,
    DST: 14,
  },
  positionMarketMultipliers: {
    QB: 1.08,
    RB: 1.28,
    WR: 1.28,
    TE: 1.1,
    K: 1,
    DST: 1,
  },
  marketPressureByPosition: {
    QB: 0.98,
    RB: 0.97,
    WR: 0.97,
    TE: 0.98,
    K: 1,
    DST: 1,
  },
  hardPriceCeilings: {
    QB: 35,
    RB: 80,
    WR: 80,
    TE: 38,
    K: 5,
    DST: 6,
  },
  auditedSpendTargets: {
    QB: 200,
    RB: 1036,
    WR: 1152,
    TE: 163,
    K: 23,
    DST: 23,
  },
  rankGapAdjustmentPerRank: 0.01,
  rankGapAdjustmentCap: 0.12,
  topAnchorMinimum: {
    espnAuctionValueAtLeast: 50,
    shareOfAnchoredPrice: 0.97,
  },
  projectionFloorRules: {
    RB: {
      triggerAtRankGapOrBelow: -40,
      topRankPrice: 70,
      referenceRank: 16,
      referenceRankPrice: 22,
      tailDecay: 0.22,
    },
  },
  projectionRankPriceFloors: {
    QB: [{ maxProjectionRank: 1, price: 35 }],
    TE: [{ maxProjectionRank: 2, price: 38 }],
  },
  playerContext: defaultPlayerContextConfig,
  spendTargetRoundingPriority: ["RB", "TE", "K", "DST", "WR", "QB"],
} as const satisfies PricingConfig;

const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundedTotal = (amounts: PositionAmounts): number =>
  Math.round(Object.values(amounts).reduce((total, amount) => total + amount, 0));

export const roundSpendTargets = (
  spendTargets: PositionAmounts,
  roundingPriority: readonly Position[] = defaultPricingConfig.spendTargetRoundingPriority,
): PositionAmounts => {
  const rounded = emptyPositionAmounts();
  const fractionalParts = new Map<Position, number>();
  let floorTotal = 0;

  for (const position of positions) {
    const floor = Math.floor(spendTargets[position]);
    rounded[position] = floor;
    floorTotal += floor;
    fractionalParts.set(position, spendTargets[position] - floor);
  }

  const priorityIndex = new Map(roundingPriority.map((position, index) => [position, index]));
  const sortedPositions = [...positions].sort(
    (left, right) =>
      (fractionalParts.get(right) ?? 0) - (fractionalParts.get(left) ?? 0) ||
      (priorityIndex.get(left) ?? Number.MAX_SAFE_INTEGER) - (priorityIndex.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
  let remainingDollars = roundedTotal(spendTargets) - floorTotal;

  for (const position of sortedPositions) {
    if (remainingDollars <= 0) break;
    rounded[position] += 1;
    remainingDollars -= 1;
  }

  return rounded;
};

export const deriveAuditedSpendTargets = (
  historicalRecords: readonly HistoricalAuctionRecord[],
  config: PricingConfig = defaultPricingConfig,
): PositionAmounts => {
  const historicalTargets = buildLeagueOpenAuctionSpendTargets(historicalRecords);
  return roundSpendTargets(historicalTargets.byPosition, config.spendTargetRoundingPriority);
};

const roleOverrideByName = (
  overrides: readonly PlayerOverride[],
): Map<string, PlayerOverride> =>
  new Map(overrides.map(override => [normalizePlayerName(override.player), override]));

const rankGapAdjustmentFor = (ranking: ProjectionRanking, config: PricingConfig): number => {
  const rankGap = ranking.rankGap ?? 0;
  const cappedAdjustment = clamp(
    rankGap * config.rankGapAdjustmentPerRank,
    -config.rankGapAdjustmentCap,
    config.rankGapAdjustmentCap,
  );

  return 1 - cappedAdjustment;
};

const projectionFloorFor = (ranking: ProjectionRanking, config: PricingConfig): number => {
  const floorRule = config.projectionFloorRules[ranking.position];
  if (!floorRule || ranking.rankGap === undefined || ranking.rankGap > floorRule.triggerAtRankGapOrBelow) return 0;

  if (ranking.projectionRank <= floorRule.referenceRank) {
    const decay = Math.log(floorRule.topRankPrice / floorRule.referenceRankPrice) /
      Math.max(1, floorRule.referenceRank - 1);
    return floorRule.topRankPrice * Math.exp(-decay * (ranking.projectionRank - 1));
  }

  return floorRule.referenceRankPrice *
    Math.exp(-floorRule.tailDecay * (ranking.projectionRank - floorRule.referenceRank));
};

const projectionRankPriceFloorFor = (ranking: ProjectionRanking, config: PricingConfig): number =>
  config.projectionRankPriceFloors[ranking.position]
    ?.find(rule => ranking.projectionRank <= rule.maxProjectionRank)
    ?.price ?? 0;

const minimumPriceFor = (
  ranking: ProjectionRanking,
  anchoredPrice: number,
  projectionFloorPrice: number,
  adjustmentFactor: number,
  config: PricingConfig,
): number => {
  const publicAnchorValue = ranking.espnAuctionValue ?? 0;
  const topAnchorMinimum = publicAnchorValue >= config.topAnchorMinimum.espnAuctionValueAtLeast
    ? Math.round(anchoredPrice * adjustmentFactor * config.topAnchorMinimum.shareOfAnchoredPrice)
    : 1;
  const rankFloor = projectionRankPriceFloorFor(ranking, config);
  const projectionFloorMinimum = Math.round(projectionFloorPrice * adjustmentFactor);

  return Math.min(
    config.hardPriceCeilings[ranking.position],
    Math.max(1, topAnchorMinimum, rankFloor, projectionFloorMinimum),
  );
};

const candidateForRanking = (
  ranking: ProjectionRanking,
  spendTarget: number,
  overrideByName: ReadonlyMap<string, PlayerOverride>,
  config: PricingConfig,
): PriceCandidate => {
  const publicAnchorValue = Math.max(1, ranking.espnAuctionValue ?? 0);
  const positionMultiplier = config.positionMarketMultipliers[ranking.position];
  const rankGapAdjustment = rankGapAdjustmentFor(ranking, config);
  const marketPressure = config.marketPressureByPosition[ranking.position];
  const anchoredPrice = publicAnchorValue * positionMultiplier * rankGapAdjustment * marketPressure;
  const projectionFloorPrice = projectionFloorFor(ranking, config);
  const preSustainabilityPrice = Math.max(anchoredPrice, projectionFloorPrice);
  const override = overrideByName.get(ranking.normalizedName);
  const sustainabilityFactor = override?.sustainabilityFactor ?? 1;
  const contextAdjustment = calculatePlayerContextAdjustment(ranking.normalizedName, config.playerContext);
  const adjustmentFactor = sustainabilityFactor * contextAdjustment.factor;
  const rawPrice = preSustainabilityPrice * adjustmentFactor;
  const minimumPrice = minimumPriceFor(
    ranking,
    anchoredPrice,
    projectionFloorPrice,
    adjustmentFactor,
    config,
  );

  return {
    ...ranking,
    publicAnchorValue,
    positionMultiplier,
    rankGapAdjustment,
    marketPressure,
    anchoredPrice,
    projectionFloorPrice,
    preSustainabilityPrice,
    sustainabilityFactor,
    ...(override ? { sustainabilityNote: override.note } : {}),
    contextAdjustmentFactor: contextAdjustment.factor,
    contextAdjustmentPercent: contextAdjustment.cappedAdjustment,
    contextSignals: contextAdjustment.signals,
    ...(contextAdjustment.notes ? { contextNotes: contextAdjustment.notes } : {}),
    rawPrice,
    allocationWeight: Math.max(0.01, rawPrice),
    minimumPrice,
    hardCeiling: config.hardPriceCeilings[ranking.position],
    spendTarget,
  };
};

const allocateIntegerPrices = (
  candidates: readonly PriceCandidate[],
  targetTotal: number,
): BasePrice[] => {
  const minimumTotal = candidates.reduce((total, candidate) => total + candidate.minimumPrice, 0);
  const maximumTotal = candidates.reduce((total, candidate) => total + candidate.hardCeiling, 0);

  if (minimumTotal > targetTotal) {
    throw new Error(`Minimum prices exceed ${candidates[0]?.position ?? "position"} spend target.`);
  }
  if (maximumTotal < targetTotal) {
    throw new Error(`Hard ceilings cannot satisfy ${candidates[0]?.position ?? "position"} spend target.`);
  }

  const fractionalPrices = candidates.map(candidate =>
    clamp(candidate.rawPrice, candidate.minimumPrice, candidate.hardCeiling),
  );

  let adjustment = targetTotal - fractionalPrices.reduce((total, price) => total + price, 0);
  while (Math.abs(adjustment) > 0.000001) {
    const isIncreasing = adjustment > 0;
    const openIndexes = candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate, index }) =>
        isIncreasing
          ? fractionalPrices[index]! < candidate.hardCeiling
          : fractionalPrices[index]! > candidate.minimumPrice,
      )
      .map(({ index }) => index);

    if (openIndexes.length === 0) break;

    const weightTotal = openIndexes.reduce(
      (total, index) => total + candidates[index]!.allocationWeight,
      0,
    );
    let adjustedThisRound = 0;

    for (const index of openIndexes) {
      const candidate = candidates[index]!;
      const share = Math.abs(adjustment) * (candidate.allocationWeight / weightTotal);
      const capacity = isIncreasing
        ? candidate.hardCeiling - fractionalPrices[index]!
        : fractionalPrices[index]! - candidate.minimumPrice;
      const amount = Math.min(share, capacity);

      fractionalPrices[index] = isIncreasing
        ? fractionalPrices[index]! + amount
        : fractionalPrices[index]! - amount;
      adjustedThisRound += amount;
    }

    if (adjustedThisRound === 0) break;
    adjustment += isIncreasing ? -adjustedThisRound : adjustedThisRound;
  }

  const priced = candidates.map((candidate, index) => ({
    candidate,
    fractionalPrice: fractionalPrices[index]!,
    price: Math.floor(fractionalPrices[index]!),
  }));
  let roundingRemainder = targetTotal - priced.reduce((total, entry) => total + entry.price, 0);

  while (roundingRemainder > 0) {
    const recipient = priced
      .filter(entry => entry.price < entry.candidate.hardCeiling)
      .sort(
        (left, right) =>
          (right.fractionalPrice - Math.floor(right.fractionalPrice)) -
          (left.fractionalPrice - Math.floor(left.fractionalPrice)) ||
          right.candidate.rawPrice - left.candidate.rawPrice,
      )[0];

    if (!recipient) throw new Error("Unable to round prices to the requested spend target.");

    recipient.price += 1;
    roundingRemainder -= 1;
  }

  return priced.map(({ candidate, price }) => {
    const { allocationWeight: _allocationWeight, ...basePrice } = candidate;
    return { ...basePrice, price };
  });
};

export const buildBasePrices = (
  projections: readonly ProjectionRecord[],
  historicalRecords: readonly HistoricalAuctionRecord[],
  config: PricingConfig = defaultPricingConfig,
): BasePrice[] => {
  const spendTargets = deriveAuditedSpendTargets(historicalRecords, config);
  const overrideByName = roleOverrideByName(playerOverrides);
  const rankings = buildProjectionRankings(projections);

  return positions
    .flatMap(position => {
      const poolCount = config.draftedPoolCounts[position];
      const positionRankings = rankings
        .filter(ranking => ranking.position === position)
        .slice(0, poolCount);

      if (positionRankings.length < poolCount) {
        throw new Error(`Only found ${positionRankings.length} ${position} projections for ${poolCount} price slots.`);
      }

      const spendTarget = spendTargets[position];
      return allocateIntegerPrices(
        positionRankings.map(ranking => candidateForRanking(ranking, spendTarget, overrideByName, config)),
        spendTarget,
      );
    })
    .sort((left, right) => right.price - left.price || right.weeks1To4 - left.weeks1To4 || left.name.localeCompare(right.name));
};

export const summarizePricePool = (
  prices: readonly Pick<BasePrice, "position" | "price">[],
): PricePoolSummary => {
  const counts = emptyPositionAmounts();
  const spend = emptyPositionAmounts();

  for (const price of prices) {
    counts[price.position] += 1;
    spend[price.position] += price.price;
  }

  return {
    counts,
    spend,
    total: Object.values(spend).reduce((total, amount) => total + amount, 0),
  };
};
