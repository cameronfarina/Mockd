import { type Owner, type Position } from "../../config/league.js";
import { lineupScore, optimizeLineup } from "../lineupOptimizer.js";
import type { LineupEntry, Player } from "../types.js";
import type { AuctionEngineConfigOverrides } from "./auctionEngine.js";
import type { MockBatch, MockRosterSummary, PlayerBatchSummary } from "./mockBatch.js";

export type DraftPlanStrategyKey = "three-rb";

export interface DraftPlanStrategyDefinition {
  key: DraftPlanStrategyKey;
  label: string;
  thresholds: {
    rb1Minimum: number;
    rb2Minimum: number;
    rb3Minimum: number;
    rbCoreSpendMinimum: number;
  };
}

export interface DraftPlanPlayerMarket {
  averageMarketPrice: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
  draftedRate: number;
}

export interface DraftPlanPlayer {
  name: string;
  position: Position;
  price: number;
  weeks1To4: number;
  market?: DraftPlanPlayerMarket;
}

export interface DraftPlanLineupEntry {
  slot: LineupEntry["slot"];
  player: DraftPlanPlayer;
}

export interface DraftPlanCandidate {
  seed: string;
  scenarioKey: string;
  owner: Owner;
  strategy: DraftPlanStrategyKey;
  rosterSpend: number;
  budgetRemaining: number;
  week1Score: number;
  weeks1To4Score: number;
  rbCoreSpend: number;
  positionSpend: Record<Position, number>;
  rbCore: DraftPlanPlayer[];
  lineup: DraftPlanLineupEntry[];
  bench: DraftPlanPlayer[];
  players: DraftPlanPlayer[];
}

export interface BuildDraftPlanReportOptions {
  batch: MockBatch;
  owner: Owner;
  strategyKey: DraftPlanStrategyKey;
  limit?: number;
}

export interface DraftPlanReport {
  owner: Owner;
  strategy: DraftPlanStrategyDefinition;
  engineMode: "fast" | "full";
  runCount: number;
  matchedRunCount: number;
  candidateLimit: number;
  candidates: DraftPlanCandidate[];
}

type CsvValue = string | number | undefined;

const defaultCandidateLimit = 5;

export const draftPlanStrategies = {
  "three-rb": {
    key: "three-rb",
    label: "True 3RB",
    thresholds: {
      rb1Minimum: 55,
      rb2Minimum: 45,
      rb3Minimum: 35,
      rbCoreSpendMinimum: 145,
    },
  },
} as const satisfies Record<DraftPlanStrategyKey, DraftPlanStrategyDefinition>;

export interface DraftPlanAuctionOverridesOptions {
  owner: Owner;
  strategyKey: DraftPlanStrategyKey;
}

export const draftPlanAuctionOverridesFor = ({
  owner,
  strategyKey,
}: DraftPlanAuctionOverridesOptions): AuctionEngineConfigOverrides => {
  if (strategyKey !== "three-rb") return {};

  return {
    ownerDemandMultipliers: {
      [owner]: {
        QB: 0.55,
        RB: 1.28,
        WR: 1.08,
        TE: 0.75,
      },
    },
    ownerBehaviors: {
      [owner]: {
        priceAggression: 1.08,
        scarcityChase: 1.2,
        replacementPatience: 0.96,
        anchorAggression: 1.42,
        depthAggression: 0.92,
      },
    },
    ownerRosterMaximums: {
      [owner]: {
        QB: 1,
        RB: 5,
        WR: 7,
        TE: 2,
        K: 1,
        DST: 1,
      },
    },
    ownerPositionAnchorTargets: {
      [owner]: {
        RB: 3,
      },
    },
    ownerPositionCoreTargets: {
      [owner]: {
        RB: [60, 50, 40],
      },
    },
    ownerPositionCoreMaxBids: {
      [owner]: {
        RB: [62, 54, 44],
      },
    },
    ownerPositionSlotMaxBids: {
      [owner]: {
        RB: [62, 54, 44, 8, 4],
        WR: [24, 18, 14, 8, 5, 3, 1],
        TE: [3, 1],
        K: [2],
        DST: [2],
      },
    },
  };
};

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const sortPlayers = (players: readonly Player[]): Player[] =>
  [...players].sort(
    (left, right) =>
      right.price - left.price ||
      right.weeks1To4 - left.weeks1To4 ||
      left.name.localeCompare(right.name),
  );

const playerMarketByName = (
  players: readonly PlayerBatchSummary[],
): ReadonlyMap<string, DraftPlanPlayerMarket> =>
  new Map(players.map(player => [
    player.name,
    {
      averageMarketPrice: player.averageMarketPrice,
      averageSalePrice: player.averageSalePrice,
      minimumSalePrice: player.minimumSalePrice,
      maximumSalePrice: player.maximumSalePrice,
      draftedRate: player.draftedRate,
    },
  ]));

const draftPlanPlayerFor = (
  player: Player,
  marketByName: ReadonlyMap<string, DraftPlanPlayerMarket>,
): DraftPlanPlayer => {
  const market = marketByName.get(player.name);
  return {
    name: player.name,
    position: player.position,
    price: player.price,
    weeks1To4: player.weeks1To4,
    ...(market ? { market } : {}),
  };
};

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const playerSummary = (player: DraftPlanPlayer): string =>
  `${player.position} ${player.name} $${player.price}`;

const joinedPlayerSummaries = (players: readonly DraftPlanPlayer[]): string =>
  players.map(playerSummary).join("; ");

const playerAtPosition = (
  candidate: DraftPlanCandidate,
  position: Position,
  index: number,
): DraftPlanPlayer | undefined =>
  candidate.players.filter(player => player.position === position)[index];

const draftPlanCsvRows = (report: DraftPlanReport): CsvValue[][] =>
  report.candidates.map((candidate, index) => {
    const rb1 = candidate.rbCore[0];
    const rb2 = candidate.rbCore[1];
    const rb3 = candidate.rbCore[2];
    const wr1 = playerAtPosition(candidate, "WR", 0);
    const wr2 = playerAtPosition(candidate, "WR", 1);
    const te = playerAtPosition(candidate, "TE", 0);
    const kicker = playerAtPosition(candidate, "K", 0);
    const defense = playerAtPosition(candidate, "DST", 0);

    return [
      index + 1,
      candidate.seed,
      candidate.scenarioKey,
      candidate.owner,
      candidate.strategy,
      report.engineMode,
      candidate.rosterSpend,
      candidate.budgetRemaining,
      candidate.week1Score,
      candidate.weeks1To4Score,
      candidate.rbCoreSpend,
      rb1?.name,
      rb1?.price,
      rb2?.name,
      rb2?.price,
      rb3?.name,
      rb3?.price,
      wr1?.name,
      wr1?.price,
      wr2?.name,
      wr2?.price,
      te?.name,
      te?.price,
      kicker?.name,
      kicker?.price,
      defense?.name,
      defense?.price,
      candidate.lineup.map(entry => `${entry.slot}: ${playerSummary(entry.player)}`).join("; "),
      joinedPlayerSummaries(candidate.bench),
      joinedPlayerSummaries(candidate.players),
    ];
  });

export const draftPlanReportCsv = (report: DraftPlanReport): string =>
  [
    [
      "rank",
      "seed",
      "scenario",
      "owner",
      "strategy",
      "engine_mode",
      "roster_spend",
      "budget_remaining",
      "week1_score",
      "weeks1_to_4_score",
      "rb_core_spend",
      "rb1",
      "rb1_price",
      "rb2",
      "rb2_price",
      "rb3",
      "rb3_price",
      "wr1",
      "wr1_price",
      "wr2",
      "wr2_price",
      "te",
      "te_price",
      "k",
      "k_price",
      "dst",
      "dst_price",
      "lineup",
      "bench",
      "roster",
    ],
    ...draftPlanCsvRows(report),
  ].map(row => row.map(csvCell).join(",")).join("\n");

const qualifiesForThreeRb = (
  rbCore: readonly Player[],
  strategy: DraftPlanStrategyDefinition,
): boolean => {
  const [rb1, rb2, rb3] = rbCore;
  if (!rb1 || !rb2 || !rb3) return false;

  return rb1.price >= strategy.thresholds.rb1Minimum &&
    rb2.price >= strategy.thresholds.rb2Minimum &&
    rb3.price >= strategy.thresholds.rb3Minimum &&
    rbCore.reduce((total, player) => total + player.price, 0) >= strategy.thresholds.rbCoreSpendMinimum;
};

const buildCandidate = (
  seed: string,
  scenarioKey: string,
  roster: MockRosterSummary,
  strategy: DraftPlanStrategyDefinition,
  marketByName: ReadonlyMap<string, DraftPlanPlayerMarket>,
): DraftPlanCandidate | undefined => {
  if (!roster.valid) return undefined;

  const rbCore = sortPlayers(roster.players.filter(player => player.position === "RB")).slice(0, 3);
  if (!qualifiesForThreeRb(rbCore, strategy)) return undefined;

  const optimizedLineup = optimizeLineup({ strategy: strategy.key, players: roster.players }, "weeks1To4");
  const lineupNames = new Set(optimizedLineup.map(entry => entry.player.name));
  const players = sortPlayers(roster.players).map(player => draftPlanPlayerFor(player, marketByName));
  const draftedPlayerByName = new Map(players.map(player => [player.name, player]));
  const lineup = optimizedLineup.map(entry => ({
    slot: entry.slot,
    player: draftedPlayerByName.get(entry.player.name) ?? draftPlanPlayerFor(entry.player, marketByName),
  }));
  const bench = sortPlayers(roster.players.filter(player => !lineupNames.has(player.name)))
    .map(player => draftedPlayerByName.get(player.name) ?? draftPlanPlayerFor(player, marketByName));

  return {
    seed,
    scenarioKey,
    owner: roster.owner,
    strategy: strategy.key,
    rosterSpend: roster.spend,
    budgetRemaining: roster.budgetRemaining,
    week1Score: roundToTwo(roster.week1Score ?? 0),
    weeks1To4Score: roundToTwo(roster.weeks1To4Score ?? lineupScore(optimizedLineup, "weeks1To4")),
    rbCoreSpend: rbCore.reduce((total, player) => total + player.price, 0),
    positionSpend: roster.positionSpend,
    rbCore: rbCore.map(player => draftPlanPlayerFor(player, marketByName)),
    lineup,
    bench,
    players,
  };
};

export const buildDraftPlanReport = ({
  batch,
  owner,
  strategyKey,
  limit = defaultCandidateLimit,
}: BuildDraftPlanReportOptions): DraftPlanReport => {
  const strategy = draftPlanStrategies[strategyKey];
  const marketByName = playerMarketByName(batch.summary.players);
  const candidates = batch.runs.flatMap(run => {
    const roster = run.rosters.find(candidate => candidate.owner === owner);
    if (!roster) return [];

    try {
      const candidate = buildCandidate(
        run.seed,
        run.keeperScenario.key,
        roster,
        strategy,
        marketByName,
      );
      return candidate ? [candidate] : [];
    } catch {
      return [];
    }
  }).sort(
    (left, right) =>
      right.weeks1To4Score - left.weeks1To4Score ||
      right.rbCoreSpend - left.rbCoreSpend ||
      left.budgetRemaining - right.budgetRemaining ||
      left.seed.localeCompare(right.seed),
  );

  return {
    owner,
    strategy,
    engineMode: batch.options.diagnosticsMode === "summary" ? "fast" : "full",
    runCount: batch.runs.length,
    matchedRunCount: candidates.length,
    candidateLimit: limit,
    candidates: candidates.slice(0, limit),
  };
};
