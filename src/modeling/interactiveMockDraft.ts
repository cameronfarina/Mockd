import { keepers as defaultKeepers, type KeeperDeclaration } from "../../config/keepers.js";
import { leagueConfig, ownerOrder, type Owner, type Position } from "../../config/league.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../projections.js";
import type { Player } from "../types.js";
import {
  buildAuctionConfig,
  buildAuctionPlayerPool,
  buildInitialRostersFromKeepers,
  buildOwnerAuctionBehaviors,
  buildOwnerDemandMultipliers,
  buildOwnerRosterMaximums,
  resolveAuctionSale,
  selectNominatedPlayer,
  type AuctionBid,
  type AuctionDiagnosticsMode,
  type AuctionEngineConfig,
  type AuctionEngineConfigOverrides,
  type AuctionOwnerState,
  type OwnerAuctionBehaviors,
  type OwnerDemandMultipliers,
  type OwnerPositionAnchorTargets,
  type OwnerPositionCoreMaxBids,
  type OwnerPositionCoreTargets,
  type OwnerPositionSlotMaxBids,
  type OwnerRosterMaximums,
} from "./auctionEngine.js";
import { buildBasePrices, defaultPricingConfig, type PricingConfig } from "./basePricing.js";
import { draftPlanAuctionOverridesFor } from "./draftPlan.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenario,
  type KeeperScenarioKey,
} from "./keeperInflation.js";
import {
  buildLiveDraftState,
  type LiveDraftOwnerState,
  type LiveDraftShortlistTarget,
  type LiveDraftState,
  type LiveDraftTarget,
} from "./liveDraft.js";
import {
  defaultLiveDraftStrategyKey,
  type LiveDraftStrategyDefinition,
  type LiveDraftStrategyKey,
} from "./liveDraftStrategies.js";
import { buildOwnerProfiles } from "./ownerProfiles.js";
import { buildProjectionRankings } from "./projectionRankings.js";

type PositionAmounts = Record<Position, number>;

export type InteractiveMockDraftPhase =
  | "ai-sale"
  | "human-decision"
  | "human-nomination"
  | "complete"
  | "blocked";

export type InteractiveMockDraftAction = "advance" | "pass" | "cam-bid" | "cam-win";

export interface InteractiveMockDraftNomination {
  player: string;
  position: Position;
  teamAbbreviation?: string;
  marketPrice: number;
  projectedWeeks1To4: number;
  topCandidates: {
    rank: number;
    player: string;
    position: Position;
    marketPrice: number;
    score: number;
  }[];
}

export interface InteractiveMockDraftBid {
  owner: Owner;
  player: string;
  amount: number;
  maxBid: number;
  marketPrice: number;
}

export interface InteractiveMockDraftCamDecision {
  maxBid: number;
  recommendedBid: number;
  topAiBid: number;
  topAiBidOwner: Owner;
  aiSalePrice: number;
  valueGap: number;
}

export interface InteractiveMockDraftState {
  phase: InteractiveMockDraftPhase;
  watchOwner: Owner;
  strategy: LiveDraftStrategyDefinition;
  scenario: KeeperScenario;
  seed: string;
  pickNumber: number;
  commandCount: number;
  nominationCursor: number;
  nominator?: Owner;
  nomination?: InteractiveMockDraftNomination;
  aiBids: InteractiveMockDraftBid[];
  aiSaleCommand?: string;
  camDecision?: InteractiveMockDraftCamDecision;
  topTargets: LiveDraftTarget[];
  shortlist: LiveDraftShortlistTarget[];
  message?: string;
}

export interface BuildInteractiveMockDraftStateOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers?: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  strategyKey?: LiveDraftStrategyKey;
  watchOwner?: Owner;
  commands?: readonly string[];
  pricingConfig?: PricingConfig;
  seed?: string;
  diagnosticsMode?: AuctionDiagnosticsMode;
}

interface PreparedInteractiveMockDraft {
  scenario: KeeperScenario;
  liveState: LiveDraftState;
  auctionPlayers: Player[];
  ownerStates: AuctionOwnerState[];
  config: AuctionEngineConfig;
}

const defaultScenarioKey: KeeperScenarioKey = "expected";
const defaultWatchOwner: Owner = "Cam";
const defaultSeed = "live-ui";
const replacementDepthBuffer = 160;
const topTargetLimit = 500;
const topBidLimit = 5;

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const normalizePlayerSet = (players: readonly { name: string }[]): Set<string> =>
  new Set(players.map(player => normalizePlayerName(player.name)));

const mergeOwnerPositionMaps = <T extends OwnerDemandMultipliers | OwnerRosterMaximums | OwnerPositionAnchorTargets>(
  base: T,
  overrides?: T,
): T => {
  if (!overrides) return base;

  const merged = { ...base } as T;
  const owners = new Set<Owner>([
    ...(Object.keys(base) as Owner[]),
    ...(Object.keys(overrides) as Owner[]),
  ]);

  for (const owner of owners) {
    merged[owner] = {
      ...(base[owner] ?? {}),
      ...(overrides[owner] ?? {}),
    };
  }

  return merged;
};

const mergeOwnerPriceLadders = <
  T extends OwnerPositionCoreTargets | OwnerPositionCoreMaxBids | OwnerPositionSlotMaxBids,
>(
  base: T,
  overrides?: T,
): T => {
  if (!overrides) return base;

  const merged = { ...base } as T;
  const owners = new Set<Owner>([
    ...(Object.keys(base) as Owner[]),
    ...(Object.keys(overrides) as Owner[]),
  ]);

  for (const owner of owners) {
    merged[owner] = {
      ...(base[owner] ?? {}),
      ...(overrides[owner] ?? {}),
    };
  }

  return merged;
};

const mergeOwnerAuctionBehaviors = (
  base: OwnerAuctionBehaviors,
  overrides?: OwnerAuctionBehaviors,
): OwnerAuctionBehaviors => {
  if (!overrides) return base;

  const merged = { ...base };
  const owners = new Set<Owner>([
    ...(Object.keys(base) as Owner[]),
    ...(Object.keys(overrides) as Owner[]),
  ]);

  for (const owner of owners) {
    const mergedBehavior = {
      ...(base[owner] ?? {}),
      ...(overrides[owner] ?? {}),
    };
    const { priceAggression, scarcityChase, replacementPatience } = mergedBehavior;

    if (
      priceAggression === undefined ||
      scarcityChase === undefined ||
      replacementPatience === undefined
    ) {
      throw new Error(`Incomplete auction behavior override for ${owner}.`);
    }

    merged[owner] = {
      priceAggression,
      scarcityChase,
      replacementPatience,
      ...(mergedBehavior.anchorAggression === undefined
        ? {}
        : { anchorAggression: mergedBehavior.anchorAggression }),
      ...(mergedBehavior.depthAggression === undefined
        ? {}
        : { depthAggression: mergedBehavior.depthAggression }),
    };
  }

  return merged;
};

export const strategyAuctionOverridesFor = (
  owner: Owner,
  strategyKey: LiveDraftStrategyKey,
): AuctionEngineConfigOverrides => {
  if (strategyKey === "three-rb") {
    return draftPlanAuctionOverridesFor({ owner, strategyKey });
  }
  if (strategyKey === "hero-rb") {
    return {
      ownerDemandMultipliers: {
        [owner]: { QB: 0.65, RB: 1.08, WR: 1.14, TE: 0.82 },
      },
      ownerBehaviors: {
        [owner]: {
          priceAggression: 1.03,
          scarcityChase: 1.08,
          replacementPatience: 0.99,
          anchorAggression: 1.12,
          depthAggression: 0.96,
        },
      },
      ownerPositionAnchorTargets: {
        [owner]: { RB: 1 },
      },
      ownerPositionSlotMaxBids: {
        [owner]: {
          RB: [62, 22, 12, 5, 2],
          WR: [45, 34, 24, 14, 8, 4, 1],
          TE: [8, 2],
          K: [1],
          DST: [1],
        },
      },
    };
  }
  if (strategyKey === "wr-heavy") {
    return {
      ownerDemandMultipliers: {
        [owner]: { QB: 0.62, RB: 0.9, WR: 1.24, TE: 0.82 },
      },
      ownerBehaviors: {
        [owner]: {
          priceAggression: 1.05,
          scarcityChase: 1.12,
          replacementPatience: 0.98,
          anchorAggression: 1.18,
          depthAggression: 1.02,
        },
      },
      ownerPositionAnchorTargets: {
        [owner]: { WR: 3 },
      },
      ownerPositionSlotMaxBids: {
        [owner]: {
          RB: [42, 24, 12, 5, 2],
          WR: [58, 48, 36, 20, 12, 6, 2],
          TE: [7, 2],
          K: [1],
          DST: [1],
        },
      },
    };
  }

  return {};
};

const buildInteractiveAuctionConfig = ({
  historicalRecords,
  seed,
  watchOwner,
  strategyKey,
}: {
  historicalRecords: readonly HistoricalAuctionRecord[];
  seed: string;
  watchOwner: Owner;
  strategyKey: LiveDraftStrategyKey;
}): AuctionEngineConfig => {
  const ownerProfiles = buildOwnerProfiles(historicalRecords);
  const ownerDemandMultipliers = buildOwnerDemandMultipliers(ownerProfiles);
  const ownerBehaviors = buildOwnerAuctionBehaviors(ownerProfiles);
  const ownerRosterMaximums = buildOwnerRosterMaximums(ownerProfiles);
  const strategyOverrides = strategyAuctionOverridesFor(watchOwner, strategyKey);

  return buildAuctionConfig({
    seed,
    ownerDemandMultipliers: mergeOwnerPositionMaps(
      ownerDemandMultipliers,
      strategyOverrides.ownerDemandMultipliers,
    ),
    ownerBehaviors: mergeOwnerAuctionBehaviors(
      ownerBehaviors,
      strategyOverrides.ownerBehaviors,
    ),
    ownerRosterMaximums: mergeOwnerPositionMaps(
      ownerRosterMaximums,
      strategyOverrides.ownerRosterMaximums,
    ),
    ownerPositionAnchorTargets: mergeOwnerPositionMaps(
      {},
      strategyOverrides.ownerPositionAnchorTargets,
    ),
    ownerPositionCoreTargets: mergeOwnerPriceLadders(
      {},
      strategyOverrides.ownerPositionCoreTargets,
    ),
    ownerPositionCoreMaxBids: mergeOwnerPriceLadders(
      {},
      strategyOverrides.ownerPositionCoreMaxBids,
    ),
    ownerPositionSlotMaxBids: mergeOwnerPriceLadders(
      {},
      strategyOverrides.ownerPositionSlotMaxBids,
    ),
  });
};

const playerMetadataByName = (
  auctionPlayers: readonly Player[],
  projections: readonly ProjectionRecord[],
): Map<string, Player> => {
  const metadata = new Map(auctionPlayers.map(player => [normalizePlayerName(player.name), player]));

  for (const projection of buildProjectionRankings(projections)) {
    const key = projection.normalizedName;
    if (metadata.has(key)) continue;
    metadata.set(key, {
      id: projection.id,
      name: projection.name,
      position: projection.position,
      ...(projection.proTeamId === undefined ? {} : { proTeamId: projection.proTeamId }),
      price: 1,
      week1: projection.weeks[1] ?? 0,
      weeks1To4: projection.weeks1To4,
    });
  }

  return metadata;
};

const playerForAuctionState = (
  player: LiveDraftOwnerState["roster"][number],
  metadataByName: ReadonlyMap<string, Player>,
): Player => {
  const metadata = metadataByName.get(normalizePlayerName(player.name));

  return {
    ...(metadata?.id === undefined ? {} : { id: metadata.id }),
    name: player.name,
    position: player.position,
    ...(metadata?.proTeamId === undefined ? {} : { proTeamId: metadata.proTeamId }),
    price: player.price,
    week1: metadata?.week1 ?? 0,
    weeks1To4: metadata?.weeks1To4 ?? 0,
    ...(metadata?.contextAdjustmentPercent === undefined
      ? {}
      : { contextAdjustmentPercent: metadata.contextAdjustmentPercent }),
    ...(metadata?.contextEvidenceCount === undefined
      ? {}
      : { contextEvidenceCount: metadata.contextEvidenceCount }),
  };
};

const ownerStatesFromLiveState = (
  liveState: LiveDraftState,
  metadataByName: ReadonlyMap<string, Player>,
  config: AuctionEngineConfig,
): AuctionOwnerState[] =>
  liveState.owners.map(ownerState => {
    const roster = ownerState.roster.map(player => playerForAuctionState(player, metadataByName));
    const spent = roster.reduce((total, player) => total + player.price, 0);
    const rosterSlotsRemaining = config.rosterSize - roster.length;
    const budgetRemaining = config.auctionBudget - spent;

    return {
      owner: ownerState.owner,
      roster,
      spent,
      budgetRemaining,
      rosterSlotsRemaining,
      maxBid: rosterSlotsRemaining <= 0
        ? 0
        : Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * config.minimumBid),
    };
  });

const prepareInteractiveMockDraft = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKey,
  strategyKey,
  watchOwner,
  commands,
  pricingConfig,
  seed,
}: Required<Pick<
  BuildInteractiveMockDraftStateOptions,
  "projections" | "historicalRecords" | "keepers" | "scenarioKey" | "strategyKey" | "watchOwner" | "commands" | "pricingConfig" | "seed"
>>): PreparedInteractiveMockDraft => {
  const liveState = buildLiveDraftState({
    projections,
    historicalRecords,
    keepers,
    scenarioKey,
    strategyKey,
    watchOwner,
    commands,
    pricingConfig,
    targetLimit: topTargetLimit,
  });
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const scenario = buildKeeperScenarios(keepers).find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);

  const adjustedPrices = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const initialRostersByOwner = buildInitialRostersFromKeepers(
    keepers,
    projections,
    scenario.includedKeeperStatuses,
  );
  const lockedKeeperCount = Object.values(initialRostersByOwner)
    .reduce((count, roster) => count + (roster?.length ?? 0), 0);
  const auctionPlayers = buildAuctionPlayerPool({
    pricedPlayers: adjustedPrices.availablePrices,
    projections,
    excludedNames: adjustedPrices.unavailableKeepers.map(keeper => keeper.player),
    targetCount: leagueConfig.teams * leagueConfig.rosterSize - lockedKeeperCount + replacementDepthBuffer,
  });
  const config = buildInteractiveAuctionConfig({
    historicalRecords,
    seed,
    watchOwner,
    strategyKey,
  });
  const metadataByName = playerMetadataByName(auctionPlayers, projections);
  const ownerStates = ownerStatesFromLiveState(liveState, metadataByName, config);
  const unavailableNames = normalizePlayerSet(ownerStates.flatMap(state => state.roster));

  return {
    scenario,
    liveState,
    auctionPlayers: auctionPlayers.filter(player => !unavailableNames.has(normalizePlayerName(player.name))),
    ownerStates,
    config,
  };
};

const allRostersFull = (ownerStates: readonly AuctionOwnerState[]): boolean =>
  ownerStates.every(state => state.rosterSlotsRemaining <= 0);

const snakeOwnerForPick = (pickIndex: number, ownerStates: readonly AuctionOwnerState[]): {
  owner: Owner;
  cursor: number;
} | undefined => {
  for (let offset = 0; offset < ownerOrder.length * 2; offset += 1) {
    const adjustedPickIndex = pickIndex + offset;
    const round = Math.floor(adjustedPickIndex / ownerOrder.length);
    const slot = adjustedPickIndex % ownerOrder.length;
    const owner = round % 2 === 0
      ? ownerOrder[slot]
      : ownerOrder[ownerOrder.length - 1 - slot];
    if (!owner) continue;

    const ownerState = ownerStates.find(state => state.owner === owner);
    if (ownerState && ownerState.rosterSlotsRemaining > 0) {
      return { owner, cursor: adjustedPickIndex + 1 };
    }
  }

  return undefined;
};

const topTargetsFor = (liveState: LiveDraftState): LiveDraftTarget[] =>
  (liveState.shortlist.length > 0
    ? liveState.shortlist.map(target => {
      const liveTarget = liveState.availableTargets.find(candidate => candidate.name === target.name);
      if (!liveTarget) throw new Error(`Missing shortlist target "${target.name}" from live board.`);
      return liveTarget;
    })
    : liveState.availableTargets).slice(0, 10);

const mockBidFor = (bid: AuctionBid, player: Player): InteractiveMockDraftBid => ({
  owner: bid.owner,
  player: player.name,
  amount: bid.amount,
  maxBid: bid.maxBid,
  marketPrice: bid.marketPrice,
});

const nominationFor = (
  selection: NonNullable<ReturnType<typeof selectNominatedPlayer>>,
): InteractiveMockDraftNomination => ({
  player: selection.player.name,
  position: selection.player.position,
  marketPrice: selection.player.price,
  projectedWeeks1To4: roundToTwo(selection.player.weeks1To4),
  topCandidates: selection.diagnostics.topCandidates.map(candidate => ({
    rank: candidate.rank,
    player: candidate.player,
    position: candidate.position,
    marketPrice: candidate.marketPrice,
    score: roundToTwo(candidate.score),
  })),
});

const totalCounts = (roster: readonly Player[]): PositionAmounts => {
  const counts = emptyPositionAmounts();
  for (const player of roster) counts[player.position] += 1;
  return counts;
};

const watchOwnerCanRoster = (
  watchOwnerState: AuctionOwnerState,
  player: Player,
): boolean => {
  if (watchOwnerState.rosterSlotsRemaining <= 0) return false;

  const counts = totalCounts(watchOwnerState.roster);
  return counts[player.position] < leagueConfig.rosterMaximums[player.position];
};

const aiSaleCommandFor = (owner: Owner, player: string, price: number): string =>
  `${owner} drafted ${player} for ${price}`;

const baseStateFor = ({
  phase,
  prepared,
  watchOwner,
  seed,
  pickNumber,
  nominationCursor,
  message,
}: {
  phase: InteractiveMockDraftPhase;
  prepared: PreparedInteractiveMockDraft;
  watchOwner: Owner;
  seed: string;
  pickNumber: number;
  nominationCursor: number;
  message?: string;
}): InteractiveMockDraftState => ({
  phase,
  watchOwner,
  strategy: prepared.liveState.strategy,
  scenario: prepared.scenario,
  seed,
  pickNumber,
  commandCount: prepared.liveState.events.length,
  nominationCursor,
  aiBids: [],
  topTargets: topTargetsFor(prepared.liveState),
  shortlist: prepared.liveState.shortlist,
  ...(message === undefined ? {} : { message }),
});

const camDecisionFor = ({
  liveState,
  watchOwnerState,
  player,
  topAiBid,
  topAiBidOwner,
  aiSalePrice,
}: {
  liveState: LiveDraftState;
  watchOwnerState: AuctionOwnerState;
  player: Player;
  topAiBid: number;
  topAiBidOwner: Owner;
  aiSalePrice: number;
}): InteractiveMockDraftCamDecision | undefined => {
  if (!watchOwnerCanRoster(watchOwnerState, player)) return undefined;

  const target = liveState.availableTargets.find(candidate =>
    normalizePlayerName(candidate.name) === normalizePlayerName(player.name)
  );
  if (!target) return undefined;

  const maxBid = Math.min(target.recommendedMaxBid, watchOwnerState.maxBid);
  if (maxBid <= topAiBid) return undefined;

  return {
    maxBid,
    recommendedBid: Math.min(maxBid, topAiBid + 1),
    topAiBid,
    topAiBidOwner,
    aiSalePrice,
    valueGap: target.personalValue - target.liveExpectedPrice,
  };
};

export const buildInteractiveMockDraftState = ({
  projections,
  historicalRecords,
  keepers = defaultKeepers,
  scenarioKey = defaultScenarioKey,
  strategyKey = defaultLiveDraftStrategyKey,
  watchOwner = defaultWatchOwner,
  commands = [],
  pricingConfig = defaultPricingConfig,
  seed = defaultSeed,
  diagnosticsMode = "full",
}: BuildInteractiveMockDraftStateOptions): InteractiveMockDraftState => {
  const prepared = prepareInteractiveMockDraft({
    projections,
    historicalRecords,
    keepers,
    scenarioKey,
    strategyKey,
    watchOwner,
    commands,
    pricingConfig,
    seed,
  });
  const pickIndex = prepared.liveState.events.length;
  const nominationTurn = snakeOwnerForPick(pickIndex, prepared.ownerStates);

  if (prepared.liveState.errors.length > 0) {
    return baseStateFor({
      phase: "blocked",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor: pickIndex,
      message: prepared.liveState.errors[0]?.message ?? "Resolve command errors before continuing mock draft.",
    });
  }
  if (prepared.auctionPlayers.length === 0 || allRostersFull(prepared.ownerStates) || !nominationTurn) {
    return baseStateFor({
      phase: "complete",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor: pickIndex,
      message: "All roster slots are filled.",
    });
  }
  if (nominationTurn.owner === watchOwner) {
    return {
      ...baseStateFor({
        phase: "human-nomination",
        prepared,
        watchOwner,
        seed,
        pickNumber: pickIndex + 1,
        nominationCursor: nominationTurn.cursor,
        message: `${watchOwner} is up to nominate.`,
      }),
      nominator: nominationTurn.owner,
    };
  }

  const nomination = selectNominatedPlayer({
    availablePlayers: prepared.auctionPlayers,
    ownerStates: prepared.ownerStates,
    nominator: nominationTurn.owner,
    pickIndex,
    config: prepared.config,
    diagnosticsMode,
  });
  if (!nomination) {
    return baseStateFor({
      phase: "blocked",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor: nominationTurn.cursor,
      message: "No legal nomination is available.",
    });
  }

  const remainingPlayers = prepared.auctionPlayers.filter((_, index) => index !== nomination.index);
  const aiOwnerStates = prepared.ownerStates.filter(state => state.owner !== watchOwner);
  const aiSale = resolveAuctionSale(nomination.player, aiOwnerStates, remainingPlayers, prepared.config, {
    nominator: nominationTurn.owner,
    diagnosticsMode,
  });
  if (!aiSale) {
    return {
      ...baseStateFor({
        phase: "blocked",
        prepared,
        watchOwner,
        seed,
        pickNumber: pickIndex + 1,
        nominationCursor: nominationTurn.cursor,
        message: "The AI room could not produce a legal bid for this nomination.",
      }),
      nominator: nominationTurn.owner,
      nomination: nominationFor(nomination),
    };
  }

  const topAiBidder = aiSale.bids[0];
  const topAiBid = topAiBidder?.amount ?? aiSale.price;
  const topAiBidOwner = topAiBidder?.owner ?? aiSale.winner;
  const watchOwnerState = prepared.ownerStates.find(state => state.owner === watchOwner);
  if (!watchOwnerState) throw new Error(`Unknown watch owner "${watchOwner}".`);

  const camDecision = camDecisionFor({
    liveState: prepared.liveState,
    watchOwnerState,
    player: nomination.player,
    topAiBid,
    topAiBidOwner,
    aiSalePrice: aiSale.price,
  });
  const phase: InteractiveMockDraftPhase = camDecision ? "human-decision" : "ai-sale";

  return {
    ...baseStateFor({
      phase,
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor: nominationTurn.cursor,
    }),
    nominator: nominationTurn.owner,
    nomination: nominationFor(nomination),
    aiBids: aiSale.bids.slice(0, topBidLimit).map(bid => mockBidFor(bid, nomination.player)),
    aiSaleCommand: aiSaleCommandFor(aiSale.winner, nomination.player.name, aiSale.price),
    ...(camDecision === undefined ? {} : { camDecision }),
  };
};

export const resolveInteractiveMockDraftAction = (
  state: InteractiveMockDraftState,
  action: InteractiveMockDraftAction,
): { command: string } => {
  if (action === "cam-bid" || action === "cam-win") {
    if (!state.nomination || !state.camDecision) {
      throw new Error("Cam does not have a live decision to win.");
    }

    return {
      command: aiSaleCommandFor(state.watchOwner, state.nomination.player, state.camDecision.recommendedBid),
    };
  }

  if (action === "advance" || action === "pass") {
    if (!state.aiSaleCommand) {
      throw new Error("No AI sale is ready to advance.");
    }

    return {
      command: state.aiSaleCommand,
    };
  }

  throw new Error(`Unknown mock draft action "${action}".`);
};
