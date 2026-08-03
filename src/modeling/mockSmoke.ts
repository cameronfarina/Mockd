import { ownerOrder, type Owner, type Position } from "../../config/league.js";
import type {
  AuctionBidDriver,
  AuctionBudgetTrajectoryRow,
  AuctionNominationDiagnostics,
  AuctionRoomPressureDiagnostics,
  AuctionSalePriceBasis,
} from "./auctionEngine.js";
import type { KeeperScenarioKey } from "./keeperInflation.js";
import type { MockBatch, MockRun } from "./mockBatch.js";

export interface MockSmokeBidDiagnostic {
  rank: number;
  owner: Owner;
  amount: number;
  uncappedAmount: number;
  maxBid: number;
  cappedByMaxBid: boolean;
  ownerDemandMultiplier: number;
  rosterNeedMultiplier: number;
  scarcityMultiplier: number;
  behaviorAggressionMultiplier: number;
  behaviorScarcityMultiplier: number;
  buildStyleMultiplier: number;
  replacementPatienceMultiplier: number;
  endgamePressureMultiplier: number;
  roomPressureMultiplier: number;
  competitionPressureMultiplier: number;
  budgetPacingMultiplier: number;
  bidVarianceMultiplier: number;
  topEndDampingMultiplier: number;
  positionOverbidDampingMultiplier: number;
  contextPenaltyDampingMultiplier: number;
  drivers: AuctionBidDriver[];
}

export interface MockSmokeSaleResolution {
  secondBidAmount: number;
  reservePrice: number;
  nominatorOpeningBid: number;
  uncappedSalePrice: number;
  topEndGuardedPrice: number;
  salePriceBasis: AuctionSalePriceBasis;
}

export interface MockSmokePick {
  pick: number;
  round: number;
  nominator: Owner;
  winner: Owner;
  player: string;
  position: Position;
  anchorPrice: number;
  salePrice: number;
  saleVsAnchor: number;
  budgetAfterPick: number;
  rosterSlotsAfterPick: number;
  nominationDiagnostics: AuctionNominationDiagnostics;
  roomPressure: AuctionRoomPressureDiagnostics;
  saleResolution: MockSmokeSaleResolution;
  bidDiagnostics: MockSmokeBidDiagnostic[];
}

export interface MockSmokeRoundSummary {
  pickCount: number;
  averageAnchorPrice: number;
  averageSalePrice: number;
  averageSaleVsAnchor: number;
}

export interface MockSmokeScenarioSummary {
  key: KeeperScenarioKey;
  runCount: number;
  invalidRosterCount: number;
  averagePickCount: number;
}

export interface MockSmokeBatchSummary {
  runCount: number;
  invalidRosterCount: number;
  scenarios: MockSmokeScenarioSummary[];
}

export interface MockSmokeReport {
  seed: string;
  scenarioKey: KeeperScenarioKey;
  roundCount: number;
  pickCount: number;
  invalidRosterCount: number;
  firstTwoRounds: MockSmokePick[];
  budgetTrajectory: AuctionBudgetTrajectoryRow[];
  firstTwoRoundSummary: MockSmokeRoundSummary;
  batch: MockSmokeBatchSummary;
  warnings: string[];
}

export interface BuildMockSmokeReportOptions {
  run: MockRun;
  batch: MockBatch;
  rounds?: number;
}

const defaultSmokeRounds = 2;
const ownerCount = ownerOrder.length;
const warningHighBudgetRemaining = 15;

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const summarizePicks = (picks: readonly MockSmokePick[]): MockSmokeRoundSummary => ({
  pickCount: picks.length,
  averageAnchorPrice: roundToTwo(average(picks.map(pick => pick.anchorPrice))),
  averageSalePrice: roundToTwo(average(picks.map(pick => pick.salePrice))),
  averageSaleVsAnchor: roundToTwo(average(picks.map(pick => pick.saleVsAnchor))),
});

const firstRoundsFor = (run: MockRun, rounds: number): MockSmokePick[] => {
  const picksToTake = ownerCount * rounds;

  return run.picks.slice(0, picksToTake).map(pick => ({
    pick: pick.pick,
    round: Math.ceil(pick.pick / ownerCount),
    nominator: pick.nominator,
    winner: pick.owner,
    player: pick.player,
    position: pick.position,
    anchorPrice: pick.marketPrice,
    salePrice: pick.price,
    saleVsAnchor: pick.price - pick.marketPrice,
    budgetAfterPick: pick.budgetAfterPick,
    rosterSlotsAfterPick: pick.rosterSlotsAfterPick,
    nominationDiagnostics: pick.nominationDiagnostics,
    roomPressure: pick.diagnostics.roomPressure,
    saleResolution: {
      secondBidAmount: pick.diagnostics.secondBidAmount,
      reservePrice: pick.diagnostics.reservePrice,
      nominatorOpeningBid: pick.diagnostics.nominatorOpeningBid,
      uncappedSalePrice: pick.diagnostics.uncappedSalePrice,
      topEndGuardedPrice: pick.diagnostics.topEndGuardedPrice,
      salePriceBasis: pick.diagnostics.salePriceBasis,
    },
    bidDiagnostics: pick.topBids.map((bid, index) => {
      const diagnostics = pick.diagnostics.topBids[index];
      return {
        rank: index + 1,
        owner: bid.owner,
        amount: bid.amount,
        uncappedAmount: bid.uncappedAmount,
        maxBid: bid.maxBid,
        cappedByMaxBid: diagnostics?.cappedByMaxBid ?? bid.amount < bid.uncappedAmount,
        ownerDemandMultiplier: bid.ownerDemandMultiplier,
        rosterNeedMultiplier: bid.rosterNeedMultiplier,
        scarcityMultiplier: bid.scarcityMultiplier,
        behaviorAggressionMultiplier: bid.behaviorAggressionMultiplier,
        behaviorScarcityMultiplier: bid.behaviorScarcityMultiplier,
        buildStyleMultiplier: bid.buildStyleMultiplier,
        replacementPatienceMultiplier: bid.replacementPatienceMultiplier,
        endgamePressureMultiplier: bid.endgamePressureMultiplier,
        roomPressureMultiplier: bid.roomPressureMultiplier,
        competitionPressureMultiplier: bid.competitionPressureMultiplier,
        budgetPacingMultiplier: bid.budgetPacingMultiplier,
        bidVarianceMultiplier: bid.bidVarianceMultiplier,
        topEndDampingMultiplier: bid.topEndDampingMultiplier,
        positionOverbidDampingMultiplier: bid.positionOverbidDampingMultiplier,
        contextPenaltyDampingMultiplier: bid.contextPenaltyDampingMultiplier,
        drivers: diagnostics?.drivers ?? [],
      };
    }),
  }));
};

const summarizeBatch = (batch: MockBatch): MockSmokeBatchSummary => ({
  runCount: batch.runs.length,
  invalidRosterCount: batch.summary.scenarios.reduce(
    (count, scenario) => count + scenario.invalidRosterCount,
    0,
  ),
  scenarios: batch.summary.scenarios.map(scenario => ({
    key: scenario.key,
    runCount: scenario.runCount,
    invalidRosterCount: scenario.invalidRosterCount,
    averagePickCount: scenario.averagePickCount,
  })),
});

const warningsFor = (
  run: MockRun,
  batch: MockSmokeBatchSummary,
  firstTwoRounds: readonly MockSmokePick[],
  expectedPickCount: number,
): string[] => {
  const warnings: string[] = [];
  const highBudgetOwners = run.rosters
    .filter(roster => roster.budgetRemaining > warningHighBudgetRemaining)
    .map(roster => `${roster.owner} $${roster.budgetRemaining}`);

  if (run.invalidRosterCount > 0) warnings.push(`${run.invalidRosterCount} invalid roster(s) in smoke run.`);
  if (batch.invalidRosterCount > 0) warnings.push(`${batch.invalidRosterCount} invalid roster(s) in smoke batch.`);
  if (firstTwoRounds.length < expectedPickCount) {
    warnings.push(`Smoke run did not produce ${expectedPickCount} early-round pick(s).`);
  }
  if (highBudgetOwners.length > 0) {
    warnings.push(`Owner budget left above $${warningHighBudgetRemaining}: ${highBudgetOwners.join(", ")}.`);
  }

  return warnings;
};

export const buildMockSmokeReport = ({
  run,
  batch,
  rounds = defaultSmokeRounds,
}: BuildMockSmokeReportOptions): MockSmokeReport => {
  const firstTwoRounds = firstRoundsFor(run, rounds);
  const batchSummary = summarizeBatch(batch);
  const expectedPickCount = ownerCount * rounds;
  const budgetTrajectory = run.budgetTrajectory.filter(row => row.pick <= firstTwoRounds.length);

  return {
    seed: run.seed,
    scenarioKey: run.keeperScenario.key,
    roundCount: rounds,
    pickCount: run.pickCount,
    invalidRosterCount: run.invalidRosterCount,
    firstTwoRounds,
    budgetTrajectory,
    firstTwoRoundSummary: summarizePicks(firstTwoRounds),
    batch: batchSummary,
    warnings: warningsFor(run, batchSummary, firstTwoRounds, expectedPickCount),
  };
};
