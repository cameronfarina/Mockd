import type { Owner, Position } from "../../config/league.js";
import { ownerOrder } from "../../config/league.js";
import { lineupScore, optimizeLineup } from "../lineupOptimizer.js";
import type { LineupEntry, Player, StarterSlot } from "../types.js";
import type { MockBatch, MockBatchSummary, MockRosterSummary, MockRun } from "./mockBatch.js";
import type { LiveDraftStrategyKey } from "./liveDraftStrategies.js";

export type MockResultsPlayerSlot = StarterSlot | "BENCH";

export interface MockResultsPlayer {
  name: string;
  position: Position;
  slot: MockResultsPlayerSlot;
  price: number;
  week1: number;
  weeks1To4: number;
  starter: boolean;
}

export interface MockResultsTeam {
  owner: Owner;
  spend: number;
  budgetRemaining: number;
  week1Score: number;
  weeks1To4Score: number;
  valid: boolean;
  errors: string[];
  starters: MockResultsPlayer[];
  bench: MockResultsPlayer[];
  players: MockResultsPlayer[];
}

export interface MockResultsRanking {
  rank: number;
  owner: Owner;
  week1Score: number;
  weeks1To4Score: number;
  projectedFinishScore: number;
}

export interface MockResultsRun {
  index: number;
  label: string;
  seed: string;
  strategyKey: LiveDraftStrategyKey;
  scenarioLabel: string;
  teams: MockResultsTeam[];
  rankings: MockResultsRanking[];
}

export interface MockResultsReport {
  mode: "batch-mock";
  options: MockBatch["options"] & {
    strategyKey: LiveDraftStrategyKey;
  };
  summary: MockBatchSummary;
  runStrategyKeys: LiveDraftStrategyKey[];
  runs: MockResultsRun[];
  cam?: MockBatchSummary["owners"][number];
  camTopExposures: MockBatchSummary["ownerPlayerExposure"];
  topPlayers: MockBatchSummary["players"];
}

const starterSlotOrder: Record<StarterSlot, number> = {
  QB: 1,
  RB1: 2,
  RB2: 3,
  WR1: 4,
  WR2: 5,
  TE: 6,
  FLEX: 7,
  K: 8,
  DST: 9,
};

const positionOrder: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  K: 5,
  DST: 6,
};

const strategyShortName = (strategyKey: LiveDraftStrategyKey): string => {
  if (strategyKey === "three-rb") return "3rb";
  if (strategyKey === "hero-rb") return "hero rb";
  if (strategyKey === "wr-heavy") return "wr heavy";
  return "balanced";
};

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const playerResultFor = (
  player: Player,
  slot: MockResultsPlayerSlot,
  starter: boolean,
): MockResultsPlayer => ({
  name: player.name,
  position: player.position,
  slot,
  price: player.price,
  week1: roundToTwo(player.week1),
  weeks1To4: roundToTwo(player.weeks1To4),
  starter,
});

const optimizedWeekOneLineup = (roster: MockRosterSummary): LineupEntry[] =>
  optimizeLineup({ strategy: "mock-results", players: roster.players }, "week1")
    .sort((left, right) => starterSlotOrder[left.slot] - starterSlotOrder[right.slot]);

const benchPlayersFor = (
  roster: MockRosterSummary,
  starters: readonly LineupEntry[],
): MockResultsPlayer[] => {
  const starterNames = new Set(starters.map(entry => entry.player.name));
  return roster.players
    .filter(player => !starterNames.has(player.name))
    .sort(
      (left, right) =>
        positionOrder[left.position] - positionOrder[right.position] ||
        right.week1 - left.week1 ||
        right.price - left.price ||
        left.name.localeCompare(right.name),
    )
    .map(player => playerResultFor(player, "BENCH", false));
};

const teamResultFor = (roster: MockRosterSummary): MockResultsTeam => {
  const starters = optimizedWeekOneLineup(roster);
  const starterPlayers = starters.map(entry => playerResultFor(entry.player, entry.slot, true));
  const bench = benchPlayersFor(roster, starters);

  return {
    owner: roster.owner,
    spend: roster.spend,
    budgetRemaining: roster.budgetRemaining,
    week1Score: roundToTwo(lineupScore(starters, "week1")),
    weeks1To4Score: roundToTwo(roster.weeks1To4Score ?? 0),
    valid: roster.valid,
    errors: roster.errors,
    starters: starterPlayers,
    bench,
    players: [...starterPlayers, ...bench],
  };
};

const rankingsFor = (teams: readonly MockResultsTeam[]): MockResultsRanking[] =>
  [...teams]
    .sort(
      (left, right) =>
        right.weeks1To4Score - left.weeks1To4Score ||
        right.week1Score - left.week1Score ||
        left.owner.localeCompare(right.owner),
    )
    .map((team, index) => ({
      rank: index + 1,
      owner: team.owner,
      week1Score: team.week1Score,
      weeks1To4Score: team.weeks1To4Score,
      projectedFinishScore: team.weeks1To4Score,
    }));

const runResultFor = (
  run: MockRun,
  index: number,
  strategyKey: LiveDraftStrategyKey,
): MockResultsRun => {
  const teams = ownerOrder.map(owner => {
    const roster = run.rosters.find(candidate => candidate.owner === owner);
    if (!roster) throw new Error(`Missing ${owner} roster for mock result run ${index + 1}.`);
    return teamResultFor(roster);
  });

  return {
    index: index + 1,
    label: `Run ${index + 1}: ${strategyShortName(strategyKey)}`,
    seed: run.seed,
    strategyKey,
    scenarioLabel: run.keeperScenario.label,
    teams,
    rankings: rankingsFor(teams),
  };
};

export const buildMockResultsReport = (
  batch: MockBatch,
  strategyKey: LiveDraftStrategyKey,
  runStrategyKeys: readonly LiveDraftStrategyKey[] = [],
): MockResultsReport => {
  const cam = batch.summary.owners.find(owner => owner.owner === "Cam");
  const resolvedRunStrategyKeys = batch.runs.map((_run, index) => runStrategyKeys[index] ?? strategyKey);

  return {
    mode: "batch-mock",
    options: {
      ...batch.options,
      strategyKey,
    },
    summary: batch.summary,
    runStrategyKeys: resolvedRunStrategyKeys,
    runs: batch.runs.map((run, index) => runResultFor(run, index, resolvedRunStrategyKeys[index] ?? strategyKey)),
    ...(cam === undefined ? {} : { cam }),
    camTopExposures: batch.summary.ownerPlayerExposure
      .filter(exposure => exposure.owner === "Cam")
      .slice(0, 12),
    topPlayers: batch.summary.players.slice(0, 12),
  };
};
