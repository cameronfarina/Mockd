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
  projectedRank?: number;
  projectedFinishLabel?: string;
  rankExplanation?: string;
  topStarter?: MockResultsPlayer;
  bestValue?: MockResultsPlayer;
  corePlayers?: MockResultsPlayer[];
  strengths?: string[];
  risks?: string[];
}

export interface MockResultsRanking {
  rank: number;
  owner: Owner;
  week1Score: number;
  weeks1To4Score: number;
  projectedFinishScore: number;
  projectedFinishLabel: string;
  explanation: string;
  strengths: string[];
  risks: string[];
}

export interface MockResultsBuildSummary {
  owner: Owner;
  rank: number;
  headline: string;
  week1Score: number;
  weeks1To4Score: number;
  spend: number;
  budgetRemaining: number;
  corePlayers: string[];
}

export interface MockResultsCamOutcome extends MockResultsBuildSummary {
  week1Rank: number;
  strengths: string[];
  risks: string[];
}

export interface MockResultsRun {
  index: number;
  label: string;
  seed: string;
  strategyKey: LiveDraftStrategyKey;
  scenarioLabel: string;
  teams: MockResultsTeam[];
  rankings: MockResultsRanking[];
  bestBuild: MockResultsBuildSummary;
  worstBuild: MockResultsBuildSummary;
  camOutcome: MockResultsCamOutcome;
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

const ordinal = (rank: number): string => {
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
};

const scoreText = (value: number): string =>
  roundToTwo(value).toFixed(1);

const moneyText = (value: number): string =>
  `$${Math.round(value)}`;

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

const topStarterFor = (team: MockResultsTeam): MockResultsPlayer | undefined =>
  [...team.starters].sort(
    (left, right) =>
      right.week1 - left.week1 ||
      right.weeks1To4 - left.weeks1To4 ||
      right.price - left.price ||
      left.name.localeCompare(right.name),
  )[0];

const bestValueFor = (team: MockResultsTeam): MockResultsPlayer | undefined =>
  [...team.players].sort(
    (left, right) =>
      (right.week1 / Math.max(1, right.price)) - (left.week1 / Math.max(1, left.price)) ||
      right.week1 - left.week1 ||
      left.name.localeCompare(right.name),
  )[0];

const corePlayersFor = (team: MockResultsTeam): MockResultsPlayer[] =>
  [...team.starters]
    .sort(
      (left, right) =>
        right.week1 - left.week1 ||
        right.weeks1To4 - left.weeks1To4 ||
        right.price - left.price ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 3);

const baseRankingTeams = (teams: readonly MockResultsTeam[]): MockResultsTeam[] =>
  [...teams]
    .sort(
      (left, right) =>
        right.weeks1To4Score - left.weeks1To4Score ||
        right.week1Score - left.week1Score ||
        left.owner.localeCompare(right.owner),
    );

const weekOneRankByOwner = (teams: readonly MockResultsTeam[]): Map<Owner, number> =>
  new Map([...teams]
    .sort(
      (left, right) =>
        right.week1Score - left.week1Score ||
        right.weeks1To4Score - left.weeks1To4Score ||
        left.owner.localeCompare(right.owner),
    )
    .map((team, index) => [team.owner, index + 1]));

const strengthNotesFor = (
  team: MockResultsTeam,
  week1Rank: number,
): string[] => {
  const topStarter = topStarterFor(team);
  const bestValue = bestValueFor(team);
  const notes = [
    `Week 1 rank ${ordinal(week1Rank)}`,
  ];

  if (topStarter) notes.push(`Top starter ${topStarter.name} at ${scoreText(topStarter.week1)} W1`);
  if (bestValue) notes.push(`Best value ${bestValue.name} at ${moneyText(bestValue.price)}`);
  return notes;
};

const riskNotesFor = (
  team: MockResultsTeam,
  rank: number,
  leaderScore: number,
): string[] => {
  const risks: string[] = [];
  const leaderGap = roundToTwo(leaderScore - team.weeks1To4Score);
  if (rank > 7) risks.push(`Needs ${scoreText(leaderGap)} points of upside to catch the lead`);
  if (team.budgetRemaining <= 1) risks.push("No budget cushion after the draft");
  if (!team.valid) risks.push(team.errors[0] ?? "Roster validation warning");
  return risks.length ? risks : ["No major roster-shape warning in this run"];
};

const rankingsFor = (teams: readonly MockResultsTeam[]): MockResultsRanking[] => {
  const rankedTeams = baseRankingTeams(teams);
  const week1Ranks = weekOneRankByOwner(teams);
  const leader = rankedTeams[0];
  const leaderScore = leader?.weeks1To4Score ?? 0;
  const runnerUp = rankedTeams[1];

  return rankedTeams.map((team, index) => {
    const rank = index + 1;
    const week1Rank = week1Ranks.get(team.owner) ?? rank;
    const gapToLeader = roundToTwo(leaderScore - team.weeks1To4Score);
    const margin = rank === 1 && runnerUp
      ? roundToTwo(team.weeks1To4Score - runnerUp.weeks1To4Score)
      : gapToLeader;
    const explanation = rank === 1
      ? `Projected 1st by Weeks 1-4 score, ${scoreText(margin)} ahead of the field; Week 1 rank ${ordinal(week1Rank)}.`
      : `Projected ${ordinal(rank)} by Weeks 1-4 score, ${scoreText(gapToLeader)} behind the leader; Week 1 rank ${ordinal(week1Rank)}.`;

    return {
      rank: index + 1,
      owner: team.owner,
      week1Score: team.week1Score,
      weeks1To4Score: team.weeks1To4Score,
      projectedFinishScore: team.weeks1To4Score,
      projectedFinishLabel: ordinal(rank),
      explanation,
      strengths: strengthNotesFor(team, week1Rank),
      risks: riskNotesFor(team, rank, leaderScore),
    };
  });
};

const applyTeamIntelligence = (
  teams: readonly MockResultsTeam[],
  rankings: readonly MockResultsRanking[],
): MockResultsTeam[] => {
  const rankingByOwner = new Map(rankings.map(ranking => [ranking.owner, ranking]));

  return teams.map(team => {
    const ranking = rankingByOwner.get(team.owner);
    if (!ranking) throw new Error(`Missing ranking for ${team.owner}.`);
    const topStarter = topStarterFor(team);
    const bestValue = bestValueFor(team);
    return {
      ...team,
      projectedRank: ranking.rank,
      projectedFinishLabel: ranking.projectedFinishLabel,
      rankExplanation: ranking.explanation,
      ...(topStarter === undefined ? {} : { topStarter }),
      ...(bestValue === undefined ? {} : { bestValue }),
      corePlayers: corePlayersFor(team),
      strengths: ranking.strengths,
      risks: ranking.risks,
    };
  });
};

const buildSummaryFor = (
  team: MockResultsTeam,
  ranking: MockResultsRanking,
): MockResultsBuildSummary => ({
  owner: team.owner,
  rank: ranking.rank,
  headline: `${team.owner} projected ${ranking.projectedFinishLabel} with ${scoreText(team.weeks1To4Score)} Weeks 1-4 points`,
  week1Score: team.week1Score,
  weeks1To4Score: team.weeks1To4Score,
  spend: team.spend,
  budgetRemaining: team.budgetRemaining,
  corePlayers: (team.corePlayers ?? corePlayersFor(team)).map(player => player.name),
});

const camOutcomeFor = (
  teams: readonly MockResultsTeam[],
  rankings: readonly MockResultsRanking[],
): MockResultsCamOutcome => {
  const camTeam = teams.find(team => team.owner === "Cam");
  const camRanking = rankings.find(ranking => ranking.owner === "Cam");
  if (!camTeam || !camRanking) throw new Error("Missing Cam mock result.");

  return {
    ...buildSummaryFor(camTeam, camRanking),
    week1Rank: weekOneRankByOwner(teams).get("Cam") ?? camRanking.rank,
    strengths: camRanking.strengths,
    risks: camRanking.risks,
  };
};

const runResultFor = (
  run: MockRun,
  index: number,
  strategyKey: LiveDraftStrategyKey,
): MockResultsRun => {
  const baseTeams = ownerOrder.map(owner => {
    const roster = run.rosters.find(candidate => candidate.owner === owner);
    if (!roster) throw new Error(`Missing ${owner} roster for mock result run ${index + 1}.`);
    return teamResultFor(roster);
  });
  const rankings = rankingsFor(baseTeams);
  const teams = applyTeamIntelligence(baseTeams, rankings);
  const enrichedRankings = rankingsFor(teams);
  const bestRanking = enrichedRankings[0];
  const worstRanking = enrichedRankings[enrichedRankings.length - 1];
  if (!bestRanking || !worstRanking) throw new Error(`Missing rankings for mock result run ${index + 1}.`);
  const bestTeam = teams.find(team => team.owner === bestRanking.owner);
  const worstTeam = teams.find(team => team.owner === worstRanking.owner);
  if (!bestTeam || !worstTeam) throw new Error(`Missing ranked team for mock result run ${index + 1}.`);

  return {
    index: index + 1,
    label: `Run ${index + 1}: ${strategyShortName(strategyKey)}`,
    seed: run.seed,
    strategyKey,
    scenarioLabel: run.keeperScenario.label,
    teams,
    rankings: enrichedRankings,
    bestBuild: buildSummaryFor(bestTeam, bestRanking),
    worstBuild: buildSummaryFor(worstTeam, worstRanking),
    camOutcome: camOutcomeFor(teams, enrichedRankings),
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
