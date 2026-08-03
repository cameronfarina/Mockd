import { leagueConfig, ownerOrder, positions, type Owner, type Position } from "../../config/league.js";
import type { KeeperDeclaration, KeeperStatus } from "../../config/keepers.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { ProjectionRecord } from "../projections.js";
import type { MockRoster, Player } from "../types.js";
import type { OwnerProfile } from "./ownerProfiles.js";
import { buildProjectionRankings } from "./projectionRankings.js";

export type PositionAmounts = Record<Position, number>;
export type InitialRostersByOwner = Partial<Record<Owner, readonly Player[]>>;
export type OwnerDemandMultipliers = Partial<Record<Owner, Partial<Record<Position, number>>>>;
export type OwnerAuctionBehaviors = Partial<Record<Owner, OwnerAuctionBehavior>>;
export type OwnerRosterMaximums = Partial<Record<Owner, Partial<Record<Position, number>>>>;
export type OwnerPositionAnchorTargets = Partial<Record<Owner, Partial<Record<Position, number>>>>;
export type OwnerPositionCoreTargets = Partial<Record<Owner, Partial<Record<Position, readonly number[]>>>>;
export type OwnerPositionCoreMaxBids = Partial<Record<Owner, Partial<Record<Position, readonly number[]>>>>;
export type OwnerPositionSlotMaxBids = Partial<Record<Owner, Partial<Record<Position, readonly number[]>>>>;
export type OwnerPositionCoreBudgetEnvelopes =
  Partial<Record<Owner, Partial<Record<Position, PositionCoreBudgetEnvelope>>>>;
export type PositionOverbidDamping = Partial<Record<Position, number>>;
export type AuctionDiagnosticsMode = "full" | "summary";

export interface ScarcityConfig {
  comparablePriceRatio: number;
  minimumComparablePrice: number;
  bidderDepthWeight: number;
  maxDemandSlotsPerOwner: number;
  slope: number;
  maxMultiplier: number;
}

export interface RosterNeedConfig {
  missingStarterMultiplier: number;
  missingFlexMultiplier: number;
  emptyPremiumPositionMultiplier: number;
  benchQuarterbackMultiplier: number;
  benchTightEndMultiplier: number;
  specialTeamsBenchMultiplier: number;
  lastPositionSlotMultiplier: number;
}

export interface NominationConfig {
  earlyEliteBiasPicks: number;
  earlyMarketPriceWeight: number;
  marketPriceWeight: number;
  projectionWeight: number;
  ownerNeedWeight: number;
  opponentNeedWeight: number;
  affordabilityWeight: number;
  scarcityWeight: number;
  flushMoneyWeight: number;
  tieBreakWeight: number;
}

export interface EndgameSpendConfig {
  startRosterSlotsRemaining: number;
  targetBudgetPerSlot: number;
  slope: number;
  maxMultiplier: number;
}

export interface RoomPressureConfig {
  startRosterSlotsRemaining: number;
  minRosterSlotsRemainingExclusive: number;
  targetBudgetPerSlot: number;
  slope: number;
  maxMultiplier: number;
  minimumPlayerPrice: number;
  maximumPlayerPrice: number;
}

export interface BudgetPacingConfig {
  targetBudgetPerSlotAfterPurchase: number;
  slope: number;
  maxDiscount: number;
  minimumPlayerPrice: number;
}

export interface BidVarianceConfig {
  minimumPlayerPrice: number;
  fullEffectPlayerPrice: number;
  maxDiscount: number;
  maxPremium: number;
}

export interface PositionCoreBudgetEnvelope {
  targetCount: number;
  hardBudget: number;
  minimumFutureCorePrice: number;
}

export interface LateOpeningBidConfig {
  startRosterSlotsRemaining: number;
  targetBudgetPerSlot: number;
  maxPlayerPrice: number;
  maxExtraBid: number;
}

export interface TopEndOverbidDampingConfig {
  startPrice: number;
  fullEffectPrice: number;
  maxOverbidDiscount: number;
}

export interface ContextPenaltyBidDampingConfig {
  minimumPlayerPrice: number;
  startPenalty: number;
  fullEffectPenalty: number;
  maxOverbidDiscount: number;
}

export interface TopEndSaleGuardConfig {
  threshold: number;
  capBelowThresholdAt: number;
  premiumThreshold: number;
  capBelowPremiumThresholdAt: number;
  eliteThreshold: number;
  capBelowEliteThresholdAt: number;
}

export interface TierSaleGuardConfig {
  threshold: number;
  capBelowThresholdAt: number;
  strongThreshold: number;
  capBelowStrongThresholdAt: number;
  maxPremiumStartPrice: number;
  maxPremiumBelowStrongThreshold: number;
}

export interface OwnerAuctionBehavior {
  priceAggression: number;
  scarcityChase: number;
  replacementPatience: number;
  anchorAggression?: number;
  depthAggression?: number;
}

type CompleteOwnerAuctionBehavior = Required<OwnerAuctionBehavior>;

export interface AuctionEngineConfig {
  owners: readonly Owner[];
  auctionBudget: number;
  rosterSize: number;
  rosterMaximums: PositionAmounts;
  starterMinimums: PositionAmounts;
  flexMinimum: number;
  minimumBid: number;
  reservePriceRatio: number;
  ownerDemandMultipliers: OwnerDemandMultipliers;
  ownerBehaviors: OwnerAuctionBehaviors;
  ownerRosterMaximums: OwnerRosterMaximums;
  ownerPositionAnchorTargets: OwnerPositionAnchorTargets;
  ownerPositionCoreTargets: OwnerPositionCoreTargets;
  ownerPositionCoreMaxBids: OwnerPositionCoreMaxBids;
  ownerPositionSlotMaxBids: OwnerPositionSlotMaxBids;
  ownerPositionCoreBudgetEnvelopes: OwnerPositionCoreBudgetEnvelopes;
  positionOverbidDamping: PositionOverbidDamping;
  scarcity: ScarcityConfig;
  rosterNeed: RosterNeedConfig;
  nomination: NominationConfig;
  endgameSpend: EndgameSpendConfig;
  roomPressure: RoomPressureConfig;
  budgetPacing: BudgetPacingConfig;
  bidVariance: BidVarianceConfig;
  lateOpeningBid: LateOpeningBidConfig;
  topEndOverbidDamping: TopEndOverbidDampingConfig;
  contextPenaltyBidDamping: ContextPenaltyBidDampingConfig;
  topEndSaleGuard: TopEndSaleGuardConfig;
  tierSaleGuard: TierSaleGuardConfig;
  seed: string;
}

export type AuctionEngineConfigOverrides =
  Partial<Omit<AuctionEngineConfig, "ownerDemandMultipliers" | "ownerBehaviors" | "ownerRosterMaximums" | "ownerPositionAnchorTargets" | "ownerPositionCoreTargets" | "ownerPositionCoreMaxBids" | "ownerPositionSlotMaxBids" | "ownerPositionCoreBudgetEnvelopes" | "positionOverbidDamping" | "scarcity" | "rosterNeed" | "nomination" | "endgameSpend" | "roomPressure" | "budgetPacing" | "bidVariance" | "lateOpeningBid" | "topEndOverbidDamping" | "contextPenaltyBidDamping" | "topEndSaleGuard" | "tierSaleGuard">> & {
    ownerDemandMultipliers?: OwnerDemandMultipliers;
    ownerBehaviors?: OwnerAuctionBehaviors;
    ownerRosterMaximums?: OwnerRosterMaximums;
    ownerPositionAnchorTargets?: OwnerPositionAnchorTargets;
    ownerPositionCoreTargets?: OwnerPositionCoreTargets;
    ownerPositionCoreMaxBids?: OwnerPositionCoreMaxBids;
    ownerPositionSlotMaxBids?: OwnerPositionSlotMaxBids;
    ownerPositionCoreBudgetEnvelopes?: OwnerPositionCoreBudgetEnvelopes;
    positionOverbidDamping?: PositionOverbidDamping;
    scarcity?: Partial<ScarcityConfig>;
    rosterNeed?: Partial<RosterNeedConfig>;
    nomination?: Partial<NominationConfig>;
    endgameSpend?: Partial<EndgameSpendConfig>;
    roomPressure?: Partial<RoomPressureConfig>;
    budgetPacing?: Partial<BudgetPacingConfig>;
    bidVariance?: Partial<BidVarianceConfig>;
    lateOpeningBid?: Partial<LateOpeningBidConfig>;
    topEndOverbidDamping?: Partial<TopEndOverbidDampingConfig>;
    contextPenaltyBidDamping?: Partial<ContextPenaltyBidDampingConfig>;
    topEndSaleGuard?: Partial<TopEndSaleGuardConfig>;
    tierSaleGuard?: Partial<TierSaleGuardConfig>;
  };

export interface AuctionOwnerState {
  owner: Owner;
  roster: Player[];
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
}

export interface AuctionBid {
  owner: Owner;
  amount: number;
  uncappedAmount: number;
  maxBid: number;
  strategyBudgetMaxBid?: number;
  marketPrice: number;
  ownerDemandMultiplier: number;
  rosterNeedMultiplier: number;
  scarcityMultiplier: number;
  behaviorAggressionMultiplier: number;
  behaviorScarcityMultiplier: number;
  buildStyleMultiplier: number;
  replacementPatienceMultiplier: number;
  endgamePressureMultiplier: number;
  roomPressureMultiplier: number;
  budgetPacingMultiplier: number;
  bidVarianceMultiplier: number;
  topEndDampingMultiplier: number;
  positionOverbidDampingMultiplier: number;
  contextPenaltyDampingMultiplier: number;
  tieBreak: number;
}

export interface AuctionNominationScoreComponents {
  marketPrice: number;
  projection: number;
  ownerNeed: number;
  opponentNeed: number;
  affordability: number;
  scarcity: number;
  flushMoney: number;
  tieBreak: number;
}

export interface AuctionNominationCandidateDiagnostics {
  rank: number;
  player: string;
  position: Position;
  marketPrice: number;
  projectionTotal: number;
  score: number;
  scoreComponents: AuctionNominationScoreComponents;
  weightedComponents: AuctionNominationScoreComponents;
}

export interface AuctionNominationDiagnostics {
  selectedPlayer: string;
  selectedPosition: Position;
  selectedScore: number;
  candidateCount: number;
  topCandidates: AuctionNominationCandidateDiagnostics[];
}

export type AuctionBidDriverDirection = "up" | "down";

export interface AuctionBidDriver {
  key: string;
  multiplier: number;
  direction: AuctionBidDriverDirection;
}

export type AuctionSalePriceBasis =
  | "minimum_bid"
  | "second_bid_plus_minimum"
  | "reserve_price"
  | "nominator_opening_bid"
  | "winning_bid_cap";

export interface AuctionBidDiagnostics {
  owner: Owner;
  cappedByMaxBid: boolean;
  drivers: AuctionBidDriver[];
}

export interface AuctionRoomPressureDiagnostics {
  legalBidderCount: number;
  biddersAtOrAboveReserve: number;
  biddersAtOrAboveAnchor: number;
  biddersAtOrAboveSalePrice: number;
  cashHeavyBidderCount: number;
  maxBidderMaxBid: number;
  medianBidderMaxBid: number;
  averageBidderMaxBid: number;
  winningOwnerMaxBid: number;
  winningOwnerBudgetRemainingBefore: number;
  winningOwnerBudgetPerRosterSlotBefore: number | null;
}

export interface AuctionPickDiagnostics {
  secondBidAmount: number;
  reservePrice: number;
  nominatorOpeningBid: number;
  uncappedSalePrice: number;
  topEndGuardedPrice: number;
  salePriceBasis: AuctionSalePriceBasis;
  roomPressure: AuctionRoomPressureDiagnostics;
  topBids: AuctionBidDiagnostics[];
}

export interface AuctionSale {
  player: Player;
  winner: Owner;
  price: number;
  marketPrice: number;
  bids: AuctionBid[];
  diagnostics: AuctionPickDiagnostics;
}

export interface ResolveAuctionSaleOptions {
  nominator?: Owner;
  diagnosticsMode?: AuctionDiagnosticsMode;
}

export interface AuctionPick {
  pick: number;
  nominator: Owner;
  owner: Owner;
  player: string;
  position: Position;
  marketPrice: number;
  price: number;
  budgetAfterPick: number;
  rosterSlotsAfterPick: number;
  topBids: AuctionBid[];
  diagnostics: AuctionPickDiagnostics;
  nominationDiagnostics: AuctionNominationDiagnostics;
}

export type AuctionBudgetTrajectoryEvent = "initial" | "after_pick";

export interface AuctionBudgetTrajectoryRow {
  pick: number;
  event: AuctionBudgetTrajectoryEvent;
  owner: Owner;
  nominator?: Owner;
  winningOwner?: Owner;
  player?: string;
  position?: Position;
  marketPrice?: number;
  salePrice?: number;
  spent: number;
  initialSpend: number;
  auctionSpend: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
  rosterSize: number;
  budgetPerRosterSlot: number | null;
  positionCounts: PositionAmounts;
}

export type AuctionRosters = Partial<Record<Owner, MockRoster>>;

export interface AuctionResult {
  seed: string;
  rosters: AuctionRosters;
  ownerStates: AuctionOwnerState[];
  picks: AuctionPick[];
  budgetTrajectory: AuctionBudgetTrajectoryRow[];
  unsoldPlayers: Player[];
}

export interface SimulateAuctionOptions {
  players: readonly Player[];
  config?: AuctionEngineConfig;
  initialRostersByOwner?: InitialRostersByOwner;
  diagnosticsMode?: AuctionDiagnosticsMode;
}

export interface AuctionPricedPlayer {
  id?: string | number;
  name: string;
  position: Position;
  proTeamId?: number;
  price: number;
  scenarioPrice?: number;
  week1?: number;
  weeks?: Record<number, number>;
  weeks1To4: number;
  contextAdjustmentPercent?: number;
  contextEvidence?: readonly unknown[];
  contextEvidenceCount?: number;
}

export interface ReplacementPriceTier {
  count: number;
  price: number;
}

export interface BuildAuctionPlayerPoolOptions {
  pricedPlayers: readonly AuctionPricedPlayer[];
  projections: readonly ProjectionRecord[];
  excludedNames?: readonly string[];
  targetCount?: number;
  replacementPrice?: number;
  replacementPriceLadder?: readonly ReplacementPriceTier[];
}

const flexEligiblePositions = ["RB", "WR", "TE"] as const satisfies readonly Position[];
const premiumPositions = ["QB", "RB", "WR", "TE"] as const satisfies readonly Position[];
const defaultSeed = "mockd-default";
const hashDivisor = 0x100000000;
const replacementPatiencePriceThreshold = 3;
const anchorBuildPriceThreshold = 40;
const depthBuildPriceThreshold = 19;
const targetAnchorRosterCount = 2;
const onePlayerRosterCountThreshold = 1.4;
const defaultReplacementPrice = 1;
const defaultReplacementPriceLadder: readonly ReplacementPriceTier[] = [];

const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const defaultStarterMinimums = (): PositionAmounts => ({
  QB: leagueConfig.lineup.QB,
  RB: leagueConfig.lineup.RB,
  WR: leagueConfig.lineup.WR,
  TE: leagueConfig.lineup.TE,
  K: leagueConfig.lineup.K,
  DST: leagueConfig.lineup.DST,
});

const configuredRosterMaximums = (): PositionAmounts => ({
  QB: leagueConfig.rosterMaximums.QB,
  RB: leagueConfig.rosterMaximums.RB,
  WR: leagueConfig.rosterMaximums.WR,
  TE: leagueConfig.rosterMaximums.TE,
  K: leagueConfig.rosterMaximums.K,
  DST: leagueConfig.rosterMaximums.DST,
});

const defaultAuctionEngineConfig: AuctionEngineConfig = {
  owners: ownerOrder,
  auctionBudget: leagueConfig.auctionBudget,
  rosterSize: leagueConfig.rosterSize,
  rosterMaximums: configuredRosterMaximums(),
  starterMinimums: defaultStarterMinimums(),
  flexMinimum: leagueConfig.lineup.FLEX,
  minimumBid: 1,
  reservePriceRatio: 0.75,
  ownerDemandMultipliers: {},
  ownerBehaviors: {},
  ownerRosterMaximums: {},
  ownerPositionAnchorTargets: {},
  ownerPositionCoreTargets: {},
  ownerPositionCoreMaxBids: {},
  ownerPositionSlotMaxBids: {},
  ownerPositionCoreBudgetEnvelopes: {},
  positionOverbidDamping: {
    QB: 0.75,
    WR: 0.18,
    TE: 0.65,
  },
  scarcity: {
    comparablePriceRatio: 0.8,
    minimumComparablePrice: 5,
    bidderDepthWeight: 0.35,
    maxDemandSlotsPerOwner: 2,
    slope: 0.03,
    maxMultiplier: 1.08,
  },
  rosterNeed: {
    missingStarterMultiplier: 1.03,
    missingFlexMultiplier: 1.015,
    emptyPremiumPositionMultiplier: 1,
    benchQuarterbackMultiplier: 0.75,
    benchTightEndMultiplier: 0.65,
    specialTeamsBenchMultiplier: 0.85,
    lastPositionSlotMultiplier: 0.97,
  },
  nomination: {
    earlyEliteBiasPicks: 6,
    earlyMarketPriceWeight: 2,
    marketPriceWeight: 1.05,
    projectionWeight: 0.15,
    ownerNeedWeight: 1.8,
    opponentNeedWeight: 0.45,
    affordabilityWeight: 0.35,
    scarcityWeight: 0.45,
    flushMoneyWeight: 0.5,
    tieBreakWeight: 0.001,
  },
  endgameSpend: {
    startRosterSlotsRemaining: 4,
    targetBudgetPerSlot: 12,
    slope: 0.18,
    maxMultiplier: 1.25,
  },
  roomPressure: {
    startRosterSlotsRemaining: 14,
    minRosterSlotsRemainingExclusive: 4,
    targetBudgetPerSlot: 12,
    slope: 0.35,
    maxMultiplier: 1.1,
    minimumPlayerPrice: 30,
    maximumPlayerPrice: 60,
  },
  budgetPacing: {
    targetBudgetPerSlotAfterPurchase: 4,
    slope: 0.85,
    maxDiscount: 0.28,
    minimumPlayerPrice: 8,
  },
  bidVariance: {
    minimumPlayerPrice: 30,
    fullEffectPlayerPrice: 75,
    maxDiscount: 0.07,
    maxPremium: 0.05,
  },
  lateOpeningBid: {
    startRosterSlotsRemaining: 2,
    targetBudgetPerSlot: 1,
    maxPlayerPrice: 15,
    maxExtraBid: 6,
  },
  topEndOverbidDamping: {
    startPrice: 50,
    fullEffectPrice: 75,
    maxOverbidDiscount: 0.75,
  },
  contextPenaltyBidDamping: {
    minimumPlayerPrice: 30,
    startPenalty: 0.04,
    fullEffectPenalty: 0.1,
    maxOverbidDiscount: 0.75,
  },
  topEndSaleGuard: {
    threshold: 70,
    capBelowThresholdAt: 69,
    premiumThreshold: 75,
    capBelowPremiumThresholdAt: 74,
    eliteThreshold: 80,
    capBelowEliteThresholdAt: 79,
  },
  tierSaleGuard: {
    threshold: 40,
    capBelowThresholdAt: 39,
    strongThreshold: 60,
    capBelowStrongThresholdAt: 59,
    maxPremiumStartPrice: 55,
    maxPremiumBelowStrongThreshold: 2,
  },
  seed: defaultSeed,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const isFlexEligible = (position: Position): boolean =>
  flexEligiblePositions.some(flexPosition => flexPosition === position);

const isPremiumPosition = (position: Position): boolean =>
  premiumPositions.some(premiumPosition => premiumPosition === position);

const rosterMaximumFor = (
  owner: Owner,
  position: Position,
  config: AuctionEngineConfig,
): number => {
  const globalMaximum = config.rosterMaximums[position];
  const ownerMaximum = config.ownerRosterMaximums[owner]?.[position] ?? globalMaximum;

  return Math.max(config.starterMinimums[position], Math.min(globalMaximum, ownerMaximum));
};

export const buildAuctionConfig = (
  overrides: AuctionEngineConfigOverrides = {},
): AuctionEngineConfig => ({
  ...defaultAuctionEngineConfig,
  ...overrides,
  ownerDemandMultipliers: overrides.ownerDemandMultipliers ?? defaultAuctionEngineConfig.ownerDemandMultipliers,
  ownerBehaviors: overrides.ownerBehaviors ?? defaultAuctionEngineConfig.ownerBehaviors,
  ownerRosterMaximums: overrides.ownerRosterMaximums ?? defaultAuctionEngineConfig.ownerRosterMaximums,
  ownerPositionAnchorTargets: overrides.ownerPositionAnchorTargets ??
    defaultAuctionEngineConfig.ownerPositionAnchorTargets,
  ownerPositionCoreTargets: overrides.ownerPositionCoreTargets ??
    defaultAuctionEngineConfig.ownerPositionCoreTargets,
  ownerPositionCoreMaxBids: overrides.ownerPositionCoreMaxBids ??
    defaultAuctionEngineConfig.ownerPositionCoreMaxBids,
  ownerPositionSlotMaxBids: overrides.ownerPositionSlotMaxBids ??
    defaultAuctionEngineConfig.ownerPositionSlotMaxBids,
  ownerPositionCoreBudgetEnvelopes: overrides.ownerPositionCoreBudgetEnvelopes ??
    defaultAuctionEngineConfig.ownerPositionCoreBudgetEnvelopes,
  positionOverbidDamping: overrides.positionOverbidDamping ?? defaultAuctionEngineConfig.positionOverbidDamping,
  scarcity: {
    ...defaultAuctionEngineConfig.scarcity,
    ...overrides.scarcity,
  },
  rosterNeed: {
    ...defaultAuctionEngineConfig.rosterNeed,
    ...overrides.rosterNeed,
  },
  nomination: {
    ...defaultAuctionEngineConfig.nomination,
    ...overrides.nomination,
  },
  endgameSpend: {
    ...defaultAuctionEngineConfig.endgameSpend,
    ...overrides.endgameSpend,
  },
  roomPressure: {
    ...defaultAuctionEngineConfig.roomPressure,
    ...overrides.roomPressure,
  },
  budgetPacing: {
    ...defaultAuctionEngineConfig.budgetPacing,
    ...overrides.budgetPacing,
  },
  bidVariance: {
    ...defaultAuctionEngineConfig.bidVariance,
    ...overrides.bidVariance,
  },
  lateOpeningBid: {
    ...defaultAuctionEngineConfig.lateOpeningBid,
    ...overrides.lateOpeningBid,
  },
  topEndOverbidDamping: {
    ...defaultAuctionEngineConfig.topEndOverbidDamping,
    ...overrides.topEndOverbidDamping,
  },
  contextPenaltyBidDamping: {
    ...defaultAuctionEngineConfig.contextPenaltyBidDamping,
    ...overrides.contextPenaltyBidDamping,
  },
  topEndSaleGuard: {
    ...defaultAuctionEngineConfig.topEndSaleGuard,
    ...overrides.topEndSaleGuard,
  },
  tierSaleGuard: {
    ...defaultAuctionEngineConfig.tierSaleGuard,
    ...overrides.tierSaleGuard,
  },
});

const countPositions = (players: readonly Player[]): PositionAmounts => {
  const counts = emptyPositionAmounts();

  for (const player of players) {
    counts[player.position] += 1;
  }

  return counts;
};

const maxBidFor = (
  budgetRemaining: number,
  rosterSlotsRemaining: number,
  minimumBid: number,
): number => {
  if (rosterSlotsRemaining <= 0) return 0;
  return Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * minimumBid);
};

const ownerStateFromRoster = (
  owner: Owner,
  roster: readonly Player[],
  config: AuctionEngineConfig,
): AuctionOwnerState => {
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = config.rosterSize - roster.length;
  const budgetRemaining = config.auctionBudget - spent;

  return {
    owner,
    roster: [...roster],
    spent,
    budgetRemaining,
    rosterSlotsRemaining,
    maxBid: maxBidFor(budgetRemaining, rosterSlotsRemaining, config.minimumBid),
  };
};

export const createAuctionOwnerStates = ({
  config = defaultAuctionEngineConfig,
  initialRostersByOwner = {},
}: {
  config?: AuctionEngineConfig;
  initialRostersByOwner?: InitialRostersByOwner;
}): AuctionOwnerState[] =>
  config.owners.map(owner => {
    const initialRoster = initialRostersByOwner[owner] ?? [];
    if (initialRoster.length > config.rosterSize) {
      throw new Error(`${owner} has more initial players than roster slots.`);
    }

    return ownerStateFromRoster(owner, initialRoster, config);
  });

const directMissingTotal = (
  counts: PositionAmounts,
  starterMinimums: PositionAmounts,
): number =>
  positions.reduce(
    (total, position) => total + Math.max(0, starterMinimums[position] - counts[position]),
    0,
  );

const directMissingFlexEligible = (
  counts: PositionAmounts,
  starterMinimums: PositionAmounts,
): number =>
  flexEligiblePositions.reduce(
    (total, position) => total + Math.max(0, starterMinimums[position] - counts[position]),
    0,
  );

const flexEligibleCount = (counts: PositionAmounts): number =>
  flexEligiblePositions.reduce((total, position) => total + counts[position], 0);

const minimumFlexEligibleCount = (config: AuctionEngineConfig): number =>
  flexEligiblePositions.reduce(
    (total, position) => total + config.starterMinimums[position],
    config.flexMinimum,
  );

const futurePicksNeededForLegalRoster = (
  counts: PositionAmounts,
  config: AuctionEngineConfig,
): number => {
  const missingDirect = directMissingTotal(counts, config.starterMinimums);
  const flexCountAfterDirectMinimums = flexEligibleCount(counts) +
    directMissingFlexEligible(counts, config.starterMinimums);
  const extraFlexShortage = Math.max(
    0,
    minimumFlexEligibleCount(config) - flexCountAfterDirectMinimums,
  );

  return missingDirect + extraFlexShortage;
};

const canOwnerCompleteRosterAfterAddingPositionSlots = (
  state: AuctionOwnerState,
  position: Position,
  slotCount: number,
  config: AuctionEngineConfig,
): boolean => {
  if (slotCount <= 0) return true;
  if (state.rosterSlotsRemaining < slotCount) return false;

  const counts = countPositions(state.roster);
  if (counts[position] + slotCount > rosterMaximumFor(state.owner, position, config)) return false;

  counts[position] += slotCount;
  const slotsAfterPick = state.rosterSlotsRemaining - slotCount;
  return futurePicksNeededForLegalRoster(counts, config) <= slotsAfterPick;
};

const canOwnerCompleteRosterAfterAdding = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): boolean =>
  canOwnerCompleteRosterAfterAddingPositionSlots(state, player.position, 1, config);

const remainingPlayersAtPosition = (
  remainingPlayers: readonly Player[],
  position: Position,
): number =>
  remainingPlayers.filter(player => player.position === position).length;

const canLeagueStillMeetPositionMinimumsWithCount = (
  candidateState: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): boolean => {
  const positionMinimum = config.starterMinimums[player.position];
  if (positionMinimum <= 0) return true;

  const directShortageAfterPick = ownerStates.reduce((shortage, state) => {
    const counts = countPositions(state.roster);
    if (state.owner === candidateState.owner) counts[player.position] += 1;
    return shortage + Math.max(0, positionMinimum - counts[player.position]);
  }, 0);

  return remainingPlayersAtPlayerPosition >= directShortageAfterPick;
};

const ownerCanBidOnPlayerWithCount = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): boolean =>
  state.maxBid >= config.minimumBid &&
  canOwnerCompleteRosterAfterAdding(state, player, config) &&
  canLeagueStillMeetPositionMinimumsWithCount(
    state,
    player,
    ownerStates,
    remainingPlayersAtPlayerPosition,
    config,
  );

const ownerCanBidOnPlayer = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): boolean =>
  ownerCanBidOnPlayerWithCount(
    state,
    player,
    ownerStates,
    remainingPlayersAtPosition(remainingPlayers, player.position),
    config,
  );

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const deterministicTieBreak = (
  seed: string,
  owner: Owner,
  playerName: string,
): number =>
  hashString(`${seed}|${owner}|${playerName}`) / hashDivisor;

const bidVarianceMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  if (player.price < config.bidVariance.minimumPlayerPrice) return 1;

  const priceRange = Math.max(
    1,
    config.bidVariance.fullEffectPlayerPrice - config.bidVariance.minimumPlayerPrice,
  );
  const priceScale = clamp(
    (player.price - config.bidVariance.minimumPlayerPrice) / priceRange,
    0,
    1,
  );
  const roll = deterministicTieBreak(`${config.seed}:bid-variance`, state.owner, player.name);
  if (roll < 0.5) {
    return 1 - ((0.5 - roll) / 0.5) * config.bidVariance.maxDiscount * priceScale;
  }

  return 1 + ((roll - 0.5) / 0.5) * config.bidVariance.maxPremium * priceScale;
};

const ownerDemandMultiplierFor = (
  owner: Owner,
  position: Position,
  config: AuctionEngineConfig,
): number =>
  config.ownerDemandMultipliers[owner]?.[position] ?? 1;

const positionCapacityFor = (
  state: AuctionOwnerState,
  position: Position,
  config: AuctionEngineConfig,
): number => {
  const counts = countPositions(state.roster);
  const maximumLegalSlots = Math.min(
    state.rosterSlotsRemaining,
    Math.max(0, rosterMaximumFor(state.owner, position, config) - counts[position]),
  );
  let capacity = 0;

  for (let slotCount = 1; slotCount <= maximumLegalSlots; slotCount += 1) {
    if (!canOwnerCompleteRosterAfterAddingPositionSlots(state, position, slotCount, config)) break;
    capacity = slotCount;
  }

  return capacity;
};

const tierDemandSlotsFor = (
  state: AuctionOwnerState,
  position: Position,
  comparablePrice: number,
  config: AuctionEngineConfig,
): number => {
  const affordableComparableSlots = Math.floor(state.maxBid / comparablePrice);
  const demandSlots = Math.min(positionCapacityFor(state, position, config), affordableComparableSlots);
  if (demandSlots <= 0) return 0;

  return clamp(
    demandSlots,
    1,
    Math.max(1, config.scarcity.maxDemandSlotsPerOwner),
  );
};

const weightedBidderDemandFor = (
  state: AuctionOwnerState,
  player: Player,
  comparablePrice: number,
  config: AuctionEngineConfig,
): number => {
  const demandSlots = tierDemandSlotsFor(state, player.position, comparablePrice, config);
  const depthDemand = 1 + Math.max(0, demandSlots - 1) * Math.max(0, config.scarcity.bidderDepthWeight);
  const needWeight = clamp(rosterNeedMultiplierFor(state, player.position, config), 0, 1.25);
  return depthDemand * needWeight;
};

const defaultOwnerAuctionBehavior: CompleteOwnerAuctionBehavior = {
  priceAggression: 1,
  scarcityChase: 1,
  replacementPatience: 1,
  anchorAggression: 1,
  depthAggression: 1,
};

const ownerBehaviorFor = (
  owner: Owner,
  config: AuctionEngineConfig,
): CompleteOwnerAuctionBehavior =>
  ({
    ...defaultOwnerAuctionBehavior,
    ...config.ownerBehaviors[owner],
  });

const rosterNeedMultiplierFor = (
  state: AuctionOwnerState,
  position: Position,
  config: AuctionEngineConfig,
): number => {
  const counts = countPositions(state.roster);
  let multiplier = 1;

  if (counts[position] < config.starterMinimums[position]) {
    multiplier *= config.rosterNeed.missingStarterMultiplier;
  } else if (isFlexEligible(position) && flexEligibleCount(counts) < minimumFlexEligibleCount(config)) {
    multiplier *= config.rosterNeed.missingFlexMultiplier;
  }

  if (isPremiumPosition(position) && counts[position] === 0) {
    multiplier *= config.rosterNeed.emptyPremiumPositionMultiplier;
  }
  if (position === "QB" && config.starterMinimums.QB > 0 && counts.QB >= config.starterMinimums.QB) {
    multiplier *= config.rosterNeed.benchQuarterbackMultiplier;
  }
  if (position === "TE" && config.starterMinimums.TE > 0 && counts.TE >= config.starterMinimums.TE) {
    multiplier *= config.rosterNeed.benchTightEndMultiplier;
  }
  if ((position === "K" || position === "DST") && counts[position] >= 1) {
    multiplier *= config.rosterNeed.specialTeamsBenchMultiplier;
  }
  if (counts[position] >= rosterMaximumFor(state.owner, position, config) - 1) {
    multiplier *= config.rosterNeed.lastPositionSlotMultiplier;
  }

  return multiplier;
};

const scarcityMultiplierFor = (
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  const comparablePrice = Math.max(
    config.scarcity.minimumComparablePrice,
    Math.ceil(player.price * config.scarcity.comparablePriceRatio),
  );
  const comparablePlayersRemaining = remainingPlayers
    .filter(candidate => candidate.position === player.position && candidate.price >= comparablePrice)
    .length + 1;
  const activeBidders = ownerStates
    .filter(state => ownerCanBidOnPlayer(state, player, ownerStates, remainingPlayers, config))
    .filter(state => state.maxBid >= comparablePrice)
  const weightedBidderDemand = activeBidders.reduce(
    (total, state) => total + weightedBidderDemandFor(state, player, comparablePrice, config),
    0,
  );
  const pressure = weightedBidderDemand / Math.max(1, comparablePlayersRemaining);

  return clamp(
    1 + Math.max(0, pressure - 1) * config.scarcity.slope,
    1,
    config.scarcity.maxMultiplier,
  );
};

const endgamePressureMultiplierFor = (
  state: AuctionOwnerState,
  config: AuctionEngineConfig,
): number => {
  if (state.rosterSlotsRemaining <= 0) return 1;
  if (state.rosterSlotsRemaining > config.endgameSpend.startRosterSlotsRemaining) return 1;

  const budgetPerSlot = state.budgetRemaining / state.rosterSlotsRemaining;
  if (budgetPerSlot <= config.endgameSpend.targetBudgetPerSlot) return 1;

  const excessBudgetRatio = (budgetPerSlot - config.endgameSpend.targetBudgetPerSlot) /
    config.endgameSpend.targetBudgetPerSlot;
  const urgency = (
    config.endgameSpend.startRosterSlotsRemaining - state.rosterSlotsRemaining + 1
  ) / config.endgameSpend.startRosterSlotsRemaining;

  return clamp(
    1 + excessBudgetRatio * urgency * config.endgameSpend.slope,
    1,
    config.endgameSpend.maxMultiplier,
  );
};

const roomPressureMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  const pressure = config.roomPressure;
  if (state.rosterSlotsRemaining <= pressure.minRosterSlotsRemainingExclusive) return 1;
  if (state.rosterSlotsRemaining > pressure.startRosterSlotsRemaining) return 1;
  if (player.price < pressure.minimumPlayerPrice || player.price > pressure.maximumPlayerPrice) return 1;
  if (state.rosterSlotsRemaining <= 0 || pressure.targetBudgetPerSlot <= 0) return 1;

  const budgetPerSlot = state.budgetRemaining / state.rosterSlotsRemaining;
  if (budgetPerSlot <= pressure.targetBudgetPerSlot) return 1;

  const phaseSpan = Math.max(1, pressure.startRosterSlotsRemaining - pressure.minRosterSlotsRemainingExclusive);
  const phase = clamp(
    (pressure.startRosterSlotsRemaining - state.rosterSlotsRemaining + 1) / phaseSpan,
    0,
    1,
  );
  const excessBudgetRatio = (budgetPerSlot - pressure.targetBudgetPerSlot) / pressure.targetBudgetPerSlot;

  return clamp(
    1 + excessBudgetRatio * phase * pressure.slope,
    1,
    pressure.maxMultiplier,
  );
};

const budgetPacingMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  if (player.price < config.budgetPacing.minimumPlayerPrice) return 1;
  if (state.rosterSlotsRemaining <= 1) return 1;
  if (config.budgetPacing.targetBudgetPerSlotAfterPurchase <= 0) return 1;

  const expectedSpend = Math.min(state.maxBid, player.price);
  const slotsAfterPurchase = state.rosterSlotsRemaining - 1;
  const budgetAfterPurchase = state.budgetRemaining - expectedSpend;
  const budgetPerSlotAfterPurchase = budgetAfterPurchase / slotsAfterPurchase;
  const targetBudgetPerSlot = config.budgetPacing.targetBudgetPerSlotAfterPurchase;
  if (budgetPerSlotAfterPurchase >= targetBudgetPerSlot) return 1;

  const shortageRatio = (targetBudgetPerSlot - budgetPerSlotAfterPurchase) / targetBudgetPerSlot;
  const discount = clamp(shortageRatio * config.budgetPacing.slope, 0, config.budgetPacing.maxDiscount);
  return 1 - discount;
};

const lateOpeningBidFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  const openingBid = config.lateOpeningBid;
  if (state.rosterSlotsRemaining <= 0) return 0;
  if (state.rosterSlotsRemaining > openingBid.startRosterSlotsRemaining) return 0;
  if (player.price > openingBid.maxPlayerPrice) return 0;

  const targetBudget = state.rosterSlotsRemaining * openingBid.targetBudgetPerSlot;
  const excessBudget = state.budgetRemaining - targetBudget;
  if (excessBudget <= 0) return 0;

  const urgency = (
    openingBid.startRosterSlotsRemaining - state.rosterSlotsRemaining + 1
  ) / openingBid.startRosterSlotsRemaining;
  const extraBid = Math.floor(Math.min(openingBid.maxExtraBid, excessBudget * urgency));
  if (extraBid <= 0) return 0;

  return clamp(player.price + extraBid, config.minimumBid, state.maxBid);
};

const lateOpeningBidForNominator = (
  nominator: Owner | undefined,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  if (!nominator) return 0;

  const nominatorState = ownerStates.find(state => state.owner === nominator);
  if (!nominatorState) return 0;
  if (!ownerCanBidOnPlayer(nominatorState, player, ownerStates, remainingPlayers, config)) return 0;

  return lateOpeningBidFor(nominatorState, player, config);
};

const topEndDampingMultiplierFor = (
  player: Player,
  rawBidMultiplier: number,
  config: AuctionEngineConfig,
): number => {
  if (rawBidMultiplier <= 1) return 1;

  const { startPrice, fullEffectPrice, maxOverbidDiscount } = config.topEndOverbidDamping;
  if (player.price < startPrice || maxOverbidDiscount <= 0) return 1;

  const priceRange = Math.max(1, fullEffectPrice - startPrice);
  const priceScale = clamp((player.price - startPrice) / priceRange, 0, 1);
  const overbidDiscount = clamp(priceScale * maxOverbidDiscount, 0, maxOverbidDiscount);
  const adjustedBidMultiplier = 1 + (rawBidMultiplier - 1) * (1 - overbidDiscount);

  return adjustedBidMultiplier / rawBidMultiplier;
};

const positionOverbidDampingMultiplierFor = (
  position: Position,
  bidMultiplier: number,
  config: AuctionEngineConfig,
): number => {
  if (bidMultiplier <= 1) return 1;

  const overbidDiscount = config.positionOverbidDamping[position] ?? 0;
  if (overbidDiscount <= 0) return 1;

  const adjustedBidMultiplier = 1 + (bidMultiplier - 1) * (1 - clamp(overbidDiscount, 0, 1));
  return adjustedBidMultiplier / bidMultiplier;
};

const contextPenaltyDampingMultiplierFor = (
  player: Player,
  bidMultiplier: number,
  config: AuctionEngineConfig,
): number => {
  if (bidMultiplier <= 1) return 1;
  if (player.price < config.contextPenaltyBidDamping.minimumPlayerPrice) return 1;

  const penalty = -(player.contextAdjustmentPercent ?? 0);
  const { startPenalty, fullEffectPenalty, maxOverbidDiscount } = config.contextPenaltyBidDamping;
  if (penalty < startPenalty || maxOverbidDiscount <= 0) return 1;

  const penaltyRange = Math.max(0.001, fullEffectPenalty - startPenalty);
  const penaltyScale = clamp((penalty - startPenalty) / penaltyRange, 0, 1);
  const overbidDiscount = clamp(penaltyScale * maxOverbidDiscount, 0, maxOverbidDiscount);
  const adjustedBidMultiplier = 1 + (bidMultiplier - 1) * (1 - overbidDiscount);

  return adjustedBidMultiplier / bidMultiplier;
};

const anchorRosterCount = (roster: readonly Player[]): number =>
  roster.filter(player => player.price >= anchorBuildPriceThreshold).length;

const positionAnchorRosterCount = (roster: readonly Player[], position: Position): number =>
  roster.filter(player => player.position === position && player.price >= anchorBuildPriceThreshold).length;

const positionRosterCount = (roster: readonly Player[], position: Position): number =>
  roster.filter(player => player.position === position).length;

const positionSpend = (roster: readonly Player[], position: Position): number =>
  roster
    .filter(player => player.position === position)
    .reduce((total, player) => total + player.price, 0);

const unmetPositionAnchorTargets = (
  state: AuctionOwnerState,
  config: AuctionEngineConfig,
): Position[] => {
  const targets = config.ownerPositionAnchorTargets[state.owner] ?? {};

  return positions.filter(position => {
    const target = targets[position];
    return target !== undefined && positionAnchorRosterCount(state.roster, position) < target;
  });
};

const strategyBudgetMaxBidFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number | undefined => {
  const positionAnchorCount = positionAnchorRosterCount(state.roster, player.position);
  const positionSlotCount = positionRosterCount(state.roster, player.position);
  const cappedMaxBids: number[] = [];
  const coreBudgetEnvelope = config.ownerPositionCoreBudgetEnvelopes[state.owner]?.[player.position];
  if (coreBudgetEnvelope && positionSlotCount < coreBudgetEnvelope.targetCount) {
    const futureCoreSlots = Math.max(0, coreBudgetEnvelope.targetCount - positionSlotCount - 1);
    const futureCoreReserve = futureCoreSlots * coreBudgetEnvelope.minimumFutureCorePrice;
    cappedMaxBids.push(Math.floor(
      coreBudgetEnvelope.hardBudget -
        positionSpend(state.roster, player.position) -
        futureCoreReserve,
    ));
  }

  const coreTargets = player.price >= anchorBuildPriceThreshold
    ? config.ownerPositionCoreTargets[state.owner]?.[player.position]
    : undefined;
  if (coreTargets && coreTargets.length > 0) {
    const remainingTargets = coreTargets.slice(positionAnchorCount);
    if (remainingTargets.length > 1) {
      const futureCoreReserve = remainingTargets
        .slice(1)
        .reduce((total, targetPrice) => total + targetPrice, 0);
      const futureCoreSlots = remainingTargets.length - 1;
      const rosterSlotsAfterPurchase = Math.max(0, state.rosterSlotsRemaining - 1);
      const nonCoreSlotsAfterPurchase = Math.max(0, rosterSlotsAfterPurchase - futureCoreSlots);
      cappedMaxBids.push(Math.floor(
        state.budgetRemaining -
          futureCoreReserve -
          nonCoreSlotsAfterPurchase * config.minimumBid,
      ));
    }
  }

  const coreSlotMaxBid = player.price >= anchorBuildPriceThreshold
    ? config.ownerPositionCoreMaxBids[state.owner]?.[player.position]?.[positionAnchorCount]
    : undefined;
  if (coreSlotMaxBid !== undefined) cappedMaxBids.push(coreSlotMaxBid);
  const positionSlotMaxBid = config.ownerPositionSlotMaxBids[state.owner]?.[player.position]?.[positionSlotCount];
  if (positionSlotMaxBid !== undefined) cappedMaxBids.push(positionSlotMaxBid);
  if (cappedMaxBids.length === 0) return undefined;

  return clamp(Math.min(...cappedMaxBids), config.minimumBid, state.maxBid);
};

const buildStyleMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  behavior: CompleteOwnerAuctionBehavior,
  config: AuctionEngineConfig,
): number => {
  const positionAnchorCount = positionAnchorRosterCount(state.roster, player.position);
  const positionAnchorTarget = config.ownerPositionAnchorTargets[state.owner]?.[player.position];
  const coreTargets = config.ownerPositionCoreTargets[state.owner]?.[player.position];
  const hasOpenPositionAnchorTarget = positionAnchorTarget !== undefined &&
    positionAnchorCount < positionAnchorTarget;
  const hasOpenCoreTarget = coreTargets !== undefined &&
    positionAnchorCount < coreTargets.length;
  const unmetTargets = unmetPositionAnchorTargets(state, config);
  if (
    player.price >= anchorBuildPriceThreshold &&
    unmetTargets.length > 0 &&
    !unmetTargets.some(position => position === player.position)
  ) {
    return behavior.depthAggression;
  }

  if (
    player.price >= anchorBuildPriceThreshold &&
    hasOpenPositionAnchorTarget
  ) {
    return behavior.anchorAggression;
  }

  if (
    player.price >= anchorBuildPriceThreshold &&
    positionAnchorCount > 0 &&
    !hasOpenCoreTarget
  ) {
    return behavior.depthAggression;
  }

  if (
    player.price >= anchorBuildPriceThreshold &&
    anchorRosterCount(state.roster) < targetAnchorRosterCount
  ) {
    return behavior.anchorAggression;
  }

  if (player.price <= depthBuildPriceThreshold) {
    return behavior.depthAggression;
  }

  return 1;
};

const bidForOwner = (
  state: AuctionOwnerState,
  player: Player,
  scarcityMultiplier: number,
  config: AuctionEngineConfig,
  openingBid = 0,
): AuctionBid => {
  const ownerDemandMultiplier = ownerDemandMultiplierFor(state.owner, player.position, config);
  const rosterNeedMultiplier = rosterNeedMultiplierFor(state, player.position, config);
  const ownerBehavior = ownerBehaviorFor(state.owner, config);
  const behaviorScarcityMultiplier = 1 + (scarcityMultiplier - 1) * ownerBehavior.scarcityChase;
  const buildStyleMultiplier = buildStyleMultiplierFor(state, player, ownerBehavior, config);
  const replacementPatienceMultiplier = player.price <= replacementPatiencePriceThreshold
    ? ownerBehavior.replacementPatience
    : 1;
  const endgamePressureMultiplier = endgamePressureMultiplierFor(state, config);
  const roomPressureMultiplier = roomPressureMultiplierFor(state, player, config);
  const budgetPacingMultiplier = budgetPacingMultiplierFor(state, player, config);
  const bidVarianceMultiplier = bidVarianceMultiplierFor(state, player, config);
  const rawBidMultiplier =
    ownerDemandMultiplier *
    rosterNeedMultiplier *
    behaviorScarcityMultiplier *
    ownerBehavior.priceAggression *
    buildStyleMultiplier *
    replacementPatienceMultiplier *
    endgamePressureMultiplier *
    roomPressureMultiplier *
    budgetPacingMultiplier *
    bidVarianceMultiplier;
  const topEndDampingMultiplier = topEndDampingMultiplierFor(player, rawBidMultiplier, config);
  const topEndAdjustedBidMultiplier = rawBidMultiplier * topEndDampingMultiplier;
  const positionOverbidDampingMultiplier = positionOverbidDampingMultiplierFor(
    player.position,
    topEndAdjustedBidMultiplier,
    config,
  );
  const contextPenaltyDampingMultiplier = contextPenaltyDampingMultiplierFor(
    player,
    topEndAdjustedBidMultiplier * positionOverbidDampingMultiplier,
    config,
  );
  const replacementLevelBidCap = player.price <= config.minimumBid
    ? config.minimumBid
    : Number.POSITIVE_INFINITY;
  const pricedBidAmount = Math.min(
    replacementLevelBidCap,
    Math.max(
      config.minimumBid,
      Math.round(
        player.price *
          topEndAdjustedBidMultiplier *
          positionOverbidDampingMultiplier *
          contextPenaltyDampingMultiplier,
      ),
    ),
  );
  const uncappedAmount = Math.max(pricedBidAmount, openingBid);
  const strategyBudgetMaxBid = strategyBudgetMaxBidFor(state, player, config);
  const maxBid = Math.min(state.maxBid, strategyBudgetMaxBid ?? state.maxBid);

  return {
    owner: state.owner,
    amount: Math.min(maxBid, uncappedAmount),
    uncappedAmount,
    maxBid: state.maxBid,
    ...(strategyBudgetMaxBid === undefined ? {} : { strategyBudgetMaxBid }),
    marketPrice: player.price,
    ownerDemandMultiplier,
    rosterNeedMultiplier,
    scarcityMultiplier,
    behaviorAggressionMultiplier: ownerBehavior.priceAggression,
    behaviorScarcityMultiplier,
    buildStyleMultiplier,
    replacementPatienceMultiplier,
    endgamePressureMultiplier,
    roomPressureMultiplier,
    budgetPacingMultiplier,
    bidVarianceMultiplier,
    topEndDampingMultiplier,
    positionOverbidDampingMultiplier,
    contextPenaltyDampingMultiplier,
    tieBreak: deterministicTieBreak(config.seed, state.owner, player.name),
  };
};

const ownerIndex = (config: AuctionEngineConfig, owner: Owner): number => {
  const index = config.owners.indexOf(owner);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const compareBids = (config: AuctionEngineConfig) => (left: AuctionBid, right: AuctionBid): number =>
  right.amount - left.amount ||
  right.uncappedAmount - left.uncappedAmount ||
  left.tieBreak - right.tieBreak ||
  ownerIndex(config, left.owner) - ownerIndex(config, right.owner);

const bidDriversFor = (bid: AuctionBid): AuctionBidDriver[] => {
  const multipliers = [
    { key: "owner_demand", multiplier: bid.ownerDemandMultiplier },
    { key: "roster_need", multiplier: bid.rosterNeedMultiplier },
    { key: "scarcity", multiplier: bid.behaviorScarcityMultiplier },
    { key: "behavior_aggression", multiplier: bid.behaviorAggressionMultiplier },
    { key: "build_style", multiplier: bid.buildStyleMultiplier },
    { key: "replacement_patience", multiplier: bid.replacementPatienceMultiplier },
    { key: "endgame_pressure", multiplier: bid.endgamePressureMultiplier },
    { key: "room_pressure", multiplier: bid.roomPressureMultiplier },
    { key: "budget_pacing", multiplier: bid.budgetPacingMultiplier },
    { key: "bid_variance", multiplier: bid.bidVarianceMultiplier },
    { key: "top_end_damping", multiplier: bid.topEndDampingMultiplier },
    { key: "position_overbid_damping", multiplier: bid.positionOverbidDampingMultiplier },
    { key: "context_penalty_damping", multiplier: bid.contextPenaltyDampingMultiplier },
  ] satisfies readonly { key: string; multiplier: number }[];

  return multipliers
    .flatMap(({ key, multiplier }) => {
      if (multiplier === 1) return [];
      return [{
        key,
        multiplier,
        direction: multiplier > 1 ? "up" : "down",
      } satisfies AuctionBidDriver];
    })
    .sort((left, right) =>
      Math.abs(right.multiplier - 1) - Math.abs(left.multiplier - 1) ||
      left.key.localeCompare(right.key),
    );
};

const retainedBidDriversFor = (bid: AuctionBid): AuctionBidDriver[] => {
  const drivers = bidDriversFor(bid);
  const retainedDrivers = drivers.slice(0, 3);
  const contextPenaltyDriver = drivers.find(driver => driver.key === "context_penalty_damping");

  if (
    !contextPenaltyDriver ||
    retainedDrivers.some(driver => driver.key === contextPenaltyDriver.key)
  ) {
    return retainedDrivers;
  }

  return [...retainedDrivers.slice(0, 2), contextPenaltyDriver];
};

const bidDiagnosticsFor = (bid: AuctionBid): AuctionBidDiagnostics => ({
  owner: bid.owner,
  cappedByMaxBid: bid.amount < bid.uncappedAmount,
  drivers: retainedBidDriversFor(bid),
});

const budgetPerRosterSlotFor = (state: AuctionOwnerState): number | null =>
  state.rosterSlotsRemaining <= 0
    ? null
    : roundToTwo(state.budgetRemaining / state.rosterSlotsRemaining);

const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? roundToTwo((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
};

const roomPressureDiagnosticsFor = ({
  bids,
  ownerStates,
  reservePrice,
  anchorPrice,
  salePrice,
  winningBid,
  config,
}: {
  bids: readonly AuctionBid[];
  ownerStates: readonly AuctionOwnerState[];
  reservePrice: number;
  anchorPrice: number;
  salePrice: number;
  winningBid: AuctionBid;
  config: AuctionEngineConfig;
}): AuctionRoomPressureDiagnostics => {
  const stateByOwner = new Map(ownerStates.map(state => [state.owner, state]));
  const bidderStates = bids.flatMap(bid => {
    const state = stateByOwner.get(bid.owner);
    return state ? [state] : [];
  });
  const bidderMaxBids = bids.map(bid => bid.maxBid);
  const winningState = stateByOwner.get(winningBid.owner);

  return {
    legalBidderCount: bids.length,
    biddersAtOrAboveReserve: bids.filter(bid => bid.amount >= reservePrice).length,
    biddersAtOrAboveAnchor: bids.filter(bid => bid.amount >= anchorPrice).length,
    biddersAtOrAboveSalePrice: bids.filter(bid => bid.amount >= salePrice).length,
    cashHeavyBidderCount: bidderStates.filter(state => {
      const budgetPerRosterSlot = budgetPerRosterSlotFor(state);
      return budgetPerRosterSlot !== null && budgetPerRosterSlot >= config.roomPressure.targetBudgetPerSlot;
    }).length,
    maxBidderMaxBid: bidderMaxBids.length === 0 ? 0 : Math.max(...bidderMaxBids),
    medianBidderMaxBid: median(bidderMaxBids),
    averageBidderMaxBid: roundToTwo(average(bidderMaxBids)),
    winningOwnerMaxBid: winningBid.maxBid,
    winningOwnerBudgetRemainingBefore: winningState?.budgetRemaining ?? 0,
    winningOwnerBudgetPerRosterSlotBefore: winningState ? budgetPerRosterSlotFor(winningState) : null,
  };
};

const salePriceBasisFor = (
  winningBidAmount: number,
  floors: readonly { basis: AuctionSalePriceBasis; amount: number }[],
): AuctionSalePriceBasis => {
  const floor = floors.reduce(
    (highest, candidate) => candidate.amount > highest.amount ? candidate : highest,
    { basis: "minimum_bid", amount: 0 } satisfies { basis: AuctionSalePriceBasis; amount: number },
  );

  return winningBidAmount <= floor.amount ? "winning_bid_cap" : floor.basis;
};

const topEndSaleGuardPriceFor = (
  player: Player,
  uncappedSalePrice: number,
  config: AuctionEngineConfig,
): number => {
  const guard = config.topEndSaleGuard;
  if (player.price < guard.threshold && uncappedSalePrice >= guard.threshold) {
    return Math.max(player.price, guard.capBelowThresholdAt);
  }

  if (
    player.price < guard.premiumThreshold &&
    uncappedSalePrice >= guard.premiumThreshold
  ) {
    return Math.max(player.price, guard.capBelowPremiumThresholdAt);
  }

  if (
    player.price < guard.eliteThreshold &&
    uncappedSalePrice >= guard.eliteThreshold
  ) {
    return Math.max(player.price, guard.capBelowEliteThresholdAt);
  }

  return uncappedSalePrice;
};

const tierSaleGuardPriceFor = (
  player: Player,
  salePrice: number,
  config: AuctionEngineConfig,
): number => {
  const guard = config.tierSaleGuard;
  let guardedPrice = salePrice;

  if (player.price < guard.threshold && guardedPrice >= guard.threshold) {
    guardedPrice = Math.max(player.price, guard.capBelowThresholdAt);
  }

  if (player.price < guard.strongThreshold && guardedPrice >= guard.strongThreshold) {
    const tierCap = player.price >= guard.maxPremiumStartPrice
      ? Math.min(
        guard.capBelowStrongThresholdAt,
        player.price + guard.maxPremiumBelowStrongThreshold,
      )
      : guard.capBelowStrongThresholdAt;
    guardedPrice = Math.max(player.price, tierCap);
  }

  return guardedPrice;
};

export const resolveAuctionSale = (
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig = defaultAuctionEngineConfig,
  options: ResolveAuctionSaleOptions = {},
): AuctionSale | undefined => {
  const diagnosticsMode = options.diagnosticsMode ?? "full";
  const scarcityMultiplier = scarcityMultiplierFor(player, ownerStates, remainingPlayers, config);
  const nominatorOpeningBid = lateOpeningBidForNominator(
    options.nominator,
    player,
    ownerStates,
    remainingPlayers,
    config,
  );
  const bids = ownerStates
    .filter(state => ownerCanBidOnPlayer(state, player, ownerStates, remainingPlayers, config))
    .map(state => bidForOwner(
      state,
      player,
      scarcityMultiplier,
      config,
      state.owner === options.nominator ? nominatorOpeningBid : 0,
    ))
    .filter(bid => bid.amount >= config.minimumBid)
    .sort(compareBids(config));

  const winningBid = bids[0];
  if (!winningBid) return undefined;

  const secondBidAmount = bids[1]?.amount ?? 0;
  const reservePrice = Math.max(config.minimumBid, Math.round(player.price * config.reservePriceRatio));
  const salePriceFloors = [
    { basis: "minimum_bid", amount: config.minimumBid },
    { basis: "second_bid_plus_minimum", amount: secondBidAmount + config.minimumBid },
    { basis: "reserve_price", amount: reservePrice },
    { basis: "nominator_opening_bid", amount: nominatorOpeningBid },
  ] satisfies readonly { basis: AuctionSalePriceBasis; amount: number }[];
  const salePriceFloor = salePriceFloors.reduce<{ basis: AuctionSalePriceBasis; amount: number }>(
    (highest, candidate) => candidate.amount > highest.amount ? candidate : highest,
    { basis: "minimum_bid", amount: config.minimumBid },
  );
  const uncappedSalePrice = Math.min(winningBid.amount, salePriceFloor.amount);
  const topEndGuardedPrice = topEndSaleGuardPriceFor(player, uncappedSalePrice, config);
  const price = tierSaleGuardPriceFor(player, topEndGuardedPrice, config);

  return {
    player,
    winner: winningBid.owner,
    price,
    marketPrice: player.price,
    bids,
    diagnostics: {
      secondBidAmount,
      reservePrice,
      nominatorOpeningBid,
      uncappedSalePrice,
      topEndGuardedPrice,
      salePriceBasis: salePriceBasisFor(winningBid.amount, salePriceFloors),
      roomPressure: roomPressureDiagnosticsFor({
        bids,
        ownerStates,
        reservePrice,
        anchorPrice: player.price,
        salePrice: price,
        winningBid,
        config,
      }),
      topBids: diagnosticsMode === "full" ? bids.slice(0, 3).map(bidDiagnosticsFor) : [],
    },
  };
};

const compareAuctionPlayers = (left: Player, right: Player): number =>
  right.price - left.price ||
  right.weeks1To4 - left.weeks1To4 ||
  left.name.localeCompare(right.name);

export interface NominationSelection {
  index: number;
  player: Player;
  score: number;
  diagnostics: AuctionNominationDiagnostics;
}

export interface NominationTurn {
  owner: Owner;
  nextCursor: number;
}

type UnrankedNominationCandidateDiagnostics = Omit<AuctionNominationCandidateDiagnostics, "rank">;
const nominationDiagnosticCandidateLimit = 3;

const highestMarketPrice = (players: readonly Player[]): number =>
  players.reduce((highest, player) => Math.max(highest, player.price), 0);

const highestProjectionTotal = (players: readonly Player[]): number =>
  players.reduce((highest, player) => Math.max(highest, player.weeks1To4), 0);

export const nextNominationTurn = (
  ownerStates: readonly AuctionOwnerState[],
  config: AuctionEngineConfig,
  nominationCursor: number,
): NominationTurn => {
  if (config.owners.length === 0) throw new Error("Auction config must include at least one owner.");

  for (let offset = 0; offset < config.owners.length; offset += 1) {
    const ownerIndex = (nominationCursor + offset) % config.owners.length;
    const owner = config.owners[ownerIndex];
    if (!owner) continue;

    const ownerState = ownerStates.find(state => state.owner === owner);
    if (ownerState && ownerState.rosterSlotsRemaining > 0) {
      return {
        owner,
        nextCursor: ownerIndex + 1,
      };
    }
  }

  throw new Error("Unable to find an owner with an open roster slot.");
};

type PositionBooleans = Record<Position, boolean>;

interface NominationOwnerContext {
  state: AuctionOwnerState;
  canCompleteAfterAdding: PositionBooleans;
  directShortageAfterPick: PositionAmounts;
  needScore: PositionAmounts;
  capacity: PositionAmounts;
}

interface NominationContext {
  availablePositionCounts: PositionAmounts;
  ownerContexts: NominationOwnerContext[];
  ownerContextByOwner: ReadonlyMap<Owner, NominationOwnerContext>;
  ownersNeedingPosition: PositionAmounts;
}

const nominationNeedScoreForCounts = (
  owner: Owner,
  counts: PositionAmounts,
  position: Position,
  config: AuctionEngineConfig,
): number => {
  if (counts[position] >= rosterMaximumFor(owner, position, config)) return 0;

  if (counts[position] < config.starterMinimums[position]) return 1;
  if (isFlexEligible(position) && flexEligibleCount(counts) < minimumFlexEligibleCount(config)) {
    return 0.65;
  }
  if (isPremiumPosition(position) && counts[position] === 0) return 0.2;

  return 0;
};

const emptyPositionBooleans = (): PositionBooleans => ({
  QB: false,
  RB: false,
  WR: false,
  TE: false,
  K: false,
  DST: false,
});

const directShortageAfterPickFor = (
  candidateOwner: Owner,
  position: Position,
  ownerCounts: ReadonlyMap<Owner, PositionAmounts>,
  config: AuctionEngineConfig,
): number => {
  const positionMinimum = config.starterMinimums[position];
  if (positionMinimum <= 0) return 0;

  return [...ownerCounts.entries()].reduce((shortage, [owner, counts]) => {
    const positionCount = counts[position] + (owner === candidateOwner ? 1 : 0);
    return shortage + Math.max(0, positionMinimum - positionCount);
  }, 0);
};

const buildNominationContext = (
  availablePlayers: readonly Player[],
  ownerStates: readonly AuctionOwnerState[],
  config: AuctionEngineConfig,
): NominationContext => {
  const availablePositionCounts = countPositions(availablePlayers);
  const ownerCounts = new Map(ownerStates.map(state => [state.owner, countPositions(state.roster)]));
  const ownersNeedingPosition = emptyPositionAmounts();
  const ownerContexts = ownerStates.map(state => {
    const counts = ownerCounts.get(state.owner);
    if (!counts) throw new Error(`Missing nomination counts for ${state.owner}.`);

    const canCompleteAfterAdding = emptyPositionBooleans();
    const directShortageAfterPick = emptyPositionAmounts();
    const needScore = emptyPositionAmounts();
    const capacity = emptyPositionAmounts();

    for (const position of positions) {
      canCompleteAfterAdding[position] = canOwnerCompleteRosterAfterAddingPositionSlots(
        state,
        position,
        1,
        config,
      );
      directShortageAfterPick[position] = directShortageAfterPickFor(
        state.owner,
        position,
        ownerCounts,
        config,
      );
      needScore[position] = nominationNeedScoreForCounts(state.owner, counts, position, config);
      capacity[position] = positionCapacityFor(state, position, config);
      if (needScore[position] > 0) ownersNeedingPosition[position] += 1;
    }

    return {
      state,
      canCompleteAfterAdding,
      directShortageAfterPick,
      needScore,
      capacity,
    };
  });

  return {
    availablePositionCounts,
    ownerContexts,
    ownerContextByOwner: new Map(ownerContexts.map(context => [context.state.owner, context])),
    ownersNeedingPosition,
  };
};

const nominationContextCanBidOnPlayer = (
  context: NominationOwnerContext,
  player: Player,
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): boolean =>
  context.state.maxBid >= config.minimumBid &&
  context.canCompleteAfterAdding[player.position] &&
  remainingPlayersAtPlayerPosition >= context.directShortageAfterPick[player.position];

const nominationAffordabilityScoreFor = (
  context: NominationOwnerContext,
  player: Player,
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): number => {
  if (!nominationContextCanBidOnPlayer(context, player, remainingPlayersAtPlayerPosition, config)) {
    return 0;
  }
  if (player.price <= config.minimumBid) return 1;

  return clamp(context.state.maxBid / player.price, 0, 1);
};

const nominationScarcityScoreFor = (
  position: Position,
  context: NominationContext,
): number => {
  const playersAtPosition = context.availablePositionCounts[position];
  const ownersNeedingPosition = context.ownersNeedingPosition[position];

  return clamp(ownersNeedingPosition / Math.max(1, playersAtPosition), 0, 1);
};

const nominationFlushMoneyScoreFor = (
  nominator: Owner,
  player: Player,
  context: NominationContext,
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
  marketPriceScore: number,
  nominatorInterestScore: number,
): number => {
  const reservePrice = Math.max(config.minimumBid, Math.round(player.price * config.reservePriceRatio));
  const otherOwnerCount = Math.max(1, context.ownerContexts.length - 1);
  const interestedOtherOwners = context.ownerContexts
    .filter(ownerContext => ownerContext.state.owner !== nominator)
    .filter(ownerContext =>
      nominationContextCanBidOnPlayer(
        ownerContext,
        player,
        remainingPlayersAtPlayerPosition,
        config,
      ))
    .filter(ownerContext => ownerContext.state.maxBid >= reservePrice)
    .length;
  const bidderPressure = interestedOtherOwners / otherOwnerCount;
  const lowPersonalInterest = 1 - clamp(nominatorInterestScore, 0, 1) * 0.5;

  return bidderPressure * marketPriceScore * lowPersonalInterest;
};

const nominationOpponentNeedScoreFor = (
  nominator: Owner,
  player: Player,
  context: NominationContext,
  config: AuctionEngineConfig,
): number => {
  const otherOwnerContexts = context.ownerContexts.filter(ownerContext => ownerContext.state.owner !== nominator);
  if (otherOwnerContexts.length === 0) return 0;

  const totalNeed = otherOwnerContexts.reduce((total, ownerContext) => {
    const needScore = ownerContext.needScore[player.position];
    if (needScore <= 0) return total;
    if (ownerContext.capacity[player.position] <= 0) return total;

    const reservePrice = Math.max(config.minimumBid, Math.round(player.price * config.reservePriceRatio));
    if (ownerContext.state.maxBid < reservePrice) return total;

    const affordabilityScore = player.price <= config.minimumBid
      ? 1
      : clamp(ownerContext.state.maxBid / player.price, 0, 1);
    return total + needScore * affordabilityScore;
  }, 0);

  return clamp(totalNeed / otherOwnerContexts.length, 0, 1);
};

const nominationScoreFor = ({
  player,
  context,
  nominator,
  pickIndex,
  topMarketPrice,
  topProjectionTotal,
  config,
}: {
  player: Player;
  context: NominationContext;
  nominator: Owner;
  pickIndex: number;
  topMarketPrice: number;
  topProjectionTotal: number;
  config: AuctionEngineConfig;
}): UnrankedNominationCandidateDiagnostics | undefined => {
  const remainingPlayersAtPlayerPosition = Math.max(0, context.availablePositionCounts[player.position] - 1);
  const playerCanSell = context.ownerContexts.some(ownerContext =>
    nominationContextCanBidOnPlayer(
      ownerContext,
      player,
      remainingPlayersAtPlayerPosition,
      config,
    ),
  );
  if (!playerCanSell) return undefined;

  const nominatorContext = context.ownerContextByOwner.get(nominator);
  if (!nominatorContext) throw new Error(`Missing auction state for ${nominator}.`);

  const marketPriceScore = player.price / Math.max(1, topMarketPrice);
  const projectionScore = player.weeks1To4 / Math.max(1, topProjectionTotal);
  const ownerNeedScore = nominatorContext.needScore[player.position];
  const affordabilityScore = nominationAffordabilityScoreFor(
    nominatorContext,
    player,
    remainingPlayersAtPlayerPosition,
    config,
  );
  const scarcityScore = nominationScarcityScoreFor(
    player.position,
    context,
  );
  const opponentNeedScore = nominationOpponentNeedScoreFor(
    nominator,
    player,
    context,
    config,
  );
  const nominatorInterestScore = (ownerNeedScore + affordabilityScore) / 2;
  const flushMoneyScore = nominationFlushMoneyScoreFor(
    nominator,
    player,
    context,
    remainingPlayersAtPlayerPosition,
    config,
    marketPriceScore,
    nominatorInterestScore,
  );
  const marketPriceWeight = pickIndex < config.nomination.earlyEliteBiasPicks
    ? config.nomination.earlyMarketPriceWeight
    : config.nomination.marketPriceWeight;
  const tieBreakScore = 1 - deterministicTieBreak(config.seed, nominator, player.name);
  const scoreComponents = {
    marketPrice: marketPriceScore,
    projection: projectionScore,
    ownerNeed: ownerNeedScore,
    opponentNeed: opponentNeedScore,
    affordability: affordabilityScore,
    scarcity: scarcityScore,
    flushMoney: flushMoneyScore,
    tieBreak: tieBreakScore,
  } satisfies AuctionNominationScoreComponents;
  const weightedComponents = {
    marketPrice: marketPriceScore * marketPriceWeight,
    projection: projectionScore * config.nomination.projectionWeight,
    ownerNeed: ownerNeedScore * config.nomination.ownerNeedWeight,
    opponentNeed: opponentNeedScore * config.nomination.opponentNeedWeight,
    affordability: affordabilityScore * config.nomination.affordabilityWeight,
    scarcity: scarcityScore * config.nomination.scarcityWeight,
    flushMoney: flushMoneyScore * config.nomination.flushMoneyWeight,
    tieBreak: tieBreakScore * config.nomination.tieBreakWeight,
  } satisfies AuctionNominationScoreComponents;
  const score = Object.values(weightedComponents)
    .reduce((total, contribution) => total + contribution, 0);

  return {
    player: player.name,
    position: player.position,
    marketPrice: player.price,
    projectionTotal: player.weeks1To4,
    score,
    scoreComponents,
    weightedComponents,
  };
};

export const selectNominatedPlayer = ({
  availablePlayers,
  ownerStates,
  nominator,
  pickIndex,
  config,
  diagnosticsMode,
}: {
  availablePlayers: readonly Player[];
  ownerStates: readonly AuctionOwnerState[];
  nominator: Owner;
  pickIndex: number;
  config: AuctionEngineConfig;
  diagnosticsMode: AuctionDiagnosticsMode;
}): NominationSelection | undefined => {
  const topMarketPrice = highestMarketPrice(availablePlayers);
  const topProjectionTotal = highestProjectionTotal(availablePlayers);
  const nominationContext = buildNominationContext(availablePlayers, ownerStates, config);

  if (diagnosticsMode === "summary") {
    let selected: {
      index: number;
      player: Player;
      diagnostics: UnrankedNominationCandidateDiagnostics;
    } | undefined;
    let candidateCount = 0;

    for (const [index, player] of availablePlayers.entries()) {
      const diagnostics = nominationScoreFor({
        player,
        context: nominationContext,
        nominator,
        pickIndex,
        topMarketPrice,
        topProjectionTotal,
        config,
      });
      if (!diagnostics) continue;

      candidateCount += 1;
      if (
        !selected ||
        diagnostics.score > selected.diagnostics.score ||
        (diagnostics.score === selected.diagnostics.score && compareAuctionPlayers(player, selected.player) < 0)
      ) {
        selected = { index, player, diagnostics };
      }
    }

    if (!selected) return undefined;

    return {
      index: selected.index,
      player: selected.player,
      score: selected.diagnostics.score,
      diagnostics: {
        selectedPlayer: selected.player.name,
        selectedPosition: selected.player.position,
        selectedScore: selected.diagnostics.score,
        candidateCount,
        topCandidates: [],
      },
    };
  }

  const candidates: {
    index: number;
    player: Player;
    diagnostics: UnrankedNominationCandidateDiagnostics;
  }[] = [];

  for (const [index, player] of availablePlayers.entries()) {
    const diagnostics = nominationScoreFor({
      player,
      context: nominationContext,
      nominator,
      pickIndex,
      topMarketPrice,
      topProjectionTotal,
      config,
    });
    if (!diagnostics) continue;

    candidates.push({ index, player, diagnostics });
  }

  const rankedCandidates = candidates.sort((left, right) =>
    right.diagnostics.score - left.diagnostics.score ||
    compareAuctionPlayers(left.player, right.player),
  );
  const selected = rankedCandidates[0];
  if (!selected) return undefined;

  return {
    index: selected.index,
    player: selected.player,
    score: selected.diagnostics.score,
    diagnostics: {
      selectedPlayer: selected.player.name,
      selectedPosition: selected.player.position,
      selectedScore: selected.diagnostics.score,
      candidateCount: rankedCandidates.length,
      topCandidates: rankedCandidates
        .slice(0, nominationDiagnosticCandidateLimit)
        .map((candidate, index) => ({
          rank: index + 1,
          ...candidate.diagnostics,
        })),
    },
  };
};

const applySaleToState = (
  state: AuctionOwnerState,
  soldPlayer: Player,
  config: AuctionEngineConfig,
): AuctionOwnerState =>
  ownerStateFromRoster(state.owner, [...state.roster, soldPlayer], config);

const allRostersFull = (states: readonly AuctionOwnerState[]): boolean =>
  states.every(state => state.rosterSlotsRemaining === 0);

const budgetTrajectoryRowsFor = (
  ownerStates: readonly AuctionOwnerState[],
  pick: number,
  event: AuctionBudgetTrajectoryEvent,
  initialSpendByOwner: ReadonlyMap<Owner, number>,
  saleContext?: {
    nominator: Owner;
    sale: AuctionSale;
  },
): AuctionBudgetTrajectoryRow[] =>
  ownerStates.map(state => {
    const initialSpend = initialSpendByOwner.get(state.owner) ?? 0;

    return {
      pick,
      event,
      owner: state.owner,
      ...(saleContext ? {
        nominator: saleContext.nominator,
        winningOwner: saleContext.sale.winner,
        player: saleContext.sale.player.name,
        position: saleContext.sale.player.position,
        marketPrice: saleContext.sale.marketPrice,
        salePrice: saleContext.sale.price,
      } : {}),
      spent: state.spent,
      initialSpend,
      auctionSpend: state.spent - initialSpend,
      budgetRemaining: state.budgetRemaining,
      rosterSlotsRemaining: state.rosterSlotsRemaining,
      maxBid: state.maxBid,
      rosterSize: state.roster.length,
      budgetPerRosterSlot: budgetPerRosterSlotFor(state),
      positionCounts: countPositions(state.roster),
    };
  });

export const simulateAuction = ({
  players,
  config = defaultAuctionEngineConfig,
  initialRostersByOwner = {},
  diagnosticsMode = "full",
}: SimulateAuctionOptions): AuctionResult => {
  let ownerStates = createAuctionOwnerStates({ config, initialRostersByOwner });
  const initialSpendByOwner = new Map(ownerStates.map(state => [state.owner, state.spent]));
  const availablePlayers = [...players].sort(compareAuctionPlayers);
  const passedPlayers: Player[] = [];
  const picks: AuctionPick[] = [];
  const budgetTrajectory = diagnosticsMode === "full"
    ? budgetTrajectoryRowsFor(ownerStates, 0, "initial", initialSpendByOwner)
    : [];
  let nominationCursor = 0;

  while (availablePlayers.length > 0 && !allRostersFull(ownerStates)) {
    const nominationTurn = nextNominationTurn(ownerStates, config, nominationCursor);
    const nominator = nominationTurn.owner;
    const nomination = selectNominatedPlayer({
      availablePlayers,
      ownerStates,
      nominator,
      pickIndex: picks.length,
      config,
      diagnosticsMode,
    });
    if (!nomination) break;

    const nominatedPlayers = availablePlayers.splice(nomination.index, 1);
    const nominatedPlayer = nominatedPlayers[0];
    if (!nominatedPlayer) throw new Error("Unable to remove nominated player from auction pool.");

    const sale = resolveAuctionSale(nominatedPlayer, ownerStates, availablePlayers, config, {
      nominator,
      diagnosticsMode,
    });
    nominationCursor = nominationTurn.nextCursor;
    if (!sale) {
      passedPlayers.push(nominatedPlayer);
      continue;
    }

    const soldPlayer = { ...nominatedPlayer, price: sale.price };
    const winnerState = ownerStates.find(state => state.owner === sale.winner);
    if (!winnerState) throw new Error(`Missing auction state for ${sale.winner}.`);

    const updatedWinnerState = applySaleToState(winnerState, soldPlayer, config);
    ownerStates = ownerStates.map(state => state.owner === sale.winner ? updatedWinnerState : state);
    const pickNumber = picks.length + 1;
    picks.push({
      pick: pickNumber,
      nominator,
      owner: sale.winner,
      player: soldPlayer.name,
      position: soldPlayer.position,
      marketPrice: sale.marketPrice,
      price: sale.price,
      budgetAfterPick: updatedWinnerState.budgetRemaining,
      rosterSlotsAfterPick: updatedWinnerState.rosterSlotsRemaining,
      topBids: diagnosticsMode === "full" ? sale.bids.slice(0, 3) : [],
      diagnostics: sale.diagnostics,
      nominationDiagnostics: nomination.diagnostics,
    });
    if (diagnosticsMode === "full") {
      budgetTrajectory.push(
        ...budgetTrajectoryRowsFor(ownerStates, pickNumber, "after_pick", initialSpendByOwner, { nominator, sale }),
      );
    }
  }

  const incompleteOwners = ownerStates
    .filter(state => state.rosterSlotsRemaining > 0)
    .map(state => `${state.owner} (${state.rosterSlotsRemaining})`);
  if (incompleteOwners.length > 0) {
    throw new Error(`Auction ended before all rosters were full: ${incompleteOwners.join(", ")}.`);
  }

  const soldNames = new Set(picks.map(pick => pick.player));
  const rosters: AuctionRosters = {};
  for (const state of ownerStates) {
    rosters[state.owner] = {
      strategy: `owner-local auction: ${config.seed}`,
      players: state.roster,
    };
  }

  return {
    seed: config.seed,
    rosters,
    ownerStates,
    picks,
    budgetTrajectory,
    unsoldPlayers: [...availablePlayers, ...passedPlayers]
      .filter(player => !soldNames.has(player.name))
      .sort(compareAuctionPlayers),
  };
};

const projectionWeekOne = (projection: Pick<ProjectionRecord, "weeks">): number =>
  projection.weeks[1] ?? 0;

export const buildInitialRostersFromKeepers = (
  declarations: readonly KeeperDeclaration[],
  projections: readonly ProjectionRecord[],
  includedStatuses: readonly KeeperStatus[],
): InitialRostersByOwner => {
  const included = new Set<KeeperStatus>(includedStatuses);
  const projectionByName = new Map(
    buildProjectionRankings(projections).map(projection => [projection.normalizedName, projection]),
  );
  const rosters: Partial<Record<Owner, Player[]>> = {};

  for (const declaration of declarations) {
    if (!included.has(declaration.status)) continue;

    const normalizedName = normalizePlayerName(declaration.player);
    const projection = projectionByName.get(normalizedName);
    const playerId = projection?.id ?? `keeper:${normalizedName}`;
    const keeperPlayer: Player = {
      id: playerId,
      name: projection?.name ?? declaration.player,
      position: declaration.position,
      ...(projection?.proTeamId === undefined ? {} : { proTeamId: projection.proTeamId }),
      price: declaration.newCost,
      week1: projection ? projectionWeekOne(projection) : 0,
      weeks1To4: projection?.weeks1To4 ?? 0,
    };

    rosters[declaration.owner] = [...(rosters[declaration.owner] ?? []), keeperPlayer];
  }

  return rosters;
};

const playerFromPricedRecord = (record: AuctionPricedPlayer): Player => {
  const id = record.id === undefined ? {} : { id: record.id };
  const contextAdjustment = record.contextAdjustmentPercent === undefined
    ? {}
    : { contextAdjustmentPercent: record.contextAdjustmentPercent };
  const contextEvidenceCount = record.contextEvidenceCount ?? record.contextEvidence?.length;
  return {
    ...id,
    name: record.name,
    position: record.position,
    ...(record.proTeamId === undefined ? {} : { proTeamId: record.proTeamId }),
    price: record.scenarioPrice ?? record.price,
    week1: record.week1 ?? record.weeks?.[1] ?? 0,
    weeks1To4: record.weeks1To4,
    ...contextAdjustment,
    ...(contextEvidenceCount === undefined ? {} : { contextEvidenceCount }),
  };
};

const replacementPriceFor = (
  replacementIndex: number,
  position: Position,
  ladder: readonly ReplacementPriceTier[],
  fallbackPrice: number,
): number => {
  if (!isPremiumPosition(position)) return fallbackPrice;

  let pricedCount = 0;

  for (const tier of ladder) {
    if (tier.count <= 0) continue;
    if (replacementIndex < pricedCount + tier.count) return tier.price;
    pricedCount += tier.count;
  }

  return fallbackPrice;
};

export const buildAuctionPlayerPool = ({
  pricedPlayers,
  projections,
  excludedNames = [],
  targetCount,
  replacementPrice = defaultReplacementPrice,
  replacementPriceLadder = defaultReplacementPriceLadder,
}: BuildAuctionPlayerPoolOptions): Player[] => {
  const players = pricedPlayers.map(playerFromPricedRecord);
  const usedNames = new Set([
    ...players.map(player => normalizePlayerName(player.name)),
    ...excludedNames.map(normalizePlayerName),
  ]);
  const requestedCount = targetCount ?? players.length;

  if (players.length < requestedCount) {
    const replacements = buildProjectionRankings(projections)
      .sort((left, right) => right.weeks1To4 - left.weeks1To4 || left.name.localeCompare(right.name));
    let premiumReplacementIndex = 0;

    for (const replacement of replacements) {
      if (players.length >= requestedCount) break;
      if (usedNames.has(replacement.normalizedName)) continue;

      const price = replacementPriceFor(
        premiumReplacementIndex,
        replacement.position,
        replacementPriceLadder,
        replacementPrice,
      );
      players.push({
        id: replacement.id,
        name: replacement.name,
        position: replacement.position,
        ...(replacement.proTeamId === undefined ? {} : { proTeamId: replacement.proTeamId }),
        price,
        week1: projectionWeekOne(replacement),
        weeks1To4: replacement.weeks1To4,
      });
      usedNames.add(replacement.normalizedName);
      if (isPremiumPosition(replacement.position)) premiumReplacementIndex += 1;
    }
  }

  return players.sort(compareAuctionPlayers);
};

const ownerProfileSpendFor = (
  profile: OwnerProfile,
  position: Position,
): number => {
  if (position === "K" || position === "DST") return profile.normalSpecialTeamsSpend / 2;
  return profile.openAuctionSpend[position];
};

export const buildOwnerDemandMultipliers = (
  profiles: readonly OwnerProfile[],
): OwnerDemandMultipliers => {
  const leagueAverages = emptyPositionAmounts();
  const multipliersByOwner: OwnerDemandMultipliers = {};

  for (const position of positions) {
    const totalSpend = profiles.reduce(
      (total, profile) => total + ownerProfileSpendFor(profile, position),
      0,
    );
    leagueAverages[position] = totalSpend / Math.max(1, profiles.length);
  }

  for (const profile of profiles) {
    const multipliers: Partial<Record<Position, number>> = {};

    for (const position of positions) {
      const averageSpend = leagueAverages[position];
      if (averageSpend <= 0) {
        multipliers[position] = 1;
        continue;
      }

      const demandRatio = ownerProfileSpendFor(profile, position) / averageSpend;
      multipliers[position] = clamp(1 + (demandRatio - 1) * 0.12, 0.9, 1.12);
    }

    multipliersByOwner[profile.owner] = multipliers;
  }

  return multipliersByOwner;
};

export const buildOwnerAuctionBehaviors = (
  profiles: readonly OwnerProfile[],
): OwnerAuctionBehaviors => {
  const averageTopTwoConcentration = average(profiles.map(profile => profile.topTwoConcentration));
  const averageOneDollarCount = average(profiles.map(profile => profile.oneDollarPlayerCount));
  const behaviors: OwnerAuctionBehaviors = {};

  for (const profile of profiles) {
    const concentrationDelta = profile.topTwoConcentration - averageTopTwoConcentration;
    const oneDollarDelta = profile.oneDollarPlayerCount - averageOneDollarCount;

    behaviors[profile.owner] = {
      priceAggression: clamp(1 + concentrationDelta * 0.003, 0.94, 1.08),
      scarcityChase: clamp(1 + concentrationDelta * 0.006, 0.9, 1.15),
      replacementPatience: clamp(1 - oneDollarDelta * 0.02, 0.92, 1.05),
      anchorAggression: clamp(1 + concentrationDelta * 0.004, 0.94, 1.1),
      depthAggression: clamp(1 - concentrationDelta * 0.003 - oneDollarDelta * 0.01, 0.9, 1.08),
    };
  }

  return behaviors;
};

export const buildOwnerRosterMaximums = (
  profiles: readonly OwnerProfile[],
): OwnerRosterMaximums => {
  const maximums: OwnerRosterMaximums = {};

  for (const profile of profiles) {
    const ownerMaximums: Partial<Record<Position, number>> = {};
    for (const position of ["QB", "TE", "K", "DST"] as const) {
      const historicalMaximum = profile.rosterCounts[position] <= onePlayerRosterCountThreshold
        ? 1
        : Math.ceil(profile.rosterCounts[position]);
      const cappedMaximum = Math.min(leagueConfig.rosterMaximums[position], historicalMaximum);
      if (cappedMaximum < leagueConfig.rosterMaximums[position]) ownerMaximums[position] = cappedMaximum;
    }
    if (Object.keys(ownerMaximums).length > 0) maximums[profile.owner] = ownerMaximums;
  }

  return maximums;
};
