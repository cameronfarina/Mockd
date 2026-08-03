import { leagueConfig, ownerOrder, positions, type Owner, type Position } from "../../config/league.js";
import type { KeeperDeclaration } from "../../config/keepers.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../projections.js";
import type { MockRoster, Player } from "../types.js";
import { validateRoster } from "../validateMocks.js";
import {
  buildAuctionConfig,
  buildAuctionPlayerPool,
  buildInitialRostersFromKeepers,
  buildOwnerAuctionBehaviors,
  buildOwnerDemandMultipliers,
  buildOwnerRosterMaximums,
  simulateAuction,
  type AuctionDiagnosticsMode,
  type AuctionEngineConfigOverrides,
  type AuctionBudgetTrajectoryRow,
  type AuctionPick,
  type InitialRostersByOwner,
  type OwnerAuctionBehaviors,
  type OwnerDemandMultipliers,
  type OwnerPositionAnchorTargets,
  type OwnerPositionCoreBudgetEnvelopes,
  type OwnerPositionCoreMaxBids,
  type OwnerPositionCoreTargets,
  type OwnerPositionSlotMaxBids,
  type OwnerRosterMaximums,
} from "./auctionEngine.js";
import { buildBasePrices, defaultPricingConfig, type PricingConfig } from "./basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenario,
  type KeeperScenarioKey,
} from "./keeperInflation.js";
import { buildOwnerProfiles } from "./ownerProfiles.js";

type PositionAmounts = Record<Position, number>;

export interface ForcedAuctionSale {
  owner: Owner;
  player: string;
  price: number;
}

export interface RunMockOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  seed?: string;
  pricingConfig?: PricingConfig;
  auctionConfigOverrides?: AuctionEngineConfigOverrides;
  forcedSales?: readonly ForcedAuctionSale[];
  diagnosticsMode?: AuctionDiagnosticsMode;
}

export interface RunMockBatchOptions extends Omit<RunMockOptions, "scenarioKey" | "seed"> {
  scenarioKeys?: readonly KeeperScenarioKey[];
  runsPerScenario?: number;
  seedPrefix?: string;
}

export interface RunMockBatchProgress {
  run: MockRun;
  completedRuns: number;
  totalRuns: number;
}

export interface RunMockBatchRunContext {
  scenarioKey: KeeperScenarioKey;
  runIndex: number;
  completedRuns: number;
  seed: string;
}

export interface RunMockBatchProgressiveOptions extends RunMockBatchOptions {
  auctionConfigOverridesForRun?: (context: RunMockBatchRunContext) => AuctionEngineConfigOverrides;
  onRunComplete?: (progress: RunMockBatchProgress) => void | Promise<void>;
}

export interface MockInputCounts {
  pricedPlayers: number;
  auctionPlayers: number;
  lockedKeepers: number;
}

export interface MockRosterSummary {
  owner: Owner;
  spend: number;
  budgetRemaining: number;
  week1Score?: number;
  weeks1To4Score?: number;
  valid: boolean;
  errors: string[];
  players: MockRoster["players"];
  positionSpend: PositionAmounts;
}

export interface MockRun {
  seed: string;
  keeperScenario: KeeperScenario;
  inputCounts: MockInputCounts;
  pickCount: number;
  picks: AuctionPick[];
  budgetTrajectory: AuctionBudgetTrajectoryRow[];
  rosters: MockRosterSummary[];
  invalidRosterCount: number;
  unsoldPlayerCount: number;
}

export interface ScenarioBatchSummary {
  key: KeeperScenarioKey;
  label: string;
  runCount: number;
  invalidRosterCount: number;
  averagePickCount: number;
}

export interface PlayerBatchSummary {
  name: string;
  position: Position;
  draftedCount: number;
  draftedRate: number;
  averageMarketPrice: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
}

export interface OwnerBatchSummary {
  owner: Owner;
  runCount: number;
  invalidRosterCount: number;
  averageSpend: number;
  minimumSpend: number;
  maximumSpend: number;
  averageWeek1Score: number;
  averageWeeks1To4Score: number;
  averageBudgetRemaining: number;
  averagePositionSpend: PositionAmounts;
}

export interface OwnerPlayerExposureSummary {
  owner: Owner;
  player: string;
  position: Position;
  draftedCount: number;
  draftedRate: number;
  averagePrice: number;
}

export interface MockBatchSummary {
  runCount: number;
  scenarios: ScenarioBatchSummary[];
  players: PlayerBatchSummary[];
  owners: OwnerBatchSummary[];
  ownerPlayerExposure: OwnerPlayerExposureSummary[];
}

export interface MockBatch {
  options: {
    scenarioKeys: KeeperScenarioKey[];
    runsPerScenario: number;
    seedPrefix: string;
    diagnosticsMode?: AuctionDiagnosticsMode;
    forcedSales?: ForcedAuctionSale[];
  };
  runs: MockRun[];
  summary: MockBatchSummary;
}

interface PreparedScenario {
  scenario: KeeperScenario;
  initialRostersByOwner: InitialRostersByOwner;
  auctionPlayers: ReturnType<typeof buildAuctionPlayerPool>;
  inputCounts: MockInputCounts;
}

interface MockPreparation {
  scenarios: PreparedScenario[];
  ownerDemandMultipliers: ReturnType<typeof buildOwnerDemandMultipliers>;
  ownerBehaviors: ReturnType<typeof buildOwnerAuctionBehaviors>;
  ownerRosterMaximums: ReturnType<typeof buildOwnerRosterMaximums>;
}

const defaultScenarioKeys: readonly KeeperScenarioKey[] = ["expected"];
const defaultRunsPerScenario = 50;
const defaultSeedPrefix = "mockd";
const replacementDepthBuffer = 160;

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const emptyPositionSpend = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const sumPositionSpend = (roster: MockRoster): PositionAmounts => {
  const spend = emptyPositionSpend();

  for (const player of roster.players) {
    spend[player.position] += player.price;
  }

  return spend;
};

const countRosterPositions = (roster: readonly Player[]): PositionAmounts => {
  const counts = emptyPositionSpend();

  for (const player of roster) counts[player.position] += 1;

  return counts;
};

const scenarioByKey = (
  scenarioKey: KeeperScenarioKey,
  scenarios: readonly KeeperScenario[],
): KeeperScenario => {
  const scenario = scenarios.find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);
  return scenario;
};

const keeperCountFor = (initialRostersByOwner: InitialRostersByOwner): number =>
  Object.values(initialRostersByOwner)
    .reduce((count, roster) => count + (roster?.length ?? 0), 0);

const prepareMockInputs = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKeys = defaultScenarioKeys,
  pricingConfig = defaultPricingConfig,
}: Omit<RunMockBatchOptions, "runsPerScenario" | "seedPrefix">): MockPreparation => {
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const keeperScenarios = buildKeeperScenarios(keepers);
  const ownerProfiles = buildOwnerProfiles(historicalRecords);
  const ownerDemandMultipliers = buildOwnerDemandMultipliers(ownerProfiles);
  const ownerBehaviors = buildOwnerAuctionBehaviors(ownerProfiles);
  const ownerRosterMaximums = buildOwnerRosterMaximums(ownerProfiles);
  const totalRosterSlots = leagueConfig.teams * leagueConfig.rosterSize;

  return {
    ownerDemandMultipliers,
    ownerBehaviors,
    ownerRosterMaximums,
    scenarios: scenarioKeys.map(scenarioKey => {
      const scenario = scenarioByKey(scenarioKey, keeperScenarios);
      const adjustedPrices = applyKeeperScenarioToPrices(prices, scenario, keepers);
      const initialRostersByOwner = buildInitialRostersFromKeepers(
        keepers,
        projections,
        scenario.includedKeeperStatuses,
      );
      const lockedKeepers = keeperCountFor(initialRostersByOwner);
      const auctionPlayers = buildAuctionPlayerPool({
        pricedPlayers: adjustedPrices.availablePrices,
        projections,
        excludedNames: adjustedPrices.unavailableKeepers.map(keeper => keeper.player),
        targetCount: totalRosterSlots - lockedKeepers + replacementDepthBuffer,
      });

      return {
        scenario,
        initialRostersByOwner,
        auctionPlayers,
        inputCounts: {
          pricedPlayers: adjustedPrices.availablePrices.length,
          auctionPlayers: auctionPlayers.length,
          lockedKeepers,
        },
      };
    }),
  };
};

const summarizeRoster = (owner: Owner, roster: MockRoster): MockRosterSummary => {
  const validation = validateRoster(roster);
  const summary: MockRosterSummary = {
    owner,
    spend: validation.spend,
    budgetRemaining: leagueConfig.auctionBudget - validation.spend,
    valid: validation.valid,
    errors: validation.errors,
    players: roster.players,
    positionSpend: sumPositionSpend(roster),
  };

  if (validation.week1Score !== undefined) summary.week1Score = validation.week1Score;
  if (validation.weeks1To4Score !== undefined) summary.weeks1To4Score = validation.weeks1To4Score;

  return summary;
};

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

const mergeOwnerPositionCoreBudgetEnvelopes = (
  base: OwnerPositionCoreBudgetEnvelopes,
  overrides?: OwnerPositionCoreBudgetEnvelopes,
): OwnerPositionCoreBudgetEnvelopes => {
  if (!overrides) return base;

  const merged: OwnerPositionCoreBudgetEnvelopes = { ...base };
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

const assertForcedSalePrice = (sale: ForcedAuctionSale): void => {
  if (!Number.isInteger(sale.price) || sale.price < 1) {
    throw new Error(`Forced sale for ${sale.player} must use a positive whole-dollar price.`);
  }
};

const maxBidForForcedSale = (roster: readonly Player[], minimumBid: number): number => {
  const spent = roster.reduce((total, player) => total + player.price, 0);
  const rosterSlotsRemaining = leagueConfig.rosterSize - roster.length;
  const budgetRemaining = leagueConfig.auctionBudget - spent;

  if (rosterSlotsRemaining <= 0) return 0;
  return Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * minimumBid);
};

const applyForcedSalesToPreparedScenario = (
  preparedScenario: PreparedScenario,
  forcedSales: readonly ForcedAuctionSale[],
  minimumBid: number,
): PreparedScenario => {
  if (forcedSales.length === 0) return preparedScenario;

  const initialRostersByOwner: InitialRostersByOwner = {};
  for (const owner of ownerOrder) {
    initialRostersByOwner[owner] = [...(preparedScenario.initialRostersByOwner[owner] ?? [])];
  }

  const auctionPlayers = [...preparedScenario.auctionPlayers];
  const forcedNames = new Set<string>();

  for (const sale of forcedSales) {
    assertForcedSalePrice(sale);
    const normalizedSaleName = normalizePlayerName(sale.player);
    if (forcedNames.has(normalizedSaleName)) {
      throw new Error(`Forced sale duplicates ${sale.player}.`);
    }
    forcedNames.add(normalizedSaleName);

    const roster = initialRostersByOwner[sale.owner] ?? [];
    if (roster.some(player => normalizePlayerName(player.name) === normalizedSaleName)) {
      throw new Error(`${sale.player} is already on ${sale.owner}'s roster.`);
    }

    const playerIndex = auctionPlayers.findIndex(player => normalizePlayerName(player.name) === normalizedSaleName);
    if (playerIndex < 0) {
      throw new Error(`Forced sale player "${sale.player}" is not available in the auction pool.`);
    }
    const player = auctionPlayers[playerIndex];
    if (!player) throw new Error(`Unable to resolve forced sale player "${sale.player}".`);

    const positionCounts = countRosterPositions(roster);
    const positionMaximum = leagueConfig.rosterMaximums[player.position];
    if (positionCounts[player.position] >= positionMaximum) {
      throw new Error(
        `${sale.owner} cannot force ${player.name}: roster limit is ${positionMaximum} ${player.position}s.`,
      );
    }
    if (roster.length >= leagueConfig.rosterSize) {
      throw new Error(`${sale.owner} cannot force ${player.name}: roster is already full.`);
    }

    const maxBid = maxBidForForcedSale(roster, minimumBid);
    if (sale.price > maxBid) {
      throw new Error(`${sale.owner} cannot force ${player.name} for $${sale.price}: max bid is $${maxBid}.`);
    }

    auctionPlayers.splice(playerIndex, 1);
    initialRostersByOwner[sale.owner] = [...roster, { ...player, price: sale.price }];
  }

  return {
    ...preparedScenario,
    initialRostersByOwner,
    auctionPlayers,
    inputCounts: {
      ...preparedScenario.inputCounts,
      auctionPlayers: auctionPlayers.length,
    },
  };
};

const mergeOwnerPositionPriceLadders = <
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

const runPreparedScenario = (
  preparedScenario: PreparedScenario,
  ownerDemandMultipliers: ReturnType<typeof buildOwnerDemandMultipliers>,
  ownerBehaviors: ReturnType<typeof buildOwnerAuctionBehaviors>,
  ownerRosterMaximums: ReturnType<typeof buildOwnerRosterMaximums>,
  seed: string,
  auctionConfigOverrides: AuctionEngineConfigOverrides = {},
  forcedSales: readonly ForcedAuctionSale[] = [],
  diagnosticsMode: AuctionDiagnosticsMode = "full",
): MockRun => {
  const auctionConfig = buildAuctionConfig({
    ...auctionConfigOverrides,
    seed,
    ownerDemandMultipliers: mergeOwnerPositionMaps(
      ownerDemandMultipliers,
      auctionConfigOverrides.ownerDemandMultipliers,
    ),
    ownerBehaviors: mergeOwnerAuctionBehaviors(
      ownerBehaviors,
      auctionConfigOverrides.ownerBehaviors,
    ),
    ownerRosterMaximums: mergeOwnerPositionMaps(
      ownerRosterMaximums,
      auctionConfigOverrides.ownerRosterMaximums,
    ),
    ownerPositionAnchorTargets: mergeOwnerPositionMaps(
      {},
      auctionConfigOverrides.ownerPositionAnchorTargets,
    ),
    ownerPositionCoreTargets: mergeOwnerPositionPriceLadders(
      {},
      auctionConfigOverrides.ownerPositionCoreTargets,
    ),
    ownerPositionCoreMaxBids: mergeOwnerPositionPriceLadders(
      {},
      auctionConfigOverrides.ownerPositionCoreMaxBids,
    ),
    ownerPositionSlotMaxBids: mergeOwnerPositionPriceLadders(
      {},
      auctionConfigOverrides.ownerPositionSlotMaxBids,
    ),
    ownerPositionCoreBudgetEnvelopes: mergeOwnerPositionCoreBudgetEnvelopes(
      {},
      auctionConfigOverrides.ownerPositionCoreBudgetEnvelopes,
    ),
  });
  const runPrepared = applyForcedSalesToPreparedScenario(
    preparedScenario,
    forcedSales,
    auctionConfig.minimumBid,
  );
  const result = simulateAuction({
    players: runPrepared.auctionPlayers,
    config: auctionConfig,
    initialRostersByOwner: runPrepared.initialRostersByOwner,
    diagnosticsMode,
  });
  const rosters = ownerOrder.map(owner => {
    const roster = result.rosters[owner];
    if (!roster) throw new Error(`Missing roster for ${owner}.`);
    return summarizeRoster(owner, roster);
  });

  return {
    seed,
    keeperScenario: runPrepared.scenario,
    inputCounts: runPrepared.inputCounts,
    pickCount: result.picks.length,
    picks: result.picks,
    budgetTrajectory: result.budgetTrajectory,
    rosters,
    invalidRosterCount: rosters.filter(roster => !roster.valid).length,
    unsoldPlayerCount: result.unsoldPlayers.length,
  };
};

export const runMock = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKey = "expected",
  seed = "mockd-default",
  pricingConfig = defaultPricingConfig,
  auctionConfigOverrides = {},
  forcedSales = [],
  diagnosticsMode = "full",
}: RunMockOptions): MockRun => {
  const preparation = prepareMockInputs({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: [scenarioKey],
    pricingConfig,
  });
  const preparedScenario = preparation.scenarios[0];
  if (!preparedScenario) throw new Error(`Unable to prepare scenario "${scenarioKey}".`);

  return runPreparedScenario(
    preparedScenario,
    preparation.ownerDemandMultipliers,
    preparation.ownerBehaviors,
    preparation.ownerRosterMaximums,
    seed,
    auctionConfigOverrides,
    forcedSales,
    diagnosticsMode,
  );
};

const summarizeScenarios = (runs: readonly MockRun[]): ScenarioBatchSummary[] =>
  [...new Set(runs.map(run => run.keeperScenario.key))]
    .map(scenarioKey => {
      const scenarioRuns = runs.filter(run => run.keeperScenario.key === scenarioKey);
      const firstRun = scenarioRuns[0];
      if (!firstRun) throw new Error(`Missing runs for scenario "${scenarioKey}".`);

      return {
        key: scenarioKey,
        label: firstRun.keeperScenario.label,
        runCount: scenarioRuns.length,
        invalidRosterCount: scenarioRuns.reduce((total, run) => total + run.invalidRosterCount, 0),
        averagePickCount: roundToTwo(average(scenarioRuns.map(run => run.pickCount))),
      };
    });

const summarizePlayers = (runs: readonly MockRun[]): PlayerBatchSummary[] => {
  const picksByPlayer = new Map<string, AuctionPick[]>();

  for (const run of runs) {
    for (const pick of run.picks) {
      picksByPlayer.set(pick.player, [...(picksByPlayer.get(pick.player) ?? []), pick]);
    }
  }

  return [...picksByPlayer.entries()]
    .map(([name, picks]) => {
      const salePrices = picks.map(pick => pick.price);
      const firstPick = picks[0];
      if (!firstPick) throw new Error(`Missing picks for ${name}.`);

      return {
        name,
        position: firstPick.position,
        draftedCount: picks.length,
        draftedRate: roundToTwo(picks.length / Math.max(1, runs.length)),
        averageMarketPrice: roundToTwo(average(picks.map(pick => pick.marketPrice))),
        averageSalePrice: roundToTwo(average(salePrices)),
        minimumSalePrice: Math.min(...salePrices),
        maximumSalePrice: Math.max(...salePrices),
      };
    })
    .sort(
      (left, right) =>
        right.draftedCount - left.draftedCount ||
        right.averageSalePrice - left.averageSalePrice ||
        left.name.localeCompare(right.name),
    );
};

const summarizeOwners = (runs: readonly MockRun[]): OwnerBatchSummary[] =>
  ownerOrder.map(owner => {
    const rosters = runs
      .flatMap(run => run.rosters)
      .filter(roster => roster.owner === owner);
    const positionSpend = emptyPositionSpend();

    for (const position of positions) {
      positionSpend[position] = roundToTwo(average(rosters.map(roster => roster.positionSpend[position])));
    }

    return {
      owner,
      runCount: rosters.length,
      invalidRosterCount: rosters.filter(roster => !roster.valid).length,
      averageSpend: roundToTwo(average(rosters.map(roster => roster.spend))),
      minimumSpend: Math.min(...rosters.map(roster => roster.spend)),
      maximumSpend: Math.max(...rosters.map(roster => roster.spend)),
      averageWeek1Score: roundToTwo(average(rosters.map(roster => roster.week1Score ?? 0))),
      averageWeeks1To4Score: roundToTwo(average(rosters.map(roster => roster.weeks1To4Score ?? 0))),
      averageBudgetRemaining: roundToTwo(average(rosters.map(roster => roster.budgetRemaining))),
      averagePositionSpend: positionSpend,
    };
  });

const summarizeOwnerPlayerExposure = (runs: readonly MockRun[]): OwnerPlayerExposureSummary[] => {
  const exposure = new Map<string, { owner: Owner; player: string; position: Position; prices: number[] }>();

  for (const run of runs) {
    for (const roster of run.rosters) {
      for (const player of roster.players) {
        const key = `${roster.owner}|${player.name}`;
        const entry = exposure.get(key) ?? {
          owner: roster.owner,
          player: player.name,
          position: player.position,
          prices: [],
        };
        entry.prices.push(player.price);
        exposure.set(key, entry);
      }
    }
  }

  return [...exposure.values()]
    .map(entry => ({
      owner: entry.owner,
      player: entry.player,
      position: entry.position,
      draftedCount: entry.prices.length,
      draftedRate: roundToTwo(entry.prices.length / Math.max(1, runs.length)),
      averagePrice: roundToTwo(average(entry.prices)),
    }))
    .sort(
      (left, right) =>
        right.draftedCount - left.draftedCount ||
        right.averagePrice - left.averagePrice ||
        left.owner.localeCompare(right.owner) ||
        left.player.localeCompare(right.player),
    );
};

export const summarizeMockBatch = (runs: readonly MockRun[]): MockBatchSummary => ({
  runCount: runs.length,
  scenarios: summarizeScenarios(runs),
  players: summarizePlayers(runs),
  owners: summarizeOwners(runs),
  ownerPlayerExposure: summarizeOwnerPlayerExposure(runs),
});

export const runMockBatch = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKeys = defaultScenarioKeys,
  runsPerScenario = defaultRunsPerScenario,
  seedPrefix = defaultSeedPrefix,
  pricingConfig = defaultPricingConfig,
  auctionConfigOverrides = {},
  forcedSales = [],
  diagnosticsMode = "full",
}: RunMockBatchOptions): MockBatch => {
  const normalizedScenarioKeys = [...scenarioKeys];
  const preparation = prepareMockInputs({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: normalizedScenarioKeys,
    pricingConfig,
  });
  const runs = preparation.scenarios.flatMap(preparedScenario =>
    Array.from({ length: runsPerScenario }, (_, index) =>
      runPreparedScenario(
        preparedScenario,
        preparation.ownerDemandMultipliers,
        preparation.ownerBehaviors,
        preparation.ownerRosterMaximums,
        `${seedPrefix}:${preparedScenario.scenario.key}:${index + 1}`,
        auctionConfigOverrides,
        forcedSales,
        diagnosticsMode,
      ),
    ),
  );

  return {
    options: {
      scenarioKeys: normalizedScenarioKeys,
      runsPerScenario,
      seedPrefix,
      ...(diagnosticsMode === "full" ? {} : { diagnosticsMode }),
      ...(forcedSales.length === 0 ? {} : { forcedSales: [...forcedSales] }),
    },
    runs,
    summary: summarizeMockBatch(runs),
  };
};

export const runMockBatchProgressively = async ({
  projections,
  historicalRecords,
  keepers,
  scenarioKeys = defaultScenarioKeys,
  runsPerScenario = defaultRunsPerScenario,
  seedPrefix = defaultSeedPrefix,
  pricingConfig = defaultPricingConfig,
  auctionConfigOverrides = {},
  forcedSales = [],
  auctionConfigOverridesForRun,
  diagnosticsMode = "full",
  onRunComplete,
}: RunMockBatchProgressiveOptions): Promise<MockBatch> => {
  const normalizedScenarioKeys = [...scenarioKeys];
  const preparation = prepareMockInputs({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: normalizedScenarioKeys,
    pricingConfig,
  });
  const totalRuns = preparation.scenarios.length * runsPerScenario;
  const runs: MockRun[] = [];

  for (const preparedScenario of preparation.scenarios) {
    for (let index = 0; index < runsPerScenario; index += 1) {
      const seed = `${seedPrefix}:${preparedScenario.scenario.key}:${index + 1}`;
      const runContext: RunMockBatchRunContext = {
        scenarioKey: preparedScenario.scenario.key,
        runIndex: index + 1,
        completedRuns: runs.length,
        seed,
      };
      const run = runPreparedScenario(
        preparedScenario,
        preparation.ownerDemandMultipliers,
        preparation.ownerBehaviors,
        preparation.ownerRosterMaximums,
        seed,
        auctionConfigOverridesForRun?.(runContext) ?? auctionConfigOverrides,
        forcedSales,
        diagnosticsMode,
      );
      runs.push(run);
      await onRunComplete?.({
        run,
        completedRuns: runs.length,
        totalRuns,
      });
    }
  }

  return {
    options: {
      scenarioKeys: normalizedScenarioKeys,
      runsPerScenario,
      seedPrefix,
      ...(diagnosticsMode === "full" ? {} : { diagnosticsMode }),
      ...(forcedSales.length === 0 ? {} : { forcedSales: [...forcedSales] }),
    },
    runs,
    summary: summarizeMockBatch(runs),
  };
};
