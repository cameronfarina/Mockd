import { ownerOrder, positions, type Owner, type Position } from "../../config/league.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import { defaultKeeperScenarioConfig } from "./keeperInflation.js";
import type { MockBatch, MockRun } from "./mockBatch.js";

type PositionAmounts = Record<Position, number>;

export interface CalibrationPriceTier {
  key: "elite" | "strong" | "starter" | "depth" | "dollar";
  label: string;
  minPrice: number;
  maxPrice?: number;
}

export interface PriceTierCalibration {
  key: CalibrationPriceTier["key"];
  label: string;
  historicalAveragePrice: number;
  mockAveragePrice: number;
  priceDelta: number;
  historicalAverageCount: number;
  mockAverageCount: number;
  countDelta: number;
}

export interface PositionSpendCalibration {
  position: Position;
  historicalAverageSpend: number;
  scenarioAverageSpendTarget: number;
  mockAverageSpend: number;
  delta: number;
  scenarioSpendDelta: number;
}

export interface PositionCountCalibration {
  position: Position;
  historicalAverageCount: number;
  mockAverageCount: number;
  delta: number;
}

export interface OwnerSpendCalibration {
  owner: Owner;
  historicalAverageAuctionSpend: number;
  scenarioAverageOpenAuctionBudget: number;
  mockAverageAuctionSpend: number;
  spendDelta: number;
  scenarioSpendDelta: number;
  historicalAverageTopTwoAuctionSpend: number;
  mockAverageTopTwoAuctionSpend: number;
  topTwoDelta: number;
}

export interface OverallCalibration {
  historicalAverageAuctionSpend: number;
  scenarioAverageOpenAuctionDollars: number;
  mockAverageAuctionSpend: number;
  auctionSpendDelta: number;
  scenarioAuctionSpendDelta: number;
  historicalAverageDollarPlayers: number;
  mockAverageDollarPlayers: number;
  dollarPlayerDelta: number;
}

export interface ScenarioCalibration {
  key: MockRun["keeperScenario"]["key"];
  label: string;
  runCount: number;
  invalidRosterCount: number;
  averagePickCount: number;
  scenarioAverageOpenAuctionDollars: number;
  mockAverageAuctionSpend: number;
  scenarioAuctionSpendDelta: number;
  leagueAverageBudgetRemaining: number;
  maxOwnerAverageBudgetRemaining: number;
}

export interface HighPriceVolumeCalibration {
  threshold: number;
  label: string;
  historicalAverageCount: number;
  historicalMaxCount: number;
  mockAverageCount: number;
  mockMaxCount: number;
  averageCountDelta: number;
  maxCountDelta: number;
}

export interface CalibrationDeltaSummary {
  key: string;
  label: string;
  target: number;
  actual: number;
  delta: number;
}

export interface OwnerBudgetRemainingSummary {
  owner: Owner;
  averageBudgetRemaining: number;
}

export interface BudgetRemainingCalibrationSummary {
  leagueAverageBudgetRemaining: number;
  ownersWithAverageBudgetRemaining: OwnerBudgetRemainingSummary[];
}

export type CalibrationGateCategory =
  | "roster_validity"
  | "auction_spend"
  | "high_price_volume"
  | "price_tier_count"
  | "position_count"
  | "position_spend"
  | "owner_spend"
  | "budget_remaining";

export type CalibrationGateStatus = "pass" | "warn" | "fail";
type CalibrationGateMode = "absolute" | "maximum" | "minimum";

export interface CalibrationGate {
  key: string;
  category: CalibrationGateCategory;
  label: string;
  status: CalibrationGateStatus;
  mode: CalibrationGateMode;
  target: number;
  actual: number;
  delta: number;
  warnThreshold: number;
  failThreshold: number;
}

export interface CalibrationGateSummary {
  status: CalibrationGateStatus;
  credible: boolean;
  gateCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export interface CalibrationGates {
  summary: CalibrationGateSummary;
  items: CalibrationGate[];
}

export interface CalibrationSummary {
  runCount: number;
  scenarioKeys: MockBatch["options"]["scenarioKeys"];
  runsPerScenario: number;
  largestPriceTierCountDeltas: CalibrationDeltaSummary[];
  largestPositionCountDeltas: CalibrationDeltaSummary[];
  largestPositionSpendDeltas: CalibrationDeltaSummary[];
  largestOwnerSpendDeltas: CalibrationDeltaSummary[];
  budgetRemaining: BudgetRemainingCalibrationSummary;
}

export interface HistoricalCalibrationAudit {
  runCount: number;
  historicalSeasons: number[];
  summary: CalibrationSummary;
  priceTiers: PriceTierCalibration[];
  highPriceVolumes: HighPriceVolumeCalibration[];
  positionCounts: PositionCountCalibration[];
  positionSpend: PositionSpendCalibration[];
  ownerSpend: OwnerSpendCalibration[];
  scenarios: ScenarioCalibration[];
  overall: OverallCalibration;
  gates: CalibrationGates;
}

export interface BuildHistoricalCalibrationAuditOptions {
  historicalRecords: readonly HistoricalAuctionRecord[];
  batch: MockBatch;
}

const priceTiers: readonly CalibrationPriceTier[] = [
  { key: "elite", label: "$60+", minPrice: 60 },
  { key: "strong", label: "$40-$59", minPrice: 40, maxPrice: 59 },
  { key: "starter", label: "$20-$39", minPrice: 20, maxPrice: 39 },
  { key: "depth", label: "$2-$19", minPrice: 2, maxPrice: 19 },
  { key: "dollar", label: "$1", minPrice: 1, maxPrice: 1 },
];

const highPriceThresholds = [70, 75, 80] as const;

const priceTierCountThresholds: Record<CalibrationPriceTier["key"], { warn: number; fail: number }> = {
  elite: { warn: 4, fail: 8 },
  strong: { warn: 5, fail: 10 },
  starter: { warn: 8, fail: 16 },
  depth: { warn: 20, fail: 40 },
  dollar: { warn: 20, fail: 45 },
};

const positionSpendThresholds: Record<Position, { warn: number; fail: number }> = {
  QB: { warn: 25, fail: 50 },
  RB: { warn: 50, fail: 100 },
  WR: { warn: 50, fail: 100 },
  TE: { warn: 25, fail: 60 },
  K: { warn: 10, fail: 20 },
  DST: { warn: 10, fail: 20 },
};

const positionCountThresholds: Record<Position, { warn: number; fail: number }> = {
  QB: { warn: 3, fail: 6 },
  RB: { warn: 8, fail: 16 },
  WR: { warn: 8, fail: 16 },
  TE: { warn: 4, fail: 8 },
  K: { warn: 3, fail: 6 },
  DST: { warn: 3, fail: 6 },
};

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const openAuctionRecords = (
  historicalRecords: readonly HistoricalAuctionRecord[],
): HistoricalAuctionRecord[] =>
  historicalRecords.filter(record => record.acquisitionType === "auction");

const historicalSeasons = (historicalRecords: readonly HistoricalAuctionRecord[]): number[] =>
  [...new Set(historicalRecords.map(record => record.season))].sort((left, right) => left - right);

const isInTier = (
  price: number,
  tier: CalibrationPriceTier,
): boolean =>
  price >= tier.minPrice && (tier.maxPrice === undefined || price <= tier.maxPrice);

const averageHistoricalCountPerSeason = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): number =>
  average(seasons.map(season => records.filter(record => record.season === season).length));

const averageMockCountPerRun = (
  runs: readonly MockRun[],
  predicate: (price: number) => boolean,
): number =>
  average(runs.map(run => run.picks.filter(pick => predicate(pick.price)).length));

const summarizePriceTiers = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): PriceTierCalibration[] =>
  priceTiers.map(tier => {
    const historicalTierRecords = records.filter(record => isInTier(record.price, tier));
    const mockTierPicks = runs.flatMap(run => run.picks.filter(pick => isInTier(pick.price, tier)));
    const historicalAveragePrice = roundToTwo(average(historicalTierRecords.map(record => record.price)));
    const mockAveragePrice = roundToTwo(average(mockTierPicks.map(pick => pick.price)));
    const historicalAverageCount = roundToTwo(averageHistoricalCountPerSeason(historicalTierRecords, seasons));
    const mockAverageCount = roundToTwo(averageMockCountPerRun(runs, price => isInTier(price, tier)));

    return {
      key: tier.key,
      label: tier.label,
      historicalAveragePrice,
      mockAveragePrice,
      priceDelta: roundToTwo(mockAveragePrice - historicalAveragePrice),
      historicalAverageCount,
      mockAverageCount,
      countDelta: roundToTwo(mockAverageCount - historicalAverageCount),
    };
  });

const highPriceCountByHistoricalSeason = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  threshold: number,
): number[] =>
  seasons.map(season =>
    records.filter(record => record.season === season && record.price >= threshold).length,
  );

const highPriceCountByMockRun = (
  runs: readonly MockRun[],
  threshold: number,
): number[] =>
  runs.map(run => run.picks.filter(pick => pick.price >= threshold).length);

const max = (values: readonly number[]): number =>
  values.length === 0 ? 0 : Math.max(...values);

const summarizeHighPriceVolumes = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): HighPriceVolumeCalibration[] =>
  highPriceThresholds.map(threshold => {
    const historicalCounts = highPriceCountByHistoricalSeason(records, seasons, threshold);
    const mockCounts = highPriceCountByMockRun(runs, threshold);
    const historicalAverageCount = roundToTwo(average(historicalCounts));
    const mockAverageCount = roundToTwo(average(mockCounts));
    const historicalMaxCount = max(historicalCounts);
    const mockMaxCount = max(mockCounts);

    return {
      threshold,
      label: `$${threshold}+`,
      historicalAverageCount,
      historicalMaxCount,
      mockAverageCount,
      mockMaxCount,
      averageCountDelta: roundToTwo(mockAverageCount - historicalAverageCount),
      maxCountDelta: roundToTwo(mockMaxCount - historicalMaxCount),
    };
  });

const historicalPositionSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  position: Position,
): number =>
  average(seasons.map(season =>
    records
      .filter(record => record.season === season && record.position === position)
      .reduce((total, record) => total + record.price, 0),
  ));

const mockPositionSpend = (
  runs: readonly MockRun[],
  position: Position,
): number =>
  average(runs.map(run =>
    run.picks
      .filter(pick => pick.position === position)
      .reduce((total, pick) => total + pick.price, 0),
  ));

const averageScenarioKeeperCount = (
  runs: readonly MockRun[],
  position: Position,
): number =>
  average(runs.map(run => run.keeperScenario.keeperCounts[position]));

const historicalTopAuctionSpendForCount = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  position: Position,
  count: number,
): number => {
  if (count <= 0) return 0;

  const fullCount = Math.floor(count);
  const fractionalCount = count - fullCount;

  return average(seasons.map(season => {
    const prices = records
      .filter(record => record.season === season && record.position === position)
      .map(record => record.price)
      .sort((left, right) => right - left);
    const fullSpend = prices
      .slice(0, fullCount)
      .reduce((total, price) => total + price, 0);
    const fractionalSpend = (prices[fullCount] ?? 0) * fractionalCount;

    return fullSpend + fractionalSpend;
  }));
};

const redistributeRemovedKeeperSpend = (
  baseTargets: PositionAmounts,
  removedTargets: PositionAmounts,
): PositionAmounts => {
  const adjustedTargets = { ...baseTargets };
  const removedTotal = positions.reduce((total, position) => total + removedTargets[position], 0);
  if (removedTotal <= 0) return adjustedTargets;

  const redistributionPositions = positions.filter(position => removedTargets[position] === 0);
  const fallbackPositions = redistributionPositions.length === 0 ? [...positions] : redistributionPositions;
  const redistributionWeightTotal = fallbackPositions.reduce(
    (total, position) => total + baseTargets[position],
    0,
  );
  if (redistributionWeightTotal <= 0) return adjustedTargets;

  for (const position of positions) {
    adjustedTargets[position] = Math.max(0, baseTargets[position] - removedTargets[position]);
  }
  for (const position of fallbackPositions) {
    adjustedTargets[position] += removedTotal * (baseTargets[position] / redistributionWeightTotal);
  }

  return adjustedTargets;
};

const keeperAdjustedPositionSpendTargets = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
  scenarioSpendScale: number,
): PositionAmounts => {
  const baseTargets = positions.reduce<PositionAmounts>(
    (targets, position) => ({
      ...targets,
      [position]: historicalPositionSpend(records, seasons, position) * scenarioSpendScale,
    }),
    { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  );
  const removedTargets = positions.reduce<PositionAmounts>(
    (targets, position) => {
      const extraKeeperCount = Math.max(
        0,
        averageScenarioKeeperCount(runs, position) -
          defaultKeeperScenarioConfig.typicalKeeperCounts[position],
      );
      const opportunitySpend = historicalTopAuctionSpendForCount(records, seasons, position, extraKeeperCount);

      return {
        ...targets,
        [position]: Math.min(baseTargets[position], opportunitySpend * scenarioSpendScale),
      };
    },
    { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  );

  return redistributeRemovedKeeperSpend(baseTargets, removedTargets);
};

const historicalPositionCount = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  position: Position,
): number =>
  average(seasons.map(season =>
    records.filter(record => record.season === season && record.position === position).length,
  ));

const mockPositionCount = (
  runs: readonly MockRun[],
  position: Position,
): number =>
  average(runs.map(run =>
    run.rosters
      .flatMap(roster => roster.players)
      .filter(player => player.position === position)
      .length,
  ));

const summarizePositionCounts = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): PositionCountCalibration[] =>
  positions.map(position => {
    const historicalAverageCount = roundToTwo(historicalPositionCount(records, seasons, position));
    const mockAverageCount = roundToTwo(mockPositionCount(runs, position));

    return {
      position,
      historicalAverageCount,
      mockAverageCount,
      delta: roundToTwo(mockAverageCount - historicalAverageCount),
    };
  });

const summarizePositionSpend = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): PositionSpendCalibration[] => {
  const historicalAverageAuctionSpend = totalHistoricalAuctionSpend(records, seasons);
  const scenarioAverageOpenAuctionDollars = scenarioOpenAuctionDollars(runs);
  const scenarioSpendScale = historicalAverageAuctionSpend === 0
    ? 1
    : scenarioAverageOpenAuctionDollars / historicalAverageAuctionSpend;
  const scenarioSpendTargets = keeperAdjustedPositionSpendTargets(
    records,
    runs,
    seasons,
    scenarioSpendScale,
  );

  return positions.map(position => {
    const historicalAverageSpend = roundToTwo(historicalPositionSpend(records, seasons, position));
    const scenarioAverageSpendTarget = roundToTwo(scenarioSpendTargets[position]);
    const mockAverageSpend = roundToTwo(mockPositionSpend(runs, position));

    return {
      position,
      historicalAverageSpend,
      scenarioAverageSpendTarget,
      mockAverageSpend,
      delta: roundToTwo(mockAverageSpend - historicalAverageSpend),
      scenarioSpendDelta: roundToTwo(mockAverageSpend - scenarioAverageSpendTarget),
    };
  });
};

const topTwoSpend = (prices: readonly number[]): number =>
  [...prices]
    .sort((left, right) => right - left)
    .slice(0, 2)
    .reduce((total, price) => total + price, 0);

const historicalOwnerAuctionSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  owner: Owner,
): number =>
  average(seasons.map(season =>
    records
      .filter(record => record.season === season && record.owner === owner)
      .reduce((total, record) => total + record.price, 0),
  ));

const historicalOwnerTopTwoSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  owner: Owner,
): number =>
  average(seasons.map(season =>
    topTwoSpend(records
      .filter(record => record.season === season && record.owner === owner)
      .map(record => record.price)),
  ));

const mockOwnerAuctionSpendForRun = (
  run: MockRun,
  owner: Owner,
): number =>
  run.picks
    .filter(pick => pick.owner === owner)
    .reduce((total, pick) => total + pick.price, 0);

const mockOwnerAuctionSpend = (
  runs: readonly MockRun[],
  owner: Owner,
): number =>
  average(runs.map(run => mockOwnerAuctionSpendForRun(run, owner)));

const scenarioOwnerOpenAuctionBudget = (
  runs: readonly MockRun[],
  owner: Owner,
): number =>
  average(runs.map(run => {
    const roster = run.rosters.find(summary => summary.owner === owner);
    if (!roster) throw new Error(`Missing roster summary for ${owner}.`);

    return mockOwnerAuctionSpendForRun(run, owner) + roster.budgetRemaining;
  }));

const mockOwnerTopTwoSpend = (
  runs: readonly MockRun[],
  owner: Owner,
): number =>
  average(runs.map(run =>
    topTwoSpend(run.picks
      .filter(pick => pick.owner === owner)
      .map(pick => pick.price)),
  ));

const summarizeOwnerSpend = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): OwnerSpendCalibration[] =>
  ownerOrder.map(owner => {
    const historicalAverageAuctionSpend = roundToTwo(historicalOwnerAuctionSpend(records, seasons, owner));
    const scenarioAverageOpenAuctionBudget = roundToTwo(scenarioOwnerOpenAuctionBudget(runs, owner));
    const mockAverageAuctionSpend = roundToTwo(mockOwnerAuctionSpend(runs, owner));
    const historicalAverageTopTwoAuctionSpend = roundToTwo(historicalOwnerTopTwoSpend(records, seasons, owner));
    const mockAverageTopTwoAuctionSpend = roundToTwo(mockOwnerTopTwoSpend(runs, owner));

    return {
      owner,
      historicalAverageAuctionSpend,
      scenarioAverageOpenAuctionBudget,
      mockAverageAuctionSpend,
      spendDelta: roundToTwo(mockAverageAuctionSpend - historicalAverageAuctionSpend),
      scenarioSpendDelta: roundToTwo(mockAverageAuctionSpend - scenarioAverageOpenAuctionBudget),
      historicalAverageTopTwoAuctionSpend,
      mockAverageTopTwoAuctionSpend,
      topTwoDelta: roundToTwo(mockAverageTopTwoAuctionSpend - historicalAverageTopTwoAuctionSpend),
    };
  });

const totalHistoricalAuctionSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): number =>
  average(seasons.map(season =>
    records
      .filter(record => record.season === season)
      .reduce((total, record) => total + record.price, 0),
  ));

const totalMockAuctionSpend = (runs: readonly MockRun[]): number =>
  average(runs.map(run => run.picks.reduce((total, pick) => total + pick.price, 0)));

const scenarioOpenAuctionDollars = (runs: readonly MockRun[]): number =>
  average(runs.map(run => run.keeperScenario.openAuctionDollars));

const dollarPlayersPerHistoricalSeason = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): number =>
  average(seasons.map(season =>
    records.filter(record => record.season === season && record.price === 1).length,
  ));

const dollarPlayersPerMockRun = (runs: readonly MockRun[]): number =>
  average(runs.map(run => run.picks.filter(pick => pick.price === 1).length));

const summarizeOverall = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): OverallCalibration => {
  const historicalAverageAuctionSpend = roundToTwo(totalHistoricalAuctionSpend(records, seasons));
  const scenarioAverageOpenAuctionDollars = roundToTwo(scenarioOpenAuctionDollars(runs));
  const mockAverageAuctionSpend = roundToTwo(totalMockAuctionSpend(runs));
  const historicalAverageDollarPlayers = roundToTwo(dollarPlayersPerHistoricalSeason(records, seasons));
  const mockAverageDollarPlayers = roundToTwo(dollarPlayersPerMockRun(runs));

  return {
    historicalAverageAuctionSpend,
    scenarioAverageOpenAuctionDollars,
    mockAverageAuctionSpend,
    auctionSpendDelta: roundToTwo(mockAverageAuctionSpend - historicalAverageAuctionSpend),
    scenarioAuctionSpendDelta: roundToTwo(mockAverageAuctionSpend - scenarioAverageOpenAuctionDollars),
    historicalAverageDollarPlayers,
    mockAverageDollarPlayers,
    dollarPlayerDelta: roundToTwo(mockAverageDollarPlayers - historicalAverageDollarPlayers),
  };
};

const runAverageBudgetRemaining = (run: MockRun): number =>
  average(run.rosters.map(roster => roster.budgetRemaining));

const maxOwnerAverageBudgetRemainingForRuns = (runs: readonly MockRun[]): number =>
  max(ownerOrder.map(owner =>
    average(runs.flatMap(run =>
      run.rosters
        .filter(roster => roster.owner === owner)
        .map(roster => roster.budgetRemaining),
    )),
  ));

const summarizeScenarioCalibration = (batch: MockBatch): ScenarioCalibration[] =>
  batch.summary.scenarios.map(scenario => {
    const runs = batch.runs.filter(run => run.keeperScenario.key === scenario.key);
    const scenarioAverageOpenAuctionDollars = roundToTwo(scenarioOpenAuctionDollars(runs));
    const mockAverageAuctionSpend = roundToTwo(totalMockAuctionSpend(runs));

    return {
      key: scenario.key,
      label: scenario.label,
      runCount: scenario.runCount,
      invalidRosterCount: scenario.invalidRosterCount,
      averagePickCount: scenario.averagePickCount,
      scenarioAverageOpenAuctionDollars,
      mockAverageAuctionSpend,
      scenarioAuctionSpendDelta: roundToTwo(mockAverageAuctionSpend - scenarioAverageOpenAuctionDollars),
      leagueAverageBudgetRemaining: roundToTwo(average(runs.map(runAverageBudgetRemaining))),
      maxOwnerAverageBudgetRemaining: roundToTwo(maxOwnerAverageBudgetRemainingForRuns(runs)),
    };
  });

const byAbsoluteDelta = (left: CalibrationDeltaSummary, right: CalibrationDeltaSummary): number =>
  Math.abs(right.delta) - Math.abs(left.delta) ||
  left.key.localeCompare(right.key);

const topDeltaSummaries = (
  summaries: readonly CalibrationDeltaSummary[],
  limit: number,
): CalibrationDeltaSummary[] =>
  [...summaries].sort(byAbsoluteDelta).slice(0, limit);

const summarizeBudgetRemaining = (batch: MockBatch): BudgetRemainingCalibrationSummary => ({
  leagueAverageBudgetRemaining: roundToTwo(
    average(batch.summary.owners.map(owner => owner.averageBudgetRemaining)),
  ),
  ownersWithAverageBudgetRemaining: batch.summary.owners
    .filter(owner => owner.averageBudgetRemaining > 0)
    .map(owner => ({
      owner: owner.owner,
      averageBudgetRemaining: owner.averageBudgetRemaining,
    }))
    .sort((left, right) =>
      right.averageBudgetRemaining - left.averageBudgetRemaining ||
      ownerOrder.indexOf(left.owner) - ownerOrder.indexOf(right.owner),
    ),
});

const summarizeCalibration = (
  batch: MockBatch,
  priceTierCalibration: readonly PriceTierCalibration[],
  positionCountCalibration: readonly PositionCountCalibration[],
  positionSpendCalibration: readonly PositionSpendCalibration[],
  ownerSpendCalibration: readonly OwnerSpendCalibration[],
): CalibrationSummary => ({
  runCount: batch.runs.length,
  scenarioKeys: batch.options.scenarioKeys,
  runsPerScenario: batch.options.runsPerScenario,
  largestPriceTierCountDeltas: topDeltaSummaries(
    priceTierCalibration.map(tier => ({
      key: tier.key,
      label: tier.label,
      target: tier.historicalAverageCount,
      actual: tier.mockAverageCount,
      delta: tier.countDelta,
    })),
    3,
  ),
  largestPositionCountDeltas: topDeltaSummaries(
    positionCountCalibration.map(position => ({
      key: position.position,
      label: position.position,
      target: position.historicalAverageCount,
      actual: position.mockAverageCount,
      delta: position.delta,
    })),
    3,
  ),
  largestPositionSpendDeltas: topDeltaSummaries(
    positionSpendCalibration.map(position => ({
      key: position.position,
      label: position.position,
      target: position.scenarioAverageSpendTarget,
      actual: position.mockAverageSpend,
      delta: position.scenarioSpendDelta,
    })),
    3,
  ),
  largestOwnerSpendDeltas: topDeltaSummaries(
    ownerSpendCalibration.map(owner => ({
      key: owner.owner,
      label: owner.owner,
      target: owner.scenarioAverageOpenAuctionBudget,
      actual: owner.mockAverageAuctionSpend,
      delta: owner.scenarioSpendDelta,
    })),
    5,
  ),
  budgetRemaining: summarizeBudgetRemaining(batch),
});

const gateStatus = (
  delta: number,
  warnThreshold: number,
  failThreshold: number,
  mode: CalibrationGateMode = "absolute",
): CalibrationGateStatus => {
  const magnitude =
    mode === "maximum" ? Math.max(0, delta) :
      mode === "minimum" ? Math.max(0, -delta) :
        Math.abs(delta);
  if (magnitude >= failThreshold) return "fail";
  if (magnitude >= warnThreshold) return "warn";
  return "pass";
};

const calibrationGate = ({
  key,
  category,
  label,
  target,
  actual,
  warnThreshold,
  failThreshold,
  mode = "absolute",
}: Omit<CalibrationGate, "delta" | "status" | "mode"> & { mode?: CalibrationGateMode }): CalibrationGate => {
  const delta = roundToTwo(actual - target);

  return {
    key,
    category,
    label,
    status: gateStatus(delta, warnThreshold, failThreshold, mode),
    mode,
    target,
    actual,
    delta,
    warnThreshold,
    failThreshold,
  };
};

const summarizeGateStatuses = (items: readonly CalibrationGate[]): CalibrationGateSummary => {
  const failCount = items.filter(gate => gate.status === "fail").length;
  const warnCount = items.filter(gate => gate.status === "warn").length;
  const passCount = items.filter(gate => gate.status === "pass").length;
  let status: CalibrationGateStatus = "pass";

  if (failCount > 0) {
    status = "fail";
  } else if (warnCount > 0) {
    status = "warn";
  }

  return {
    status,
    credible: failCount === 0,
    gateCount: items.length,
    passCount,
    warnCount,
    failCount,
  };
};

const priceTierGateLabel = (tier: PriceTierCalibration): string =>
  tier.key === "dollar" ? "$1 player count" : `${tier.label} player count`;

const highPriceVolumeGateLabel = (volume: HighPriceVolumeCalibration): string =>
  `$${volume.threshold}+ player count`;

const maxOwnerAverageBudgetRemaining = (
  summary: BudgetRemainingCalibrationSummary,
): number =>
  summary.ownersWithAverageBudgetRemaining[0]?.averageBudgetRemaining ?? 0;

const summarizeGates = (
  batch: MockBatch,
  summary: CalibrationSummary,
  priceTierCalibration: readonly PriceTierCalibration[],
  highPriceVolumes: readonly HighPriceVolumeCalibration[],
  positionCountCalibration: readonly PositionCountCalibration[],
  positionSpendCalibration: readonly PositionSpendCalibration[],
  ownerSpendCalibration: readonly OwnerSpendCalibration[],
  overall: OverallCalibration,
): CalibrationGates => {
  const invalidRosterCount = batch.summary.scenarios.reduce(
    (count, scenario) => count + scenario.invalidRosterCount,
    0,
  );

  const items = [
    calibrationGate({
      key: "roster-validity",
      category: "roster_validity",
      label: "Invalid roster count",
      target: 0,
      actual: invalidRosterCount,
      warnThreshold: 0.5,
      failThreshold: 1,
    }),
    calibrationGate({
      key: "auction-spend",
      category: "auction_spend",
      label: "Scenario open auction spend",
      target: overall.scenarioAverageOpenAuctionDollars,
      actual: overall.mockAverageAuctionSpend,
      warnThreshold: 50,
      failThreshold: 100,
    }),
    ...highPriceVolumes.map(volume =>
      calibrationGate({
        key: `high-price-volume:${volume.threshold}-plus`,
        category: "high_price_volume",
        label: highPriceVolumeGateLabel(volume),
        target: volume.historicalMaxCount,
        actual: volume.mockMaxCount,
        warnThreshold: 1,
        failThreshold: 3,
        mode: "maximum",
      }),
    ),
    ...highPriceVolumes.map(volume =>
      calibrationGate({
        key: `high-price-volume-floor:${volume.threshold}-plus`,
        category: "high_price_volume",
        label: `${highPriceVolumeGateLabel(volume)} floor`,
        target: volume.historicalAverageCount,
        actual: volume.mockAverageCount,
        warnThreshold: 2,
        failThreshold: 4,
        mode: "minimum",
      }),
    ),
    ...priceTierCalibration.map(tier => {
      const thresholds = priceTierCountThresholds[tier.key];

      return calibrationGate({
        key: `price-tier-count:${tier.key}`,
        category: "price_tier_count",
        label: priceTierGateLabel(tier),
        target: tier.historicalAverageCount,
        actual: tier.mockAverageCount,
        warnThreshold: thresholds.warn,
        failThreshold: thresholds.fail,
      });
    }),
    ...positionCountCalibration.map(position => {
      const thresholds = positionCountThresholds[position.position];

      return calibrationGate({
        key: `position-count:${position.position}`,
        category: "position_count",
        label: `${position.position} roster count`,
        target: position.historicalAverageCount,
        actual: position.mockAverageCount,
        warnThreshold: thresholds.warn,
        failThreshold: thresholds.fail,
      });
    }),
    ...positionSpendCalibration.map(position => {
      const thresholds = positionSpendThresholds[position.position];

      return calibrationGate({
        key: `position-spend:${position.position}`,
        category: "position_spend",
        label: `${position.position} spend`,
        target: position.scenarioAverageSpendTarget,
        actual: position.mockAverageSpend,
        warnThreshold: thresholds.warn,
        failThreshold: thresholds.fail,
      });
    }),
    ...ownerSpendCalibration.map(owner =>
      calibrationGate({
        key: `owner-spend:${owner.owner}`,
        category: "owner_spend",
        label: `${owner.owner} scenario auction spend`,
        target: owner.scenarioAverageOpenAuctionBudget,
        actual: owner.mockAverageAuctionSpend,
        warnThreshold: 10,
        failThreshold: 20,
      }),
    ),
    calibrationGate({
      key: "budget-remaining:league-average",
      category: "budget_remaining",
      label: "League average budget remaining",
      target: 0,
      actual: summary.budgetRemaining.leagueAverageBudgetRemaining,
      warnThreshold: 4,
      failThreshold: 7,
    }),
    calibrationGate({
      key: "budget-remaining:max-owner",
      category: "budget_remaining",
      label: "Highest owner average budget remaining",
      target: 0,
      actual: maxOwnerAverageBudgetRemaining(summary.budgetRemaining),
      warnThreshold: 10,
      failThreshold: 20,
    }),
  ];

  return {
    summary: summarizeGateStatuses(items),
    items,
  };
};

export const buildHistoricalCalibrationAudit = ({
  historicalRecords,
  batch,
}: BuildHistoricalCalibrationAuditOptions): HistoricalCalibrationAudit => {
  const records = openAuctionRecords(historicalRecords);
  const seasons = historicalSeasons(historicalRecords);
  const runs = batch.runs;
  const priceTierCalibration = summarizePriceTiers(records, runs, seasons);
  const highPriceVolumes = summarizeHighPriceVolumes(records, runs, seasons);
  const positionCountCalibration = summarizePositionCounts(historicalRecords, runs, seasons);
  const positionSpendCalibration = summarizePositionSpend(records, runs, seasons);
  const ownerSpendCalibration = summarizeOwnerSpend(records, runs, seasons);
  const scenarioCalibration = summarizeScenarioCalibration(batch);
  const summary = summarizeCalibration(
    batch,
    priceTierCalibration,
    positionCountCalibration,
    positionSpendCalibration,
    ownerSpendCalibration,
  );
  const overall = summarizeOverall(records, runs, seasons);

  return {
    runCount: runs.length,
    historicalSeasons: seasons,
    summary,
    priceTiers: priceTierCalibration,
    highPriceVolumes,
    positionCounts: positionCountCalibration,
    positionSpend: positionSpendCalibration,
    ownerSpend: ownerSpendCalibration,
    scenarios: scenarioCalibration,
    overall,
    gates: summarizeGates(
      batch,
      summary,
      priceTierCalibration,
      highPriceVolumes,
      positionCountCalibration,
      positionSpendCalibration,
      ownerSpendCalibration,
      overall,
    ),
  };
};
