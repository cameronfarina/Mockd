import { ownerOrder, positions, type Owner, type Position } from "../../config/league.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
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
  mockAverageSpend: number;
  delta: number;
}

export interface OwnerSpendCalibration {
  owner: Owner;
  historicalAverageAuctionSpend: number;
  mockAverageAuctionSpend: number;
  spendDelta: number;
  historicalAverageTopTwoAuctionSpend: number;
  mockAverageTopTwoAuctionSpend: number;
  topTwoDelta: number;
}

export interface OverallCalibration {
  historicalAverageAuctionSpend: number;
  mockAverageAuctionSpend: number;
  auctionSpendDelta: number;
  historicalAverageDollarPlayers: number;
  mockAverageDollarPlayers: number;
  dollarPlayerDelta: number;
}

export interface HistoricalCalibrationAudit {
  runCount: number;
  historicalSeasons: number[];
  priceTiers: PriceTierCalibration[];
  positionSpend: PositionSpendCalibration[];
  ownerSpend: OwnerSpendCalibration[];
  overall: OverallCalibration;
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

const summarizePositionSpend = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): PositionSpendCalibration[] =>
  positions.map(position => {
    const historicalAverageSpend = roundToTwo(historicalPositionSpend(records, seasons, position));
    const mockAverageSpend = roundToTwo(mockPositionSpend(runs, position));

    return {
      position,
      historicalAverageSpend,
      mockAverageSpend,
      delta: roundToTwo(mockAverageSpend - historicalAverageSpend),
    };
  });

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

const mockOwnerAuctionSpend = (
  runs: readonly MockRun[],
  owner: Owner,
): number =>
  average(runs.map(run =>
    run.picks
      .filter(pick => pick.owner === owner)
      .reduce((total, pick) => total + pick.price, 0),
  ));

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
    const mockAverageAuctionSpend = roundToTwo(mockOwnerAuctionSpend(runs, owner));
    const historicalAverageTopTwoAuctionSpend = roundToTwo(historicalOwnerTopTwoSpend(records, seasons, owner));
    const mockAverageTopTwoAuctionSpend = roundToTwo(mockOwnerTopTwoSpend(runs, owner));

    return {
      owner,
      historicalAverageAuctionSpend,
      mockAverageAuctionSpend,
      spendDelta: roundToTwo(mockAverageAuctionSpend - historicalAverageAuctionSpend),
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
  const mockAverageAuctionSpend = roundToTwo(totalMockAuctionSpend(runs));
  const historicalAverageDollarPlayers = roundToTwo(dollarPlayersPerHistoricalSeason(records, seasons));
  const mockAverageDollarPlayers = roundToTwo(dollarPlayersPerMockRun(runs));

  return {
    historicalAverageAuctionSpend,
    mockAverageAuctionSpend,
    auctionSpendDelta: roundToTwo(mockAverageAuctionSpend - historicalAverageAuctionSpend),
    historicalAverageDollarPlayers,
    mockAverageDollarPlayers,
    dollarPlayerDelta: roundToTwo(mockAverageDollarPlayers - historicalAverageDollarPlayers),
  };
};

export const buildHistoricalCalibrationAudit = ({
  historicalRecords,
  batch,
}: BuildHistoricalCalibrationAuditOptions): HistoricalCalibrationAudit => {
  const records = openAuctionRecords(historicalRecords);
  const seasons = historicalSeasons(records);
  const runs = batch.runs;

  return {
    runCount: runs.length,
    historicalSeasons: seasons,
    priceTiers: summarizePriceTiers(records, runs, seasons),
    positionSpend: summarizePositionSpend(records, runs, seasons),
    ownerSpend: summarizeOwnerSpend(records, runs, seasons),
    overall: summarizeOverall(records, runs, seasons),
  };
};
