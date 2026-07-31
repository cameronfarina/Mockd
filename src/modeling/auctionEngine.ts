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
export type PositionOverbidDamping = Partial<Record<Position, number>>;

export interface ScarcityConfig {
  comparablePriceRatio: number;
  minimumComparablePrice: number;
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

export interface BudgetPacingConfig {
  targetBudgetPerSlotAfterPurchase: number;
  slope: number;
  maxDiscount: number;
  minimumPlayerPrice: number;
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

export interface TopEndSaleGuardConfig {
  threshold: number;
  capBelowThresholdAt: number;
  premiumThreshold: number;
  capBelowPremiumThresholdAt: number;
}

export interface TierSaleGuardConfig {
  threshold: number;
  capBelowThresholdAt: number;
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
  positionOverbidDamping: PositionOverbidDamping;
  scarcity: ScarcityConfig;
  rosterNeed: RosterNeedConfig;
  nomination: NominationConfig;
  endgameSpend: EndgameSpendConfig;
  budgetPacing: BudgetPacingConfig;
  lateOpeningBid: LateOpeningBidConfig;
  topEndOverbidDamping: TopEndOverbidDampingConfig;
  topEndSaleGuard: TopEndSaleGuardConfig;
  tierSaleGuard: TierSaleGuardConfig;
  seed: string;
}

export type AuctionEngineConfigOverrides =
  Partial<Omit<AuctionEngineConfig, "ownerDemandMultipliers" | "ownerBehaviors" | "ownerRosterMaximums" | "positionOverbidDamping" | "scarcity" | "rosterNeed" | "nomination" | "endgameSpend" | "budgetPacing" | "lateOpeningBid" | "topEndOverbidDamping" | "topEndSaleGuard" | "tierSaleGuard">> & {
    ownerDemandMultipliers?: OwnerDemandMultipliers;
    ownerBehaviors?: OwnerAuctionBehaviors;
    ownerRosterMaximums?: OwnerRosterMaximums;
    positionOverbidDamping?: PositionOverbidDamping;
    scarcity?: Partial<ScarcityConfig>;
    rosterNeed?: Partial<RosterNeedConfig>;
    nomination?: Partial<NominationConfig>;
    endgameSpend?: Partial<EndgameSpendConfig>;
    budgetPacing?: Partial<BudgetPacingConfig>;
    lateOpeningBid?: Partial<LateOpeningBidConfig>;
    topEndOverbidDamping?: Partial<TopEndOverbidDampingConfig>;
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
  marketPrice: number;
  ownerDemandMultiplier: number;
  rosterNeedMultiplier: number;
  scarcityMultiplier: number;
  behaviorAggressionMultiplier: number;
  behaviorScarcityMultiplier: number;
  buildStyleMultiplier: number;
  replacementPatienceMultiplier: number;
  endgamePressureMultiplier: number;
  budgetPacingMultiplier: number;
  topEndDampingMultiplier: number;
  positionOverbidDampingMultiplier: number;
  tieBreak: number;
}

export interface AuctionSale {
  player: Player;
  winner: Owner;
  price: number;
  marketPrice: number;
  bids: AuctionBid[];
}

export interface ResolveAuctionSaleOptions {
  nominator?: Owner;
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
}

export type AuctionRosters = Partial<Record<Owner, MockRoster>>;

export interface AuctionResult {
  seed: string;
  rosters: AuctionRosters;
  ownerStates: AuctionOwnerState[];
  picks: AuctionPick[];
  unsoldPlayers: Player[];
}

export interface SimulateAuctionOptions {
  players: readonly Player[];
  config?: AuctionEngineConfig;
  initialRostersByOwner?: InitialRostersByOwner;
}

export interface AuctionPricedPlayer {
  id?: string | number;
  name: string;
  position: Position;
  price: number;
  scenarioPrice?: number;
  week1?: number;
  weeks?: Record<number, number>;
  weeks1To4: number;
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
const defaultReplacementPriceLadder: readonly ReplacementPriceTier[] = [
  { count: 8, price: 8 },
  { count: 14, price: 6 },
  { count: 20, price: 4 },
  { count: 28, price: 3 },
  { count: 32, price: 2 },
];

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
  positionOverbidDamping: {
    QB: 0.75,
    WR: 0.08,
    TE: 0.65,
  },
  scarcity: {
    comparablePriceRatio: 0.8,
    minimumComparablePrice: 5,
    slope: 0.03,
    maxMultiplier: 1.08,
  },
  rosterNeed: {
    missingStarterMultiplier: 1.03,
    missingFlexMultiplier: 1.015,
    emptyPremiumPositionMultiplier: 1,
    benchQuarterbackMultiplier: 0.55,
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
  budgetPacing: {
    targetBudgetPerSlotAfterPurchase: 4,
    slope: 0.85,
    maxDiscount: 0.28,
    minimumPlayerPrice: 8,
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
  topEndSaleGuard: {
    threshold: 70,
    capBelowThresholdAt: 69,
    premiumThreshold: 72,
    capBelowPremiumThresholdAt: 74,
  },
  tierSaleGuard: {
    threshold: 40,
    capBelowThresholdAt: 39,
  },
  seed: defaultSeed,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

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
  budgetPacing: {
    ...defaultAuctionEngineConfig.budgetPacing,
    ...overrides.budgetPacing,
  },
  lateOpeningBid: {
    ...defaultAuctionEngineConfig.lateOpeningBid,
    ...overrides.lateOpeningBid,
  },
  topEndOverbidDamping: {
    ...defaultAuctionEngineConfig.topEndOverbidDamping,
    ...overrides.topEndOverbidDamping,
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

const canOwnerCompleteRosterAfterAdding = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): boolean => {
  if (state.rosterSlotsRemaining <= 0) return false;

  const counts = countPositions(state.roster);
  if (counts[player.position] >= rosterMaximumFor(state.owner, player.position, config)) return false;

  counts[player.position] += 1;
  const slotsAfterPick = state.rosterSlotsRemaining - 1;
  return futurePicksNeededForLegalRoster(counts, config) <= slotsAfterPick;
};

const remainingPlayersAtPosition = (
  remainingPlayers: readonly Player[],
  position: Position,
): number =>
  remainingPlayers.filter(player => player.position === position).length;

const canLeagueStillMeetPositionMinimums = (
  candidateState: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): boolean => {
  const positionMinimum = config.starterMinimums[player.position];
  if (positionMinimum <= 0) return true;

  const directShortageAfterPick = ownerStates.reduce((shortage, state) => {
    const counts = countPositions(state.roster);
    if (state.owner === candidateState.owner) counts[player.position] += 1;
    return shortage + Math.max(0, positionMinimum - counts[player.position]);
  }, 0);

  return remainingPlayersAtPosition(remainingPlayers, player.position) >= directShortageAfterPick;
};

const ownerCanBidOnPlayer = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): boolean =>
  state.maxBid >= config.minimumBid &&
  canOwnerCompleteRosterAfterAdding(state, player, config) &&
  canLeagueStillMeetPositionMinimums(state, player, ownerStates, remainingPlayers, config);

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

const ownerDemandMultiplierFor = (
  owner: Owner,
  position: Position,
  config: AuctionEngineConfig,
): number =>
  config.ownerDemandMultipliers[owner]?.[position] ?? 1;

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
    .length;
  const pressure = activeBidders / Math.max(1, comparablePlayersRemaining);

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

const anchorRosterCount = (roster: readonly Player[]): number =>
  roster.filter(player => player.price >= anchorBuildPriceThreshold).length;

const buildStyleMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  behavior: CompleteOwnerAuctionBehavior,
): number => {
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
  const buildStyleMultiplier = buildStyleMultiplierFor(state, player, ownerBehavior);
  const replacementPatienceMultiplier = player.price <= replacementPatiencePriceThreshold
    ? ownerBehavior.replacementPatience
    : 1;
  const endgamePressureMultiplier = endgamePressureMultiplierFor(state, config);
  const budgetPacingMultiplier = budgetPacingMultiplierFor(state, player, config);
  const rawBidMultiplier =
    ownerDemandMultiplier *
    rosterNeedMultiplier *
    behaviorScarcityMultiplier *
    ownerBehavior.priceAggression *
    buildStyleMultiplier *
    replacementPatienceMultiplier *
    endgamePressureMultiplier *
    budgetPacingMultiplier;
  const topEndDampingMultiplier = topEndDampingMultiplierFor(player, rawBidMultiplier, config);
  const topEndAdjustedBidMultiplier = rawBidMultiplier * topEndDampingMultiplier;
  const positionOverbidDampingMultiplier = positionOverbidDampingMultiplierFor(
    player.position,
    topEndAdjustedBidMultiplier,
    config,
  );
  const pricedBidAmount = Math.max(
    config.minimumBid,
    Math.round(
      player.price * topEndAdjustedBidMultiplier * positionOverbidDampingMultiplier,
    ),
  );
  const uncappedAmount = Math.max(pricedBidAmount, openingBid);

  return {
    owner: state.owner,
    amount: Math.min(state.maxBid, uncappedAmount),
    uncappedAmount,
    maxBid: state.maxBid,
    marketPrice: player.price,
    ownerDemandMultiplier,
    rosterNeedMultiplier,
    scarcityMultiplier,
    behaviorAggressionMultiplier: ownerBehavior.priceAggression,
    behaviorScarcityMultiplier,
    buildStyleMultiplier,
    replacementPatienceMultiplier,
    endgamePressureMultiplier,
    budgetPacingMultiplier,
    topEndDampingMultiplier,
    positionOverbidDampingMultiplier,
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
    uncappedSalePrice > guard.capBelowPremiumThresholdAt
  ) {
    return Math.max(player.price, guard.capBelowPremiumThresholdAt);
  }

  return uncappedSalePrice;
};

const tierSaleGuardPriceFor = (
  player: Player,
  salePrice: number,
  config: AuctionEngineConfig,
): number => {
  const guard = config.tierSaleGuard;
  if (player.price >= guard.threshold) return salePrice;
  if (salePrice < guard.threshold) return salePrice;

  return Math.max(player.price, guard.capBelowThresholdAt);
};

export const resolveAuctionSale = (
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig = defaultAuctionEngineConfig,
  options: ResolveAuctionSaleOptions = {},
): AuctionSale | undefined => {
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
  const uncappedSalePrice = Math.min(
    winningBid.amount,
    Math.max(config.minimumBid, secondBidAmount + config.minimumBid, reservePrice, nominatorOpeningBid),
  );
  const topEndGuardedPrice = topEndSaleGuardPriceFor(player, uncappedSalePrice, config);
  const price = tierSaleGuardPriceFor(player, topEndGuardedPrice, config);

  return {
    player,
    winner: winningBid.owner,
    price,
    marketPrice: player.price,
    bids,
  };
};

const compareAuctionPlayers = (left: Player, right: Player): number =>
  right.price - left.price ||
  right.weeks1To4 - left.weeks1To4 ||
  left.name.localeCompare(right.name);

interface NominationSelection {
  index: number;
  player: Player;
  score: number;
}

interface NominationTurn {
  owner: Owner;
  nextCursor: number;
}

const highestMarketPrice = (players: readonly Player[]): number =>
  players.reduce((highest, player) => Math.max(highest, player.price), 0);

const highestProjectionTotal = (players: readonly Player[]): number =>
  players.reduce((highest, player) => Math.max(highest, player.weeks1To4), 0);

const playersAfterNomination = (
  players: readonly Player[],
  nominatedIndex: number,
): Player[] =>
  players.filter((_player, index) => index !== nominatedIndex);

const nextNominationTurn = (
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

const nominationNeedScoreFor = (
  state: AuctionOwnerState,
  position: Position,
  config: AuctionEngineConfig,
): number => {
  const counts = countPositions(state.roster);
  if (counts[position] >= rosterMaximumFor(state.owner, position, config)) return 0;

  if (counts[position] < config.starterMinimums[position]) return 1;
  if (isFlexEligible(position) && flexEligibleCount(counts) < minimumFlexEligibleCount(config)) {
    return 0.65;
  }
  if (isPremiumPosition(position) && counts[position] === 0) return 0.2;

  return 0;
};

const nominationAffordabilityScoreFor = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  if (!ownerCanBidOnPlayer(state, player, ownerStates, remainingPlayers, config)) return 0;
  if (player.price <= config.minimumBid) return 1;

  return clamp(state.maxBid / player.price, 0, 1);
};

const nominationScarcityScoreFor = (
  position: Position,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  const playersAtPosition = remainingPlayersAtPosition(remainingPlayers, position) + 1;
  const ownersNeedingPosition = ownerStates
    .filter(state => nominationNeedScoreFor(state, position, config) > 0)
    .length;

  return clamp(ownersNeedingPosition / Math.max(1, playersAtPosition), 0, 1);
};

const nominationFlushMoneyScoreFor = (
  nominator: Owner,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
  marketPriceScore: number,
  nominatorInterestScore: number,
): number => {
  const reservePrice = Math.max(config.minimumBid, Math.round(player.price * config.reservePriceRatio));
  const otherOwnerCount = Math.max(1, ownerStates.length - 1);
  const interestedOtherOwners = ownerStates
    .filter(state => state.owner !== nominator)
    .filter(state => ownerCanBidOnPlayer(state, player, ownerStates, remainingPlayers, config))
    .filter(state => state.maxBid >= reservePrice)
    .length;
  const bidderPressure = interestedOtherOwners / otherOwnerCount;
  const lowPersonalInterest = 1 - clamp(nominatorInterestScore, 0, 1) * 0.5;

  return bidderPressure * marketPriceScore * lowPersonalInterest;
};

const nominationScoreFor = ({
  player,
  index,
  availablePlayers,
  ownerStates,
  nominator,
  pickIndex,
  topMarketPrice,
  topProjectionTotal,
  config,
}: {
  player: Player;
  index: number;
  availablePlayers: readonly Player[];
  ownerStates: readonly AuctionOwnerState[];
  nominator: Owner;
  pickIndex: number;
  topMarketPrice: number;
  topProjectionTotal: number;
  config: AuctionEngineConfig;
}): number | undefined => {
  const remainingPlayers = playersAfterNomination(availablePlayers, index);
  const playerCanSell = ownerStates.some(state =>
    ownerCanBidOnPlayer(state, player, ownerStates, remainingPlayers, config),
  );
  if (!playerCanSell) return undefined;

  const nominatorState = ownerStates.find(state => state.owner === nominator);
  if (!nominatorState) throw new Error(`Missing auction state for ${nominator}.`);

  const marketPriceScore = player.price / Math.max(1, topMarketPrice);
  const projectionScore = player.weeks1To4 / Math.max(1, topProjectionTotal);
  const ownerNeedScore = nominationNeedScoreFor(nominatorState, player.position, config);
  const affordabilityScore = nominationAffordabilityScoreFor(
    nominatorState,
    player,
    ownerStates,
    remainingPlayers,
    config,
  );
  const scarcityScore = nominationScarcityScoreFor(player.position, ownerStates, remainingPlayers, config);
  const nominatorInterestScore = (ownerNeedScore + affordabilityScore) / 2;
  const flushMoneyScore = nominationFlushMoneyScoreFor(
    nominator,
    player,
    ownerStates,
    remainingPlayers,
    config,
    marketPriceScore,
    nominatorInterestScore,
  );
  const marketPriceWeight = pickIndex < config.nomination.earlyEliteBiasPicks
    ? config.nomination.earlyMarketPriceWeight
    : config.nomination.marketPriceWeight;
  const tieBreakScore = 1 - deterministicTieBreak(config.seed, nominator, player.name);

  return (
    marketPriceScore * marketPriceWeight +
    projectionScore * config.nomination.projectionWeight +
    ownerNeedScore * config.nomination.ownerNeedWeight +
    affordabilityScore * config.nomination.affordabilityWeight +
    scarcityScore * config.nomination.scarcityWeight +
    flushMoneyScore * config.nomination.flushMoneyWeight +
    tieBreakScore * config.nomination.tieBreakWeight
  );
};

const selectNominatedPlayer = ({
  availablePlayers,
  ownerStates,
  nominator,
  pickIndex,
  config,
}: {
  availablePlayers: readonly Player[];
  ownerStates: readonly AuctionOwnerState[];
  nominator: Owner;
  pickIndex: number;
  config: AuctionEngineConfig;
}): NominationSelection | undefined => {
  const topMarketPrice = highestMarketPrice(availablePlayers);
  const topProjectionTotal = highestProjectionTotal(availablePlayers);
  let selected: NominationSelection | undefined;

  for (const [index, player] of availablePlayers.entries()) {
    const score = nominationScoreFor({
      player,
      index,
      availablePlayers,
      ownerStates,
      nominator,
      pickIndex,
      topMarketPrice,
      topProjectionTotal,
      config,
    });
    if (score === undefined) continue;

    if (
      !selected ||
      score > selected.score ||
      (score === selected.score && compareAuctionPlayers(player, selected.player) < 0)
    ) {
      selected = { index, player, score };
    }
  }

  return selected;
};

const applySaleToState = (
  state: AuctionOwnerState,
  soldPlayer: Player,
  config: AuctionEngineConfig,
): AuctionOwnerState =>
  ownerStateFromRoster(state.owner, [...state.roster, soldPlayer], config);

const allRostersFull = (states: readonly AuctionOwnerState[]): boolean =>
  states.every(state => state.rosterSlotsRemaining === 0);

export const simulateAuction = ({
  players,
  config = defaultAuctionEngineConfig,
  initialRostersByOwner = {},
}: SimulateAuctionOptions): AuctionResult => {
  let ownerStates = createAuctionOwnerStates({ config, initialRostersByOwner });
  const availablePlayers = [...players].sort(compareAuctionPlayers);
  const passedPlayers: Player[] = [];
  const picks: AuctionPick[] = [];
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
    });
    if (!nomination) break;

    const nominatedPlayers = availablePlayers.splice(nomination.index, 1);
    const nominatedPlayer = nominatedPlayers[0];
    if (!nominatedPlayer) throw new Error("Unable to remove nominated player from auction pool.");

    const sale = resolveAuctionSale(nominatedPlayer, ownerStates, availablePlayers, config, { nominator });
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
    picks.push({
      pick: picks.length + 1,
      nominator,
      owner: sale.winner,
      player: soldPlayer.name,
      position: soldPlayer.position,
      marketPrice: sale.marketPrice,
      price: sale.price,
      budgetAfterPick: updatedWinnerState.budgetRemaining,
      rosterSlotsAfterPick: updatedWinnerState.rosterSlotsRemaining,
      topBids: sale.bids.slice(0, 3),
    });
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
  return {
    ...id,
    name: record.name,
    position: record.position,
    price: record.scenarioPrice ?? record.price,
    week1: record.week1 ?? record.weeks?.[1] ?? 0,
    weeks1To4: record.weeks1To4,
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
    if (profile.rosterCounts.QB <= onePlayerRosterCountThreshold) ownerMaximums.QB = 1;
    if (profile.rosterCounts.TE <= onePlayerRosterCountThreshold) ownerMaximums.TE = 1;
    if (Object.keys(ownerMaximums).length > 0) maximums[profile.owner] = ownerMaximums;
  }

  return maximums;
};
