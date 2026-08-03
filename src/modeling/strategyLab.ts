import type { KeeperDeclaration } from "../../config/keepers.js";
import { leagueConfig, type Position } from "../../config/league.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../projections.js";
import {
  buildKeeperScenarios,
  type KeeperScenario,
  type KeeperScenarioKey,
} from "./keeperInflation.js";
import {
  buildMockResultsReport,
  type MockResultsPlayer,
  type MockResultsRun,
} from "./mockResults.js";
import {
  runMockBatchProgressively,
  type ForcedAuctionSale,
} from "./mockBatch.js";
import { strategyAuctionOverridesFor } from "./interactiveMockDraft.js";
import type { PricingConfig } from "./basePricing.js";
import type { LiveDraftStrategyKey } from "./liveDraftStrategies.js";

type ForcedStartSource = "keeper" | "forced-sale";

export interface StrategyLabScenario {
  key: string;
  label: string;
  question: string;
  strategyKey: LiveDraftStrategyKey;
  forcedSales: readonly ForcedAuctionSale[];
  notes?: string;
}

export interface StrategyLabForcedStartPlayer {
  player: string;
  position: Position;
  price: number;
  source: ForcedStartSource;
}

export interface StrategyLabForcedStart {
  spend: number;
  budgetRemaining: number;
  slotsRemaining: number;
  maxBid: number;
  players: StrategyLabForcedStartPlayer[];
}

export interface StrategyLabSampleBuild {
  label: string;
  seed: string;
  camRank: number;
  camWeek1Score: number;
  camSeasonStrengthScore: number;
  camSpend: number;
  camBudgetRemaining: number;
  camBenchWeek1Score: number;
  camStarterFloorWeek1Score: number;
  camDollarPlayers: number;
  thinnessScore: number;
  corePlayers: string[];
  camPlayers: MockResultsPlayer[];
}

export interface StrategyLabScenarioResult {
  key: string;
  label: string;
  question: string;
  strategyKey: LiveDraftStrategyKey;
  forcedSales: ForcedAuctionSale[];
  notes?: string;
  camForcedStart: StrategyLabForcedStart;
  runCount: number;
  averageCamRank: number;
  bestCamRank: number;
  worstCamRank: number;
  averageCamWeek1Score: number;
  averageCamSeasonStrengthScore: number;
  averageCamSpend: number;
  averageCamBudgetRemaining: number;
  averageCamBenchWeek1Score: number;
  averageCamStarterFloorWeek1Score: number;
  averageCamDollarPlayers: number;
  averageThinnessScore: number;
  sampleBuilds: StrategyLabSampleBuild[];
}

export interface StrategyLabLeaderboardEntry {
  key: string;
  label: string;
  averageCamRank: number;
  bestCamRank: number;
  worstCamRank: number;
  averageCamWeek1Score: number;
  averageCamSeasonStrengthScore: number;
  averageThinnessScore: number;
}

export interface StrategyLabReport {
  mode: "strategy-lab";
  options: {
    scenarioKey: KeeperScenarioKey;
    runsPerScenario: number;
    seedPrefix: string;
  };
  leaderboard: StrategyLabLeaderboardEntry[];
  scenarios: StrategyLabScenarioResult[];
}

export interface RunStrategyLabOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers: readonly KeeperDeclaration[];
  scenarios?: readonly StrategyLabScenario[];
  scenarioKey?: KeeperScenarioKey;
  runsPerScenario?: number;
  seedPrefix?: string;
  pricingConfig?: PricingConfig;
}

const defaultScenarioKey: KeeperScenarioKey = "expected";
const defaultRunsPerScenario = 25;
const defaultSeedPrefix = "strategy-lab";
const minimumBid = 1;
const sampleBuildLimit = 3;

export const defaultStrategyLabScenarios: readonly StrategyLabScenario[] = [
  {
    key: "puka-75",
    label: "Puka $75",
    question: "If Cam keeps Achane and buys Puka Nacua for $75, what does the rest of the room leave us?",
    strategyKey: "wr-heavy",
    forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 75 }],
  },
  {
    key: "puka-80",
    label: "Puka $80",
    question: "If Cam keeps Achane and has to pay $80 for Puka, how thin does the build get?",
    strategyKey: "wr-heavy",
    forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 80 }],
  },
  {
    key: "chase-70",
    label: "Chase $70",
    question: "If Cam keeps Achane and buys Ja'Marr Chase for $70, does the discount beat the Puka builds?",
    strategyKey: "wr-heavy",
    forcedSales: [{ owner: "Cam", player: "Ja'Marr Chase", price: 70 }],
  },
  {
    key: "puka-75-walker",
    label: "Puka $75 + Walker $36",
    question: "If Cam pairs Puka with Achane and Kenneth Walker, can the value WR room hold up?",
    strategyKey: "three-rb",
    forcedSales: [
      { owner: "Cam", player: "Puka Nacua", price: 75 },
      { owner: "Cam", player: "Kenneth Walker III", price: 36 },
    ],
  },
  {
    key: "value-wr-cook",
    label: "DeVonta + Ladd + Cook",
    question: "If Cam skips the elite WR spend and builds around value WRs plus James Cook, what is the upside?",
    strategyKey: "hero-rb",
    forcedSales: [
      { owner: "Cam", player: "DeVonta Smith", price: 32 },
      { owner: "Cam", player: "Ladd McConkey", price: 22 },
      { owner: "Cam", player: "James Cook III", price: 50 },
    ],
  },
  {
    key: "value-wr-walker",
    label: "DeVonta + Ladd + Walker",
    question: "If Cam keeps spend lighter at RB2 with Kenneth Walker, does the room create better balance?",
    strategyKey: "hero-rb",
    forcedSales: [
      { owner: "Cam", player: "DeVonta Smith", price: 32 },
      { owner: "Cam", player: "Ladd McConkey", price: 22 },
      { owner: "Cam", player: "Kenneth Walker III", price: 36 },
    ],
  },
  {
    key: "rb-stack-cook-walker",
    label: "Cook + Walker",
    question: "If Cam starts Achane plus Cook and Walker, how hard does the WR room have to hit?",
    strategyKey: "three-rb",
    forcedSales: [
      { owner: "Cam", player: "James Cook III", price: 50 },
      { owner: "Cam", player: "Kenneth Walker III", price: 35 },
    ],
  },
];

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const moneyText = (value: number): string =>
  `$${Math.round(value)}`;

const scenarioByKey = (
  scenarioKey: KeeperScenarioKey,
  scenarios: readonly KeeperScenario[],
): KeeperScenario => {
  const scenario = scenarios.find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);
  return scenario;
};

const projectionPositionFor = (
  projections: readonly ProjectionRecord[],
  playerName: string,
): Position => {
  const normalizedName = normalizePlayerName(playerName);
  const projection = projections.find(candidate => normalizePlayerName(candidate.name) === normalizedName);
  if (!projection) throw new Error(`Unable to find projection for strategy-lab player "${playerName}".`);
  return projection.position;
};

const forcedStartFor = ({
  keepers,
  projections,
  scenarioKey,
  forcedSales,
}: {
  keepers: readonly KeeperDeclaration[];
  projections: readonly ProjectionRecord[];
  scenarioKey: KeeperScenarioKey;
  forcedSales: readonly ForcedAuctionSale[];
}): StrategyLabForcedStart => {
  const keeperScenario = scenarioByKey(scenarioKey, buildKeeperScenarios(keepers));
  const keeperPlayers = keepers
    .filter(keeper =>
      keeper.owner === "Cam" &&
      keeperScenario.includedKeeperStatuses.includes(keeper.status),
    )
    .map(keeper => ({
      player: keeper.player,
      position: keeper.position,
      price: keeper.newCost,
      source: "keeper" as const,
    }));
  const forcedPlayers = forcedSales.map(sale => ({
    player: sale.player,
    position: projectionPositionFor(projections, sale.player),
    price: sale.price,
    source: "forced-sale" as const,
  }));
  const players = [...keeperPlayers, ...forcedPlayers];
  const spend = players.reduce((total, player) => total + player.price, 0);
  const slotsRemaining = Math.max(0, leagueConfig.rosterSize - players.length);
  const budgetRemaining = leagueConfig.auctionBudget - spend;
  const maxBid = slotsRemaining === 0
    ? 0
    : Math.max(0, budgetRemaining - Math.max(0, slotsRemaining - 1) * minimumBid);

  return {
    spend,
    budgetRemaining,
    slotsRemaining,
    maxBid,
    players,
  };
};

const benchWeek1ScoreFor = (run: MockResultsRun): number => {
  const cam = run.teams.find(team => team.owner === "Cam");
  if (!cam) throw new Error(`Missing Cam team for ${run.label}.`);

  return roundToTwo(
    cam.bench
      .filter(player => player.position !== "K" && player.position !== "DST")
      .sort(
        (left, right) =>
          right.week1 - left.week1 ||
          right.weeks1To4 - left.weeks1To4 ||
          left.name.localeCompare(right.name),
      )
      .slice(0, 3)
      .reduce((total, player) => total + player.week1, 0),
  );
};

const starterFloorWeek1ScoreFor = (run: MockResultsRun): number => {
  const cam = run.teams.find(team => team.owner === "Cam");
  if (!cam) throw new Error(`Missing Cam team for ${run.label}.`);

  return roundToTwo(Math.min(...cam.starters.map(player => player.week1)));
};

const dollarPlayerCountFor = (run: MockResultsRun): number => {
  const cam = run.teams.find(team => team.owner === "Cam");
  if (!cam) throw new Error(`Missing Cam team for ${run.label}.`);

  return cam.players.filter(player => player.price <= 2).length;
};

const thinnessScoreFor = (run: MockResultsRun): number => {
  const benchWeek1Score = benchWeek1ScoreFor(run);
  const starterFloorWeek1Score = starterFloorWeek1ScoreFor(run);
  const dollarPlayers = dollarPlayerCountFor(run);
  const lowBenchPenalty = Math.max(0, 18 - benchWeek1Score) * 1.5;
  const lowStarterPenalty = Math.max(0, 8.5 - starterFloorWeek1Score) * 4;

  return roundToTwo(lowBenchPenalty + lowStarterPenalty + dollarPlayers * 1.25);
};

const sampleBuildFor = (run: MockResultsRun): StrategyLabSampleBuild => {
  const cam = run.teams.find(team => team.owner === "Cam");
  if (!cam) throw new Error(`Missing Cam team for ${run.label}.`);

  return {
    label: run.label,
    seed: run.seed,
    camRank: run.camOutcome.rank,
    camWeek1Score: run.camOutcome.week1Score,
    camSeasonStrengthScore: run.camOutcome.seasonStrengthScore,
    camSpend: run.camOutcome.spend,
    camBudgetRemaining: run.camOutcome.budgetRemaining,
    camBenchWeek1Score: benchWeek1ScoreFor(run),
    camStarterFloorWeek1Score: starterFloorWeek1ScoreFor(run),
    camDollarPlayers: dollarPlayerCountFor(run),
    thinnessScore: thinnessScoreFor(run),
    corePlayers: run.camOutcome.corePlayers,
    camPlayers: cam.players,
  };
};

const scenarioResultFor = (
  scenario: StrategyLabScenario,
  mockRuns: readonly MockResultsRun[],
  camForcedStart: StrategyLabForcedStart,
): StrategyLabScenarioResult => {
  const camRanks = mockRuns.map(run => run.camOutcome.rank);
  const samples = mockRuns
    .map(sampleBuildFor)
    .sort(
      (left, right) =>
        left.camRank - right.camRank ||
        right.camSeasonStrengthScore - left.camSeasonStrengthScore ||
        left.thinnessScore - right.thinnessScore ||
        left.seed.localeCompare(right.seed),
    );

  return {
    key: scenario.key,
    label: scenario.label,
    question: scenario.question,
    strategyKey: scenario.strategyKey,
    forcedSales: [...scenario.forcedSales],
    ...(scenario.notes === undefined ? {} : { notes: scenario.notes }),
    camForcedStart,
    runCount: mockRuns.length,
    averageCamRank: roundToTwo(average(camRanks)),
    bestCamRank: Math.min(...camRanks),
    worstCamRank: Math.max(...camRanks),
    averageCamWeek1Score: roundToTwo(average(mockRuns.map(run => run.camOutcome.week1Score))),
    averageCamSeasonStrengthScore: roundToTwo(average(mockRuns.map(run => run.camOutcome.seasonStrengthScore))),
    averageCamSpend: roundToTwo(average(mockRuns.map(run => run.camOutcome.spend))),
    averageCamBudgetRemaining: roundToTwo(average(mockRuns.map(run => run.camOutcome.budgetRemaining))),
    averageCamBenchWeek1Score: roundToTwo(average(mockRuns.map(benchWeek1ScoreFor))),
    averageCamStarterFloorWeek1Score: roundToTwo(average(mockRuns.map(starterFloorWeek1ScoreFor))),
    averageCamDollarPlayers: roundToTwo(average(mockRuns.map(dollarPlayerCountFor))),
    averageThinnessScore: roundToTwo(average(mockRuns.map(thinnessScoreFor))),
    sampleBuilds: samples.slice(0, sampleBuildLimit),
  };
};

const leaderboardFor = (
  scenarios: readonly StrategyLabScenarioResult[],
): StrategyLabLeaderboardEntry[] =>
  scenarios
    .map(scenario => ({
      key: scenario.key,
      label: scenario.label,
      averageCamRank: scenario.averageCamRank,
      bestCamRank: scenario.bestCamRank,
      worstCamRank: scenario.worstCamRank,
      averageCamWeek1Score: scenario.averageCamWeek1Score,
      averageCamSeasonStrengthScore: scenario.averageCamSeasonStrengthScore,
      averageThinnessScore: scenario.averageThinnessScore,
    }))
    .sort(
      (left, right) =>
        left.averageCamRank - right.averageCamRank ||
        right.averageCamSeasonStrengthScore - left.averageCamSeasonStrengthScore ||
        left.averageThinnessScore - right.averageThinnessScore ||
        left.label.localeCompare(right.label),
    );

export const runStrategyLab = async ({
  projections,
  historicalRecords,
  keepers,
  scenarios = defaultStrategyLabScenarios,
  scenarioKey = defaultScenarioKey,
  runsPerScenario = defaultRunsPerScenario,
  seedPrefix = defaultSeedPrefix,
  pricingConfig,
}: RunStrategyLabOptions): Promise<StrategyLabReport> => {
  const scenarioResults: StrategyLabScenarioResult[] = [];

  for (const strategyScenario of scenarios) {
    const batch = await runMockBatchProgressively({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: [scenarioKey],
      runsPerScenario,
      seedPrefix: `${seedPrefix}:${strategyScenario.key}`,
      ...(pricingConfig === undefined ? {} : { pricingConfig }),
      diagnosticsMode: "summary",
      forcedSales: strategyScenario.forcedSales,
      auctionConfigOverridesForRun: context =>
        strategyAuctionOverridesFor("Cam", strategyScenario.strategyKey, { variantSeed: context.seed }),
    });
    const mockResults = buildMockResultsReport(
      batch,
      strategyScenario.strategyKey,
      batch.runs.map(() => strategyScenario.strategyKey),
    );
    const camForcedStart = forcedStartFor({
      keepers,
      projections,
      scenarioKey,
      forcedSales: strategyScenario.forcedSales,
    });

    scenarioResults.push(scenarioResultFor(strategyScenario, mockResults.runs, camForcedStart));
  }

  return {
    mode: "strategy-lab",
    options: {
      scenarioKey,
      runsPerScenario,
      seedPrefix,
    },
    leaderboard: leaderboardFor(scenarioResults),
    scenarios: scenarioResults,
  };
};

const forcedStartMarkdown = (forcedStart: StrategyLabForcedStart): string =>
  forcedStart.players
    .map(player => `${player.player} ${moneyText(player.price)} (${player.source})`)
    .join(" | ");

const sampleMarkdown = (sample: StrategyLabSampleBuild): string =>
  [
    `Best sample ${sample.label}`,
    `Cam rank ${sample.camRank}, Week 1 ${sample.camWeek1Score.toFixed(1)}, season strength ${sample.camSeasonStrengthScore.toFixed(1)}, thinness ${sample.thinnessScore.toFixed(1)}`,
    `Core: ${sample.corePlayers.join(" | ")}`,
  ].join(" - ");

const playerMarkdown = (player: MockResultsPlayer): string =>
  `${player.slot} ${player.name} ${moneyText(player.price)} (${player.week1.toFixed(1)} W1)`;

const benchPlayerMarkdown = (player: MockResultsPlayer): string =>
  `${player.position} ${player.name} ${moneyText(player.price)} (${player.week1.toFixed(1)} W1)`;

const sampleStartersMarkdown = (sample: StrategyLabSampleBuild): string =>
  sample.camPlayers
    .filter(player => player.starter)
    .map(playerMarkdown)
    .join(" | ");

const sampleBenchMarkdown = (sample: StrategyLabSampleBuild): string =>
  sample.camPlayers
    .filter(player => !player.starter)
    .slice(0, 7)
    .map(benchPlayerMarkdown)
    .join(" | ");

export const strategyLabReportMarkdown = (report: StrategyLabReport): string => {
  const lines = [
    "# Cam Strategy Lab",
    "",
    `Runs per scenario: ${report.options.runsPerScenario}`,
    "",
    "## Leaderboard",
    "| Scenario | Avg rank | Best | Worst | Week 1 | Season strength | Thinness |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.leaderboard.map(row =>
      `| ${row.label} | ${row.averageCamRank.toFixed(2)} | ${row.bestCamRank} | ${row.worstCamRank} | ${row.averageCamWeek1Score.toFixed(1)} | ${row.averageCamSeasonStrengthScore.toFixed(1)} | ${row.averageThinnessScore.toFixed(1)} |`,
    ),
  ];

  for (const scenario of report.scenarios) {
    const bestSample = scenario.sampleBuilds[0];
    lines.push(
      "",
      `## ${scenario.label}`,
      scenario.question,
      `Strategy lens: ${scenario.strategyKey}`,
      `Forced start: ${forcedStartMarkdown(scenario.camForcedStart)}`,
      `Budget after forced start: ${moneyText(scenario.camForcedStart.budgetRemaining)}, max bid ${moneyText(scenario.camForcedStart.maxBid)}, slots left ${scenario.camForcedStart.slotsRemaining}`,
      `Average: rank ${scenario.averageCamRank.toFixed(2)}, Week 1 ${scenario.averageCamWeek1Score.toFixed(1)}, season strength ${scenario.averageCamSeasonStrengthScore.toFixed(1)}, bench W1 ${scenario.averageCamBenchWeek1Score.toFixed(1)}, dollar players ${scenario.averageCamDollarPlayers.toFixed(1)}`,
      bestSample ? sampleMarkdown(bestSample) : "Best sample unavailable.",
      bestSample ? `Starters: ${sampleStartersMarkdown(bestSample)}` : "Starters unavailable.",
      bestSample ? `Bench: ${sampleBenchMarkdown(bestSample)}` : "Bench unavailable.",
    );
  }

  return lines.join("\n");
};
