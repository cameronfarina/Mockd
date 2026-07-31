import type { KeeperDeclaration } from "../../config/keepers.js";
import type { Position } from "../../config/league.js";
import type { PlayerContextEvidence } from "../../config/playerContext.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../projections.js";
import { buildBasePrices, defaultPricingConfig, type PricingConfig } from "./basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenarioKey,
  type ScenarioAdjustedPrice,
} from "./keeperInflation.js";
import { runMockBatch, type MockBatch, type MockRun } from "./mockBatch.js";

export type SanityFlagKey =
  | "highMockPremium"
  | "largeProjectionRankLift"
  | "missingFactualEvidence"
  | "contextPenalty"
  | "hardCeilingPressure";

export type SanityFlagSeverity = "info" | "review";
export type HighPriceVolumeStatus = "pass" | "review";

export interface BuildTopPlayerSanityReportOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  limit?: number;
  runs?: number;
  seedPrefix?: string;
  pricingConfig?: PricingConfig;
  mockBatch?: MockBatch;
}

export interface SanityFlag {
  key: SanityFlagKey;
  severity: SanityFlagSeverity;
  message: string;
}

export interface TopPlayerSanityRow {
  rank: number;
  name: string;
  position: Position;
  publicAnchorValue: number;
  projectionRank: number;
  espnRank: number | null;
  rankGap: number | null;
  basePrice: number;
  scenarioPrice: number;
  draftedCount: number;
  draftedRate: number;
  averageMockSalePrice: number;
  saleVsScenarioPrice: number;
  minMockSalePrice: number;
  maxMockSalePrice: number;
  contextAdjustmentPercent: number;
  contextEvidenceCount: number;
  contextEvidence?: readonly PlayerContextEvidence[];
  flags: readonly SanityFlag[];
}

export interface HighPriceVolumeSanity {
  threshold: number;
  historicalAverageCount: number;
  historicalMaxCount: number;
  scenarioCount: number;
  mockAverageCount: number;
  mockMaxCount: number;
  status: HighPriceVolumeStatus;
}

export interface TopPlayerSanitySummary {
  reviewedCount: number;
  flaggedPlayerCount: number;
  flagCounts: Partial<Record<SanityFlagKey, number>>;
  highPriceVolume: HighPriceVolumeSanity[];
}

export interface TopPlayerSanityReport {
  config: {
    scenarioKey: KeeperScenarioKey;
    limit: number;
    runs: number;
    seedPrefix: string;
  };
  scenario: {
    label: string;
    openAuctionDollars: number;
    globalFactor: number;
  };
  summary: TopPlayerSanitySummary;
  players: TopPlayerSanityRow[];
  flaggedPlayers: TopPlayerSanityRow[];
}

interface MockSaleSummary {
  draftedCount: number;
  draftedRate: number;
  averageSalePrice: number;
  saleVsScenarioPrice: number;
  minSalePrice: number;
  maxSalePrice: number;
}

const defaultScenarioKey: KeeperScenarioKey = "expected";
const defaultLimit = 40;
const defaultRuns = 10;
const defaultSeedPrefix = "top-sanity";
const highMockPremiumThreshold = 6;
const largeProjectionLiftThreshold = -5;
const largeProjectionLiftPriceThreshold = 45;
const extremeProjectionLiftThreshold = -30;
const expensiveMissingEvidenceThreshold = 50;
const contextPenaltyThreshold = -0.03;
const highPriceThresholds = [70, 75, 80] as const;

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const max = (values: readonly number[]): number =>
  values.length === 0 ? 0 : Math.max(...values);

const saleSummaryFor = (
  runs: readonly MockRun[],
  player: ScenarioAdjustedPrice,
): MockSaleSummary => {
  const picks = runs.flatMap(run =>
    run.picks.filter(pick => normalizePlayerName(pick.player) === player.normalizedName),
  );
  const salePrices = picks.map(pick => pick.price);
  const averageSalePrice = roundToTwo(average(salePrices));

  return {
    draftedCount: picks.length,
    draftedRate: roundToTwo(picks.length / Math.max(1, runs.length)),
    averageSalePrice,
    saleVsScenarioPrice: roundToTwo(averageSalePrice - player.scenarioPrice),
    minSalePrice: salePrices.length > 0 ? Math.min(...salePrices) : 0,
    maxSalePrice: salePrices.length > 0 ? Math.max(...salePrices) : 0,
  };
};

const flagsFor = (
  player: ScenarioAdjustedPrice,
  saleSummary: MockSaleSummary,
): SanityFlag[] => {
  const flags: SanityFlag[] = [];

  if (saleSummary.saleVsScenarioPrice >= highMockPremiumThreshold) {
    flags.push({
      key: "highMockPremium",
      severity: "review",
      message: `Mock sale average is $${saleSummary.saleVsScenarioPrice} above the scenario anchor.`,
    });
  }

  const rankGap = player.rankGap ?? 0;
  const hasLargeProjectionLift =
    (player.scenarioPrice >= largeProjectionLiftPriceThreshold && rankGap <= largeProjectionLiftThreshold) ||
    rankGap <= extremeProjectionLiftThreshold;

  if (hasLargeProjectionLift) {
    flags.push({
      key: "largeProjectionRankLift",
      severity: "review",
      message: `Projection rank is ${Math.abs(rankGap)} spot(s) higher than ESPN rank.`,
    });
  }

  if (player.scenarioPrice >= expensiveMissingEvidenceThreshold && !player.contextEvidence?.length) {
    flags.push({
      key: "missingFactualEvidence",
      severity: "review",
      message: "Expensive player has no factual evidence rows attached.",
    });
  }

  if (player.contextAdjustmentPercent <= contextPenaltyThreshold) {
    flags.push({
      key: "contextPenalty",
      severity: "info",
      message: `Context adjustment trims price by ${Math.abs(roundToTwo(player.contextAdjustmentPercent * 100))}%.`,
    });
  }

  if (player.price >= player.hardCeiling) {
    flags.push({
      key: "hardCeilingPressure",
      severity: "info",
      message: `Base price is at the ${player.position} hard ceiling.`,
    });
  }

  return flags;
};

const openAuctionRecords = (
  historicalRecords: readonly HistoricalAuctionRecord[],
): HistoricalAuctionRecord[] =>
  historicalRecords.filter(record => record.acquisitionType === "auction");

const historicalSeasons = (historicalRecords: readonly HistoricalAuctionRecord[]): number[] =>
  [...new Set(historicalRecords.map(record => record.season))].sort((left, right) => left - right);

const highPriceVolumeFor = (
  historicalRecords: readonly HistoricalAuctionRecord[],
  availablePrices: readonly ScenarioAdjustedPrice[],
  runs: readonly MockRun[],
): HighPriceVolumeSanity[] => {
  const auctionRecords = openAuctionRecords(historicalRecords);
  const seasons = historicalSeasons(historicalRecords);

  return highPriceThresholds.map(threshold => {
    const historicalCounts = seasons.map(season =>
      auctionRecords.filter(record => record.season === season && record.price >= threshold).length,
    );
    const mockCounts = runs.map(run => run.picks.filter(pick => pick.price >= threshold).length);
    const scenarioCount = availablePrices.filter(price => price.scenarioPrice >= threshold).length;
    const mockMaxCount = max(mockCounts);
    const historicalMaxCount = max(historicalCounts);

    return {
      threshold,
      historicalAverageCount: roundToTwo(average(historicalCounts)),
      historicalMaxCount,
      scenarioCount,
      mockAverageCount: roundToTwo(average(mockCounts)),
      mockMaxCount,
      status: scenarioCount > historicalMaxCount || mockMaxCount > historicalMaxCount ? "review" : "pass",
    };
  });
};

const flagCountsFor = (
  rows: readonly TopPlayerSanityRow[],
): Partial<Record<SanityFlagKey, number>> => {
  const counts: Partial<Record<SanityFlagKey, number>> = {};

  for (const row of rows) {
    for (const flag of row.flags) {
      counts[flag.key] = (counts[flag.key] ?? 0) + 1;
    }
  }

  return counts;
};

export const buildTopPlayerSanityReport = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKey = defaultScenarioKey,
  limit = defaultLimit,
  runs = defaultRuns,
  seedPrefix = defaultSeedPrefix,
  pricingConfig = defaultPricingConfig,
  mockBatch,
}: BuildTopPlayerSanityReportOptions): TopPlayerSanityReport => {
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const scenario = buildKeeperScenarios(keepers).find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);

  const appliedScenario = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const batch = mockBatch ?? runMockBatch({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: [scenarioKey],
    runsPerScenario: runs,
    seedPrefix,
    pricingConfig,
  });
  const scenarioRuns = batch.runs.filter(run => run.keeperScenario.key === scenarioKey);
  if (scenarioRuns.length === 0) throw new Error(`No mock runs found for scenario "${scenarioKey}".`);

  const players = appliedScenario.availablePrices.slice(0, limit).map((player, index) => {
    const saleSummary = saleSummaryFor(scenarioRuns, player);

    return {
      rank: index + 1,
      name: player.name,
      position: player.position,
      publicAnchorValue: player.publicAnchorValue,
      projectionRank: player.projectionRank,
      espnRank: player.espnRank ?? null,
      rankGap: player.rankGap ?? null,
      basePrice: player.price,
      scenarioPrice: player.scenarioPrice,
      draftedCount: saleSummary.draftedCount,
      draftedRate: saleSummary.draftedRate,
      averageMockSalePrice: saleSummary.averageSalePrice,
      saleVsScenarioPrice: saleSummary.saleVsScenarioPrice,
      minMockSalePrice: saleSummary.minSalePrice,
      maxMockSalePrice: saleSummary.maxSalePrice,
      contextAdjustmentPercent: player.contextAdjustmentPercent,
      contextEvidenceCount: player.contextEvidence?.length ?? 0,
      ...(player.contextEvidence ? { contextEvidence: player.contextEvidence } : {}),
      flags: flagsFor(player, saleSummary),
    };
  });
  const flaggedPlayers = players.filter(player => player.flags.length > 0);

  return {
    config: {
      scenarioKey,
      limit,
      runs: scenarioRuns.length,
      seedPrefix,
    },
    scenario: {
      label: scenario.label,
      openAuctionDollars: scenario.openAuctionDollars,
      globalFactor: scenario.globalFactor,
    },
    summary: {
      reviewedCount: players.length,
      flaggedPlayerCount: flaggedPlayers.length,
      flagCounts: flagCountsFor(players),
      highPriceVolume: highPriceVolumeFor(historicalRecords, appliedScenario.availablePrices, scenarioRuns),
    },
    players,
    flaggedPlayers,
  };
};
