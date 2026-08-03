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

export interface DraftPlanPriceBand {
  slot: string;
  position: Position;
  minimumPrice: number;
  maximumPrice: number;
  note: string;
}

export interface DraftPlanTargetCluster {
  label: string;
  position: Position;
  targetNames: string[];
  priceBand: string;
  note: string;
}

export interface DraftPlanPivotRule {
  label: string;
  trigger: string;
  action: string;
}

export interface DraftPlanRecommendations {
  maxPriceBands: DraftPlanPriceBand[];
  targetClusters: DraftPlanTargetCluster[];
  pivotRules: DraftPlanPivotRule[];
  deadZoneWarnings: string[];
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
  recommendations: DraftPlanRecommendations;
  candidates: DraftPlanCandidate[];
}

type CsvValue = string | number | undefined;

const defaultCandidateLimit = 5;
const hashDivisor = 0x100000000;

export const threeRbPathRules = {
  rbCoreBudget: {
    targetCount: 3,
    minimumSpend: 130,
    hardBudget: 158,
    minimumFutureCorePrice: 14,
  },
  priceBands: [
    {
      slot: "RB1",
      position: "RB",
      minimumPrice: 50,
      maximumPrice: 76,
      note: "Anchor RB lane; can flex up when the board makes it worth it.",
    },
    {
      slot: "RB2",
      position: "RB",
      minimumPrice: 35,
      maximumPrice: 76,
      note: "Second core RB lane, balanced against total RB spend.",
    },
    {
      slot: "RB3",
      position: "RB",
      minimumPrice: 12,
      maximumPrice: 48,
      note: "Third playable RB lane; price flexes down after expensive anchors.",
    },
    {
      slot: "WR1",
      position: "WR",
      minimumPrice: 12,
      maximumPrice: 26,
      note: "Paid WR value starter.",
    },
    {
      slot: "WR2",
      position: "WR",
      minimumPrice: 8,
      maximumPrice: 20,
      note: "Second WR value starter.",
    },
    {
      slot: "TE",
      position: "TE",
      minimumPrice: 1,
      maximumPrice: 4,
      note: "Cheap TE lane.",
    },
  ],
  slotMaxBids: {
    RB: [76, 76, 76, 8, 4],
    WR: [26, 20, 16, 8, 5, 3, 1],
    TE: [4, 1],
    K: [2],
    DST: [2],
  },
  pivotRules: [
    {
      label: "RB budget envelope",
      trigger: "The first two RBs use most of the RB core budget.",
      action: "Let the third RB flex down and protect paid WR value instead of forcing another premium RB.",
    },
    {
      label: "Third RB chase",
      trigger: "The third RB would push the core above the hard RB budget.",
      action: "Pass unless the player is a clear projection value and the WR plan is already intact.",
    },
    {
      label: "WR pocket closes",
      trigger: "WR starters are clearing above the value pocket.",
      action: "Preserve the RB core and force TE/K/DST into the $1-$3 lane.",
    },
  ],
} as const satisfies {
  rbCoreBudget: {
    targetCount: number;
    minimumSpend: number;
    hardBudget: number;
    minimumFutureCorePrice: number;
  };
  priceBands: readonly DraftPlanPriceBand[];
  slotMaxBids: Partial<Record<Position, readonly number[]>>;
  pivotRules: readonly DraftPlanPivotRule[];
};

interface ThreeRbAuctionVariant {
  rbCoreBudget: {
    hardBudget: number;
    minimumFutureCorePrice: number;
  };
  rbSlotMaxBids: readonly number[];
  rbDemandMultiplier: number;
  priceAggression: number;
  scarcityChase: number;
  replacementPatience: number;
  anchorAggression: number;
  depthAggression: number;
}

const threeRbAuctionVariants: readonly ThreeRbAuctionVariant[] = [
  {
    rbCoreBudget: {
      hardBudget: 158,
      minimumFutureCorePrice: 14,
    },
    rbSlotMaxBids: [76, 76, 76, 8, 4],
    rbDemandMultiplier: 1.26,
    priceAggression: 1.07,
    scarcityChase: 1.17,
    replacementPatience: 0.96,
    anchorAggression: 1.38,
    depthAggression: 0.92,
  },
  {
    rbCoreBudget: {
      hardBudget: 152,
      minimumFutureCorePrice: 14,
    },
    rbSlotMaxBids: [76, 76, 76, 8, 4],
    rbDemandMultiplier: 1.34,
    priceAggression: 1.1,
    scarcityChase: 1.22,
    replacementPatience: 0.95,
    anchorAggression: 1.52,
    depthAggression: 0.9,
  },
  {
    rbCoreBudget: {
      hardBudget: 165,
      minimumFutureCorePrice: 22,
    },
    rbSlotMaxBids: [72, 68, 56, 8, 4],
    rbDemandMultiplier: 1.24,
    priceAggression: 1.06,
    scarcityChase: 1.18,
    replacementPatience: 0.97,
    anchorAggression: 1.34,
    depthAggression: 0.93,
  },
  {
    rbCoreBudget: {
      hardBudget: 148,
      minimumFutureCorePrice: 12,
    },
    rbSlotMaxBids: [78, 78, 78, 8, 4],
    rbDemandMultiplier: 1.32,
    priceAggression: 1.09,
    scarcityChase: 1.2,
    replacementPatience: 0.95,
    anchorAggression: 1.5,
    depthAggression: 0.89,
  },
  {
    rbCoreBudget: {
      hardBudget: 160,
      minimumFutureCorePrice: 18,
    },
    rbSlotMaxBids: [74, 74, 64, 8, 4],
    rbDemandMultiplier: 1.22,
    priceAggression: 1.05,
    scarcityChase: 1.16,
    replacementPatience: 0.97,
    anchorAggression: 1.3,
    depthAggression: 0.94,
  },
] as const;

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const threeRbAuctionVariantFor = (variantSeed: string | undefined): ThreeRbAuctionVariant =>
  variantSeed === undefined
    ? threeRbAuctionVariants[0]!
    : threeRbAuctionVariants[Math.floor(
      (hashString(variantSeed) / hashDivisor) * threeRbAuctionVariants.length,
    )] ?? threeRbAuctionVariants[0]!;

export const draftPlanStrategies = {
  "three-rb": {
    key: "three-rb",
    label: "True 3RB",
    thresholds: {
      rb1Minimum: threeRbPathRules.priceBands[0].minimumPrice,
      rb2Minimum: threeRbPathRules.priceBands[1].minimumPrice,
      rb3Minimum: threeRbPathRules.priceBands[2].minimumPrice,
      rbCoreSpendMinimum: threeRbPathRules.rbCoreBudget.minimumSpend,
    },
  },
} as const satisfies Record<DraftPlanStrategyKey, DraftPlanStrategyDefinition>;

export interface DraftPlanAuctionOverridesOptions {
  owner: Owner;
  strategyKey: DraftPlanStrategyKey;
  variantSeed?: string;
}

export const draftPlanAuctionOverridesFor = ({
  owner,
  strategyKey,
  variantSeed,
}: DraftPlanAuctionOverridesOptions): AuctionEngineConfigOverrides => {
  if (strategyKey !== "three-rb") return {};

  const variant = threeRbAuctionVariantFor(variantSeed);

  return {
    ownerDemandMultipliers: {
      [owner]: {
        QB: 0.55,
        RB: variant.rbDemandMultiplier,
        WR: 1.08,
        TE: 0.75,
      },
    },
    ownerBehaviors: {
      [owner]: {
        priceAggression: variant.priceAggression,
        scarcityChase: variant.scarcityChase,
        replacementPatience: variant.replacementPatience,
        anchorAggression: variant.anchorAggression,
        depthAggression: variant.depthAggression,
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
    ownerPositionCoreBudgetEnvelopes: {
      [owner]: {
        RB: {
          targetCount: threeRbPathRules.rbCoreBudget.targetCount,
          hardBudget: variant.rbCoreBudget.hardBudget,
          minimumFutureCorePrice: variant.rbCoreBudget.minimumFutureCorePrice,
        },
      },
    },
    ownerPositionSlotMaxBids: {
      [owner]: {
        RB: [...variant.rbSlotMaxBids],
        WR: [...(threeRbPathRules.slotMaxBids.WR ?? [])],
        TE: [...(threeRbPathRules.slotMaxBids.TE ?? [])],
        K: [...(threeRbPathRules.slotMaxBids.K ?? [])],
        DST: [...(threeRbPathRules.slotMaxBids.DST ?? [])],
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

const priceBandText = (band: Pick<DraftPlanPriceBand, "minimumPrice" | "maximumPrice">): string =>
  `$${band.minimumPrice}-$${band.maximumPrice}`;

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
  lineup: readonly LineupEntry[],
): boolean => {
  const [rb1, rb2, rb3] = rbCore;
  if (!rb1 || !rb2 || !rb3) return false;

  const startingRbCount = lineup.filter(entry => entry.player.position === "RB").length;

  return rb1.price >= strategy.thresholds.rb1Minimum &&
    rb2.price >= strategy.thresholds.rb2Minimum &&
    rb3.price >= strategy.thresholds.rb3Minimum &&
    rbCore.reduce((total, player) => total + player.price, 0) >= strategy.thresholds.rbCoreSpendMinimum &&
    startingRbCount >= threeRbPathRules.rbCoreBudget.targetCount;
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
  const optimizedLineup = optimizeLineup({ strategy: strategy.key, players: roster.players }, "weeks1To4");
  if (!qualifiesForThreeRb(rbCore, strategy, optimizedLineup)) return undefined;

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

const buildRecommendations = (candidates: readonly DraftPlanCandidate[]): DraftPlanRecommendations => {
  const topCandidate = candidates[0];
  const rbBands = threeRbPathRules.priceBands.filter(band => band.position === "RB");
  const wrBands = threeRbPathRules.priceBands.filter(band => band.position === "WR");
  const teBand = threeRbPathRules.priceBands.find(band => band.position === "TE");
  const targetClusters: DraftPlanTargetCluster[] = [];

  if (topCandidate) {
    targetClusters.push({
      label: "RB core",
      position: "RB",
      targetNames: topCandidate.rbCore.map(player => player.name),
      priceBand: rbBands.map(priceBandText).join(" / "),
      note: `The true 3RB build works when three startable RBs fit inside about $${threeRbPathRules.rbCoreBudget.minimumSpend}-$${threeRbPathRules.rbCoreBudget.hardBudget} of core RB spend.`,
    });

    const wrTargets = topCandidate.players
      .filter(player => player.position === "WR")
      .slice(0, 3)
      .map(player => player.name);
    if (wrTargets.length) {
      targetClusters.push({
        label: "WR values",
        position: "WR",
        targetNames: wrTargets,
        priceBand: wrBands.map(priceBandText).join(" / "),
        note: "Fill WR starters from the value pocket after the RB budget envelope is protected.",
      });
    }

    const teTargets = topCandidate.players
      .filter(player => player.position === "TE")
      .slice(0, 2)
      .map(player => player.name);
    if (teTargets.length && teBand) {
      targetClusters.push({
        label: "Cheap TE",
        position: "TE",
        targetNames: teTargets,
        priceBand: priceBandText(teBand),
        note: "Avoid paying up at TE unless the RB core came in under plan.",
      });
    }
  }

  return {
    maxPriceBands: threeRbPathRules.priceBands.map(band => ({ ...band })),
    targetClusters,
    pivotRules: threeRbPathRules.pivotRules.map(rule => ({ ...rule })),
    deadZoneWarnings: topCandidate ? [] : ["No sampled roster matched the true 3RB path."],
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
    recommendations: buildRecommendations(candidates),
    candidates: candidates.slice(0, limit),
  };
};
